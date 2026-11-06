//! QR / barcode reader (Apple Vision `VNDetectBarcodesRequest`, fully offline). Owner: Agent E.
//! The payload is copied to the clipboard and shown in a small window; links are only opened
//! when the user clicks "Open" and confirms (see src/qr/main.ts).
use crate::{export, types::*};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Serialize)]
pub struct QrResult {
    pub payloads: Vec<String>,
    pub path: String,
}

/// Decode every barcode / QR code found in encoded image bytes. Blocking.
#[cfg(target_os = "macos")]
pub fn decode(image_bytes: &[u8]) -> Result<Vec<String>, String> {
    use objc2::rc::Retained;
    use objc2::AnyThread;
    use objc2_foundation::{NSArray, NSData, NSDictionary};
    use objc2_vision::{VNDetectBarcodesRequest, VNImageRequestHandler, VNRequest};

    let png = export::ensure_png(image_bytes.to_vec())?;
    objc2::rc::autoreleasepool(|_| {
        let data = NSData::with_bytes(&png);
        let options = NSDictionary::new();
        let handler = VNImageRequestHandler::initWithData_options(VNImageRequestHandler::alloc(), &data, &options);
        let request = unsafe { VNDetectBarcodesRequest::new() };
        let as_request: Retained<VNRequest> = Retained::into_super(Retained::into_super(request.clone()));
        let requests = NSArray::from_retained_slice(&[as_request]);
        handler.performRequests_error(&requests).map_err(|e| e.localizedDescription().to_string())?;
        let mut out: Vec<String> = Vec::new();
        if let Some(results) = unsafe { request.results() } {
            for obs in results.iter() {
                if let Some(s) = unsafe { obs.payloadStringValue() } {
                    let s = s.to_string();
                    if !s.is_empty() && !out.contains(&s) {
                        out.push(s);
                    }
                }
            }
        }
        Ok(out)
    })
}

#[cfg(not(target_os = "macos"))]
pub fn decode(_image_bytes: &[u8]) -> Result<Vec<String>, String> {
    Err("QR reading is only supported on macOS".into())
}

fn results() -> &'static Mutex<HashMap<String, QrResult>> {
    static R: OnceLock<Mutex<HashMap<String, QrResult>>> = OnceLock::new();
    R.get_or_init(|| Mutex::new(HashMap::new()))
}

fn lock() -> std::sync::MutexGuard<'static, HashMap<String, QrResult>> {
    results().lock().unwrap_or_else(|e| e.into_inner())
}

fn show_result_window(app: &AppHandle, res: QrResult) {
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        let label = format!("qr-{}", uuid::Uuid::new_v4().simple());
        lock().insert(label.clone(), res);
        let (w, h) = (420.0, 260.0);
        let mut b = WebviewWindowBuilder::new(&app2, &label, WebviewUrl::App(format!("qr.html?label={label}").into()))
            .title("CaptureME QR")
            .inner_size(w, h)
            .decorations(false)
            .transparent(true)
            .shadow(true)
            .always_on_top(true)
            .resizable(false)
            .skip_taskbar(true)
            .visible_on_all_workspaces(true)
            .focused(true);
        let mon = app2.cursor_position().ok().and_then(|p| app2.monitor_from_point(p.x, p.y).ok().flatten()).or_else(|| app2.primary_monitor().ok().flatten());
        if let Some(m) = mon {
            let sf = m.scale_factor();
            let pos = m.position().to_logical::<f64>(sf);
            let size = m.size().to_logical::<f64>(sf);
            b = b.position(pos.x + size.width - w - 16.0, pos.y + 40.0);
        }
        match b.build() {
            Ok(w) => crate::windows::float_over_fullscreen(&w),
            Err(e) => {
                log::warn!("qr result window: {e}");
                lock().remove(&label);
            }
        }
    });
}

/// Called by capture.rs after the user selects a region in overlay mode "qr".
pub fn run_on_image(app: &AppHandle, image_path: &str) {
    let app = app.clone();
    let path = image_path.to_string();
    std::thread::spawn(move || {
        let payloads = match std::fs::read(&path).map_err(|e| format!("{path}: {e}")).and_then(|b| decode(&b)) {
            Ok(p) => p,
            Err(e) => {
                log::warn!("QR decode failed: {e}");
                Vec::new()
            }
        };
        if !payloads.is_empty() {
            if let Err(e) = export::copy_text_to_clipboard(&payloads.join("\n")) {
                log::warn!("QR clipboard: {e}");
            }
        }
        show_result_window(&app, QrResult { payloads, path: path.clone() });
        let _ = std::fs::remove_file(&path);
    });
}

#[tauri::command]
pub fn qr_result_get(label: String) -> Option<QrResult> {
    lock().get(&label).cloned()
}

#[tauri::command]
pub fn qr_result_close(app: AppHandle, label: String) {
    lock().remove(&label);
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.close();
    }
}

/// Copy text to the clipboard (kept here so the QR page does not depend on other modules).
#[tauri::command]
pub fn qr_copy(text: String) -> CmdResult<()> {
    export::copy_text_to_clipboard(&text)?;
    Ok(())
}
