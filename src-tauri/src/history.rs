//! Capture history. Owner: Agent C.
use crate::types::CaptureResult;
use tauri::AppHandle;

/// Called by capture.rs for every new capture.
pub fn record(_app: &AppHandle, _capture: &CaptureResult) {}
