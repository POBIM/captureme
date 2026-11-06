//! Screen colour picker support: formatting, the list of recently picked colours and the small
//! "Colors" panel window. Owner: Agent E. The pixel lookup itself lives in capture.rs.
use crate::{export, paths, settings, types::*};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

const MAX_COLORS: usize = 30;
static LIST: Mutex<Option<Vec<ColorEntry>>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorEntry {
    pub hex: String,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub at: String,
}

#[derive(Serialize)]
pub struct PickedColor {
    pub hex: String,
    pub rgb: String,
    pub hsl: String,
    /// The text that was put on the clipboard (in the user's chosen format).
    pub text: String,
}

pub fn hex(rgb: [u8; 3]) -> String {
    format!("#{:02X}{:02X}{:02X}", rgb[0], rgb[1], rgb[2])
}

pub fn rgb_text(rgb: [u8; 3]) -> String {
    format!("rgb({}, {}, {})", rgb[0], rgb[1], rgb[2])
}

pub fn hsl_text(rgb: [u8; 3]) -> String {
    let (r, g, b) = (rgb[0] as f64 / 255.0, rgb[1] as f64 / 255.0, rgb[2] as f64 / 255.0);
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;
    let d = max - min;
    let (h, s) = if d < 1e-9 {
        (0.0, 0.0)
    } else {
        let s = d / (1.0 - (2.0 * l - 1.0).abs());
        let h = if max == r {
            ((g - b) / d).rem_euclid(6.0)
        } else if max == g {
            (b - r) / d + 2.0
        } else {
            (r - g) / d + 4.0
        };
        (h * 60.0, s)
    };
    format!("hsl({}, {}%, {}%)", h.round() as i32 % 360, (s * 100.0).round() as i32, (l * 100.0).round() as i32)
}

pub fn format(rgb: [u8; 3], fmt: &str) -> String {
    match fmt {
        "rgb" => rgb_text(rgb),
        "hsl" => hsl_text(rgb),
        _ => hex(rgb),
    }
}

fn file(app: &AppHandle) -> std::path::PathBuf {
    paths::config_file(app).with_file_name("colors.json")
}

fn with_list<R>(app: &AppHandle, f: impl FnOnce(&mut Vec<ColorEntry>) -> R) -> R {
    let mut g = LIST.lock().unwrap_or_else(|e| e.into_inner());
    if g.is_none() {
        *g = Some(std::fs::read_to_string(file(app)).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default());
    }
    let list = g.as_mut().expect("initialised above");
    let r = f(list);
    if let Ok(s) = serde_json::to_string(list) {
        let _ = std::fs::write(file(app), s);
    }
    r
}

/// Record a pick: clipboard (user's format) + recent list. Returns the formatted values.
pub fn record_pick(app: &AppHandle, rgb: [u8; 3]) -> Result<PickedColor, String> {
    let fmt = settings::get(app).color_format;
    let text = format(rgb, &fmt);
    export::copy_text_to_clipboard(&text)?;
    let entry = ColorEntry { hex: hex(rgb), r: rgb[0], g: rgb[1], b: rgb[2], at: chrono::Local::now().to_rfc3339() };
    with_list(app, |l| {
        l.retain(|c| c.hex != entry.hex);
        l.insert(0, entry);
        l.truncate(MAX_COLORS);
    });
    let _ = app.emit("colors-changed", ());
    Ok(PickedColor { hex: hex(rgb), rgb: rgb_text(rgb), hsl: hsl_text(rgb), text })
}

/// Show (or focus) the recent-colours panel.
pub fn show_panel(app: &AppHandle) {
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(w) = app2.get_webview_window("colors") {
            let _ = w.show();
            let _ = w.set_focus();
            return;
        }
        let title = if settings::get(&app2).language == "th" { "สีที่เลือกล่าสุด" } else { "Recent colors" };
        let b = tauri::WebviewWindowBuilder::new(&app2, "colors", tauri::WebviewUrl::App("colors.html".into()))
            .title(title)
            .inner_size(300.0, 420.0)
            .min_inner_size(240.0, 260.0)
            .always_on_top(true)
            .visible_on_all_workspaces(true)
            .center();
        match b.build() {
            Ok(w) => {
                crate::windows::float_over_fullscreen(&w);
                let _ = w.set_focus();
            }
            Err(e) => log::error!("colors window: {e}"),
        }
    });
}

#[tauri::command]
pub fn colors_list(app: AppHandle) -> Vec<ColorEntry> {
    with_list(&app, |l| l.clone())
}

#[tauri::command]
pub fn colors_clear(app: AppHandle) {
    with_list(&app, |l| l.clear());
    let _ = app.emit("colors-changed", ());
}

#[tauri::command]
pub fn colors_show(app: AppHandle) {
    show_panel(&app);
}

/// Copy a stored colour in the given format ("hex" | "rgb" | "hsl").
#[tauri::command]
pub fn colors_copy(r: u8, g: u8, b: u8, format: String) -> CmdResult<String> {
    let text = self::format([r, g, b], &format);
    export::copy_text_to_clipboard(&text)?;
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn formats() {
        assert_eq!(hex([255, 128, 0]), "#FF8000");
        assert_eq!(hsl_text([255, 0, 0]), "hsl(0, 100%, 50%)");
        assert_eq!(hsl_text([0, 0, 255]), "hsl(240, 100%, 50%)");
        assert_eq!(hsl_text([128, 128, 128]), "hsl(0, 0%, 50%)");
        assert_eq!(rgb_text([1, 2, 3]), "rgb(1, 2, 3)");
    }
}
