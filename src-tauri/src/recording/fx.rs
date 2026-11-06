//! Recording extras: click-highlight rings, keystroke display and the webcam bubble.
//!
//! * `rec-fx` – transparent, click-through window over the recorded display. The page draws a
//!   ring where the mouse is pressed (`rec-click`) and key caps (`rec-key`). Both come from
//!   global `NSEvent` monitors: mouse-down locations need no permission, key events need
//!   Input Monitoring (`CGPreflightListenEventAccess`).
//! * `rec-camera` – small always-on-top window with the webcam (getUserMedia in the webview).
//!
//! Both windows are *not* hidden from capture – they are meant to appear in the recording.
use crate::floating;
use crate::types::SelectionRect;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2_app_kit::{NSEvent, NSEventMask, NSEventModifierFlags};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const FX: &str = "rec-fx";
pub const CAMERA: &str = "rec-camera";

struct Monitor(Retained<AnyObject>);
unsafe impl Send for Monitor {}
static MONITORS: Mutex<Vec<Monitor>> = Mutex::new(Vec::new());

// ------------------------------------------------------------------------------------------------
// permissions
// ------------------------------------------------------------------------------------------------

/// Input Monitoring granted? (needed to see key presses of other apps)
pub fn keys_access() -> bool {
    objc2_core_graphics::CGPreflightListenEventAccess()
}

/// Shows the system prompt (first time) and returns the current state.
pub fn keys_request() -> bool {
    objc2_core_graphics::CGRequestListenEventAccess()
}

// ------------------------------------------------------------------------------------------------
// window numbers (for SCContentFilter: keep these windows in the recording)
// ------------------------------------------------------------------------------------------------

pub fn window_number(app: &AppHandle, label: &str) -> Option<u32> {
    let win = app.get_webview_window(label)?;
    let ptr = win.ns_window().ok()? as usize;
    let (tx, rx) = std::sync::mpsc::channel();
    let _ = app.run_on_main_thread(move || {
        let n: isize = unsafe { objc2::msg_send![ptr as *mut AnyObject, windowNumber] };
        let _ = tx.send(n);
    });
    rx.recv_timeout(std::time::Duration::from_secs(2)).ok().filter(|n| *n > 0).map(|n| n as u32)
}

// ------------------------------------------------------------------------------------------------
// click / key overlay
// ------------------------------------------------------------------------------------------------

#[derive(Serialize, Clone)]
struct ClickEvent {
    /// Position relative to the overlay window (logical points, top-left origin).
    x: f64,
    y: f64,
    button: u8,
}

#[derive(Serialize, Clone)]
struct KeyEvent {
    label: String,
    /// true when a modifier (⌘ ⌃ ⌥) is held or the key is not printable
    chord: bool,
}

fn primary_height() -> f64 {
    core_graphics::display::CGDisplay::main().bounds().size.height
}

/// Open the click-through overlay over the monitor of `rect`.
pub fn open_fx(app: &AppHandle, rect: &SelectionRect) -> tauri::Result<WebviewWindow> {
    let (x, y, w, h) = floating::monitor_bounds(rect);
    close_fx(app);
    // the key caps are drawn at the bottom of the recorded region (monitor-relative rect)
    let url = format!("recorder.html?mode=fx&rx={}&ry={}&rw={}&rh={}", rect.x.round(), rect.y.round(), rect.width.round(), rect.height.round());
    let win = WebviewWindowBuilder::new(app, FX, WebviewUrl::App(url.into()))
        .title("CaptureME")
        .inner_size(w, h)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .focused(false)
        .build()?;
    let _ = win.set_ignore_cursor_events(true);
    style_float(app, &win, 102);
    Ok(win)
}

pub fn close_fx(app: &AppHandle) {
    remove_monitors(app);
    floating::close(app, FX);
}

/// Install the global monitors. `origin` = global top-left of the overlay window.
pub fn start_monitors(app: &AppHandle, origin: (f64, f64), clicks: bool, keys: bool) {
    remove_monitors(app);
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        let mut list = MONITORS.lock().unwrap_or_else(|e| e.into_inner());
        if clicks {
            let a = app2.clone();
            let block = block2::RcBlock::new(move |ev: std::ptr::NonNull<NSEvent>| {
                let ev = unsafe { ev.as_ref() };
                let p = NSEvent::mouseLocation();
                let gy = primary_height() - p.y;
                let button = match unsafe { objc2::msg_send![ev, buttonNumber] } {
                    0isize => 0u8,
                    1 => 1,
                    _ => 2,
                };
                let _ = a.emit("rec-click", ClickEvent { x: p.x - origin.0, y: gy - origin.1, button });
            });
            let mask = NSEventMask::LeftMouseDown | NSEventMask::RightMouseDown;
            if let Some(m) = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(mask, &block) {
                list.push(Monitor(m));
            }
        }
        if keys && keys_access() {
            let a = app2.clone();
            let block = block2::RcBlock::new(move |ev: std::ptr::NonNull<NSEvent>| {
                let ev = unsafe { ev.as_ref() };
                if let Some(k) = key_event(ev) {
                    let _ = a.emit("rec-key", k);
                }
            });
            if let Some(m) = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(NSEventMask::KeyDown, &block) {
                list.push(Monitor(m));
            }
        }
    });
}

pub fn remove_monitors(app: &AppHandle) {
    let _ = app.run_on_main_thread(|| {
        let mut list = MONITORS.lock().unwrap_or_else(|e| e.into_inner());
        for m in list.drain(..) {
            unsafe { NSEvent::removeMonitor(&m.0) };
        }
    });
}

fn key_event(ev: &NSEvent) -> Option<KeyEvent> {
    let mods = ev.modifierFlags();
    let code = ev.keyCode();
    let special = match code {
        36 | 76 => Some("⏎"),
        48 => Some("⇥"),
        49 => Some("␣"),
        51 => Some("⌫"),
        117 => Some("⌦"),
        53 => Some("⎋"),
        123 => Some("←"),
        124 => Some("→"),
        125 => Some("↓"),
        126 => Some("↑"),
        115 => Some("↖"),
        119 => Some("↘"),
        116 => Some("⇞"),
        121 => Some("⇟"),
        122 => Some("F1"),
        120 => Some("F2"),
        99 => Some("F3"),
        118 => Some("F4"),
        96 => Some("F5"),
        97 => Some("F6"),
        98 => Some("F7"),
        100 => Some("F8"),
        101 => Some("F9"),
        109 => Some("F10"),
        103 => Some("F11"),
        111 => Some("F12"),
        _ => None,
    };
    let ctrl = mods.contains(NSEventModifierFlags::Control);
    let opt = mods.contains(NSEventModifierFlags::Option);
    let cmd = mods.contains(NSEventModifierFlags::Command);
    let shift = mods.contains(NSEventModifierFlags::Shift);
    let chord = ctrl || opt || cmd || special.is_some_and(|s| s != "␣");
    let base = match special {
        Some(s) => s.to_string(),
        None => {
            let c = if chord { ev.charactersIgnoringModifiers() } else { ev.characters() };
            let s = c.map(|s| s.to_string()).unwrap_or_default();
            let s: String = s.chars().filter(|c| !c.is_control()).collect();
            if s.is_empty() {
                return None;
            }
            if chord { s.to_uppercase() } else { s }
        }
    };
    let mut label = String::new();
    if chord {
        if ctrl {
            label.push('⌃');
        }
        if opt {
            label.push('⌥');
        }
        if shift {
            label.push('⇧');
        }
        if cmd {
            label.push('⌘');
        }
    }
    label.push_str(&base);
    Some(KeyEvent { label, chord })
}

// ------------------------------------------------------------------------------------------------
// webcam bubble
// ------------------------------------------------------------------------------------------------

pub fn camera_px(size: &str) -> f64 {
    match size {
        "s" => 120.0,
        "l" => 280.0,
        _ => 190.0,
    }
}

/// Open (or restyle) the webcam bubble inside the recorded rectangle.
pub fn open_camera(app: &AppHandle, rect: &SelectionRect, size: &str, shape: &str) -> tauri::Result<WebviewWindow> {
    let px = camera_px(size);
    if let Some(w) = app.get_webview_window(CAMERA) {
        let _ = w.set_size(tauri::LogicalSize::new(px, px));
        let _ = app.emit("camera-style", serde_json::json!({ "size": size, "shape": shape }));
        return Ok(w);
    }
    let (gx, gy, w, h) = floating::global_rect(rect);
    let (mx, my, mw, mh) = floating::monitor_bounds(rect);
    // bottom-left inside the region, kept on the monitor
    let x = (gx + 16.0).max(mx + 4.0).min(mx + mw - px - 4.0);
    let y = (gy + h - px - 16.0).max(my + 30.0).min(my + mh - px - 4.0);
    let _ = w;
    let win = WebviewWindowBuilder::new(app, CAMERA, WebviewUrl::App(format!("camera.html?size={size}&shape={shape}").into()))
        .title("CaptureME Camera")
        .inner_size(px, px)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .accept_first_mouse(true)
        .focused(false)
        .build()?;
    style_float(app, &win, 103);
    Ok(win)
}

pub fn close_camera(app: &AppHandle) {
    floating::close(app, CAMERA);
}

/// Make a window float above full-screen apps and on every Space (like the capture overlay).
pub fn style_float(app: &AppHandle, win: &WebviewWindow, level: isize) {
    use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
    let Ok(ptr) = win.ns_window() else { return };
    let ptr = ptr as usize;
    let _ = app.run_on_main_thread(move || unsafe {
        let w: &NSWindow = &*(ptr as *const NSWindow);
        w.setLevel(level);
        w.setCollectionBehavior(
            NSWindowCollectionBehavior::CanJoinAllSpaces
                | NSWindowCollectionBehavior::Stationary
                | NSWindowCollectionBehavior::FullScreenAuxiliary
                | NSWindowCollectionBehavior::IgnoresCycle,
        );
        w.orderFrontRegardless();
    });
}
