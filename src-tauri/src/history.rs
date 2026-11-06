//! Capture history. Owner: Agent C.
//!
//! Index lives in `<app data>/history/index.json`; thumbnails in `<app data>/history/thumbs/`;
//! edited images (from the editor) in `<app data>/history/edited/`. Original captures stay in
//! `paths::captures_dir` and are deleted together with their history entry.
use crate::{export, settings, types::*, windows};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager};

const THUMB_SIZE: u32 = 320;

/// A history entry: a `CaptureResult` (flattened, so it is a superset of that contract) plus
/// the optional edited image and a thumbnail path.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryItem {
    #[serde(flatten)]
    pub capture: CaptureResult,
    #[serde(default)]
    pub edited_path: Option<String>,
    #[serde(default)]
    pub thumb_path: String,
}

impl HistoryItem {
    /// The image to show/open: the edited version if there is one.
    fn best_path(&self) -> &str {
        self.edited_path.as_deref().unwrap_or(&self.capture.path)
    }
}

struct Store {
    loaded: bool,
    items: Vec<HistoryItem>, // newest first
}

fn store() -> &'static Mutex<Store> {
    static S: OnceLock<Mutex<Store>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(Store { loaded: false, items: Vec::new() }))
}

fn root(app: &AppHandle) -> PathBuf {
    let d = app.path().app_data_dir().expect("app data dir").join("history");
    let _ = std::fs::create_dir_all(&d);
    d
}
fn index_file(app: &AppHandle) -> PathBuf {
    root(app).join("index.json")
}
fn thumbs_dir(app: &AppHandle) -> PathBuf {
    let d = root(app).join("thumbs");
    let _ = std::fs::create_dir_all(&d);
    d
}
fn edited_dir(app: &AppHandle) -> PathBuf {
    let d = root(app).join("edited");
    let _ = std::fs::create_dir_all(&d);
    d
}

fn with_store<R>(app: &AppHandle, f: impl FnOnce(&mut Vec<HistoryItem>) -> R) -> R {
    let mut g = store().lock().unwrap_or_else(|e| e.into_inner());
    if !g.loaded {
        g.items = std::fs::read_to_string(index_file(app)).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
        g.loaded = true;
    }
    f(&mut g.items)
}

fn persist(app: &AppHandle, items: &[HistoryItem]) {
    let tmp = index_file(app).with_extension("json.tmp");
    if let Ok(s) = serde_json::to_string(items) {
        if std::fs::write(&tmp, s).is_ok() {
            let _ = std::fs::rename(&tmp, index_file(app));
        }
    }
}

fn notify(app: &AppHandle) {
    let _ = app.emit("history-changed", ());
}

fn remove_file_quiet(p: &str) {
    if !p.is_empty() {
        let _ = std::fs::remove_file(p);
    }
}

/// Delete the files that belong to an entry.
fn remove_files(item: &HistoryItem) {
    remove_file_quiet(&item.capture.path);
    if let Some(e) = &item.edited_path {
        remove_file_quiet(e);
    }
    remove_file_quiet(&item.thumb_path);
}

fn make_thumb(src: &Path, dst: &Path) -> Result<(), String> {
    let img = image::open(src).map_err(|e| e.to_string())?;
    let th = img.thumbnail(THUMB_SIZE, THUMB_SIZE);
    // JPEG thumbnails are small; flatten alpha onto a neutral background.
    let rgb = th.to_rgb8();
    let mut buf = Vec::new();
    let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 82);
    image::DynamicImage::ImageRgb8(rgb).write_with_encoder(enc).map_err(|e| e.to_string())?;
    std::fs::write(dst, buf).map_err(|e| e.to_string())
}

fn enforce_limit(app: &AppHandle, items: &mut Vec<HistoryItem>) {
    let limit = settings::get(app).history_limit.max(1) as usize;
    while items.len() > limit {
        if let Some(old) = items.pop() {
            remove_files(&old);
        }
    }
}

/// Called by capture.rs for every new capture.
pub fn record(app: &AppHandle, capture: &CaptureResult) {
    let app = app.clone();
    let capture = capture.clone();
    // Thumbnail generation can take a few ms for big screenshots – keep the capture flow snappy.
    std::thread::spawn(move || {
        let thumb = thumbs_dir(&app).join(format!("{}.jpg", capture.id));
        let thumb_path = match make_thumb(Path::new(&capture.path), &thumb) {
            Ok(()) => thumb.to_string_lossy().into_owned(),
            Err(e) => {
                log::warn!("history thumbnail: {e}");
                String::new()
            }
        };
        let item = HistoryItem { capture, edited_path: None, thumb_path };
        with_store(&app, |items| {
            items.retain(|i| i.capture.id != item.capture.id);
            items.insert(0, item);
            enforce_limit(&app, items);
            persist(&app, items);
        });
        notify(&app);
    });
}

fn sorted(mut items: Vec<HistoryItem>) -> Vec<HistoryItem> {
    // Newest first (ISO 8601 strings compare chronologically when they share an offset; parse to be safe).
    let key = |i: &HistoryItem| chrono::DateTime::parse_from_rfc3339(&i.capture.created_at).map(|d| d.timestamp_millis()).unwrap_or(0);
    items.sort_by_key(|i| std::cmp::Reverse(key(i)));
    items
}

// ---------------------------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------------------------

#[tauri::command]
pub fn history_list(app: AppHandle) -> Vec<HistoryItem> {
    // Drop entries whose files vanished (e.g. deleted in Finder).
    let items = with_store(&app, |items| {
        let before = items.len();
        items.retain(|i| Path::new(i.best_path()).exists() || Path::new(&i.capture.path).exists());
        if items.len() != before {
            persist(&app, items);
        }
        items.clone()
    });
    sorted(items)
}

#[tauri::command]
pub fn history_delete(app: AppHandle, id: String) -> CmdResult<()> {
    history_delete_many(app, vec![id])
}

#[tauri::command]
pub fn history_delete_many(app: AppHandle, ids: Vec<String>) -> CmdResult<()> {
    with_store(&app, |items| {
        items.retain(|i| {
            if ids.contains(&i.capture.id) {
                remove_files(i);
                false
            } else {
                true
            }
        });
        persist(&app, items);
    });
    notify(&app);
    Ok(())
}

#[tauri::command]
pub fn history_clear(app: AppHandle) -> CmdResult<()> {
    with_store(&app, |items| {
        for i in items.iter() {
            remove_files(i);
        }
        items.clear();
        persist(&app, items);
    });
    notify(&app);
    Ok(())
}

/// Open the entry in the editor (edited version if available).
#[tauri::command]
pub fn history_open(app: AppHandle, id: String) -> CmdResult<()> {
    let item = with_store(&app, |items| items.iter().find(|i| i.capture.id == id).cloned());
    let item = item.ok_or_else(|| AppError::Msg(format!("history entry {id} not found")))?;
    windows::open_editor_with_id(&app, item.best_path(), &item.capture.id).map_err(|e| AppError::Msg(e.to_string()))?;
    Ok(())
}

/// Store the edited (annotated) version of a history entry.
#[tauri::command]
pub async fn update_history_image(app: AppHandle, id: String, png_base64: String, redacted: Option<bool>) -> CmdResult<()> {
    // The id becomes part of a file name: only ever accept the uuid-like ids we generate.
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(AppError::Msg("invalid history id".into()));
    }
    let bytes = export::ensure_png(export::decode_b64(&png_base64)?)?;
    let dst = edited_dir(&app).join(format!("{id}.png"));
    std::fs::write(&dst, &bytes)?;
    let dims = image::load_from_memory(&bytes).ok().map(|i| (i.width(), i.height()));
    let thumb = thumbs_dir(&app).join(format!("{id}.jpg"));
    let thumb_ok = make_thumb(&dst, &thumb).is_ok();
    let found = with_store(&app, |items| {
        if let Some(it) = items.iter_mut().find(|i| i.capture.id == id) {
            it.edited_path = Some(dst.to_string_lossy().into_owned());
            if thumb_ok {
                it.thumb_path = thumb.to_string_lossy().into_owned();
            }
            if let Some((w, h)) = dims {
                it.capture.width = w;
                it.capture.height = h;
            }
            persist(&app, items);
            true
        } else {
            false
        }
    });
    if !found {
        let _ = std::fs::remove_file(&dst);
        let _ = std::fs::remove_file(&thumb);
        return Err(AppError::Msg(format!("history entry {id} not found")));
    }
    // Privacy: when the edit hides content, overwrite the original capture so the
    // un-redacted pixels don't stay on disk.
    if redacted.unwrap_or(false) {
        let original = with_store(&app, |items| items.iter().find(|i| i.capture.id == id).map(|i| i.capture.path.clone()));
        if let Some(orig) = original {
            let p = std::path::Path::new(&orig);
            if p.starts_with(crate::paths::captures_dir(&app)) || p.starts_with(root(&app)) {
                std::fs::write(p, &bytes)?;
            }
        }
    }
    notify(&app);
    Ok(())
}

/// Used by the tray/hotkey: show the history window.
pub fn show(app: &AppHandle) {
    let _ = windows::open_history(app);
}

#[tauri::command]
pub fn open_history_window(app: AppHandle) {
    show(&app);
}
