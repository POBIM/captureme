//! Screen-recording permission handling + first-launch onboarding. Owner: Agent A.
use crate::{paths, windows};
use tauri::{AppHandle, Manager};

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

/// True when the process may capture the screen (no prompt shown).
pub fn has_screen_access() -> bool {
    #[cfg(target_os = "macos")]
    unsafe {
        CGPreflightScreenCaptureAccess()
    }
    #[cfg(not(target_os = "macos"))]
    true
}

fn onboarded_marker(app: &AppHandle) -> std::path::PathBuf {
    paths::config_file(app).with_file_name("onboarded")
}

pub fn is_first_launch(app: &AppHandle) -> bool {
    !onboarded_marker(app).exists()
}

/// Opens the onboarding window (sized for its content).
pub fn show_onboarding(app: &AppHandle) {
    if let Err(e) = windows::open_page(app, "onboarding", "onboarding", "", "CaptureME", 580.0, 720.0) {
        log::error!("cannot open onboarding: {e}");
    }
}

/// Called once from setup: onboarding on first launch or when permission is missing.
pub fn onboarding_if_needed(app: &AppHandle) {
    if is_first_launch(app) || !has_screen_access() {
        show_onboarding(app);
    }
}

#[tauri::command]
pub fn check_screen_permission() -> bool {
    has_screen_access()
}

/// Triggers the system prompt (first time only) and returns the current state.
#[tauri::command]
pub fn request_screen_permission() -> bool {
    #[cfg(target_os = "macos")]
    unsafe {
        CGRequestScreenCaptureAccess()
    }
    #[cfg(not(target_os = "macos"))]
    true
}

#[tauri::command]
pub fn open_screen_permission_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
        .spawn();
}

/// Marks onboarding as done and closes the window.
#[tauri::command]
pub fn onboarding_complete(app: AppHandle) {
    let _ = std::fs::write(onboarded_marker(&app), "1");
    if let Some(w) = app.get_webview_window("onboarding") {
        let _ = w.close();
    }
}

/// Relaunch the app (macOS often needs this after granting screen recording).
#[tauri::command]
pub fn relaunch_app(app: AppHandle) {
    app.restart();
}
