//! TODO: implemented by owning agent (see AGENTS.md).
use tauri::AppHandle;
pub fn start_overlay(_app: &AppHandle, _mode: &str) {}
pub fn start_region(app: &AppHandle) { start_overlay(app, "capture") }
pub fn start_window(_app: &AppHandle) {}
pub fn start_fullscreen(_app: &AppHandle) {}
pub fn start_delayed(_app: &AppHandle, _secs: u64) {}
