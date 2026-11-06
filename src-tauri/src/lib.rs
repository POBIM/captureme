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
pub mod floating;
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
            capture::cleanup_stale(&handle);
            permissions::onboarding_if_needed(&handle);
            // ===== setup: Agent D may add init calls here =====
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ===== shared =====
            settings::get_settings,
            settings::save_settings,
            // ===== Agent A – capture core =====
            capture::overlay_info,
            capture::overlay_ready,
            capture::overlay_finish,
            capture::overlay_cancel,
            permissions::check_screen_permission,
            permissions::request_screen_permission,
            permissions::open_screen_permission_settings,
            permissions::onboarding_complete,
            permissions::relaunch_app,
            // ===== Agent C – tools (export/history/ocr/pin) =====
            export::copy_image_png,
            export::copy_image_file,
            export::save_image_png,
            export::save_image_file,
            export::copy_text,
            export::reveal_in_finder,
            history::history_list,
            history::history_delete,
            history::history_delete_many,
            history::history_clear,
            history::history_open,
            history::open_history_window,
            history::update_history_image,
            ocr::ocr_image_png,
            ocr::ocr_file,
            ocr::ocr_result_get,
            ocr::ocr_result_close,
            pin::pin_image_png,
            pin::pin_file,
            pin::pin_edit,
            // ===== Agent D – advanced (scroll/recording) =====
            scroll::scroll_status,
            scroll::scroll_done,
            scroll::scroll_cancel,
            scroll::scroll_set_auto,
            recording::recording_status,
            recording::recording_begin,
            recording::recording_stop,
            recording::recording_cancel,
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
