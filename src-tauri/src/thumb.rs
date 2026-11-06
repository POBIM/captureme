//! Floating post-capture thumbnail (bottom-right, like macOS) with quick actions.
//! The window is `thumb.html`; the image can be dragged straight into Finder / other apps.
//! Owner: Agent E.
use crate::{export, floating, paths, settings, types::*};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const LABEL: &str = "thumb";
/// Generation counter: the watchdog below only closes the thumbnail it was created for.
static GEN: AtomicU64 = AtomicU64::new(0);
const IMG_MAX: (f64, f64) = (264.0, 168.0);
const BAR_H: f64 = 38.0;
const PAD: f64 = 8.0;
/// Room for the five action buttons even when the screenshot itself is narrow.
const MIN_W: f64 = 196.0;
const MARGIN: f64 = 18.0;

/// Show the thumbnail for a fresh capture (replaces a previous one).
pub fn show(app: &AppHandle, res: &CaptureResult) {
    let (app, res) = (app.clone(), res.clone());
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        let app = app2;
        if let Some(w) = app.get_webview_window(LABEL) {
            let _ = w.destroy();
        }
        let k = (IMG_MAX.0 / res.width.max(1) as f64).min(IMG_MAX.1 / res.height.max(1) as f64).min(1.0).max(0.05);
        let (iw, ih) = ((res.width as f64 * k).round().max(60.0), (res.height as f64 * k).round().max(40.0));
        let (w, h) = ((iw + PAD * 2.0).max(MIN_W), ih + BAR_H + PAD * 2.0);
        let secs = settings::get(&app).thumbnail_seconds;
        let query = format!(
            "path={}&id={}&secs={}&iw={}&ih={}",
            crate::windows::url_encode(&res.path),
            crate::windows::url_encode(&res.id),
            secs,
            iw,
            ih
        );
        let mut b = WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::App(format!("thumb.html?{query}").into()))
            .title("CaptureME")
            .inner_size(w, h)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .resizable(false)
            .skip_taskbar(true)
            .visible_on_all_workspaces(true)
            .accept_first_mouse(true)
            .focused(false);
        let mon = app.cursor_position().ok().and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten()).or_else(|| app.primary_monitor().ok().flatten());
        if let Some(m) = mon {
            let sf = m.scale_factor();
            let wa = m.work_area();
            let pos = wa.position.to_logical::<f64>(sf);
            let size = wa.size.to_logical::<f64>(sf);
            b = b.position(pos.x + size.width - w - MARGIN, pos.y + size.height - h - MARGIN);
        }
        match b.build() {
            Ok(win) => {
                crate::windows::float_over_fullscreen(&win);
                floating::exclude_from_capture(&app, &win);
                // Safety net: the page dismisses itself, but never leave a window behind if it did not.
                let gen = GEN.fetch_add(1, Ordering::SeqCst) + 1;
                if secs > 0 {
                    let app3 = app.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(secs as u64 + 180));
                        if GEN.load(Ordering::SeqCst) == gen {
                            if let Some(w) = app3.get_webview_window(LABEL) {
                                let _ = w.destroy();
                            }
                        }
                    });
                }
            }
            Err(e) => log::error!("thumbnail window: {e}"),
        }
    });
}

/// Start a native drag of the capture (as a nicely named PNG) out of the thumbnail window.
#[tauri::command]
pub fn thumb_drag(window: WebviewWindow, app: AppHandle, path: String) -> CmdResult<()> {
    let s = settings::get(&app);
    // Drag a copy named after the user's filename pattern instead of "capture-2025…-ab12cd34.png".
    let dir = paths::temp_dir(&app).join(format!("drag-{}", uuid::Uuid::new_v4().simple()));
    std::fs::create_dir_all(&dir)?;
    let name = format!("{}.png", export::expand_pattern(&s.filename_pattern, None));
    let dst = dir.join(name);
    std::fs::copy(&path, &dst)?;
    // Small drag preview (the real image can be huge).
    let preview = dir.join("preview.png");
    let small = image::open(&path).map_err(|e| AppError::Msg(e.to_string()))?.thumbnail(160, 160);
    small.save(&preview).map_err(|e| AppError::Msg(e.to_string()))?;
    let win = window.clone();
    drag::start_drag(
        &window,
        drag::DragItem::Files(vec![dst.clone()]),
        drag::Image::File(preview),
        move |result, _pos| {
            if matches!(result, drag::DragResult::Dropped) {
                let _ = win.close();
            }
        },
        drag::Options::default(),
    )
    .map_err(|e| AppError::Msg(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn thumb_close(app: AppHandle) {
    if let Some(w) = app.get_webview_window(LABEL) {
        let _ = w.close();
    }
}
