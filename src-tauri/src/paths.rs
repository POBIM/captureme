//! Well-known directories.
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Where fresh captures (raw PNG) are stored; also the history store.
pub fn captures_dir(app: &AppHandle) -> PathBuf {
    let d = app.path().app_data_dir().expect("app data dir").join("captures");
    let _ = std::fs::create_dir_all(&d);
    d
}
pub fn config_file(app: &AppHandle) -> PathBuf {
    let d = app.path().app_config_dir().expect("app config dir");
    let _ = std::fs::create_dir_all(&d);
    d.join("settings.json")
}
pub fn temp_dir(app: &AppHandle) -> PathBuf {
    let d = app.path().app_cache_dir().expect("cache dir").join("tmp");
    let _ = std::fs::create_dir_all(&d);
    d
}
