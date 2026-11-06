//! Settings persistence. Owner: Agent C (tools). Others read via `settings::get(app)`.
use crate::{paths, types::*};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

pub struct SettingsState(pub Mutex<Settings>);

pub fn load(app: &AppHandle) -> Settings {
    std::fs::read_to_string(paths::config_file(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn get(app: &AppHandle) -> Settings {
    app.state::<SettingsState>().0.lock().unwrap().clone()
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Settings {
    get(&app)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> CmdResult<()> {
    std::fs::write(paths::config_file(&app), serde_json::to_string_pretty(&settings).unwrap())?;
    *app.state::<SettingsState>().0.lock().unwrap() = settings.clone();
    // Listeners (hotkeys, autostart, all windows for language) react to this event.
    let _ = app.emit("settings-changed", settings);
    Ok(())
}
