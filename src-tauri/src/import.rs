//! "Open image…" and "Annotate image from clipboard": bring an existing image into CaptureME
//! (a PNG copy in the captures dir + history entry, so the original file is never modified),
//! then open the editor on it. Owner: Agent E.
use crate::{capture, floating, types::*, windows};
use image::RgbaImage;
use tauri::AppHandle;

/// Decode any image macOS understands (HEIC, TIFF, BMP, …) through AppKit – fallback when the
/// `image` crate cannot read a file.
#[cfg(target_os = "macos")]
fn decode_with_appkit(path: &str) -> Result<RgbaImage, String> {
    use objc2::AnyThread;
    use objc2_app_kit::NSImage;
    use objc2_foundation::NSString;
    objc2::rc::autoreleasepool(|_| {
        let img = NSImage::initWithContentsOfFile(NSImage::alloc(), &NSString::from_str(path)).ok_or("macOS cannot read this file as an image")?;
        let tiff = img.TIFFRepresentation().ok_or("cannot convert image")?;
        tiff_to_rgba(&tiff.to_vec())
    })
}

#[cfg(not(target_os = "macos"))]
fn decode_with_appkit(_path: &str) -> Result<RgbaImage, String> {
    Err("unsupported image format".into())
}

/// TIFF (or any NSBitmapImageRep-readable data) → RGBA. Picks the largest representation.
#[cfg(target_os = "macos")]
pub fn tiff_to_rgba(data: &[u8]) -> Result<RgbaImage, String> {
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep};
    use objc2_foundation::{NSData, NSDictionary};
    objc2::rc::autoreleasepool(|_| {
        let nsdata = NSData::with_bytes(data);
        let reps = NSBitmapImageRep::imageRepsWithData(&nsdata);
        let best = reps.iter().max_by_key(|r| r.pixelsWide()).ok_or("no image representation")?;
        let bitmap = best.downcast::<NSBitmapImageRep>().map_err(|_| "unsupported image representation")?;
        let props = NSDictionary::new();
        let png = unsafe { bitmap.representationUsingType_properties(NSBitmapImageFileType::PNG, &props) }.ok_or("cannot encode PNG")?;
        image::load_from_memory(&png.to_vec()).map(|i| i.to_rgba8()).map_err(|e| e.to_string())
    })
}

#[cfg(not(target_os = "macos"))]
pub fn tiff_to_rgba(_data: &[u8]) -> Result<RgbaImage, String> {
    Err("unsupported".into())
}

/// Import an image file (any readable format) as a new capture and open it in the editor.
pub fn import_file(app: &AppHandle, path: &str) -> Result<CaptureResult, String> {
    let img = match image::open(path) {
        Ok(i) => i.to_rgba8(),
        Err(e) => decode_with_appkit(path).map_err(|e2| format!("{path}: {e} / {e2}"))?,
    };
    if img.width() == 0 || img.height() == 0 {
        return Err("empty image".into());
    }
    let res = capture::store_capture(app, &img, 1.0)?;
    windows::open_editor_with_id(app, &res.path, &res.id).map_err(|e| e.to_string())?;
    Ok(res)
}

/// Tray: pick an image file, then annotate it.
pub fn open_image_dialog(app: &AppHandle) {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    let thai = crate::settings::get(app).language == "th";
    let app2 = app.clone();
    app.dialog()
        .file()
        .set_title(if thai { "เปิดรูปภาพเพื่อเขียนกำกับ" } else { "Open an image to annotate" })
        .add_filter(if thai { "รูปภาพ" } else { "Images" }, &["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "heic"])
        .pick_file(move |picked| {
            let Some(FilePath::Path(p)) = picked else { return };
            let app = app2.clone();
            std::thread::spawn(move || {
                if let Err(e) = import_file(&app, &p.to_string_lossy()) {
                    log::error!("open image: {e}");
                    floating::alert(&app, "เปิดรูปภาพไม่สำเร็จ", "Could not open the image", &e);
                }
            });
        });
}

/// Tray/hotkey: annotate the image currently on the clipboard.
pub fn annotate_clipboard(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let r = (|| -> Result<(), String> {
            let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
            let data = cb.get_image().map_err(|_| "NO_IMAGE".to_string())?;
            let img = RgbaImage::from_raw(data.width as u32, data.height as u32, data.bytes.into_owned()).ok_or("bad clipboard image")?;
            let res = capture::store_capture(&app, &img, 1.0)?;
            windows::open_editor_with_id(&app, &res.path, &res.id).map_err(|e| e.to_string())?;
            Ok(())
        })();
        match r {
            Ok(()) => {}
            Err(e) if e == "NO_IMAGE" => floating::alert(&app, "ไม่พบรูปภาพในคลิปบอร์ด", "There is no image on the clipboard", ""),
            Err(e) => {
                log::error!("clipboard annotate: {e}");
                floating::alert(&app, "ใช้รูปจากคลิปบอร์ดไม่สำเร็จ", "Could not use the clipboard image", &e);
            }
        }
    });
}

/// Frontend: open a file in the editor (also used by drag & drop in the future).
#[tauri::command]
pub async fn import_image_file(app: AppHandle, path: String) -> CmdResult<()> {
    tauri::async_runtime::spawn_blocking(move || import_file(&app, &path))
        .await
        .map_err(|e| AppError::Msg(e.to_string()))??;
    Ok(())
}
