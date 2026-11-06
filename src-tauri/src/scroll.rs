//! Scrolling capture. Owner: Agent D.
use tauri::AppHandle;

/// Logical-point rect on a given monitor, chosen by the user in the overlay.
pub use crate::types::SelectionRect;

/// Called by capture.rs when overlay mode "scroll" finishes.
pub fn start_region(_app: &AppHandle, _rect: SelectionRect) {}
