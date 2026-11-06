//! Settings persistence. Owner: Agent C (tools). Others read via `settings::get(app)`.
use crate::{paths, types::*};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

pub struct SettingsState(pub Mutex<Settings>);

fn same_accel(a: &str, b: &str) -> bool {
    a.trim().eq_ignore_ascii_case(b.trim())
}

/// Moves hotkeys that still hold the pre-v2 defaults (⌘⇧1-0, which collide with macOS' own
/// screenshot shortcuts) to the new defaults, and adds the new actions. Customised hotkeys are
/// kept; a new default that would collide with one of them is left disabled ("").
fn migrate_hotkeys(s: &mut Settings) {
    for (action, old) in LEGACY_HOTKEYS {
        if s.hotkeys.get(*action).map(|h| same_accel(h, old)).unwrap_or(false) {
            s.hotkeys.remove(*action);
        }
    }
    for (action, def) in DEFAULT_HOTKEYS {
        if s.hotkeys.contains_key(*action) {
            continue;
        }
        let clash = s.hotkeys.values().any(|h| same_accel(h, def));
        s.hotkeys.insert(action.to_string(), if clash { String::new() } else { def.to_string() });
    }
    s.hotkeys_version = HOTKEY_VERSION;
}

pub fn load(app: &AppHandle) -> Settings {
    let file = paths::config_file(app);
    let json: Option<serde_json::Value> = std::fs::read_to_string(&file).ok().and_then(|s| serde_json::from_str(&s).ok());
    let mut s: Settings = json.clone().and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default();
    let mut migrated = false;
    if let Some(v) = &json {
        // Settings written before `after_capture` existed: derive it from the old switch.
        if v.get("after_capture").is_none() {
            s.after_capture = if s.open_editor_after_capture { "editor".into() } else { "save".into() };
            migrated = true;
        }
        if v.get("hotkeys_version").is_none() {
            migrate_hotkeys(&mut s);
            migrated = true;
        }
    }
    // Fill actions that are missing from an older settings file with their defaults.
    for (k, v) in Settings::default().hotkeys {
        s.hotkeys.entry(k).or_insert(v);
    }
    if migrated {
        if let Ok(txt) = serde_json::to_string_pretty(&s) {
            let _ = std::fs::write(&file, txt);
        }
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
    s.after_capture = match s.after_capture.as_str() {
        "thumbnail" | "copy" | "save" => s.after_capture.clone(),
        _ => "editor".into(),
    };
    s.open_editor_after_capture = s.after_capture == "editor";
    s.thumbnail_seconds = s.thumbnail_seconds.min(120);
    s.color_format = match s.color_format.as_str() {
        "rgb" | "hsl" => s.color_format.clone(),
        _ => "hex".into(),
    };
    s.hotkeys_version = HOTKEY_VERSION;
    // Hotkeys: every default action must exist; accelerators must parse and be unique.
    // An empty accelerator means "disabled".
    for (k, v) in &defaults.hotkeys {
        s.hotkeys.entry(k.clone()).or_insert_with(|| v.clone());
    }
    let mut seen: std::collections::HashMap<String, String> = Default::default();
    let mut actions: Vec<_> = s.hotkeys.keys().cloned().collect();
    actions.sort();
    for action in actions {
        let acc = s.hotkeys[&action].trim().to_string();
        if acc.is_empty() {
            s.hotkeys.insert(action.clone(), String::new());
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

/// Modify the settings from Rust (validated, persisted, `settings-changed` emitted).
pub fn update(app: &AppHandle, f: impl FnOnce(&mut Settings)) -> CmdResult<()> {
    let mut s = get(app);
    f(&mut s);
    save_settings(app.clone(), s)
}

pub fn get(app: &AppHandle) -> Settings {
    app.state::<SettingsState>().0.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

/// Factory defaults (the settings page uses them for "reset hotkeys").
#[tauri::command]
pub fn default_settings() -> Settings {
    Settings::default()
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Settings {
    get(&app)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> CmdResult<()> {
    let settings = validate(settings)?;
    apply_autostart(&app, settings.launch_at_login);
    let file = paths::config_file(&app);
    let tmp = file.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(&settings).map_err(|e| AppError::Msg(e.to_string()))?;
    std::fs::write(&tmp, text)?;
    std::fs::rename(&tmp, &file)?; // atomic: a crash never leaves a half-written settings file
    *app.state::<SettingsState>().0.lock().unwrap_or_else(|e| e.into_inner()) = settings.clone();
    // Listeners (hotkeys, autostart, all windows for language) react to this event.
    let _ = app.emit("settings-changed", settings);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_old_default_hotkeys() {
        let mut s = Settings::default();
        s.hotkeys = LEGACY_HOTKEYS.iter().map(|(a, b)| (a.to_string(), b.to_string())).collect();
        s.hotkeys.insert("region".into(), "CmdOrCtrl+Alt+R".into()); // user customised
        s.hotkeys.insert("ocr".into(), "Ctrl+Shift+1".into()); // collides with the new fullscreen default
        migrate_hotkeys(&mut s);
        assert_eq!(s.hotkeys["region"], "CmdOrCtrl+Alt+R");
        assert_eq!(s.hotkeys["ocr"], "Ctrl+Shift+1");
        assert_eq!(s.hotkeys["fullscreen"], "", "clashing new default stays disabled");
        assert_eq!(s.hotkeys["window"], "Ctrl+Shift+3");
        assert_eq!(s.hotkeys["history"], "Ctrl+Shift+9");
        assert_eq!(s.hotkeys["color"], "Ctrl+Shift+C");
        assert_eq!(s.hotkeys_version, HOTKEY_VERSION);
        // the migrated set must validate (unique + parseable), empty = disabled
        let v = validate(s).unwrap();
        assert_eq!(v.hotkeys["fullscreen"], "");
    }

    #[test]
    fn defaults_validate_and_avoid_macos_shortcuts() {
        let v = validate(Settings::default()).unwrap();
        for (action, acc) in &v.hotkeys {
            assert!(!acc.starts_with("CmdOrCtrl+Shift+"), "{action} clashes with macOS screenshot keys");
        }
        assert_eq!(v.after_capture, "editor");
    }
}
