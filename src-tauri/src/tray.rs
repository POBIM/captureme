//! Menu-bar (tray) icon and menu. Owner: Agent A.
use crate::{capture, hotkey, recording, settings, windows};
use std::time::Duration;
use tauri::{
    image::Image,
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    AppHandle, Listener,
};

const TRAY_ID: &str = "main";

pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app)?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        .icon_as_template(true)
        .tooltip("CaptureME")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| on_menu(app, event.id().as_ref()))
        .build(app)?;

    // Rebuild on language / hotkey changes.
    let a = app.clone();
    app.listen("settings-changed", move |_| refresh(&a));

    // The "Record Screen" label toggles with the recording state (no event exists for it).
    let a = app.clone();
    std::thread::spawn(move || {
        let mut last = recording::is_recording();
        loop {
            std::thread::sleep(Duration::from_millis(700));
            let now = recording::is_recording();
            if now != last {
                last = now;
                refresh(&a);
            }
        }
    });
    Ok(())
}

fn refresh(app: &AppHandle) {
    let a = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let (Some(tray), Ok(menu)) = (a.tray_by_id(TRAY_ID), build_menu(&a)) {
            let _ = tray.set_menu(Some(menu));
        }
    });
}

fn on_menu(app: &AppHandle, id: &str) {
    match id {
        "history" | "settings" => {
            let r = if id == "history" { windows::open_history(app) } else { windows::open_settings(app) };
            if let Err(e) = r {
                log::error!("open {id}: {e}");
            }
        }
        "quit" => app.exit(0),
        "delayed3" | "delayed5" | "delayed10" => {
            let secs: u64 = id.trim_start_matches("delayed").parse().unwrap_or(5);
            capture::start_delayed(app, secs);
        }
        action => {
            // Give the menu time to fade out so it doesn't end up in the screenshot.
            let (app, action) = (app.clone(), action.to_string());
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(200));
                hotkey::run_action(&app, &action);
            });
        }
    }
}

struct Labels {
    region: &'static str,
    window: &'static str,
    fullscreen: &'static str,
    delayed: &'static str,
    secs: &'static str,
    scroll: &'static str,
    record: &'static str,
    stop: &'static str,
    ocr: &'static str,
    history: &'static str,
    settings: &'static str,
    about: &'static str,
    quit: &'static str,
}

fn labels(lang: &str) -> Labels {
    if lang == "en" {
        Labels {
            region: "Capture Region",
            window: "Capture Window",
            fullscreen: "Capture Fullscreen",
            delayed: "Delayed Capture",
            secs: "seconds",
            scroll: "Scroll Capture",
            record: "Record Screen",
            stop: "Stop Recording",
            ocr: "OCR Text",
            history: "History",
            settings: "Settings…",
            about: "About CaptureME",
            quit: "Quit CaptureME",
        }
    } else {
        Labels {
            region: "จับภาพพื้นที่",
            window: "จับภาพหน้าต่าง",
            fullscreen: "จับภาพเต็มหน้าจอ",
            delayed: "จับภาพแบบหน่วงเวลา",
            secs: "วินาที",
            scroll: "จับภาพแบบเลื่อน",
            record: "บันทึกหน้าจอ",
            stop: "หยุดบันทึกหน้าจอ",
            ocr: "ดึงข้อความ (OCR)",
            history: "ประวัติ",
            settings: "ตั้งค่า…",
            about: "เกี่ยวกับ CaptureME",
            quit: "ออกจาก CaptureME",
        }
    }
}

fn item(app: &AppHandle, id: &str, text: &str, accel: Option<&String>) -> tauri::Result<MenuItem<tauri::Wry>> {
    if let Some(a) = accel.filter(|a| !a.trim().is_empty()) {
        if let Ok(i) = MenuItem::with_id(app, id, text, true, Some(a.as_str())) {
            return Ok(i);
        }
    }
    MenuItem::with_id(app, id, text, true, None::<&str>)
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let s = settings::get(app);
    let l = labels(&s.language);
    let hk = &s.hotkeys;

    let region = item(app, "region", l.region, hk.get("region"))?;
    let window = item(app, "window", l.window, hk.get("window"))?;
    let fullscreen = item(app, "fullscreen", l.fullscreen, hk.get("fullscreen"))?;
    let d3 = item(app, "delayed3", &format!("3 {}", l.secs), None)?;
    let d5 = item(app, "delayed5", &format!("5 {}", l.secs), hk.get("delayed"))?;
    let d10 = item(app, "delayed10", &format!("10 {}", l.secs), None)?;
    let delayed = Submenu::with_items(app, l.delayed, true, &[&d3, &d5, &d10])?;
    let scroll = item(app, "scroll", l.scroll, hk.get("scroll"))?;
    let record = item(app, "record", if recording::is_recording() { l.stop } else { l.record }, hk.get("record"))?;
    let ocr = item(app, "ocr", l.ocr, hk.get("ocr"))?;
    let history = item(app, "history", l.history, hk.get("history"))?;
    let settings_i = item(app, "settings", l.settings, None)?;
    let about = PredefinedMenuItem::about(app, Some(l.about), None)?;
    let quit = item(app, "quit", l.quit, None)?;
    let (s1, s2, s3) = (PredefinedMenuItem::separator(app)?, PredefinedMenuItem::separator(app)?, PredefinedMenuItem::separator(app)?);

    let items: Vec<&dyn IsMenuItem<tauri::Wry>> = vec![
        &region, &window, &fullscreen, &delayed, &s1, &scroll, &record, &ocr, &s2, &history, &settings_i, &about, &s3, &quit,
    ];
    Menu::with_items(app, &items)
}
