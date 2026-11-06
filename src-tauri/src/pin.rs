//! Pin-to-screen floating windows. Owner: Agent C.
use tauri::AppHandle;

/// Open a borderless always-on-top window showing `image_path`.
pub fn open_pin(_app: &AppHandle, _image_path: &str) {}
