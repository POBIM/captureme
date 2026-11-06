//! Recent recordings list (history.rs only supports images, so recordings keep their own index).
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

const LIMIT: usize = 300;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recording {
    pub id: String,
    pub path: String,
    /// "mp4" | "mov" | "gif"
    pub format: String,
    pub duration_ms: u64,
    pub width: u32,
    pub height: u32,
    pub size_bytes: u64,
    pub created_at: String,
    /// JPEG poster frame in the app cache dir (inside the asset-protocol scope).
    #[serde(default)]
    pub thumb: Option<String>,
}

static STORE: Mutex<Option<Vec<Recording>>> = Mutex::new(None);

fn index_file(app: &AppHandle) -> PathBuf {
    crate::paths::config_file(app).with_file_name("recordings.json")
}

pub fn thumbs_dir(app: &AppHandle) -> PathBuf {
    let d = app.path().app_cache_dir().map(|p| p.join("rec-thumbs")).unwrap_or_else(|_| std::env::temp_dir().join("captureme-rec-thumbs"));
    let _ = std::fs::create_dir_all(&d);
    d
}

fn with<R>(app: &AppHandle, f: impl FnOnce(&mut Vec<Recording>) -> R) -> R {
    let mut g = STORE.lock().unwrap_or_else(|e| e.into_inner());
    if g.is_none() {
        let loaded: Vec<Recording> = std::fs::read_to_string(index_file(app)).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
        *g = Some(loaded);
    }
    let items = g.as_mut().unwrap();
    f(items)
}

fn persist(app: &AppHandle, items: &[Recording]) {
    if let Ok(s) = serde_json::to_string_pretty(items) {
        let _ = std::fs::write(index_file(app), s);
    }
}

fn notify(app: &AppHandle) {
    let _ = app.emit("recordings-changed", ());
}

pub fn add(app: &AppHandle, rec: Recording) {
    with(app, |items| {
        items.retain(|r| r.path != rec.path);
        items.insert(0, rec);
        while items.len() > LIMIT {
            if let Some(old) = items.pop() {
                if let Some(t) = old.thumb {
                    let _ = std::fs::remove_file(t);
                }
            }
        }
        persist(app, items);
    });
    notify(app);
}

/// Newest first; entries whose file vanished are dropped.
pub fn list(app: &AppHandle) -> Vec<Recording> {
    let out = with(app, |items| {
        let before = items.len();
        items.retain(|r| std::path::Path::new(&r.path).exists());
        if items.len() != before {
            persist(app, items);
        }
        items.clone()
    });
    out
}

pub fn find_by_path(app: &AppHandle, path: &str) -> Option<Recording> {
    with(app, |items| items.iter().find(|r| r.path == path).cloned())
}

/// Forget an entry (and its thumbnail). Returns the removed entry.
pub fn remove(app: &AppHandle, id: &str) -> Option<Recording> {
    let r = with(app, |items| {
        let pos = items.iter().position(|r| r.id == id)?;
        let r = items.remove(pos);
        persist(app, items);
        Some(r)
    });
    if let Some(r) = &r {
        if let Some(t) = &r.thumb {
            let _ = std::fs::remove_file(t);
        }
    }
    notify(app);
    r
}

pub fn remove_by_path(app: &AppHandle, path: &str) {
    if let Some(r) = find_by_path(app, path) {
        remove(app, &r.id);
    }
}

pub fn update_duration(app: &AppHandle, path: &str, f: impl FnOnce(&mut Recording)) {
    with(app, |items| {
        if let Some(r) = items.iter_mut().find(|r| r.path == path) {
            f(r);
            persist(app, items);
        }
    });
}
