//! Helpers for the small always-on-top windows used by scrolling capture and recording.
//! Owner: Agent D.
use crate::types::SelectionRect;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// Global logical rect (x, y, w, h) of a selection.
pub fn global_rect(r: &SelectionRect) -> (f64, f64, f64, f64) {
    (r.monitor_x + r.x, r.monitor_y + r.y, r.width, r.height)
}

/// Global logical bounds (x, y, w, h) of the monitor of the selection.
pub fn monitor_bounds(r: &SelectionRect) -> (f64, f64, f64, f64) {
    if let Ok(list) = xcap::Monitor::all() {
        for m in list {
            if m.id().ok() == Some(r.monitor_id) {
                if let (Ok(x), Ok(y), Ok(w), Ok(h)) = (m.x(), m.y(), m.width(), m.height()) {
                    return (x as f64, y as f64, w as f64, h as f64);
                }
            }
        }
    }
    (r.monitor_x, r.monitor_y, 100_000.0, 100_000.0)
}

#[derive(Clone, Copy, PartialEq)]
pub enum Side {
    Below,
    Above,
    Right,
    Left,
}

/// Choose a top-left position for a `bw` x `bh` window next to the selection, never overlapping
/// it when possible. Falls back to the inside bottom-centre of the region.
pub fn place(r: &SelectionRect, bw: f64, bh: f64, order: &[Side]) -> (f64, f64) {
    let (gx, gy, w, h) = global_rect(r);
    let (mx, my, mw, mh) = monitor_bounds(r);
    let gap = 10.0;
    let top_safe = my + 34.0; // menu bar
    let clamp_x = |x: f64| x.max(mx + 4.0).min(mx + mw - bw - 4.0);
    let clamp_y = |y: f64| y.max(top_safe).min(my + mh - bh - 4.0);
    for s in order {
        match s {
            Side::Below if gy + h + gap + bh <= my + mh - 4.0 => return (clamp_x(gx + (w - bw) / 2.0), gy + h + gap),
            Side::Above if gy - gap - bh >= top_safe => return (clamp_x(gx + (w - bw) / 2.0), gy - gap - bh),
            Side::Right if gx + w + gap + bw <= mx + mw - 4.0 => return (gx + w + gap, clamp_y(gy)),
            Side::Left if gx - gap - bw >= mx + 4.0 => return (gx - gap - bw, clamp_y(gy)),
            _ => {}
        }
    }
    (clamp_x(gx + (w - bw) / 2.0), clamp_y(gy + h - bh - gap))
}

/// Hide a window from screenshots / screen recordings (NSWindowSharingNone).
pub fn exclude_from_capture(app: &AppHandle, win: &WebviewWindow) {
    #[cfg(target_os = "macos")]
    if let Ok(ptr) = win.ns_window() {
        let addr = ptr as usize;
        let _ = app.run_on_main_thread(move || unsafe {
            let obj = addr as *mut objc2::runtime::AnyObject;
            let _: () = objc2::msg_send![obj, setSharingType: 0usize];
        });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, win);
}

/// Small frameless floating panel.
#[allow(clippy::too_many_arguments)]
pub fn open_panel(app: &AppHandle, label: &str, url: &str, pos: (f64, f64), size: (f64, f64), focused: bool) -> tauri::Result<WebviewWindow> {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.destroy();
    }
    let win = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("CaptureME")
        .inner_size(size.0, size.1)
        .position(pos.0, pos.1)
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .focused(focused)
        .build()?;
    exclude_from_capture(app, &win);
    Ok(win)
}

/// Thin click-through border drawn just outside the selection. `kind` = "rec" | "scroll".
pub fn open_border(app: &AppHandle, label: &str, page: &str, kind: &str, r: &SelectionRect) -> tauri::Result<WebviewWindow> {
    const PAD: f64 = 4.0;
    let (gx, gy, w, h) = global_rect(r);
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.destroy();
    }
    let win = WebviewWindowBuilder::new(app, label, WebviewUrl::App(format!("{page}.html?mode=border&kind={kind}").into()))
        .title("CaptureME")
        .inner_size(w + PAD * 2.0, h + PAD * 2.0)
        .position(gx - PAD, gy - PAD)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .focused(false)
        .build()?;
    let _ = win.set_ignore_cursor_events(true);
    exclude_from_capture(app, &win);
    Ok(win)
}

pub fn close(app: &AppHandle, label: &str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.destroy();
    }
}

/// Resolve the user's save directory (creating it). Falls back to ~/Pictures/CaptureME.
pub fn save_dir(app: &AppHandle) -> std::path::PathBuf {
    let s = crate::settings::get(app);
    let raw = s.save_dir.trim();
    let mut dir = if let Some(rest) = raw.strip_prefix("~/") {
        dirs::home_dir().map(|h| h.join(rest)).unwrap_or_default()
    } else {
        std::path::PathBuf::from(raw)
    };
    if dir.as_os_str().is_empty() {
        dir = dirs::picture_dir().unwrap_or_else(|| std::path::PathBuf::from(".")).join("CaptureME");
    }
    if std::fs::create_dir_all(&dir).is_err() {
        dir = dirs::picture_dir().unwrap_or_else(|| std::path::PathBuf::from(".")).join("CaptureME");
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

/// `<pattern> <suffix>.<ext>` inside the save dir, unique.
pub fn unique_path(app: &AppHandle, suffix: &str, ext: &str) -> std::path::PathBuf {
    let s = crate::settings::get(app);
    let now = chrono::Local::now();
    let base = s
        .filename_pattern
        .replace("{date}", &now.format("%Y-%m-%d").to_string())
        .replace("{time}", &now.format("%H.%M.%S").to_string())
        .replace("{n}", "");
    let base: String = base.chars().map(|c| if matches!(c, '/' | '\\' | ':' | '\0') { '-' } else { c }).collect();
    let base = format!("{} {}", base.trim(), suffix);
    let dir = save_dir(app);
    let mut p = dir.join(format!("{base}.{ext}"));
    let mut n = 2;
    while p.exists() {
        p = dir.join(format!("{base} ({n}).{ext}"));
        n += 1;
    }
    p
}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Native error dialog in the user's language.
pub fn alert(app: &AppHandle, th: &str, en: &str, detail: &str) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
    let thai = crate::settings::get(app).language == "th";
    let head = if thai { th } else { en };
    let msg = if detail.trim().is_empty() { head.to_string() } else { format!("{head}\n\n{}", detail.trim()) };
    app.dialog().message(msg).title("CaptureME").kind(MessageDialogKind::Error).show(|_| {});
}
