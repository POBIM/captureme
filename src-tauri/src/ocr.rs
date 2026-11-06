//! OCR via Apple Vision. Owner: Agent C.
use crate::{export, types::*};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Serialize)]
pub struct OcrResult {
    pub text: String,
    pub path: String,
}

/// Recognise text in encoded image bytes (PNG/JPEG/...). Runs synchronously – call off the main thread.
#[cfg(target_os = "macos")]
pub fn recognize(image_bytes: &[u8]) -> Result<String, String> {
    use objc2::rc::Retained;
    use objc2::AnyThread;
    use objc2_foundation::{NSArray, NSData, NSDictionary, NSString};
    use objc2_vision::{VNImageRequestHandler, VNRecognizeTextRequest, VNRequest, VNRequestTextRecognitionLevel};

    // Make sure Vision gets something it understands (also normalises weird colour spaces).
    let png = export::ensure_png(image_bytes.to_vec())?;
    objc2::rc::autoreleasepool(|_| {
        let data = NSData::with_bytes(&png);
        let options = NSDictionary::new();
        let handler = VNImageRequestHandler::initWithData_options(VNImageRequestHandler::alloc(), &data, &options);

        let request = VNRecognizeTextRequest::new();
        request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
        request.setUsesLanguageCorrection(true);

        // Ask for Thai + English, but only for languages this OS revision supports.
        let wanted = ["th-TH", "en-US"];
        let supported: Vec<String> = unsafe { request.supportedRecognitionLanguagesAndReturnError() }
            .map(|arr| arr.iter().map(|s| s.to_string()).collect())
            .unwrap_or_default();
        let langs: Vec<Retained<NSString>> = wanted.iter().filter(|l| supported.iter().any(|s| s == *l)).map(|l| NSString::from_str(l)).collect();
        if !langs.is_empty() {
            let arr = NSArray::from_retained_slice(&langs);
            request.setRecognitionLanguages(&arr);
        } else {
            log::warn!("OCR: th-TH / en-US not reported as supported ({supported:?}); using Vision defaults");
        }

        let as_request: Retained<VNRequest> = Retained::into_super(Retained::into_super(request.clone()));
        let requests = NSArray::from_retained_slice(&[as_request]);
        handler.performRequests_error(&requests).map_err(|e| e.localizedDescription().to_string())?;

        let mut lines: Vec<String> = Vec::new();
        if let Some(results) = request.results() {
            for obs in results.iter() {
                let cands = obs.topCandidates(1);
                if let Some(c) = cands.iter().next() {
                    let line = c.string().to_string();
                    if !line.trim().is_empty() {
                        lines.push(line);
                    }
                }
            }
        }
        Ok(lines.join("\n"))
    })
}

#[cfg(not(target_os = "macos"))]
pub fn recognize(_image_bytes: &[u8]) -> Result<String, String> {
    Err("OCR is only supported on macOS".into())
}

fn results() -> &'static Mutex<HashMap<String, OcrResult>> {
    static R: OnceLock<Mutex<HashMap<String, OcrResult>>> = OnceLock::new();
    R.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Show a small always-on-top toast window (`ocr.html`) with the recognised text.
fn show_result_window(app: &AppHandle, res: OcrResult) {
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        let label = format!("ocr-{}", uuid::Uuid::new_v4().simple());
        results().lock().unwrap().insert(label.clone(), res);
        let (w, h) = (400.0, 230.0);
        let mut b = WebviewWindowBuilder::new(&app2, &label, WebviewUrl::App(format!("ocr.html?label={label}").into()))
            .title("CaptureME OCR")
            .inner_size(w, h)
            .decorations(false)
            .transparent(true)
            .shadow(true)
            .always_on_top(true)
            .resizable(true)
            .skip_taskbar(true)
            .visible_on_all_workspaces(true)
            .focused(false);
        // Top-right corner of the monitor under the cursor / primary monitor.
        let mon = app2.cursor_position().ok().and_then(|p| app2.monitor_from_point(p.x, p.y).ok().flatten()).or_else(|| app2.primary_monitor().ok().flatten());
        if let Some(m) = mon {
            let sf = m.scale_factor();
            let pos = m.position().to_logical::<f64>(sf);
            let size = m.size().to_logical::<f64>(sf);
            b = b.position(pos.x + size.width - w - 16.0, pos.y + 40.0);
        }
        if let Err(e) = b.build() {
            log::warn!("ocr result window: {e}");
            results().lock().unwrap().remove(&label);
        }
    });
}

/// Called by capture.rs after the user selects a region in overlay mode "ocr".
/// `image_path` is a cropped PNG. Should recognise text (th + en), copy it to clipboard, notify user.
pub fn run_on_image(app: &AppHandle, image_path: &str) {
    let app = app.clone();
    let path = image_path.to_string();
    std::thread::spawn(move || {
        let r = std::fs::read(&path).map_err(|e| format!("{path}: {e}")).and_then(|b| recognize(&b));
        let text = match r {
            Ok(t) => t,
            Err(e) => {
                log::warn!("OCR failed: {e}");
                let _ = app.emit("ocr-error", e);
                String::new()
            }
        };
        if !text.is_empty() {
            if let Err(e) = export::copy_text_to_clipboard(&text) {
                log::warn!("OCR clipboard: {e}");
            }
        }
        let res = OcrResult { text, path };
        let _ = app.emit("ocr-result", res.clone());
        show_result_window(&app, res);
    });
}

// ---------------------------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------------------------

#[tauri::command]
pub async fn ocr_image_png(png_base64: String) -> CmdResult<String> {
    let bytes = export::decode_b64(&png_base64)?;
    tauri::async_runtime::spawn_blocking(move || recognize(&bytes))
        .await
        .map_err(|e| AppError::Msg(e.to_string()))?
        .map_err(Into::into)
}

#[tauri::command]
pub async fn ocr_file(path: String) -> CmdResult<String> {
    let bytes = std::fs::read(&path)?;
    tauri::async_runtime::spawn_blocking(move || recognize(&bytes))
        .await
        .map_err(|e| AppError::Msg(e.to_string()))?
        .map_err(Into::into)
}

/// Text for an OCR result window (called by `ocr.html`).
#[tauri::command]
pub fn ocr_result_get(label: String) -> Option<OcrResult> {
    results().lock().unwrap().get(&label).cloned()
}

/// Called by `ocr.html` when it closes itself.
#[tauri::command]
pub fn ocr_result_close(app: AppHandle, label: String) {
    results().lock().unwrap().remove(&label);
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.close();
    }
}

#[cfg(test)]
mod tests {
    #[test]
    #[ignore = "needs /tmp/ocrtest.png"]
    fn recognise_sample() {
        let bytes = std::fs::read("/tmp/ocrtest.png").unwrap();
        let text = super::recognize(&bytes).unwrap();
        println!("OCR => {text:?}");
        assert!(text.contains("Hello"));
    }
}
