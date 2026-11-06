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
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, button_state: tauri::tray::MouseButtonState::Up, .. } = event {
                recording::on_tray_click(tray.app_handle());
            }
        })
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

pub fn refresh(app: &AppHandle) {
    let a = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(tray) = a.tray_by_id(TRAY_ID) else { return };
        if recording::is_recording() {
            // While recording, a click on the menu-bar icon stops the recording (no menu).
            let _ = tray.set_menu(None::<Menu<tauri::Wry>>);
            let _ = tray.set_show_menu_on_left_click(false);
        } else if let Ok(menu) = build_menu(&a) {
            let _ = tray.set_menu(Some(menu));
            let _ = tray.set_show_menu_on_left_click(true);
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
        "colors" => crate::colors::show_panel(app),
        "about" => {
            // The About tab of the settings window carries version, privacy statement and licence.
            match windows::open_page(app, "settings", "settings", "tab=about", "CaptureME Settings", 720.0, 560.0) {
                Ok(_) => {
                    let _ = tauri::Emitter::emit(app, "settings-tab", "about");
                }
                Err(e) => log::error!("open about: {e}"),
            }
        }
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
    repeat: &'static str,
    scroll: &'static str,
    record: &'static str,
    record_full: &'static str,
    record_window: &'static str,
    recordings: &'static str,
    stop: &'static str,
    ocr: &'static str,
    tools: &'static str,
    pin: &'static str,
    color: &'static str,
    colors: &'static str,
    measure: &'static str,
    qr: &'static str,
    open_file: &'static str,
    clipboard: &'static str,
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
            repeat: "Repeat Last Region",
            scroll: "Scroll Capture",
            record: "Record Screen",
            record_full: "Record Full Screen",
            record_window: "Record Window",
            recordings: "Recordings…",
            stop: "Stop Recording",
            ocr: "OCR Text",
            tools: "More Tools",
            pin: "Pin Region to Screen",
            color: "Color Picker",
            colors: "Recent Colors…",
            measure: "Pixel Ruler",
            qr: "QR / Barcode Reader",
            open_file: "Open Image…",
            clipboard: "Annotate Clipboard Image",
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
            repeat: "จับภาพพื้นที่เดิมซ้ำ",
            scroll: "จับภาพแบบเลื่อน",
            record: "บันทึกหน้าจอ",
            record_full: "บันทึกเต็มหน้าจอ",
            record_window: "บันทึกหน้าต่าง",
            recordings: "วิดีโอที่บันทึกไว้…",
            stop: "หยุดบันทึกหน้าจอ",
            ocr: "ดึงข้อความ (OCR)",
            tools: "เครื่องมืออื่น ๆ",
            pin: "ปักหมุดพื้นที่บนหน้าจอ",
            color: "ดูดสีจากหน้าจอ",
            colors: "สีที่เลือกล่าสุด…",
            measure: "ไม้บรรทัดพิกเซล",
            qr: "อ่าน QR / บาร์โค้ด",
            open_file: "เปิดรูปภาพ…",
            clipboard: "เขียนกำกับรูปจากคลิปบอร์ด",
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

pub(crate) fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
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
    let repeat = item(app, "repeat", l.repeat, hk.get("repeat"))?;
    let scroll = item(app, "scroll", l.scroll, hk.get("scroll"))?;
    let record = item(app, "record", if recording::is_recording() { l.stop } else { l.record }, hk.get("record"))?;
    let record_full = item(app, "record_full", l.record_full, hk.get("record_full"))?;
    let record_window = item(app, "record_window", l.record_window, hk.get("record_window"))?;
    let recordings = item(app, "recordings", l.recordings, None)?;
    let ocr = item(app, "ocr", l.ocr, hk.get("ocr"))?;
    let pin = item(app, "pin", l.pin, hk.get("pin"))?;
    let color = item(app, "color", l.color, hk.get("color"))?;
    let colors = item(app, "colors", l.colors, None)?;
    let measure = item(app, "measure", l.measure, hk.get("measure"))?;
    let qr = item(app, "qr", l.qr, hk.get("qr"))?;
    let tools = Submenu::with_items(app, l.tools, true, &[&pin, &color, &colors, &measure, &qr])?;
    let open_file = item(app, "open_file", l.open_file, None)?;
    let clipboard = item(app, "clipboard", l.clipboard, hk.get("clipboard"))?;
    let history = item(app, "history", l.history, hk.get("history"))?;
    let settings_i = item(app, "settings", l.settings, None)?;
    let about = item(app, "about", l.about, None)?;
    let quit = item(app, "quit", l.quit, None)?;
    let (s1, s2, s3, s4) =
        (PredefinedMenuItem::separator(app)?, PredefinedMenuItem::separator(app)?, PredefinedMenuItem::separator(app)?, PredefinedMenuItem::separator(app)?);

    let items: Vec<&dyn IsMenuItem<tauri::Wry>> = vec![
        &region, &window, &fullscreen, &delayed, &repeat, &s1, &scroll, &record, &record_full, &record_window, &recordings, &ocr, &tools, &s2, &open_file, &clipboard, &s3, &history, &settings_i, &about,
        &s4, &quit,
    ];
    Menu::with_items(app, &items)
}
