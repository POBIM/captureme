//! CaptureME – app entry. Module ownership is documented in AGENTS.md.
//! When adding commands, ONLY add lines inside your own section of `generate_handler!`.

pub mod paths;
pub mod settings;
pub mod types;
pub mod windows;

// Agent A – capture core
pub mod capture;
pub mod hotkey;
pub mod permissions;
pub mod tray;
// Agent C – tools
pub mod export;
pub mod history;
pub mod ocr;
pub mod pin;
// Agent D – advanced capture
pub mod recording;
pub mod scroll;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            let s = settings::load(&handle);
            app.manage(settings::SettingsState(Mutex::new(s)));

            tray::init(&handle)?;
            hotkey::init(&handle)?;
            // ===== setup: Agent A may add permission/onboarding checks here =====
            // ===== setup: Agent D may add init calls here =====
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ===== shared =====
            settings::get_settings,
            settings::save_settings,
            // ===== Agent A – capture core =====
            // ===== Agent C – tools (export/history/ocr/pin) =====
            // ===== Agent D – advanced (scroll/recording) =====
        ])
        .build(tauri::generate_context!())
        .expect("error while building CaptureME")
        .run(|_app, event| {
            // Keep running in the menu bar when all windows are closed.
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
