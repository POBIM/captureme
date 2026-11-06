//! Helpers to open the app's windows. Shared by all modules – append new helpers, don't rename.
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

fn enc(s: &str) -> String {
    // minimal percent-encoding for query values
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => (b as char).to_string(),
            _ => format!("%{:02X}", b),
        })
        .collect()
}

/// Open (or focus) a normal app window for `page` (= `<page>.html`).
pub fn open_page(app: &AppHandle, label: &str, page: &str, query: &str, title: &str, w: f64, h: f64) -> tauri::Result<WebviewWindow> {
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(win);
    }
    let url = if query.is_empty() { format!("{page}.html") } else { format!("{page}.html?{query}") };
    let win = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title(title)
        .inner_size(w, h)
        .center()
        .focused(true)
        .build()?;
    Ok(win)
}

/// Open the annotation editor for an image file (each capture gets its own window).
pub fn open_editor(app: &AppHandle, image_path: &str) -> tauri::Result<WebviewWindow> {
    let label = format!("editor-{}", uuid::Uuid::new_v4().simple());
    let win = open_page(app, &label, "editor", &format!("path={}", enc(image_path)), "CaptureME Editor", 1100.0, 760.0)?;
    let _ = win.set_focus();
    Ok(win)
}

pub fn open_settings(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    open_page(app, "settings", "settings", "", "CaptureME Settings", 720.0, 560.0)
}

pub fn open_history(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    open_page(app, "history", "history", "", "CaptureME History", 960.0, 640.0)
}

pub fn open_onboarding(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    open_page(app, "onboarding", "onboarding", "", "Welcome to CaptureME", 560.0, 520.0)
}

pub fn url_encode(s: &str) -> String {
    enc(s)
}

/// Open the editor for an image that belongs to a history entry (`id` = CaptureResult id).
pub fn open_editor_with_id(app: &AppHandle, image_path: &str, id: &str) -> tauri::Result<WebviewWindow> {
    let label = format!("editor-{}", uuid::Uuid::new_v4().simple());
    let q = format!("path={}&id={}", enc(image_path), enc(id));
    let win = open_page(app, &label, "editor", &q, "CaptureME Editor", 1100.0, 760.0)?;
    let _ = win.set_focus();
    Ok(win)
}
