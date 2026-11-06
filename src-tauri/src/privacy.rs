//! "Remove all CaptureME data" (uninstall helper). Owner: Agent E.
//! Deletes captures, history, colours, settings, caches and the web view's local storage, turns
//! off launch-at-login and quits. Files the user saved to their own folders are never touched.
use crate::types::*;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn data_dirs(app: &AppHandle) -> Vec<PathBuf> {
    let p = app.path();
    let mut v: Vec<PathBuf> = [p.app_data_dir(), p.app_config_dir(), p.app_local_data_dir(), p.app_cache_dir(), p.app_log_dir()]
        .into_iter()
        .flatten()
        .collect();
    let id = app.config().identifier.clone();
    if let Some(home) = dirs::home_dir() {
        v.push(home.join("Library/WebKit").join(&id));
        v.push(home.join("Library/HTTPStorages").join(&id));
        v.push(home.join("Library/Saved Application State").join(format!("{id}.savedState")));
        v.push(home.join("Library/Preferences").join(format!("{id}.plist")));
    }
    v.sort();
    v.dedup();
    v
}

/// Delete everything the app stores. Returns the number of locations removed.
pub fn wipe(app: &AppHandle) -> usize {
    use tauri_plugin_autostart::ManagerExt;
    let _ = app.autolaunch().disable();
    let mut n = 0;
    for d in data_dirs(app) {
        let r = if d.is_dir() { std::fs::remove_dir_all(&d) } else { std::fs::remove_file(&d) };
        match r {
            Ok(()) => n += 1,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => log::warn!("cannot remove {}: {e}", d.display()),
        }
    }
    n
}

/// Wipe all app data, then quit (so nothing is re-created). The UI asks for confirmation first.
#[tauri::command]
pub fn remove_all_data(app: AppHandle) -> CmdResult<()> {
    let n = wipe(&app);
    log::info!("removed {n} data locations");
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}
