//! Clipboard / save to disk. Owner: Agent C.
use tauri::AppHandle;

/// Copy a PNG file to the clipboard as an image.
pub fn copy_file_to_clipboard(_app: &AppHandle, _image_path: &str) -> Result<(), String> { Ok(()) }
/// Save a PNG file into the user's save dir using settings (format/pattern). Returns final path.
pub fn save_file_auto(_app: &AppHandle, _image_path: &str) -> Result<String, String> { Ok(String::new()) }
