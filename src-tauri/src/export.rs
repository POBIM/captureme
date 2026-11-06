//! Clipboard / save to disk. Owner: Agent C.
use crate::{settings, types::*};
use base64::Engine;
use image::DynamicImage;
use std::io::{Cursor, Write};
use std::path::{Path, PathBuf};
use tauri::AppHandle;

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

/// Decode base64 (optionally a `data:` URL) into bytes.
pub fn decode_b64(s: &str) -> Result<Vec<u8>, String> {
    let s = s.trim();
    let s = if s.starts_with("data:") { s.split_once(',').map(|x| x.1).unwrap_or(s) } else { s };
    base64::engine::general_purpose::STANDARD.decode(s).map_err(|e| format!("invalid base64: {e}"))
}

/// Normalise a user supplied format/extension to one of png / jpg / webp.
pub fn norm_format(f: &str) -> &'static str {
    match f.trim_start_matches('.').to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "jpg",
        "webp" => "webp",
        _ => "png",
    }
}

/// Encode an image to `fmt` (png / jpg / webp). JPEG uses `quality` (1-100); WebP is lossless.
pub fn encode_image(img: &DynamicImage, fmt: &str, quality: u8) -> Result<Vec<u8>, String> {
    let mut buf: Vec<u8> = Vec::new();
    match norm_format(fmt) {
        "jpg" => {
            let rgb = DynamicImage::ImageRgb8(img.to_rgb8());
            let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality.clamp(1, 100));
            rgb.write_with_encoder(enc).map_err(|e| e.to_string())?;
        }
        "webp" => {
            let rgba = DynamicImage::ImageRgba8(img.to_rgba8());
            let enc = image::codecs::webp::WebPEncoder::new_lossless(&mut buf);
            rgba.write_with_encoder(enc).map_err(|e| e.to_string())?;
        }
        _ => {
            img.write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png).map_err(|e| e.to_string())?;
        }
    }
    Ok(buf)
}

fn is_png(bytes: &[u8]) -> bool {
    bytes.starts_with(&[0x89, b'P', b'N', b'G'])
}

/// Make sure bytes are PNG (re-encode if they are another image format).
pub fn ensure_png(bytes: Vec<u8>) -> Result<Vec<u8>, String> {
    if is_png(&bytes) {
        return Ok(bytes);
    }
    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    encode_image(&img, "png", 100)
}

fn expand_tilde(p: &str) -> PathBuf {
    if let Some(rest) = p.strip_prefix("~/") {
        if let Some(h) = dirs::home_dir() {
            return h.join(rest);
        }
    } else if p == "~" {
        if let Some(h) = dirs::home_dir() {
            return h;
        }
    }
    PathBuf::from(p)
}

/// Resolve the directory images are saved to (created if missing).
pub fn save_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let s = settings::get(app);
    let dir = if s.save_dir.trim().is_empty() {
        Settings::default().save_dir.into()
    } else {
        expand_tilde(s.save_dir.trim())
    };
    let dir: PathBuf = if dir.as_os_str().is_empty() {
        dirs::picture_dir().unwrap_or_else(|| PathBuf::from(".")).join("CaptureME")
    } else {
        dir
    };
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    Ok(dir)
}

fn sanitize_name(s: &str) -> String {
    let cleaned: String = s.chars().map(|c| if matches!(c, '/' | '\\' | ':' | '\0' | '*' | '?' | '"' | '<' | '>' | '|') { '-' } else { c }).collect();
    let cleaned = cleaned.trim().trim_matches('.').trim().to_string();
    if cleaned.is_empty() {
        "CaptureME".into()
    } else {
        cleaned
    }
}

/// Expand the tokens `{date}` `{time}` `{n}` in a filename pattern (without extension).
pub fn expand_pattern(pattern: &str, n: Option<u32>) -> String {
    let now = chrono::Local::now();
    let mut s = pattern.replace("{date}", &now.format("%Y-%m-%d").to_string()).replace("{time}", &now.format("%H.%M.%S").to_string());
    s = s.replace("{n}", &n.map(|n| n.to_string()).unwrap_or_default());
    sanitize_name(&s)
}

/// Write `bytes` to a new unique file in `dir` named after `pattern` + `ext`.
pub fn write_unique(dir: &Path, pattern: &str, ext: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    let has_n = pattern.contains("{n}");
    for n in 1..100_000u32 {
        let base = if has_n {
            expand_pattern(pattern, Some(n))
        } else if n == 1 {
            expand_pattern(pattern, None)
        } else {
            format!("{} ({})", expand_pattern(pattern, None), n)
        };
        let path = dir.join(format!("{base}.{ext}"));
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut f) => {
                f.write_all(bytes).map_err(|e| e.to_string())?;
                return Ok(path);
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("cannot write {}: {e}", path.display())),
        }
    }
    Err("could not find a free file name".into())
}

/// Save raw image bytes (any decodable format) using the user's settings.
fn save_bytes_auto(app: &AppHandle, bytes: &[u8]) -> Result<String, String> {
    let s = settings::get(app);
    let fmt = norm_format(&s.image_format);
    let out = if fmt == "png" && is_png(bytes) {
        bytes.to_vec()
    } else {
        let img = image::load_from_memory(bytes).map_err(|e| e.to_string())?;
        encode_image(&img, fmt, s.jpg_quality)?
    };
    let dir = save_dir(app)?;
    let p = write_unique(&dir, &s.filename_pattern, fmt, &out)?;
    Ok(p.to_string_lossy().into_owned())
}

// ---------------------------------------------------------------------------------------------
// clipboard
// ---------------------------------------------------------------------------------------------

/// Put PNG data on the general pasteboard (PNG + TIFF flavours so every app can paste it).
#[cfg(target_os = "macos")]
pub fn copy_png_bytes(png: &[u8]) -> Result<(), String> {
    use objc2::AnyThread;
    use objc2_app_kit::{NSImage, NSPasteboard, NSPasteboardTypePNG, NSPasteboardTypeTIFF};
    use objc2_foundation::NSData;
    unsafe {
        let pb = NSPasteboard::generalPasteboard();
        pb.clearContents();
        let data = NSData::with_bytes(png);
        let ok = pb.setData_forType(Some(&data), NSPasteboardTypePNG);
        if !ok {
            return Err("failed to write PNG to the clipboard".into());
        }
        if let Some(img) = NSImage::initWithData(NSImage::alloc(), &data) {
            if let Some(tiff) = img.TIFFRepresentation() {
                pb.setData_forType(Some(&tiff), NSPasteboardTypeTIFF);
            }
        }
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn copy_png_bytes(png: &[u8]) -> Result<(), String> {
    let img = image::load_from_memory(png).map_err(|e| e.to_string())?.to_rgba8();
    let (w, h) = img.dimensions();
    let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_image(arboard::ImageData { width: w as usize, height: h as usize, bytes: img.into_raw().into() }).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
pub fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    use objc2_app_kit::{NSPasteboard, NSPasteboardTypeString};
    use objc2_foundation::NSString;
    unsafe {
        let pb = NSPasteboard::generalPasteboard();
        pb.clearContents();
        if pb.setString_forType(&NSString::from_str(text), NSPasteboardTypeString) {
            Ok(())
        } else {
            Err("failed to write text to the clipboard".into())
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    arboard::Clipboard::new().and_then(|mut c| c.set_text(text.to_string())).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------------------------
// cross-module API
// ---------------------------------------------------------------------------------------------

/// Copy a PNG file to the clipboard as an image.
pub fn copy_file_to_clipboard(_app: &AppHandle, image_path: &str) -> Result<(), String> {
    let bytes = std::fs::read(image_path).map_err(|e| format!("{image_path}: {e}"))?;
    copy_png_bytes(&ensure_png(bytes)?)
}

/// Save a PNG file into the user's save dir using settings (format/pattern). Returns final path.
pub fn save_file_auto(app: &AppHandle, image_path: &str) -> Result<String, String> {
    let bytes = std::fs::read(image_path).map_err(|e| format!("{image_path}: {e}"))?;
    save_bytes_auto(app, &bytes)
}

// ---------------------------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------------------------

#[tauri::command]
pub async fn copy_image_png(png_base64: String) -> CmdResult<()> {
    let bytes = decode_b64(&png_base64)?;
    copy_png_bytes(&ensure_png(bytes)?)?;
    Ok(())
}

/// Copy an image file (by path) to the clipboard.
#[tauri::command]
pub async fn copy_image_file(app: AppHandle, path: String) -> CmdResult<()> {
    copy_file_to_clipboard(&app, &path)?;
    Ok(())
}

/// Save an image. With `path` the format follows its extension, otherwise settings decide
/// (save dir, filename pattern, format). Returns the final path.
#[tauri::command]
pub async fn save_image_png(app: AppHandle, png_base64: String, path: Option<String>) -> CmdResult<String> {
    let bytes = decode_b64(&png_base64)?;
    match path.filter(|p| !p.trim().is_empty()) {
        None => Ok(save_bytes_auto(&app, &bytes)?),
        Some(p) => {
            let p = expand_tilde(&p);
            let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("png");
            let fmt = norm_format(ext);
            let out = if fmt == "png" && is_png(&bytes) {
                bytes
            } else {
                let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
                encode_image(&img, fmt, settings::get(&app).jpg_quality)?
            };
            if let Some(parent) = p.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&p, out)?;
            Ok(p.to_string_lossy().into_owned())
        }
    }
}

/// Save an image file into the save dir using settings. Returns the final path.
#[tauri::command]
pub async fn save_image_file(app: AppHandle, path: String) -> CmdResult<String> {
    Ok(save_file_auto(&app, &path)?)
}

#[tauri::command]
pub async fn copy_text(text: String) -> CmdResult<()> {
    copy_text_to_clipboard(&text)?;
    Ok(())
}

/// Reveal a file in Finder (or open it if it is a directory).
#[tauri::command]
pub fn reveal_in_finder(path: String) -> CmdResult<()> {
    let p = expand_tilde(&path);
    let mut cmd = std::process::Command::new("open");
    if p.is_dir() {
        cmd.arg(&p);
    } else {
        cmd.arg("-R").arg(&p);
    }
    cmd.spawn()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pattern_and_unique_names() {
        let dir = std::env::temp_dir().join(format!("captureme-test-{}", uuid::Uuid::new_v4().simple()));
        std::fs::create_dir_all(&dir).unwrap();
        let a = write_unique(&dir, "Shot {date} {time}", "png", b"x").unwrap();
        let b = write_unique(&dir, "Shot {date} {time}", "png", b"x").unwrap();
        assert_ne!(a, b);
        let c = write_unique(&dir, "n{n}", "png", b"x").unwrap();
        let d = write_unique(&dir, "n{n}", "png", b"x").unwrap();
        assert!(c.ends_with("n1.png") && d.ends_with("n2.png"));
        assert_eq!(expand_pattern("a/b:c", None), "a-b-c");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn encode_formats_and_clipboard() {
        let img = DynamicImage::new_rgba8(40, 30);
        for f in ["png", "jpg", "webp"] {
            let b = encode_image(&img, f, 80).unwrap();
            assert!(image::load_from_memory(&b).is_ok(), "{f}");
        }
        let png = encode_image(&img, "png", 100).unwrap();
        copy_png_bytes(&png).unwrap();
        copy_text_to_clipboard("hello สวัสดี").unwrap();
    }
}
