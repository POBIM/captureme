//! Capture core: screenshots, the frozen-screen selection overlay and result dispatch. Owner: Agent A.
//!
//! Flow: `start_overlay(mode)` → grab every monitor (xcap) → write each to a temp PNG → open one
//! borderless always-on-top window per monitor (`overlay.html`). The overlay talks back through
//! `overlay_info`, `overlay_ready`, `overlay_finish` and `overlay_cancel`.
use crate::{colors, export, floating, history, import, ocr, paths, permissions, pin, qr, recording, scroll, settings, thumb, types::*, windows};
use image::{codecs::png::{CompressionType, FilterType, PngEncoder}, ExtendedColorType, ImageEncoder, RgbaImage};
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

// ---------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------

/// One frozen monitor screenshot (kept in memory for cropping; a PNG copy feeds the webview).
struct Shot {
    id: u32,
    /// Global logical origin / size (points).
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    scale: f64,
    image: RgbaImage,
    png: PathBuf,
}

#[derive(Clone, Serialize)]
pub struct WinInfo {
    pub id: u32,
    pub app: String,
    pub title: String,
    /// Global logical frame (points, top-left origin).
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

struct Session {
    mode: String,
    shots: Vec<Shot>,
    windows: Vec<WinInfo>,
    labels: Vec<String>,
    /// Monitor under the cursor when the overlay opened (gets keyboard focus).
    key_monitor: u32,
}

static SESSION: Mutex<Option<Session>> = Mutex::new(None);
/// An overlay session is open or being created.
static ACTIVE: AtomicBool = AtomicBool::new(false);
/// A delayed-capture countdown is running.
static COUNTING: AtomicBool = AtomicBool::new(false);
/// The last region/window selection (for "repeat last region").
static LAST_REGION: Mutex<Option<SelectionRect>> = Mutex::new(None);
/// We registered the global Esc shortcut for the current overlay session.
static ESC_REGISTERED: AtomicBool = AtomicBool::new(false);
/// Colours were picked (Shift+click) during the current colour-picker session.
static COLOR_PICKED: AtomicBool = AtomicBool::new(false);

const OVERLAY_LEVEL: isize = 1000; // NSScreenSaverWindowLevel – above the menu bar and Dock

fn session_lock() -> std::sync::MutexGuard<'static, Option<Session>> {
    SESSION.lock().unwrap_or_else(|e| e.into_inner())
}

fn take_session() -> Option<Session> {
    let s = session_lock().take();
    ACTIVE.store(false, Ordering::SeqCst);
    s
}

// ---------------------------------------------------------------------------------------------
// Public API (signatures fixed by AGENTS.md)
// ---------------------------------------------------------------------------------------------

pub fn start_region(app: &AppHandle) {
    start_overlay(app, "capture")
}

pub fn start_window(app: &AppHandle) {
    start_overlay(app, "window")
}

/// Open the frozen-screen overlay. `mode`: capture | window | ocr | pin | scroll | record.
pub fn start_overlay(app: &AppHandle, mode: &str) {
    let (app, mode) = (app.clone(), mode.to_string());
    std::thread::spawn(move || {
        if let Err(e) = open_overlays(&app, &mode) {
            log::error!("start_overlay({mode}) failed: {e}");
            unregister_escape(&app);
            if !e.starts_with("screen recording permission") {
                floating::alert(&app, "เริ่มจับภาพไม่สำเร็จ", "Could not start the capture", &e);
            }
        }
    });
}

/// Capture the monitor under the cursor immediately (no overlay).
pub fn start_fullscreen(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        if !ensure_permission(&app) {
            return;
        }
        let res = (|| -> Result<(), String> {
            let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
            let m = monitor_under_cursor(&monitors).ok_or("no monitor found")?;
            let mut img = m.capture_image().map_err(|e| e.to_string())?;
            let scale = img.width() as f64 / (m.width().map_err(|e| e.to_string())?.max(1) as f64);
            if settings::get(&app).include_cursor {
                add_cursor(&mut img, (m.x().unwrap_or(0) as f64, m.y().unwrap_or(0) as f64), scale);
            }
            deliver(&app, "capture", img, scale)
        })();
        if let Err(e) = res {
            log::error!("fullscreen capture failed: {e}");
            floating::alert(&app, "จับภาพไม่สำเร็จ", "Capture failed", &e);
        }
    });
}

/// Small countdown, then the region overlay.
pub fn start_delayed(app: &AppHandle, secs: u64) {
    if ACTIVE.load(Ordering::SeqCst) || COUNTING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let secs = secs.clamp(1, 60);
        let win = open_countdown(&app, secs);
        std::thread::sleep(Duration::from_secs(secs));
        if let Some(w) = win {
            let _ = w.destroy();
        }
        std::thread::sleep(Duration::from_millis(150)); // let the countdown vanish from the screen
        COUNTING.store(false, Ordering::SeqCst);
        if let Err(e) = open_overlays(&app, "capture") {
            log::error!("delayed capture failed: {e}");
        }
    });
}

// ---------------------------------------------------------------------------------------------
// Helpers: permission, cursor, monitors, windows
// ---------------------------------------------------------------------------------------------

fn ensure_permission(app: &AppHandle) -> bool {
    if permissions::has_screen_access() {
        return true;
    }
    let a = app.clone();
    let _ = app.run_on_main_thread(move || permissions::show_onboarding(&a));
    false
}

/// Global cursor position in logical points, top-left origin (same space as xcap).
fn cursor_pos() -> Option<(f64, f64)> {
    use core_graphics::event::CGEvent;
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    let src = CGEventSource::new(CGEventSourceStateID::HIDSystemState).ok()?;
    let p = CGEvent::new(src).ok()?.location();
    Some((p.x, p.y))
}

fn monitor_under_cursor(monitors: &[xcap::Monitor]) -> Option<&xcap::Monitor> {
    if let Some((cx, cy)) = cursor_pos() {
        for m in monitors {
            let (Ok(x), Ok(y), Ok(w), Ok(h)) = (m.x(), m.y(), m.width(), m.height()) else { continue };
            if cx >= x as f64 && cx < (x + w as i32) as f64 && cy >= y as f64 && cy < (y + h as i32) as f64 {
                return Some(m);
            }
        }
    }
    monitors.iter().find(|m| m.is_primary().unwrap_or(false)).or(monitors.first())
}

/// Normal (layer 0) on-screen windows, front-most first.
fn list_windows() -> Vec<WinInfo> {
    use core_foundation::{
        base::{CFType, TCFType},
        dictionary::CFDictionary,
        number::CFNumber,
        string::CFString,
    };
    use core_graphics::window::{copy_window_info, kCGNullWindowID, kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly};

    type Dict = CFDictionary<CFString, CFType>;
    fn get<'a>(d: &'a Dict, key: &str) -> Option<core_foundation::base::ItemRef<'a, CFType>> {
        d.find(CFString::new(key))
    }
    fn num(d: &Dict, key: &str) -> Option<f64> {
        get(d, key)?.downcast::<CFNumber>()?.to_f64()
    }
    fn text(d: &Dict, key: &str) -> String {
        get(d, key).and_then(|v| v.downcast::<CFString>()).map(|s| s.to_string()).unwrap_or_default()
    }

    let Some(arr) = copy_window_info(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID) else {
        return vec![];
    };
    let mut out = Vec::new();
    for item in arr.iter() {
        let d: Dict = unsafe { CFDictionary::wrap_under_get_rule(*item as core_foundation::dictionary::CFDictionaryRef) };
        if num(&d, "kCGWindowLayer").unwrap_or(1.0) != 0.0 || num(&d, "kCGWindowAlpha").unwrap_or(1.0) < 0.05 {
            continue;
        }
        let Some(id) = num(&d, "kCGWindowNumber") else { continue };
        let Some(raw) = get(&d, "kCGWindowBounds").and_then(|v| v.downcast::<CFDictionary>()) else { continue };
        let b: Dict = unsafe { CFDictionary::wrap_under_get_rule(raw.as_concrete_TypeRef()) };
        let (Some(x), Some(y), Some(w), Some(h)) = (num(&b, "X"), num(&b, "Y"), num(&b, "Width"), num(&b, "Height")) else {
            continue;
        };
        if w < 40.0 || h < 30.0 {
            continue;
        }
        out.push(WinInfo { id: id as u32, app: text(&d, "kCGWindowOwnerName"), title: text(&d, "kCGWindowName"), x, y, width: w, height: h });
    }
    out
}

fn write_png(img: &RgbaImage, path: &Path) -> Result<(), String> {
    let f = std::io::BufWriter::new(std::fs::File::create(path).map_err(|e| e.to_string())?);
    PngEncoder::new_with_quality(f, CompressionType::Fast, FilterType::Sub)
        .write_image(img.as_raw(), img.width(), img.height(), ExtendedColorType::Rgba8)
        .map_err(|e| e.to_string())
}

/// Draw the mouse cursor into `img` (a monitor screenshot whose top-left is `origin` in global
/// points, `scale` pixels per point).
fn add_cursor(img: &mut RgbaImage, origin: (f64, f64), scale: f64) {
    let Some((cx, cy)) = cursor_pos() else { return };
    let Some((sprite, hx, hy, pw, ph)) = cursor_sprite() else { return };
    let (tw, th) = (((pw * scale).round() as u32).max(1), ((ph * scale).round() as u32).max(1));
    let sprite = if sprite.width() != tw || sprite.height() != th {
        image::imageops::resize(&sprite, tw, th, image::imageops::FilterType::Lanczos3)
    } else {
        sprite
    };
    let x = ((cx - origin.0 - hx) * scale).round() as i64;
    let y = ((cy - origin.1 - hy) * scale).round() as i64;
    image::imageops::overlay(img, &sprite, x, y);
}

/// The current cursor image + hot spot + size (points).
#[cfg(target_os = "macos")]
fn cursor_sprite() -> Option<(RgbaImage, f64, f64, f64, f64)> {
    use objc2_app_kit::NSCursor;
    objc2::rc::autoreleasepool(|_| {
        #[allow(deprecated)]
        let c = NSCursor::currentSystemCursor().unwrap_or_else(NSCursor::arrowCursor);
        let img = c.image();
        let hot = c.hotSpot();
        let size = img.size();
        let tiff = img.TIFFRepresentation()?;
        let rgba = import::tiff_to_rgba(&tiff.to_vec()).ok()?;
        Some((rgba, hot.x, hot.y, size.width, size.height))
    })
}

#[cfg(not(target_os = "macos"))]
fn cursor_sprite() -> Option<(RgbaImage, f64, f64, f64, f64)> {
    None
}

/// Capture one window through CoreGraphics. With `shadow` the image includes the window's
/// drop shadow on a transparent background (macOS ⌥-click style); without it, just the window.
#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn capture_window_cg(id: u32, shadow: bool) -> Result<RgbaImage, String> {
    use objc2_core_foundation::{CGPoint, CGRect, CGSize};
    use objc2_core_graphics::{CGDataProvider, CGImage, CGWindowImageOption, CGWindowListCreateImage, CGWindowListOption};
    // CGRectNull → "the window's own bounds" (incl. framing effects unless told to ignore them).
    let null = CGRect::new(CGPoint::new(f64::INFINITY, f64::INFINITY), CGSize::new(0.0, 0.0));
    let opt = if shadow { CGWindowImageOption::Default } else { CGWindowImageOption::BoundsIgnoreFraming };
    let cg = CGWindowListCreateImage(null, CGWindowListOption::OptionIncludingWindow, id, opt).ok_or("window image unavailable")?;
    let (w, h) = (CGImage::width(Some(&cg)), CGImage::height(Some(&cg)));
    if w == 0 || h == 0 {
        return Err("empty window image".into());
    }
    let stride = CGImage::bytes_per_row(Some(&cg));
    let provider = CGImage::data_provider(Some(&cg));
    let data = CGDataProvider::data(provider.as_deref()).ok_or("no pixel data")?.to_vec();
    let mut buf = Vec::with_capacity(w * h * 4);
    for row in data.chunks_exact(stride.max(w * 4)).take(h) {
        buf.extend_from_slice(&row[..w * 4]);
    }
    for px in buf.chunks_exact_mut(4) {
        px.swap(0, 2); // BGRA → RGBA
        let a = px[3] as u32;
        if a > 0 && a < 255 {
            // premultiplied → straight alpha (soft shadow edges stay clean)
            for c in &mut px[..3] {
                *c = ((*c as u32 * 255) / a).min(255) as u8;
            }
        }
    }
    RgbaImage::from_raw(w as u32, h as u32, buf).ok_or_else(|| "bad window image".into())
}

#[cfg(not(target_os = "macos"))]
fn capture_window_cg(_id: u32, _shadow: bool) -> Result<RgbaImage, String> {
    Err("unsupported".into())
}

fn play_shutter(app: &AppHandle) {
    if !settings::get(app).play_sound {
        return;
    }
    const DIR: &str = "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system";
    for name in ["Screen Capture.aif", "Grab.aif", "Shutter.aif"] {
        let p = format!("{DIR}/{name}");
        if Path::new(&p).exists() {
            let _ = std::process::Command::new("afplay").arg(p).spawn();
            return;
        }
    }
}

// ---------------------------------------------------------------------------------------------
// macOS window styling
// ---------------------------------------------------------------------------------------------

/// Apply overlay styling to an NSWindow on the main thread.
/// `frame` = (x, y, w, h) in Cocoa coordinates (origin bottom-left of the primary display).
fn style_window(app: &AppHandle, win: &WebviewWindow, frame: Option<(f64, f64, f64, f64)>, show: Option<bool>) {
    #[cfg(target_os = "macos")]
    {
        use objc2::MainThreadMarker;
        use objc2_app_kit::{NSApplication, NSColor, NSWindow, NSWindowCollectionBehavior};
        use objc2_foundation::{NSPoint, NSRect, NSSize};
        let Ok(ptr) = win.ns_window() else { return };
        let ptr = ptr as usize;
        let _ = app.run_on_main_thread(move || unsafe {
            let Some(mtm) = MainThreadMarker::new() else { return };
            let w: &NSWindow = &*(ptr as *const NSWindow);
            w.setLevel(OVERLAY_LEVEL);
            w.setCollectionBehavior(
                NSWindowCollectionBehavior::CanJoinAllSpaces
                    | NSWindowCollectionBehavior::Stationary
                    | NSWindowCollectionBehavior::FullScreenAuxiliary
                    | NSWindowCollectionBehavior::IgnoresCycle,
            );
            w.setHasShadow(false);
            w.setOpaque(false);
            w.setBackgroundColor(Some(&NSColor::clearColor()));
            if let Some((x, y, fw, fh)) = frame {
                w.setFrame_display(NSRect::new(NSPoint::new(x, y), NSSize::new(fw, fh)), false);
            }
            match show {
                Some(true) => {
                    #[allow(deprecated)]
                    NSApplication::sharedApplication(mtm).activateIgnoringOtherApps(true);
                    w.makeKeyAndOrderFront(None);
                }
                Some(false) => w.orderFrontRegardless(),
                None => {}
            }
        });
    }
}

// ---------------------------------------------------------------------------------------------
// Overlay session
// ---------------------------------------------------------------------------------------------

fn open_overlays(app: &AppHandle, mode: &str) -> Result<(), String> {
    if !ensure_permission(app) {
        return Err("screen recording permission missing".into());
    }
    if ACTIVE.swap(true, Ordering::SeqCst) {
        return Ok(()); // already open
    }
    let r = build_session(app, mode);
    if r.is_err() {
        take_session();
    }
    r
}

fn build_session(app: &AppHandle, mode: &str) -> Result<(), String> {
    let tmp = paths::temp_dir(app);
    cleanup_old_temp(&tmp);
    let sid = uuid::Uuid::new_v4().simple().to_string();

    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    let key_monitor = monitor_under_cursor(&monitors).and_then(|m| m.id().ok()).unwrap_or(0);
    let primary_h = monitors
        .iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or(monitors.first())
        .and_then(|m| m.height().ok())
        .unwrap_or(0) as f64;

    let windows_list = list_windows();
    let with_cursor = settings::get(app).include_cursor && matches!(mode, "capture" | "window");

    // Screenshot + encode every monitor in parallel.
    let shots: Vec<Shot> = std::thread::scope(|s| {
        let handles: Vec<_> = monitors
            .iter()
            .map(|m| {
                let tmp = &tmp;
                let sid = &sid;
                s.spawn(move || -> Result<Shot, String> {
                    let id = m.id().map_err(|e| e.to_string())?;
                    let (x, y) = (m.x().map_err(|e| e.to_string())? as f64, m.y().map_err(|e| e.to_string())? as f64);
                    let (w, h) = (m.width().map_err(|e| e.to_string())? as f64, m.height().map_err(|e| e.to_string())? as f64);
                    let mut image = m.capture_image().map_err(|e| e.to_string())?;
                    let scale = image.width() as f64 / w.max(1.0);
                    if with_cursor {
                        add_cursor(&mut image, (x, y), scale);
                    }
                    let png = tmp.join(format!("overlay-{sid}-{id}.png"));
                    write_png(&image, &png)?;
                    Ok(Shot { id, x, y, w, h, scale, image, png })
                })
            })
            .collect();
        handles
            .into_iter()
            .filter_map(|h| match h.join() {
                Ok(Ok(s)) => Some(s),
                Ok(Err(e)) => {
                    log::warn!("monitor capture failed: {e}");
                    None
                }
                Err(_) => None,
            })
            .collect()
    });
    if shots.is_empty() {
        return Err("could not capture any monitor".into());
    }

    let labels: Vec<String> = shots.iter().map(|s| format!("overlay-{}", s.id)).collect();
    let layout: Vec<(String, u32, f64, f64, f64, f64, String)> = shots
        .iter()
        .map(|s| (format!("overlay-{}", s.id), s.id, s.x, s.y, s.w, s.h, s.png.to_string_lossy().into_owned()))
        .collect();

    *session_lock() = Some(Session { mode: mode.to_string(), shots, windows: windows_list, labels: labels.clone(), key_monitor });

    for (label, id, x, y, w, h, png) in layout {
        let query = format!("mode={}&monitor={}&img={}", mode, id, windows::url_encode(&png));
        let win = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(format!("overlay.html?{query}").into()))
            .title("CaptureME overlay")
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .visible(false)
            .focused(false)
            .accept_first_mouse(true)
            .visible_on_all_workspaces(true)
            .position(x, y)
            .inner_size(w, h)
            .build()
            .map_err(|e| e.to_string())?;
        style_window(app, &win, Some((x, primary_h - (y + h), w, h)), None);
        let a = app.clone();
        win.on_window_event(move |ev| {
            // Closed by some other means (Cmd+W, crash…) → end the session.
            if matches!(ev, WindowEvent::Destroyed) && session_lock().is_some() {
                end_session(&a);
            }
        });
    }

    register_escape(app);

    // Safety net: show windows whose page never reported ready.
    let a = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(2500));
        let (labels, key) = match session_lock().as_ref() {
            Some(s) => (s.labels.clone(), s.key_monitor),
            None => return,
        };
        for l in labels {
            if let Some(w) = a.get_webview_window(&l) {
                if !w.is_visible().unwrap_or(true) {
                    show_overlay(&a, &w, l == format!("overlay-{key}"));
                }
            }
        }
    });
    Ok(())
}

/// Global Esc while an overlay is open: the way out even if the overlay page failed to load or
/// never got keyboard focus.
fn register_escape(app: &AppHandle) {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
    let a = app.clone();
    let r = app.global_shortcut().on_shortcut("Escape", move |_app, _sc, ev| {
        if ev.state == ShortcutState::Pressed {
            let a = a.clone();
            std::thread::spawn(move || end_session(&a)); // never unregister from inside the callback
        }
    });
    match r {
        Ok(()) => ESC_REGISTERED.store(true, Ordering::SeqCst),
        Err(e) => log::warn!("cannot register Esc for the overlay: {e}"),
    }
}

fn unregister_escape(app: &AppHandle) {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    if ESC_REGISTERED.swap(false, Ordering::SeqCst) {
        let _ = app.global_shortcut().unregister("Escape");
    }
}

fn show_overlay(app: &AppHandle, win: &WebviewWindow, key: bool) {
    let _ = win.show();
    style_window(app, win, None, Some(key));
}

fn close_labels(app: &AppHandle, labels: &[String]) {
    for l in labels {
        if let Some(w) = app.get_webview_window(l) {
            let _ = w.destroy();
        }
    }
}

fn cleanup_session_files(s: &Session) {
    for shot in &s.shots {
        let _ = std::fs::remove_file(&shot.png);
    }
}

fn cleanup_old_temp(dir: &Path) {
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        // Frozen screenshots are only needed during a session; pin/ocr crops live a day.
        let max_age = if name.starts_with("overlay-") {
            3600
        } else if name.starts_with("crop-") || name.starts_with("pin-") || name.starts_with("drag-") || name.starts_with("rec-") {
            24 * 3600
        } else {
            continue;
        };
        let stale = e
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.elapsed().ok())
            .map(|d| d > Duration::from_secs(max_age))
            .unwrap_or(false);
        if stale {
            let p = e.path();
            if p.is_dir() {
                let _ = std::fs::remove_dir_all(&p);
            } else {
                let _ = std::fs::remove_file(&p);
            }
        }
    }
}

/// Remove leftovers from a previous run (call once at startup, before any session exists).
pub fn cleanup_stale(app: &AppHandle) {
    let dir = paths::temp_dir(app);
    if let Ok(rd) = std::fs::read_dir(&dir) {
        for e in rd.flatten() {
            if e.file_name().to_string_lossy().starts_with("overlay-") {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
    cleanup_old_temp(&dir);
}

/// Tear the session down without capturing.
fn end_session(app: &AppHandle) {
    if let Some(s) = take_session() {
        unregister_escape(app);
        if s.mode == "color" && COLOR_PICKED.swap(false, Ordering::SeqCst) {
            colors::show_panel(app); // keep-picking session ended (Esc): show what was collected
        }
        let (app, labels) = (app.clone(), s.labels.clone());
        std::thread::spawn(move || {
            close_labels(&app, &labels);
            cleanup_session_files(&s);
        });
    }
}

// ---------------------------------------------------------------------------------------------
// Commands used by the overlay page
// ---------------------------------------------------------------------------------------------

#[derive(Serialize)]
pub struct OverlayWindow {
    pub id: u32,
    pub app: String,
    pub title: String,
    /// Frame relative to this monitor, logical points, clipped to the monitor.
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize)]
pub struct OverlayInfo {
    pub mode: String,
    pub monitor_id: u32,
    pub monitor_x: f64,
    pub monitor_y: f64,
    pub width: f64,
    pub height: f64,
    pub scale: f64,
    /// Front-most first.
    pub windows: Vec<OverlayWindow>,
}

#[tauri::command]
pub fn overlay_info(monitor: u32) -> CmdResult<OverlayInfo> {
    let guard = session_lock();
    let s = guard.as_ref().ok_or("no active overlay")?;
    let shot = s.shots.iter().find(|m| m.id == monitor).ok_or("unknown monitor")?;
    let windows = s
        .windows
        .iter()
        .filter_map(|w| {
            let (x0, y0) = ((w.x - shot.x).max(0.0), (w.y - shot.y).max(0.0));
            let (x1, y1) = ((w.x + w.width - shot.x).min(shot.w), (w.y + w.height - shot.y).min(shot.h));
            (x1 - x0 >= 20.0 && y1 - y0 >= 20.0).then(|| OverlayWindow {
                id: w.id,
                app: w.app.clone(),
                title: w.title.clone(),
                x: x0,
                y: y0,
                width: x1 - x0,
                height: y1 - y0,
            })
        })
        .collect();
    Ok(OverlayInfo {
        mode: s.mode.clone(),
        monitor_id: shot.id,
        monitor_x: shot.x,
        monitor_y: shot.y,
        width: shot.w,
        height: shot.h,
        scale: shot.scale,
        windows,
    })
}

/// The overlay page has decoded its screenshot → reveal the window.
#[tauri::command]
pub fn overlay_ready(app: AppHandle, window: WebviewWindow) {
    let key = match session_lock().as_ref() {
        Some(s) => window.label() == format!("overlay-{}", s.key_monitor),
        None => return,
    };
    show_overlay(&app, &window, key);
}

#[tauri::command]
pub fn overlay_cancel(app: AppHandle) {
    end_session(&app);
}

// ---- measure / colour tools (the overlay stays open, the frozen screenshot is read here) ----

#[derive(Serialize)]
pub struct Edges {
    /// Boundary lines in points, relative to the monitor.
    pub left: f64,
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub w_px: u32,
    pub h_px: u32,
}

fn px_diff(a: &image::Rgba<u8>, b: &image::Rgba<u8>) -> i32 {
    (0..3).map(|i| (a[i] as i32 - b[i] as i32).abs()).sum()
}

/// Inclusive pixel range [left, top, right, bottom] of the area around (px, py) that is bounded by
/// colour edges (a neighbouring pixel differing by more than `tol`, summed over RGB).
fn find_edges(img: &RgbaImage, px: u32, py: u32, tol: i32) -> (u32, u32, u32, u32) {
    let (w, h) = (img.width(), img.height());
    let (px, py) = (px.min(w - 1), py.min(h - 1));
    let (mut l, mut r, mut t, mut b) = (px, px, py, py);
    while l > 0 && px_diff(img.get_pixel(l - 1, py), img.get_pixel(l, py)) <= tol {
        l -= 1;
    }
    while r + 1 < w && px_diff(img.get_pixel(r + 1, py), img.get_pixel(r, py)) <= tol {
        r += 1;
    }
    while t > 0 && px_diff(img.get_pixel(px, t - 1), img.get_pixel(px, t)) <= tol {
        t -= 1;
    }
    while b + 1 < h && px_diff(img.get_pixel(px, b + 1), img.get_pixel(px, b)) <= tol {
        b += 1;
    }
    (l, t, r, b)
}

/// Auto edge detection for the "measure" overlay: scan from (x, y) in four directions.
#[tauri::command]
pub fn overlay_measure(monitor: u32, x: f64, y: f64, tol: u32) -> CmdResult<Edges> {
    let guard = session_lock();
    let s = guard.as_ref().ok_or("no active overlay")?;
    let shot = s.shots.iter().find(|m| m.id == monitor).ok_or("unknown monitor")?;
    let (iw, ih) = (shot.image.width(), shot.image.height());
    if iw == 0 || ih == 0 {
        return Err("empty screenshot".into());
    }
    let px = ((x * shot.scale).floor().max(0.0) as u32).min(iw - 1);
    let py = ((y * shot.scale).floor().max(0.0) as u32).min(ih - 1);
    let (l, t, r, b) = find_edges(&shot.image, px, py, tol.min(255) as i32);
    let sc = shot.scale;
    Ok(Edges { left: l as f64 / sc, top: t as f64 / sc, right: (r + 1) as f64 / sc, bottom: (b + 1) as f64 / sc, w_px: r - l + 1, h_px: b - t + 1 })
}

fn pixel_at(shot: &Shot, x: f64, y: f64) -> [u8; 3] {
    let px = ((x * shot.scale).floor().max(0.0) as u32).min(shot.image.width().saturating_sub(1));
    let py = ((y * shot.scale).floor().max(0.0) as u32).min(shot.image.height().saturating_sub(1));
    let p = shot.image.get_pixel(px, py);
    [p[0], p[1], p[2]]
}

/// RGB under (x, y) – used by the colour overlay when the page cannot read pixels itself.
#[tauri::command]
pub fn overlay_pixel(monitor: u32, x: f64, y: f64) -> CmdResult<[u8; 3]> {
    let guard = session_lock();
    let s = guard.as_ref().ok_or("no active overlay")?;
    let shot = s.shots.iter().find(|m| m.id == monitor).ok_or("unknown monitor")?;
    Ok(pixel_at(shot, x, y))
}

/// The user clicked a pixel in colour-picker mode: copy it (user's format), remember it, and – unless
/// `keep` (Shift+click) – close the overlay and show the recent-colours panel.
#[tauri::command]
pub fn overlay_color_pick(app: AppHandle, monitor: u32, x: f64, y: f64, keep: bool) -> CmdResult<colors::PickedColor> {
    let rgb = {
        let guard = session_lock();
        let s = guard.as_ref().ok_or("no active overlay")?;
        let shot = s.shots.iter().find(|m| m.id == monitor).ok_or("unknown monitor")?;
        pixel_at(shot, x, y)
    };
    let picked = colors::record_pick(&app, rgb)?;
    if keep {
        COLOR_PICKED.store(true, Ordering::SeqCst);
    } else {
        end_session(&app);
        colors::show_panel(&app);
    }
    Ok(picked)
}

/// Change the colour format (hex / rgb / hsl) from the overlay (F key).
#[tauri::command]
pub fn color_set_format(app: AppHandle, format: String) -> CmdResult<()> {
    settings::update(&app, |s| s.color_format = format)
}

/// Finish the selection. `mode` may differ from the session mode (toolbar buttons):
/// capture | copy | ocr | pin | scroll | record. `window_id` = snapped window to capture on its own.
#[tauri::command]
pub fn overlay_finish(app: AppHandle, mode: String, rect: SelectionRect, window_id: Option<u32>) -> CmdResult<()> {
    let session = take_session().ok_or("no active overlay")?;
    unregister_escape(&app);
    if matches!(mode.as_str(), "capture" | "copy") {
        *LAST_REGION.lock().unwrap_or_else(|e| e.into_inner()) = Some(rect);
    }
    std::thread::spawn(move || {
        close_labels(&app, &session.labels);
        if let Err(e) = finish(&app, &session, &mode, rect, window_id) {
            log::error!("capture failed: {e}");
            floating::alert(&app, "จับภาพไม่สำเร็จ", "Capture failed", &e);
        }
        cleanup_session_files(&session);
    });
    Ok(())
}

fn finish(app: &AppHandle, s: &Session, mode: &str, rect: SelectionRect, window_id: Option<u32>) -> Result<(), String> {
    if mode == "scroll" || mode == "record" || mode == "record-window" {
        std::thread::sleep(Duration::from_millis(200)); // overlay must be gone before they grab frames
        if mode == "scroll" {
            scroll::start_region(app, rect);
        } else if let (true, Some(id)) = (mode == "record-window", window_id) {
            recording::start_window(app, rect, id);
        } else {
            recording::start_region(app, rect);
        }
        return Ok(());
    }

    // Snapped window → capture just that window (works even if partly covered).
    if let (Some(id), "capture" | "copy") = (window_id, mode) {
        let shadow = settings::get(app).window_shadow;
        match capture_window_cg(id, shadow).or_else(|e| {
            log::warn!("CG window capture failed ({e}); trying xcap");
            capture_window(id).map(|(img, _)| img)
        }) {
            Ok(img) => return deliver(app, mode, img, rect.scale.max(1.0)),
            Err(e) => log::warn!("window capture failed ({e}); falling back to crop"),
        }
    }

    let shot = s.shots.iter().find(|m| m.id == rect.monitor_id).ok_or("unknown monitor")?;
    let (iw, ih) = (shot.image.width(), shot.image.height());
    let sc = shot.scale;
    let x0 = ((rect.x * sc).round().max(0.0) as u32).min(iw.saturating_sub(1));
    let y0 = ((rect.y * sc).round().max(0.0) as u32).min(ih.saturating_sub(1));
    let x1 = (((rect.x + rect.width) * sc).round().max(0.0) as u32).min(iw);
    let y1 = (((rect.y + rect.height) * sc).round().max(0.0) as u32).min(ih);
    let (w, h) = (x1.saturating_sub(x0), y1.saturating_sub(y0));
    if w == 0 || h == 0 {
        return Err("empty selection".into());
    }
    let img = image::imageops::crop_imm(&shot.image, x0, y0, w, h).to_image();
    deliver(app, mode, img, sc)
}

fn capture_window(id: u32) -> Result<(RgbaImage, f64), String> {
    let wins = xcap::Window::all().map_err(|e| e.to_string())?;
    let w = wins.iter().find(|w| w.id().ok() == Some(id)).ok_or("window gone")?;
    let pts = w.width().map_err(|e| e.to_string())?.max(1) as f64;
    let img = w.capture_image().map_err(|e| e.to_string())?;
    let scale = img.width() as f64 / pts;
    Ok((img, scale))
}

// ---------------------------------------------------------------------------------------------
// Result dispatch
// ---------------------------------------------------------------------------------------------

fn deliver(app: &AppHandle, mode: &str, img: RgbaImage, scale: f64) -> Result<(), String> {
    match mode {
        "ocr" | "pin" | "qr" => {
            let path = paths::temp_dir(app).join(format!("crop-{}.png", uuid::Uuid::new_v4().simple()));
            write_png(&img, &path)?;
            let p = path.to_string_lossy().into_owned();
            match mode {
                "ocr" => ocr::run_on_image(app, &p),
                "qr" => qr::run_on_image(app, &p),
                _ => pin::open_pin(app, &p),
            }
            Ok(())
        }
        // "capture" and "copy"
        _ => save_capture(app, &img, scale, mode == "copy"),
    }
}

fn save_capture(app: &AppHandle, img: &RgbaImage, scale: f64, copy_only: bool) -> Result<(), String> {
    let result = store_capture(app, img, scale)?;
    play_shutter(app);
    after_capture(app, &result, copy_only)
}

/// Write a new capture PNG into the captures dir and add it to the history.
pub fn store_capture(app: &AppHandle, img: &RgbaImage, scale: f64) -> Result<CaptureResult, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Local::now();
    let path = paths::captures_dir(app).join(format!("capture-{}-{}.png", now.format("%Y%m%d-%H%M%S"), &id[..8]));
    write_png(img, &path)?;
    let result = CaptureResult {
        id,
        path: path.to_string_lossy().into_owned(),
        width: img.width(),
        height: img.height(),
        scale,
        created_at: now.to_rfc3339(),
    };
    history::record(app, &result);
    Ok(result)
}

/// What happens with a fresh capture: settings.after_capture = editor | thumbnail | copy | save.
fn after_capture(app: &AppHandle, res: &CaptureResult, copy_only: bool) -> Result<(), String> {
    if copy_only {
        return export::copy_file_to_clipboard(app, &res.path);
    }
    let s = settings::get(app);
    let copy_mode = s.after_capture == "copy";
    if s.copy_after_capture || copy_mode {
        if let Err(e) = export::copy_file_to_clipboard(app, &res.path) {
            if copy_mode {
                return Err(e);
            }
            log::warn!("copy to clipboard failed: {e}");
        }
    }
    match s.after_capture.as_str() {
        "thumbnail" => thumb::show(app, res),
        "copy" => {}
        "save" => {
            export::save_file_auto(app, &res.path)?;
        }
        _ => {
            windows::open_editor_with_id(app, &res.path, &res.id).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Repeat the last region/window selection on the current screen contents (no overlay).
pub fn repeat_last(app: &AppHandle) {
    let Some(r) = *LAST_REGION.lock().unwrap_or_else(|e| e.into_inner()) else {
        start_region(app); // nothing to repeat yet → ask for a region
        return;
    };
    let app = app.clone();
    std::thread::spawn(move || {
        if !ensure_permission(&app) {
            return;
        }
        let res = (|| -> Result<(), String> {
            let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
            // Same monitor if it is still there, otherwise whichever one contains the region's centre.
            let (gx, gy) = (r.monitor_x + r.x + r.width / 2.0, r.monitor_y + r.y + r.height / 2.0);
            let m = monitors
                .iter()
                .find(|m| m.id().ok() == Some(r.monitor_id))
                .or_else(|| {
                    monitors.iter().find(|m| {
                        let (Ok(x), Ok(y), Ok(w), Ok(h)) = (m.x(), m.y(), m.width(), m.height()) else { return false };
                        gx >= x as f64 && gx < (x + w as i32) as f64 && gy >= y as f64 && gy < (y + h as i32) as f64
                    })
                })
                .or_else(|| monitor_under_cursor(&monitors))
                .ok_or("no monitor found")?;
            let (mx, my) = (m.x().unwrap_or(0) as f64, m.y().unwrap_or(0) as f64);
            let mut img = m.capture_image().map_err(|e| e.to_string())?;
            let sc = img.width() as f64 / (m.width().map_err(|e| e.to_string())?.max(1) as f64);
            if settings::get(&app).include_cursor {
                add_cursor(&mut img, (mx, my), sc);
            }
            // Region in this monitor's pixel space (use the stored global origin if the id changed).
            let (rx, ry) = if m.id().ok() == Some(r.monitor_id) { (r.x, r.y) } else { (r.monitor_x + r.x - mx, r.monitor_y + r.y - my) };
            let (iw, ih) = (img.width(), img.height());
            let x0 = ((rx * sc).round().max(0.0) as u32).min(iw.saturating_sub(1));
            let y0 = ((ry * sc).round().max(0.0) as u32).min(ih.saturating_sub(1));
            let x1 = (((rx + r.width) * sc).round().max(0.0) as u32).min(iw);
            let y1 = (((ry + r.height) * sc).round().max(0.0) as u32).min(ih);
            if x1 <= x0 || y1 <= y0 {
                return Err("the previous region is outside the screen".into());
            }
            let crop = image::imageops::crop_imm(&img, x0, y0, x1 - x0, y1 - y0).to_image();
            deliver(&app, "capture", crop, sc)
        })();
        if let Err(e) = res {
            log::error!("repeat capture failed: {e}");
            floating::alert(&app, "จับภาพซ้ำไม่สำเร็จ", "Repeat capture failed", &e);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    #[test]
    #[ignore = "needs a desktop session + screen recording permission"]
    fn live_window_and_cursor() {
        let wins = list_windows();
        println!("{} windows", wins.len());
        for w in wins.iter().take(4) {
            let plain = capture_window_cg(w.id, false).unwrap();
            let shadow = capture_window_cg(w.id, true).unwrap();
            println!("window {}x{} pts -> plain {}x{} / shadow {}x{}", w.width, w.height, plain.width(), plain.height(), shadow.width(), shadow.height());
            assert!(shadow.width() >= plain.width());
            let corner = shadow.get_pixel(0, 0);
            println!("shadow corner pixel {corner:?}");
        }
        let sp = cursor_sprite();
        println!("cursor sprite: {:?}", sp.as_ref().map(|s| (s.0.width(), s.0.height(), s.1, s.2, s.3, s.4)));
        println!("cursor pos {:?}", cursor_pos());
    }

    #[test]
    fn edge_detection_finds_box() {
        let mut img = RgbaImage::from_pixel(100, 80, Rgba([255, 255, 255, 255]));
        for y in 20..50 {
            for x in 30..70 {
                img.put_pixel(x, y, Rgba([10, 20, 200, 255]));
            }
        }
        assert_eq!(find_edges(&img, 40, 30, 12), (30, 20, 69, 49));
        // outside the box: bounded by the screen edges and the box
        assert_eq!(find_edges(&img, 5, 5, 12), (0, 0, 99, 79));
    }
}

// ---------------------------------------------------------------------------------------------
// Countdown window
// ---------------------------------------------------------------------------------------------

fn open_countdown(app: &AppHandle, secs: u64) -> Option<WebviewWindow> {
    const SIZE: f64 = 140.0;
    let monitors = xcap::Monitor::all().ok()?;
    let m = monitor_under_cursor(&monitors)?;
    let (mx, my, mw, mh) = (m.x().ok()? as f64, m.y().ok()? as f64, m.width().ok()? as f64, m.height().ok()? as f64);
    let primary_h = monitors.iter().find(|m| m.is_primary().unwrap_or(false)).and_then(|m| m.height().ok()).unwrap_or(mh as u32) as f64;
    let (x, y) = (mx + (mw - SIZE) / 2.0, my + (mh - SIZE) / 2.0);
    let win = WebviewWindowBuilder::new(app, "countdown", WebviewUrl::App(format!("overlay.html?mode=countdown&secs={secs}").into()))
        .title("CaptureME countdown")
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .visible_on_all_workspaces(true)
        .position(x, y)
        .inner_size(SIZE, SIZE)
        .build()
        .map_err(|e| log::error!("countdown window: {e}"))
        .ok()?;
    let _ = win.set_ignore_cursor_events(true);
    style_window(app, &win, Some((x, primary_h - (y + SIZE), SIZE, SIZE)), Some(false));
    Some(win)
}
