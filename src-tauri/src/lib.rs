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
// Agent H – video recording / video window
pub mod video;
// Agent E – review + new capture tools
pub mod colors;
pub mod import;
pub mod privacy;
pub mod qr;
pub mod thumb;
// Demo driver for the marketing captures – debug builds + CAPTUREME_DEMO only (see demo.rs)
pub mod demo;

use std::sync::Mutex;
use tauri::Manager;

/// Minimal stderr logger (no extra crates; nothing is written to disk or sent anywhere).
struct StderrLogger;
impl log::Log for StderrLogger {
    fn enabled(&self, m: &log::Metadata) -> bool {
        m.level() <= log::Level::Info
    }
    fn log(&self, r: &log::Record) {
        if self.enabled(r.metadata()) && r.target().starts_with("captureme") {
            eprintln!("[{}] {}: {}", r.level(), r.target(), r.args());
        }
    }
    fn flush(&self) {}
}
static LOGGER: StderrLogger = StderrLogger;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = log::set_logger(&LOGGER).map(|()| log::set_max_level(log::LevelFilter::Info));
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
            let demo_mode = demo::init(&handle); // false in release builds
            if !demo_mode {
                hotkey::init(&handle)?;
            }
            // ===== setup: Agent A may add permission/onboarding checks here =====
            capture::cleanup_stale(&handle);
            if !demo_mode {
                permissions::onboarding_if_needed(&handle);
            }
            // ===== setup: Agent D may add init calls here =====
            #[cfg(debug_assertions)]
            recording::debug_autotest(&handle);
            Ok(())
        })
        // ===== Agent E: images dropped onto a window become readable by that webview (asset scope is strict) =====
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                for p in paths.iter().filter(|p| windows::is_image_path(p)) {
                    windows::allow_asset(window.app_handle(), &p.to_string_lossy());
                }
            }
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
            // ===== Agent H – video recording / video window =====
            recording::recording_pause,
            recording::recording_camera,
            recording::recording_keys_access,
            recording::recording_mic_status,
            recording::recording_keys_request,
            recording::recording_options_get,
            recording::recording_options_save,
            recording::recording_default_dir,
            video::video_open,
            video::video_probe,
            video::video_thumbs,
            video::video_export_mp4,
            video::video_export_gif,
            video::video_copy_file,
            video::video_trash,
            video::recordings_list,
            video::recordings_remove,
            video::recordings_open_folder,
            // ===== Agent E – new tools (measure/colour/QR/thumbnail/import/privacy) =====
            settings::default_settings,
            windows::allow_image_file,
            capture::overlay_measure,
            capture::overlay_pixel,
            capture::overlay_color_pick,
            capture::color_set_format,
            colors::colors_list,
            colors::colors_clear,
            colors::colors_show,
            colors::colors_copy,
            qr::qr_result_get,
            qr::qr_result_close,
            qr::qr_copy,
            thumb::thumb_drag,
            thumb::thumb_close,
            import::import_image_file,
            privacy::remove_all_data,
            privacy::quit_app,
            // ===== demo driver (inert unless a debug build runs with CAPTUREME_DEMO) =====
            demo::demo_report,
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
