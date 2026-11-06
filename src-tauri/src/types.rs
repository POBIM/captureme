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
    /// action -> accelerator ("" = disabled). Actions: region, window, fullscreen, delayed, repeat,
    /// scroll, record, ocr, pin, color, measure, qr, clipboard, history
    pub hotkeys: HashMap<String, String>,
    // ---- Round 2 (Agent E) – additive fields ----
    /// What happens after a capture: "editor" | "thumbnail" | "copy" | "save".
    pub after_capture: String,
    /// Seconds the floating thumbnail stays on screen (0 = until dismissed).
    pub thumbnail_seconds: u32,
    /// Colour picker output format: "hex" | "rgb" | "hsl".
    pub color_format: String,
    /// Draw the mouse cursor into region / window / fullscreen captures.
    pub include_cursor: bool,
    /// Window snapping keeps the macOS drop shadow (transparent padding) around the window.
    pub window_shadow: bool,
    /// Version of the default-hotkey set the stored hotkeys were migrated to.
    pub hotkeys_version: u32,
}

/// Bump when the default hotkeys change (see `settings::load` for the migration).
pub const HOTKEY_VERSION: u32 = 2;

/// The hotkey defaults shipped before `hotkeys_version` existed (they clash with macOS ⌘⇧3/4/5).
pub const LEGACY_HOTKEYS: &[(&str, &str)] = &[
    ("region", "CmdOrCtrl+Shift+2"),
    ("window", "CmdOrCtrl+Shift+3"),
    ("fullscreen", "CmdOrCtrl+Shift+1"),
    ("delayed", "CmdOrCtrl+Shift+6"),
    ("scroll", "CmdOrCtrl+Shift+7"),
    ("record", "CmdOrCtrl+Shift+8"),
    ("ocr", "CmdOrCtrl+Shift+9"),
    ("history", "CmdOrCtrl+Shift+0"),
];

/// Default hotkeys: ⌃⇧ + digit/letter – none of these collide with the macOS screenshot
/// shortcuts (⌘⇧3 / ⌘⇧4 / ⌘⇧5 / ⌘⇧6).
pub const DEFAULT_HOTKEYS: &[(&str, &str)] = &[
    ("fullscreen", "Ctrl+Shift+1"),
    ("region", "Ctrl+Shift+2"),
    ("window", "Ctrl+Shift+3"),
    ("repeat", "Ctrl+Shift+4"),
    ("delayed", "Ctrl+Shift+5"),
    ("scroll", "Ctrl+Shift+6"),
    ("record", "Ctrl+Shift+7"),
    ("ocr", "Ctrl+Shift+8"),
    ("history", "Ctrl+Shift+9"),
    ("pin", "Ctrl+Shift+P"),
    ("color", "Ctrl+Shift+C"),
    ("measure", "Ctrl+Shift+M"),
    ("qr", "Ctrl+Shift+Q"),
    ("clipboard", "Ctrl+Shift+V"),
];

impl Default for Settings {
    fn default() -> Self {
        let save_dir = dirs::picture_dir()
            .or_else(dirs::desktop_dir)
            .map(|p| p.join("CaptureME").to_string_lossy().into_owned())
            .unwrap_or_default();
        let hotkeys = DEFAULT_HOTKEYS
        .iter()
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
            after_capture: "editor".into(),
            thumbnail_seconds: 6,
            color_format: "hex".into(),
            include_cursor: false,
            window_shadow: true,
            hotkeys_version: HOTKEY_VERSION,
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
pub const OVERLAY_MODES: &[&str] = &["capture", "window", "ocr", "pin", "scroll", "record", "color", "measure", "qr"];
