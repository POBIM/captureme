//! Pin-to-screen floating windows. Owner: Agent C.
use crate::{export, paths, types::*, windows};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Logical size for a pin: pixels / scale, capped to 90% of the monitor, aspect preserved.
fn pin_size(app: &AppHandle, px_w: u32, px_h: u32) -> (f64, f64, Option<(f64, f64, f64, f64)>) {
    let mon = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    let (scale, area) = match &mon {
        Some(m) => {
            let sf = m.scale_factor().max(1.0);
            let pos = m.position().to_logical::<f64>(sf);
            let size = m.size().to_logical::<f64>(sf);
            (sf, Some((pos.x, pos.y, size.width, size.height)))
        }
        None => (2.0, None),
    };
    let mut w = px_w as f64 / scale;
    let mut h = px_h as f64 / scale;
    if let Some((_, _, mw, mh)) = area {
        let k = (mw * 0.9 / w).min(mh * 0.9 / h).min(1.0);
        w *= k;
        h *= k;
    }
    (w.max(48.0).round(), h.max(48.0).round(), area)
}

/// Make the pin follow the user across Spaces and sit above full-screen apps.
#[cfg(target_os = "macos")]
fn tune_ns_window(win: &tauri::WebviewWindow) {
    use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
    if let Ok(ptr) = win.ns_window() {
        unsafe {
            let w: &NSWindow = &*(ptr as *const NSWindow);
            w.setCollectionBehavior(
                NSWindowCollectionBehavior::CanJoinAllSpaces | NSWindowCollectionBehavior::FullScreenAuxiliary | NSWindowCollectionBehavior::IgnoresCycle,
            );
            w.setHidesOnDeactivate(false);
        }
    }
}

/// Open a borderless always-on-top window showing `image_path`.
pub fn open_pin(app: &AppHandle, image_path: &str) {
    let app = app.clone();
    let path = image_path.to_string();
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        let app = app2;
        let (pw, ph) = match image::image_dimensions(&path) {
            Ok(d) => d,
            Err(e) => {
                log::warn!("pin: cannot read {path}: {e}");
                return;
            }
        };
        let (w, h, area) = pin_size(&app, pw, ph);
        let label = format!("pin-{}", uuid::Uuid::new_v4().simple());
        let query = format!("path={}&pw={}&ph={}", windows::url_encode(&path), pw, ph);
        let mut b = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(format!("pin.html?{query}").into()))
            .title("CaptureME Pin")
            .inner_size(w, h)
            .min_inner_size(48.0, 48.0)
            .decorations(false)
            .transparent(true)
            .shadow(true)
            .always_on_top(true)
            .resizable(true)
            .skip_taskbar(true)
            .visible_on_all_workspaces(true)
            .focused(true);
        if let Some((ax, ay, aw, ah)) = area {
            // Cascade a little so several pins don't sit exactly on top of each other.
            let n = app.webview_windows().keys().filter(|k| k.starts_with("pin-")).count() as f64;
            let off = (n % 8.0) * 24.0;
            b = b.position(ax + (aw - w) / 2.0 + off, ay + (ah - h) / 2.0 + off);
        } else {
            b = b.center();
        }
        match b.build() {
            Ok(win) => {
                #[cfg(target_os = "macos")]
                tune_ns_window(&win);
                let _ = win.set_focus();
            }
            Err(e) => log::warn!("pin window: {e}"),
        }
    });
}

#[tauri::command]
pub async fn pin_image_png(app: AppHandle, png_base64: String) -> CmdResult<()> {
    let bytes = export::ensure_png(export::decode_b64(&png_base64)?)?;
    let p = paths::temp_dir(&app).join(format!("pin-{}.png", uuid::Uuid::new_v4().simple()));
    std::fs::write(&p, bytes)?;
    open_pin(&app, &p.to_string_lossy());
    Ok(())
}

#[tauri::command]
pub async fn pin_file(app: AppHandle, path: String) -> CmdResult<()> {
    if !std::path::Path::new(&path).exists() {
        return Err(AppError::Msg(format!("{path}: no such file")));
    }
    open_pin(&app, &path);
    Ok(())
}

/// Open the pinned image in the editor and close the pin.
#[tauri::command]
pub fn pin_edit(app: AppHandle, label: String, path: String) -> CmdResult<()> {
    windows::open_editor(&app, &path).map_err(|e| AppError::Msg(e.to_string()))?;
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.close();
    }
    Ok(())
}
