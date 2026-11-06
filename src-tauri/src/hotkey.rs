//! Global shortcuts. Owner: Agent A.
//! Registers `settings.hotkeys` (action -> accelerator) and re-registers on `settings-changed`.
use crate::{capture, recording, settings, windows};
use tauri::{AppHandle, Listener};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub fn init(app: &AppHandle) -> tauri::Result<()> {
    register_all(app);
    let a = app.clone();
    app.listen("settings-changed", move |_| {
        let a2 = a.clone();
        let _ = a.run_on_main_thread(move || register_all(&a2));
    });
    Ok(())
}

fn register_all(app: &AppHandle) {
    let gs = app.global_shortcut();
    if let Err(e) = gs.unregister_all() {
        log::warn!("unregister_all failed: {e}");
    }
    for (action, accel) in settings::get(app).hotkeys {
        let accel = accel.trim().to_string();
        if accel.is_empty() {
            continue;
        }
        let act = action.clone();
        let res = gs.on_shortcut(accel.as_str(), move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                run_action(app, &act);
            }
        });
        if let Err(e) = res {
            log::warn!("cannot register hotkey {accel:?} for {action}: {e}");
        }
    }
}

/// Run a hotkey/tray action: region, window, fullscreen, delayed, scroll, record, ocr, history.
pub fn run_action(app: &AppHandle, action: &str) {
    match action {
        "region" => capture::start_region(app),
        "window" => capture::start_window(app),
        "fullscreen" => capture::start_fullscreen(app),
        "delayed" => capture::start_delayed(app, 5),
        "scroll" => capture::start_overlay(app, "scroll"),
        "record" => {
            if !recording::stop_if_recording(app) {
                capture::start_overlay(app, "record");
            }
        }
        "ocr" => capture::start_overlay(app, "ocr"),
        "history" => {
            if let Err(e) = windows::open_history(app) {
                log::error!("open history: {e}");
            }
        }
        other => log::warn!("unknown hotkey action {other}"),
    }
}
