//! Screen recording (video + GIF). Owner: Agent D.
use tauri::AppHandle;
pub use crate::types::SelectionRect;

/// Called by capture.rs when overlay mode "record" finishes.
pub fn start_region(_app: &AppHandle, _rect: SelectionRect) {}
/// Stop an active recording if any. Returns true if one was stopped (used by hotkey/tray toggle).
pub fn stop_if_recording(_app: &AppHandle) -> bool { false }
pub fn is_recording() -> bool { false }
