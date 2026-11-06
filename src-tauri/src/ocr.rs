//! OCR via Apple Vision. Owner: Agent C.
use tauri::AppHandle;

/// Called by capture.rs after the user selects a region in overlay mode "ocr".
/// `image_path` is a cropped PNG. Should recognise text (th + en), copy it to clipboard, notify user.
pub fn run_on_image(_app: &AppHandle, _image_path: &str) {}
