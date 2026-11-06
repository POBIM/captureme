//! Demo driver – lets `marketing/capture/*` show the REAL app windows in clean, reproducible states
//! without touching the user's screen content or posting any synthetic OS input.
//!
//! * Only compiled with debug assertions (`cargo build`, never `--release`); the release build contains
//!   none of it (the functions below are empty stubs).
//! * Only active when the environment variable `CAPTUREME_DEMO=<dir>` is set. The driver then
//!   - skips global hotkeys + first-launch onboarding,
//!   - polls `<dir>/*.cmd.json`, runs each command and writes `<name>.ack` with the result,
//!   - lets the capture overlay use a prepared PNG ("scene") instead of grabbing the real screen,
//!   - stops hiding utility windows from screenshots (so `screencapture -l <window>` can photograph them).
//! Commands (JSON, key `op`): open · panel · overlay · eval · emit · zoom · place · close · closeall · windows · editor · thumb · ocr ·
//! qr · pin · colors · history_add · settings · settings_window · history_window · onboarding · tray_menu · quit.
use crate::capture::WinInfo;
use image::RgbaImage;

/// A prepared "screen" for the overlay: the frozen image, its pixel density and the fake window frames.
pub struct Scene {
    pub image: RgbaImage,
    /// Size in points; `image` is `scale` times larger in pixels.
    pub width: f64,
    pub height: f64,
    pub scale: f64,
    /// Magnify the overlay window + page by this factor (2 → a crisp 2x capture on a 1x display).
    pub zoom: f64,
    pub windows: Vec<WinInfo>,
}

#[cfg(not(debug_assertions))]
mod imp {
    use super::Scene;
    pub fn active() -> bool {
        false
    }
    pub fn init(_app: &tauri::AppHandle) -> bool {
        false
    }
    pub fn scene_pending() -> bool {
        false
    }
    pub fn take_scene() -> Option<Scene> {
        None
    }
    #[tauri::command]
    pub fn demo_report(_json: String) {}
}

#[cfg(debug_assertions)]
mod imp {
    use super::Scene;
    use crate::{capture, colors, history, ocr, pin, qr, settings, thumb, types::CaptureResult, windows};
    use tauri::menu::ContextMenu;
    use serde_json::{json, Value};
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    };
    use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

    static ACTIVE: AtomicBool = AtomicBool::new(false);
    static SCENE: Mutex<Option<Scene>> = Mutex::new(None);

    pub fn active() -> bool {
        ACTIVE.load(Ordering::SeqCst)
    }
    pub fn scene_pending() -> bool {
        SCENE.lock().map(|s| s.is_some()).unwrap_or(false)
    }
    pub fn take_scene() -> Option<Scene> {
        SCENE.lock().ok().and_then(|mut s| s.take())
    }

    /// Returns true when demo mode is on.
    pub fn init(app: &AppHandle) -> bool {
        let Ok(dir) = std::env::var("CAPTUREME_DEMO") else { return false };
        let dir = std::path::PathBuf::from(dir);
        let _ = std::fs::create_dir_all(&dir);
        ACTIVE.store(true, Ordering::SeqCst);
        log::info!("DEMO MODE: polling {}", dir.display());
        let app = app.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_millis(150));
            let mut cmds: Vec<_> = std::fs::read_dir(&dir)
                .map(|rd| rd.flatten().map(|e| e.path()).filter(|p| p.to_string_lossy().ends_with(".cmd.json")).collect())
                .unwrap_or_default();
            cmds.sort();
            for p in cmds {
                let text = std::fs::read_to_string(&p).unwrap_or_default();
                let _ = std::fs::remove_file(&p);
                let ack = p.with_file_name(p.file_name().unwrap().to_string_lossy().replace(".cmd.json", ".ack"));
                let res = match serde_json::from_str::<Value>(&text) {
                    Ok(v) => run(&app, &v),
                    Err(e) => Err(format!("bad json: {e}")),
                };
                let out = match res {
                    Ok(v) => json!({ "ok": true, "result": v }),
                    Err(e) => {
                        log::warn!("demo command failed: {e}");
                        json!({ "ok": false, "error": e })
                    }
                };
                let _ = std::fs::write(ack, out.to_string());
            }
        });
        true
    }

    /// Pages call this (through `eval`) to hand measurements back, e.g. button rectangles for callouts.
    #[tauri::command]
    pub fn demo_report(json: String) {
        if let Ok(dir) = std::env::var("CAPTUREME_DEMO") {
            use std::io::Write;
            if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(std::path::Path::new(&dir).join("report.jsonl")) {
                let _ = writeln!(f, "{}", json.replace('\n', " "));
            }
        }
    }

    fn s<'a>(v: &'a Value, k: &str) -> Option<&'a str> {
        v.get(k).and_then(|x| x.as_str())
    }
    fn f(v: &Value, k: &str) -> Option<f64> {
        v.get(k).and_then(|x| x.as_f64())
    }
    fn win_of(app: &AppHandle, v: &Value) -> Result<tauri::WebviewWindow, String> {
        let l = s(v, "label").ok_or("missing label")?;
        app.get_webview_window(l).ok_or_else(|| format!("no window {l}"))
    }

    fn run(app: &AppHandle, v: &Value) -> Result<Value, String> {
        match s(v, "op").unwrap_or("") {
            "open" => open(app, v),
            "panel" => {
                let label = s(v, "label").unwrap_or("demo-panel");
                let url = s(v, "url").ok_or("missing url")?;
                let w = crate::floating::open_panel(app, label, url, (f(v, "x").unwrap_or(100.0), f(v, "y").unwrap_or(100.0)), (f(v, "w").unwrap_or(400.0), f(v, "h").unwrap_or(300.0)), true)
                    .map_err(|e| e.to_string())?;
                Ok(json!(w.label()))
            }
            "overlay" => {
                let bg = s(v, "bg").ok_or("missing bg")?;
                let image = image::open(bg).map_err(|e| e.to_string())?.to_rgba8();
                let scale = f(v, "scale").unwrap_or(1.0);
                let (width, height) = (image.width() as f64 / scale, image.height() as f64 / scale);
                let wins = v
                    .get("windows")
                    .and_then(|a| a.as_array())
                    .map(|a| {
                        a.iter()
                            .enumerate()
                            .map(|(i, w)| capture::WinInfo {
                                id: 900_000 + i as u32,
                                app: s(w, "app").unwrap_or("").into(),
                                title: s(w, "title").unwrap_or("").into(),
                                x: f(w, "x").unwrap_or(0.0),
                                y: f(w, "y").unwrap_or(0.0),
                                width: f(w, "w").unwrap_or(100.0),
                                height: f(w, "h").unwrap_or(100.0),
                            })
                            .collect()
                    })
                    .unwrap_or_default();
                *SCENE.lock().unwrap() = Some(Scene { image, width, height, scale, zoom: f(v, "zoom").unwrap_or(1.0), windows: wins });
                capture::start_overlay(app, s(v, "mode").unwrap_or("capture"));
                Ok(json!("overlay-1"))
            }
            "eval" => {
                win_of(app, v)?.eval(s(v, "js").ok_or("missing js")?).map_err(|e| e.to_string())?;
                Ok(Value::Null)
            }
            "emit" => {
                use tauri::Emitter;
                app.emit(s(v, "event").ok_or("missing event")?, v.get("payload").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
                Ok(Value::Null)
            }
            "zoom" => {
                win_of(app, v)?.set_zoom(f(v, "zoom").unwrap_or(1.0)).map_err(|e| e.to_string())?;
                Ok(Value::Null)
            }
            "close" => {
                if let Ok(w) = win_of(app, v) {
                    let _ = w.destroy();
                }
                Ok(Value::Null)
            }
            "closeall" => {
                for (_, w) in app.webview_windows() {
                    let _ = w.destroy();
                }
                Ok(Value::Null)
            }
            "place" => {
                let w = win_of(app, v)?;
                // move first: AppKit clamps a titled window's height to the screen it is on while resizing
                if let (Some(x), Some(y)) = (f(v, "x"), f(v, "y")) {
                    let _ = w.set_position(tauri::LogicalPosition::new(x, y));
                }
                if let (Some(ww), Some(hh)) = (f(v, "w"), f(v, "h")) {
                    let _ = w.set_size(tauri::LogicalSize::new(ww, hh));
                }
                if let Some(z) = f(v, "zoom") {
                    let _ = w.set_zoom(z);
                }
                Ok(Value::Null)
            }
            "tray_menu" => {
                // pop up the real menu-bar menu at a spot of an (invisible) helper window; the run is ended by killing the app
                let anchor = win_of(app, v)?;
                let menu = crate::tray::build_menu(app).map_err(|e| e.to_string())?;
                let (x, y) = (f(v, "mx").unwrap_or(0.0), f(v, "my").unwrap_or(0.0));
                let a2 = anchor.clone();
                let _ = app.run_on_main_thread(move || {
                    let _ = menu.popup_at(a2.as_ref().window().clone(), tauri::LogicalPosition::new(x, y));
                });
                Ok(Value::Null)
            }
            "windows" => {
                let list: Vec<Value> = app
                    .webview_windows()
                    .iter()
                    .map(|(l, w)| {
                        let p = w.outer_position().map(|p| (p.x, p.y)).unwrap_or((0, 0));
                        json!({ "label": l, "title": w.title().unwrap_or_default(), "x": p.0, "y": p.1 })
                    })
                    .collect();
                Ok(json!(list))
            }
            "editor" => {
                let path = s(v, "path").ok_or("missing path")?;
                windows::allow_asset(app, path);
                let mut o = v.clone();
                o["page"] = json!("editor");
                o["query"] = json!(format!("path={}&demo=1", windows::url_encode(path)));
                o["label"] = json!(format!("editor-{}", uuid::Uuid::new_v4().simple()));
                o["title"] = json!("CaptureME Editor");
                o["init"] = json!("try{localStorage.clear()}catch(e){}"); // every demo editor starts with factory preferences
                open(app, &o)
            }
            "thumb" => {
                thumb::show(app, &capture_result(v)?);
                Ok(json!("thumb"))
            }
            "ocr" => {
                ocr::run_on_image(app, s(v, "path").ok_or("missing path")?);
                Ok(Value::Null)
            }
            "qr" => {
                qr::run_on_image(app, s(v, "path").ok_or("missing path")?);
                Ok(Value::Null)
            }
            "pin" => {
                pin::open_pin(app, s(v, "path").ok_or("missing path")?);
                Ok(Value::Null)
            }
            "colors" => {
                for c in v.get("list").and_then(|a| a.as_array()).ok_or("missing list")? {
                    let a: Vec<u8> = c.as_array().map(|x| x.iter().filter_map(|n| n.as_u64()).map(|n| n as u8).collect()).unwrap_or_default();
                    if a.len() == 3 {
                        colors::record_pick(app, [a[0], a[1], a[2]])?;
                    }
                }
                colors::show_panel(app);
                Ok(Value::Null)
            }
            "history_add" => {
                history::record(app, &capture_result(v)?);
                Ok(Value::Null)
            }
            "settings" => {
                let mut cur = serde_json::to_value(settings::get(app)).map_err(|e| e.to_string())?;
                if let (Some(o), Some(patch)) = (cur.as_object_mut(), v.get("patch").and_then(|p| p.as_object())) {
                    for (k, val) in patch {
                        o.insert(k.clone(), val.clone());
                    }
                }
                let st: crate::types::Settings = serde_json::from_value(cur).map_err(|e| e.to_string())?;
                crate::settings::save_settings(app.clone(), st).map_err(|e| e.to_string())?;
                Ok(Value::Null)
            }
            "settings_window" => Ok(json!(windows::open_page(app, "settings", "settings", s(v, "query").unwrap_or(""), "CaptureME Settings", f(v, "w").unwrap_or(720.0), f(v, "h").unwrap_or(560.0)).map_err(|e| e.to_string())?.label())),
            "history_window" => Ok(json!(windows::open_history(app).map_err(|e| e.to_string())?.label())),
            "onboarding" => Ok(json!(windows::open_page(app, "onboarding", "onboarding", "", "CaptureME", 580.0, 720.0).map_err(|e| e.to_string())?.label())),
            "quit" => {
                app.exit(0);
                Ok(Value::Null)
            }
            other => Err(format!("unknown op {other:?}")),
        }
    }

    fn capture_result(v: &Value) -> Result<CaptureResult, String> {
        let path = s(v, "path").ok_or("missing path")?.to_string();
        let (w, h) = image::image_dimensions(&path).map_err(|e| e.to_string())?;
        Ok(CaptureResult {
            id: s(v, "id").map(String::from).unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            path,
            width: w,
            height: h,
            scale: f(v, "scale").unwrap_or(2.0),
            created_at: s(v, "created_at").map(String::from).unwrap_or_else(|| chrono::Local::now().to_rfc3339()),
        })
    }

    /// Generic window: `page`, `query`, `title`, `w`, `h`, optional `x`,`y`, `frameless`, `init` (JS run before the page).
    fn open(app: &AppHandle, v: &Value) -> Result<Value, String> {
        let label = s(v, "label").unwrap_or("demo");
        if let Some(w) = app.get_webview_window(label) {
            let _ = w.destroy();
        }
        let page = s(v, "page").ok_or("missing page")?;
        if let Some(p) = s(v, "allow") {
            windows::allow_asset(app, p); // e.g. a sample video for the video window
        }
        let url = match s(v, "query") {
            Some(q) if !q.is_empty() => format!("{page}.html?{q}"),
            _ => format!("{page}.html"),
        };
        let mut b = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
            .title(s(v, "title").unwrap_or("CaptureME"))
            .inner_size(f(v, "w").unwrap_or(800.0), f(v, "h").unwrap_or(600.0))
            .focused(true);
        if v.get("frameless").and_then(|x| x.as_bool()).unwrap_or(false) {
            b = b.decorations(false).transparent(true).shadow(v.get("shadow").and_then(|x| x.as_bool()).unwrap_or(true)).always_on_top(true).resizable(false).skip_taskbar(true);
        }
        if let Some(js) = s(v, "init") {
            b = b.initialization_script(js);
        }
        b = match (f(v, "x"), f(v, "y")) {
            (Some(x), Some(y)) => b.position(x, y),
            _ => b.center(),
        };
        Ok(json!(b.build().map_err(|e| e.to_string())?.label()))
    }
}

pub use imp::*;
