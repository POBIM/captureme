//! Shared data contracts between modules and the frontend (mirror: src/shared/api.ts).
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureResult {
    pub id: String,
    /// Absolute path of the PNG written to the capture cache dir.
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub language: String,
    pub save_dir: String,
    pub filename_pattern: String,
    pub image_format: String,
    pub jpg_quality: u8,
    pub copy_after_capture: bool,
    pub open_editor_after_capture: bool,
    pub play_sound: bool,
    pub launch_at_login: bool,
    pub history_limit: u32,
    /// action -> accelerator. Actions: region, window, fullscreen, delayed, scroll, record, ocr, history
    pub hotkeys: HashMap<String, String>,
}

impl Default for Settings {
    fn default() -> Self {
        let save_dir = dirs::picture_dir()
            .or_else(dirs::desktop_dir)
            .map(|p| p.join("CaptureME").to_string_lossy().into_owned())
            .unwrap_or_default();
        let hotkeys = [
            ("region", "CmdOrCtrl+Shift+2"),
            ("window", "CmdOrCtrl+Shift+3"),
            ("fullscreen", "CmdOrCtrl+Shift+1"),
            ("delayed", "CmdOrCtrl+Shift+6"),
            ("scroll", "CmdOrCtrl+Shift+7"),
            ("record", "CmdOrCtrl+Shift+8"),
            ("ocr", "CmdOrCtrl+Shift+9"),
            ("history", "CmdOrCtrl+Shift+0"),
        ]
        .into_iter()
        .map(|(a, b)| (a.to_string(), b.to_string()))
        .collect();
        Self {
            language: "th".into(),
            save_dir,
            filename_pattern: "CaptureME {date} {time}".into(),
            image_format: "png".into(),
            jpg_quality: 90,
            copy_after_capture: false,
            open_editor_after_capture: true,
            play_sound: true,
            launch_at_login: false,
            history_limit: 200,
            hotkeys,
        }
    }
}

/// Error type returned by commands (serialised to a string for the frontend).
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Msg(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}
impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}
impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Msg(s)
    }
}
impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Msg(s.to_string())
    }
}
pub type CmdResult<T> = Result<T, AppError>;

/// A user selection from the overlay. Coordinates are in *logical points* relative to the
/// top-left of the monitor identified by `monitor_id` (xcap Monitor::id()).
/// `monitor_x/monitor_y` are the monitor's global logical origin; `scale` its scale factor.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SelectionRect {
    pub monitor_id: u32,
    pub monitor_x: f64,
    pub monitor_y: f64,
    pub scale: f64,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Overlay modes. The overlay window is opened by capture.rs with `?mode=<mode>`.
pub const OVERLAY_MODES: &[&str] = &["capture", "ocr", "pin", "scroll", "record"];
