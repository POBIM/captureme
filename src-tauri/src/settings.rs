//! Settings persistence. Owner: Agent C (tools). Others read via `settings::get(app)`.
use crate::{paths, types::*};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

pub struct SettingsState(pub Mutex<Settings>);

pub fn load(app: &AppHandle) -> Settings {
    let mut s: Settings = std::fs::read_to_string(paths::config_file(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    // Fill actions that are missing from an older settings file with their defaults.
    for (k, v) in Settings::default().hotkeys {
        s.hotkeys.entry(k).or_insert(v);
    }
    s
}

/// Normalise + validate user supplied settings. Returns a human readable error on invalid input.
pub fn validate(mut s: Settings) -> Result<Settings, String> {
    let defaults = Settings::default();
    if s.language != "th" && s.language != "en" {
        s.language = defaults.language.clone();
    }
    s.image_format = match s.image_format.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "jpg".into(),
        "webp" => "webp".into(),
        _ => "png".into(),
    };
    s.jpg_quality = s.jpg_quality.clamp(1, 100);
    s.history_limit = s.history_limit.clamp(1, 10_000);
    s.save_dir = s.save_dir.trim().to_string();
    if s.save_dir.is_empty() {
        s.save_dir = defaults.save_dir.clone();
    }
    s.filename_pattern = s.filename_pattern.trim().to_string();
    if s.filename_pattern.is_empty() {
        s.filename_pattern = defaults.filename_pattern.clone();
    }
    // Hotkeys: every default action must exist; accelerators must parse and be unique.
    for (k, v) in &defaults.hotkeys {
        s.hotkeys.entry(k.clone()).or_insert_with(|| v.clone());
    }
    let mut seen: std::collections::HashMap<String, String> = Default::default();
    let mut actions: Vec<_> = s.hotkeys.keys().cloned().collect();
    actions.sort();
    for action in actions {
        let acc = s.hotkeys[&action].trim().to_string();
        if acc.is_empty() {
            let d = defaults.hotkeys.get(&action).cloned().unwrap_or_default();
            s.hotkeys.insert(action.clone(), d);
            continue;
        }
        let parsed = acc
            .parse::<tauri_plugin_global_shortcut::Shortcut>()
            .map_err(|e| format!("invalid shortcut \"{acc}\" for {action}: {e}"))?;
        let key = format!("{:?}", parsed.id());
        if let Some(other) = seen.insert(key, action.clone()) {
            return Err(format!("shortcut {acc} is used by both {other} and {action}"));
        }
        s.hotkeys.insert(action, acc);
    }
    Ok(s)
}

fn apply_autostart(app: &AppHandle, enable: bool) {
    use tauri_plugin_autostart::ManagerExt;
    let mgr = app.autolaunch();
    let current = mgr.is_enabled().unwrap_or(false);
    if current != enable {
        let r = if enable { mgr.enable() } else { mgr.disable() };
        if let Err(e) = r {
            log::warn!("autostart {}: {e}", if enable { "enable" } else { "disable" });
        }
    }
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
    let settings = validate(settings)?;
    apply_autostart(&app, settings.launch_at_login);
    std::fs::write(paths::config_file(&app), serde_json::to_string_pretty(&settings).unwrap())?;
    *app.state::<SettingsState>().0.lock().unwrap() = settings.clone();
    // Listeners (hotkeys, autostart, all windows for language) react to this event.
    let _ = app.emit("settings-changed", settings);
    Ok(())
}
