//! Scrolling capture. Owner: Agent D.
//!
//! Flow: overlay -> `start_region` -> click-through border window + small control window.
//! A worker thread grabs the region every ~150 ms (xcap), the `Stitcher` finds the vertical shift
//! between consecutive frames (row signatures on a downscaled grayscale copy, sticky
//! header / footer rows excluded) and appends only the new rows. "Done" writes the PNG into the
//! captures dir, records it in the history and opens the editor.
use crate::floating::{self, Side};
use crate::types::CaptureResult;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Logical-point rect on a given monitor, chosen by the user in the overlay.
pub use crate::types::SelectionRect;

const CONTROL: &str = "scroll-control";
const BORDER: &str = "scroll-border";
const CONTROL_SIZE: (f64, f64) = (268.0, 408.0);
const FRAME_INTERVAL: Duration = Duration::from_millis(150);
/// Hard cap of the stitched image height (pixels).
const MAX_HEIGHT: usize = 30_000;

// ------------------------------------------------------------------------------------------------
// session state
// ------------------------------------------------------------------------------------------------

#[derive(Clone)]
struct Session {
    done: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
    auto: Arc<AtomicBool>,
    width: f64,
    height: f64,
}
static SESSION: Mutex<Option<Session>> = Mutex::new(None);

#[derive(Serialize, Clone)]
pub struct ScrollStatus {
    pub active: bool,
    pub width: f64,
    pub height: f64,
    pub auto: bool,
    pub accessibility: bool,
}

#[derive(Serialize, Clone)]
struct Preview {
    jpeg: String,
    rows: usize,
    width: usize,
    frames: u32,
    limit: bool,
}

/// Called by capture.rs when overlay mode "scroll" finishes.
pub fn start_region(app: &AppHandle, rect: SelectionRect) {
    let sess = {
        let mut s = SESSION.lock().unwrap_or_else(|e| e.into_inner());
        if s.is_some() {
            return;
        }
        let sess = Session {
            done: Arc::new(AtomicBool::new(false)),
            cancel: Arc::new(AtomicBool::new(false)),
            auto: Arc::new(AtomicBool::new(false)),
            width: rect.width,
            height: rect.height,
        };
        *s = Some(sess.clone());
        sess
    };

    if let Err(e) = floating::open_border(app, BORDER, "scroll", "scroll", &rect) {
        log::warn!("scroll border: {e}");
    }
    let pos = floating::place(&rect, CONTROL_SIZE.0, CONTROL_SIZE.1, &[Side::Right, Side::Left, Side::Below, Side::Above]);
    if let Err(e) = floating::open_panel(app, CONTROL, "scroll.html?mode=control", pos, CONTROL_SIZE, true) {
        log::error!("scroll control window: {e}");
        floating::close(app, BORDER);
        *SESSION.lock().unwrap_or_else(|e| e.into_inner()) = None;
        return;
    }
    register_escape(app);

    let app2 = app.clone();
    std::thread::spawn(move || {
        run(&app2, rect, sess);
    });
}

fn register_escape(app: &AppHandle) {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
    let r = app.global_shortcut().on_shortcut("Escape", |_app, _sc, ev| {
        if ev.state == ShortcutState::Pressed {
            if let Some(s) = SESSION.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
                s.done.store(true, Ordering::SeqCst);
            }
        }
    });
    if let Err(e) = r {
        log::warn!("cannot register Esc for scrolling capture: {e}");
    }
}
fn unregister_escape(app: &AppHandle) {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let _ = app.global_shortcut().unregister("Escape");
}

// ------------------------------------------------------------------------------------------------
// commands
// ------------------------------------------------------------------------------------------------

#[tauri::command]
pub fn scroll_status() -> ScrollStatus {
    match SESSION.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
        Some(s) => ScrollStatus { active: true, width: s.width, height: s.height, auto: s.auto.load(Ordering::SeqCst), accessibility: input::trusted() },
        None => ScrollStatus { active: false, width: 0.0, height: 0.0, auto: false, accessibility: input::trusted() },
    }
}

#[tauri::command]
pub fn scroll_done() {
    if let Some(s) = SESSION.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
        s.done.store(true, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn scroll_cancel() {
    if let Some(s) = SESSION.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
        s.cancel.store(true, Ordering::SeqCst);
        s.done.store(true, Ordering::SeqCst);
    }
}

/// Toggle auto-scroll (posts scroll-wheel events; needs the Accessibility permission).
#[tauri::command]
pub fn scroll_set_auto(on: bool) -> Result<(), String> {
    let guard = SESSION.lock().unwrap_or_else(|e| e.into_inner());
    let s = guard.as_ref().ok_or("no active scrolling capture")?;
    if on && !input::trusted() {
        input::prompt_trust();
        return Err("accessibility".into());
    }
    s.auto.store(on, Ordering::SeqCst);
    Ok(())
}

// ------------------------------------------------------------------------------------------------
// capture loop
// ------------------------------------------------------------------------------------------------

fn run(app: &AppHandle, rect: SelectionRect, sess: Session) {
    let finish = |app: &AppHandle| {
        unregister_escape(app);
        floating::close(app, CONTROL);
        floating::close(app, BORDER);
        *SESSION.lock().unwrap_or_else(|e| e.into_inner()) = None;
    };

    let monitor = xcap::Monitor::all().ok().and_then(|l| l.into_iter().find(|m| m.id().ok() == Some(rect.monitor_id)));
    let Some(monitor) = monitor else {
        let _ = app.emit("scroll-error", "monitor not found");
        finish(app);
        return;
    };
    let (mw, mh) = (monitor.width().unwrap_or(0) as f64, monitor.height().unwrap_or(0) as f64);
    let rx = rect.x.max(0.0).round();
    let ry = rect.y.max(0.0).round();
    let rw = rect.width.round().min(mw - rx).max(2.0) as u32;
    let rh = rect.height.round().min(mh - ry).max(2.0) as u32;

    let mut st = Stitcher::new();
    let mut last_preview = Instant::now() - Duration::from_secs(1);
    let mut dirty = false;
    let mut failures = 0;
    let mut idle_ticks = 0u32;
    let mut auto_dir: i32 = -1; // wheel delta sign that scrolls down (auto-detected)
    let mut wrong_dir = 0;
    let mut had_auto_progress = false;
    let mut limit = false;
    let auto_step = ((rect.height * 0.22).clamp(30.0, 260.0)) as i32;
    let center = (rect.monitor_x + rect.x + rect.width / 2.0, rect.monitor_y + rect.y + rect.height / 2.0);
    let region_global = floating::global_rect(&rect);
    let mut was_auto = false;

    loop {
        let tick = Instant::now();
        let finishing = sess.done.load(Ordering::SeqCst);

        if !finishing && sess.auto.load(Ordering::SeqCst) {
            if !was_auto {
                was_auto = true;
                idle_ticks = 0;
                had_auto_progress = false;
            }
            input::ensure_cursor_inside(region_global, center);
            input::scroll_pixels(auto_dir * auto_step);
        } else {
            was_auto = false;
        }

        match monitor.capture_region(rx as u32, ry as u32, rw, rh) {
            Ok(img) => {
                failures = 0;
                match st.push(&img) {
                    Outcome::Appended { shift } => {
                        dirty = true;
                        idle_ticks = 0;
                        if was_auto {
                            had_auto_progress = true;
                            wrong_dir = 0;
                        }
                        let _ = shift;
                    }
                    Outcome::Moved { shift } => {
                        // scrolled within already captured content (or up)
                        idle_ticks = 0;
                        if was_auto && shift < 0 {
                            wrong_dir += 1;
                            if wrong_dir >= 2 && !had_auto_progress {
                                auto_dir = -auto_dir;
                                wrong_dir = 0;
                            }
                        }
                    }
                    Outcome::Same | Outcome::NoMatch => idle_ticks += 1,
                }
                if st.rows() >= MAX_HEIGHT {
                    limit = true;
                }
            }
            Err(e) => {
                failures += 1;
                log::warn!("scroll capture: {e}");
                if failures >= 5 {
                    floating::alert(app, "สกรอลล์จับภาพไม่สำเร็จ – ตรวจสอบสิทธิ์ Screen Recording ใน ตั้งค่าระบบ", "Scrolling capture failed – check the Screen Recording permission in System Settings", &e.to_string());
                    let _ = app.emit("scroll-error", format!("capture failed: {e}"));
                    sess.cancel.store(true, Ordering::SeqCst);
                    break;
                }
            }
        }

        if dirty && last_preview.elapsed() > Duration::from_millis(450) {
            emit_preview(app, &st, limit);
            last_preview = Instant::now();
            dirty = false;
        }

        if finishing || limit {
            break;
        }
        // Auto-scroll reached the end of the content.
        if was_auto && had_auto_progress && idle_ticks >= 8 {
            break;
        }
        if let Some(rest) = FRAME_INTERVAL.checked_sub(tick.elapsed()) {
            std::thread::sleep(rest);
        }
    }

    sess.auto.store(false, Ordering::SeqCst);
    if sess.cancel.load(Ordering::SeqCst) || st.rows() == 0 {
        finish(app);
        return;
    }
    emit_preview(app, &st, limit);
    // Close the control windows first so they never appear in anything that follows.
    finish(app);

    match save_and_open(app, &st, rect.scale) {
        Ok(cr) => {
            let _ = app.emit("scroll-finished", cr);
        }
        Err(e) => {
            log::error!("scroll save: {e}");
            floating::alert(app, "บันทึกภาพสกรอลล์ไม่สำเร็จ", "Could not save the scrolling capture", &e);
            let _ = app.emit("scroll-error", e);
        }
    }
}

fn emit_preview(app: &AppHandle, st: &Stitcher, limit: bool) {
    if let Some(jpeg) = st.preview_jpeg(220, 250) {
        use base64::Engine;
        let data = format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(jpeg));
        let _ = app.emit("scroll-preview", Preview { jpeg: data, rows: st.rows(), width: st.w, frames: st.frames, limit });
    }
}

fn save_and_open(app: &AppHandle, st: &Stitcher, scale: f64) -> Result<CaptureResult, String> {
    use image::codecs::png::{CompressionType, FilterType, PngEncoder};
    use image::{ExtendedColorType, ImageEncoder};
    let data = st.assemble();
    let (w, h) = (st.w as u32, (data.len() / (st.w * 4)) as u32);
    let id = uuid::Uuid::new_v4().to_string();
    let path = crate::paths::captures_dir(app).join(format!("scroll-{}.png", id));
    {
        let f = std::io::BufWriter::new(std::fs::File::create(&path).map_err(|e| e.to_string())?);
        PngEncoder::new_with_quality(f, CompressionType::Fast, FilterType::Sub)
            .write_image(&data, w, h, ExtendedColorType::Rgba8)
            .map_err(|e| e.to_string())?;
    }
    let cr = CaptureResult {
        id,
        path: path.to_string_lossy().into_owned(),
        width: w,
        height: h,
        scale: if scale > 0.0 { scale } else { 1.0 },
        created_at: chrono::Local::now().to_rfc3339(),
    };
    crate::history::record(app, &cr);
    if crate::settings::get(app).copy_after_capture {
        let _ = crate::export::copy_file_to_clipboard(app, &cr.path);
    }
    let _ = crate::windows::open_editor(app, &cr.path);
    Ok(cr)
}

// ------------------------------------------------------------------------------------------------
// stitching
// ------------------------------------------------------------------------------------------------

/// Number of columns of the downscaled grayscale signature of every row.
const COLS: usize = 48;

pub enum Outcome {
    /// New rows were appended to the stitched image.
    Appended { shift: i32 },
    /// Frame matched but added nothing (scrolled back / within captured content).
    Moved { shift: i32 },
    /// Nothing changed.
    Same,
    /// Frame could not be aligned (ignored).
    NoMatch,
}

pub struct Stitcher {
    pub w: usize,
    h: usize,
    /// stitched RGBA rows without the footer
    body: Vec<u8>,
    body_rows: usize,
    footer: Vec<u8>,
    footer_n: usize,
    header_n: usize,
    configured: bool,
    /// row (in `body`) of the first row of the previous frame
    pos: i64,
    prev: Vec<u8>,
    pub frames: u32,
}

impl Stitcher {
    pub fn new() -> Self {
        Self { w: 0, h: 0, body: Vec::new(), body_rows: 0, footer: Vec::new(), footer_n: 0, header_n: 0, configured: false, pos: 0, prev: Vec::new(), frames: 0 }
    }

    pub fn rows(&self) -> usize {
        self.body_rows + self.footer_n
    }

    /// Final image bytes: body + footer.
    pub fn assemble(&self) -> Vec<u8> {
        let mut v = Vec::with_capacity(self.body.len() + self.footer.len());
        v.extend_from_slice(&self.body);
        v.extend_from_slice(&self.footer);
        v
    }

    pub fn push(&mut self, img: &image::RgbaImage) -> Outcome {
        let (w, h) = (img.width() as usize, img.height() as usize);
        if h < 64 || w < 16 {
            return Outcome::NoMatch;
        }
        let raw = img.as_raw();
        let sig = signature(raw, w, h);
        if self.frames == 0 {
            self.w = w;
            self.h = h;
            self.body = raw.clone();
            self.body_rows = h;
            self.pos = 0;
            self.prev = sig;
            self.frames = 1;
            return Outcome::Appended { shift: 0 };
        }
        if w != self.w || h != self.h {
            return Outcome::NoMatch;
        }
        // Unchanged frame?
        if mean_diff_all(&self.prev, &sig, h) < 0.4 {
            return Outcome::Same;
        }

        // Sticky header / footer rows (identical in both frames).
        let (header_n, footer_n) = if self.configured {
            (self.header_n, self.footer_n)
        } else {
            let cap = h / 3;
            let mut hn = 0;
            while hn < cap && rows_equal(&self.prev, hn, &sig, hn) {
                hn += 1;
            }
            let mut fnn = 0;
            while fnn < cap && rows_equal(&self.prev, h - 1 - fnn, &sig, h - 1 - fnn) {
                fnn += 1;
            }
            (hn, fnn)
        };
        let top = header_n;
        let bottom = h - footer_n;
        if bottom <= top + 32 {
            return Outcome::NoMatch;
        }
        let Some(shift) = find_shift(&self.prev, &sig, top, bottom) else {
            return Outcome::NoMatch;
        };

        if !self.configured {
            // First successful alignment: the body currently equals the first frame.
            if footer_n > 0 && self.body_rows == h && self.pos == 0 {
                self.footer = self.body[(h - footer_n) * w * 4..].to_vec();
                self.body.truncate((h - footer_n) * w * 4);
                self.body_rows = h - footer_n;
            }
            self.header_n = header_n;
            self.footer_n = if self.footer.is_empty() { 0 } else { footer_n };
            self.configured = true;
        }
        let fnum = self.footer_n;
        let new_pos = self.pos + shift as i64;
        let frame_body_rows = h - fnum;
        let mut appended = false;
        if new_pos >= 0 {
            let end = new_pos + frame_body_rows as i64;
            if end > self.body_rows as i64 {
                let start = ((self.body_rows as i64 - new_pos).max(self.header_n as i64)) as usize;
                let mut stop = frame_body_rows;
                let room = MAX_HEIGHT.saturating_sub(self.body_rows + fnum);
                if stop - start > room {
                    stop = start + room;
                }
                if stop > start {
                    self.body.extend_from_slice(&raw[start * w * 4..stop * w * 4]);
                    self.body_rows += stop - start;
                    appended = true;
                }
            }
            if fnum > 0 {
                self.footer = raw[(h - fnum) * w * 4..].to_vec();
            }
        }
        self.pos = new_pos;
        self.prev = sig;
        self.frames += 1;
        if appended {
            Outcome::Appended { shift }
        } else {
            Outcome::Moved { shift }
        }
    }

    /// JPEG thumbnail of the bottom of the stitched image (the part currently being captured).
    pub fn preview_jpeg(&self, max_w: u32, max_h: u32) -> Option<Vec<u8>> {
        if self.body_rows == 0 {
            return None;
        }
        let total = self.rows();
        let scale = (max_w as f64 / self.w as f64).min(1.0);
        let show_rows = ((max_h as f64 / scale) as usize).min(total);
        let first = total - show_rows;
        // Collect `show_rows` rows from body+footer.
        let row_bytes = self.w * 4;
        let mut buf = Vec::with_capacity(show_rows * row_bytes);
        let body_len = self.body_rows;
        if first < body_len {
            buf.extend_from_slice(&self.body[first * row_bytes..]);
            buf.extend_from_slice(&self.footer);
        } else {
            buf.extend_from_slice(&self.footer[(first - body_len) * row_bytes..]);
        }
        let img = image::RgbaImage::from_raw(self.w as u32, show_rows as u32, buf)?;
        let tw = ((self.w as f64) * scale).round().max(1.0) as u32;
        let th = ((show_rows as f64) * scale).round().max(1.0) as u32;
        let small = image::imageops::resize(&img, tw, th, image::imageops::FilterType::Triangle);
        let rgb = image::DynamicImage::ImageRgba8(small).to_rgb8();
        let mut out = Vec::new();
        let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 70);
        rgb.write_with_encoder(enc).ok()?;
        Some(out)
    }
}

/// Per-row grayscale signature: `COLS` block averages per row.
fn signature(raw: &[u8], w: usize, h: usize) -> Vec<u8> {
    let mut sig = vec![0u8; h * COLS];
    let bounds: Vec<(usize, usize)> = (0..COLS).map(|c| (c * w / COLS, ((c + 1) * w / COLS).max(c * w / COLS + 1))).collect();
    for y in 0..h {
        let row = &raw[y * w * 4..(y + 1) * w * 4];
        for (c, (x0, x1)) in bounds.iter().enumerate() {
            let mut sum = 0u32;
            let mut n = 0u32;
            let mut x = *x0;
            while x < *x1 {
                let p = &row[x * 4..x * 4 + 3];
                sum += (p[0] as u32 * 77 + p[1] as u32 * 150 + p[2] as u32 * 29) >> 8;
                n += 1;
                x += 1;
            }
            sig[y * COLS + c] = (sum / n.max(1)) as u8;
        }
    }
    sig
}

#[inline]
fn row_sad(a: &[u8], ai: usize, b: &[u8], bi: usize) -> u32 {
    let ra = &a[ai * COLS..ai * COLS + COLS];
    let rb = &b[bi * COLS..bi * COLS + COLS];
    ra.iter().zip(rb).map(|(x, y)| (*x as i32 - *y as i32).unsigned_abs()).sum()
}

fn rows_equal(a: &[u8], ai: usize, b: &[u8], bi: usize) -> bool {
    row_sad(a, ai, b, bi) <= COLS as u32 // avg ≤ 1 level per column
}

fn mean_diff_all(a: &[u8], b: &[u8], h: usize) -> f64 {
    let step = (h / 240).max(1);
    let mut sum = 0u64;
    let mut n = 0u64;
    let mut y = 0;
    while y < h {
        sum += row_sad(a, y, b, y) as u64;
        n += COLS as u64;
        y += step;
    }
    sum as f64 / n.max(1) as f64
}

/// Find the vertical shift `d` (≠ 0) between `prev` and `cur` inside rows `top..bottom`.
/// d > 0: content moved up by d (scrolled down): cur[i] == prev[i + d].
/// d < 0: content moved down (scrolled up):      cur[i + |d|] == prev[i].
fn find_shift(prev: &[u8], cur: &[u8], top: usize, bottom: usize) -> Option<i32> {
    let band = bottom - top;
    let min_ov = (band * 12 / 100).max(24);
    if band <= min_ov + 1 {
        return None;
    }
    let max_d = band - min_ov;
    let mut best_mean = f64::MAX;
    let mut best_d = 0i32;
    for dd in 1..=max_d {
        for sign in [1i32, -1i32] {
            let overlap = band - dd;
            let step = (overlap / 160).max(1);
            // (cur_start, prev_start)
            let (cs, ps) = if sign > 0 { (top, top + dd) } else { (top + dd, top) };
            let rows_cnt = (overlap + step - 1) / step;
            let limit = if best_mean < f64::MAX { (best_mean * (rows_cnt * COLS) as f64) as u64 + 2 } else { u64::MAX };
            let mut sum = 0u64;
            let mut k = 0;
            let mut ok = true;
            while k < overlap {
                sum += row_sad(cur, cs + k, prev, ps + k) as u64;
                if sum > limit {
                    ok = false;
                    break;
                }
                k += step;
            }
            if !ok {
                continue;
            }
            let mean = sum as f64 / (rows_cnt * COLS) as f64;
            if mean < best_mean {
                best_mean = mean;
                best_d = sign * dd as i32;
            }
        }
    }
    if best_d == 0 || best_mean > 3.0 {
        return None;
    }
    // The aligned region must contain real structure, otherwise the match is ambiguous.
    let dd = best_d.unsigned_abs() as usize;
    let overlap = band - dd;
    let cs = if best_d > 0 { top } else { top + dd };
    let mut textured = 0;
    for k in 0..overlap {
        let r = &cur[(cs + k) * COLS..(cs + k) * COLS + COLS];
        let (mn, mx) = r.iter().fold((255u8, 0u8), |(a, b), v| (a.min(*v), b.max(*v)));
        if mx - mn > 20 {
            textured += 1;
            if textured >= 4 {
                return Some(best_d);
            }
        }
    }
    None
}

// ------------------------------------------------------------------------------------------------
// synthetic scroll-wheel input (auto-scroll) – raw CoreGraphics FFI
// ------------------------------------------------------------------------------------------------

mod input {
    use std::ffi::c_void;

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CGPoint {
        x: f64,
        y: f64,
    }

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
    }
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventCreateScrollWheelEvent2(source: *const c_void, units: u32, wheel_count: u32, w1: i32, w2: i32, w3: i32) -> *mut c_void;
        fn CGEventPost(tap: u32, event: *mut c_void);
        fn CGWarpMouseCursorPosition(p: CGPoint) -> i32;
        fn CGEventCreate(source: *const c_void) -> *mut c_void;
        fn CGEventGetLocation(event: *const c_void) -> CGPoint;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFRelease(cf: *const c_void);
    }

    pub fn trusted() -> bool {
        unsafe { AXIsProcessTrusted() }
    }

    /// Ask macOS to show the Accessibility permission prompt / settings.
    pub fn prompt_trust() {
        let _ = std::process::Command::new("/usr/bin/open").arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility").spawn();
    }

    /// Make sure the pointer is inside the captured region (scroll events go to the window under it).
    pub fn ensure_cursor_inside(region: (f64, f64, f64, f64), center: (f64, f64)) {
        unsafe {
            let ev = CGEventCreate(std::ptr::null());
            if ev.is_null() {
                return;
            }
            let p = CGEventGetLocation(ev);
            CFRelease(ev);
            let (x, y, w, h) = region;
            if p.x < x || p.y < y || p.x > x + w || p.y > y + h {
                CGWarpMouseCursorPosition(CGPoint { x: center.0, y: center.1 });
            }
        }
    }

    /// Post a pixel-unit vertical scroll event (negative = scroll down).
    pub fn scroll_pixels(delta: i32) {
        unsafe {
            let ev = CGEventCreateScrollWheelEvent2(std::ptr::null(), 0, 1, delta, 0, 0);
            if !ev.is_null() {
                CGEventPost(0, ev); // kCGHIDEventTap
                CFRelease(ev);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a tall synthetic page and check that stitching windows of it reproduces it.
    #[test]
    fn stitches_scrolled_windows() {
        let (w, h_frame, total) = (200usize, 120usize, 600usize);
        // pseudo-random textured page
        let mut seed = 12345u32;
        let mut page = vec![0u8; total * w * 4];
        for y in 0..total {
            for x in 0..w {
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                let v = if (y / 6) % 3 == 0 { 255 } else { (seed >> 24) as u8 };
                let i = (y * w + x) * 4;
                page[i..i + 4].copy_from_slice(&[v, v, v, 255]);
            }
        }
        let mut st = Stitcher::new();
        let mut y = 0;
        // sticky header of 10 rows: rows 0..10 always show page rows 0..10
        while y + h_frame <= total {
            let mut frame = page[y * w * 4..(y + h_frame) * w * 4].to_vec();
            frame[..10 * w * 4].copy_from_slice(&page[..10 * w * 4]);
            let img = image::RgbaImage::from_raw(w as u32, h_frame as u32, frame).unwrap();
            st.push(&img);
            y += 37;
        }
        let out = st.assemble();
        let rows = out.len() / (w * 4);
        assert!(rows >= total - 37 - 10, "rows {rows}");
        assert_eq!(&out[..rows * w * 4], &page[..rows * w * 4]);
    }

    /// Sparse "document" (mostly white, short text-like bars), sticky header + footer, scrolling
    /// down with an occasional step back up.
    #[test]
    fn stitches_sparse_with_footer_and_backscroll() {
        let (w, h_frame, total) = (300usize, 200usize, 1500usize);
        let mut page = vec![255u8; total * w * 4];
        let mut seed = 7u32;
        for line in 0..(total / 14) {
            let y0 = line * 14 + 3;
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            let len = 40 + ((seed >> 16) as usize % 240);
            for y in y0..y0 + 7 {
                for x in 10..10 + len {
                    seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                    let v = if (seed >> 28) < 9 { 20 } else { 235 };
                    let i = (y * w + x) * 4;
                    page[i..i + 4].copy_from_slice(&[v, v, v, 255]);
                }
            }
        }
        let (hn, fnn) = (16usize, 12usize);
        let mut st = Stitcher::new();
        let mut ys: Vec<usize> = vec![];
        let mut y = 0usize;
        while y + h_frame - fnn <= total {
            ys.push(y);
            y += 55;
            if ys.len() % 5 == 0 {
                ys.push(y - 40); // scroll back up a bit
            }
        }
        for y in ys {
            let mut frame = page[y * w * 4..(y + h_frame).min(total) * w * 4].to_vec();
            frame.resize(h_frame * w * 4, 255);
            frame[..hn * w * 4].copy_from_slice(&page[..hn * w * 4]);
            // footer: constant gray text row block
            for r in h_frame - fnn..h_frame {
                for x in 0..w {
                    let i = (r * w + x) * 4;
                    let v = if x % 7 < 3 { 60 } else { 200 };
                    frame[i..i + 4].copy_from_slice(&[v, v, v, 255]);
                }
            }
            let img = image::RgbaImage::from_raw(w as u32, h_frame as u32, frame).unwrap();
            st.push(&img);
        }
        let out = st.assemble();
        let rows = out.len() / (w * 4);
        let body_rows = rows - fnn;
        assert!(body_rows >= total - 2 * h_frame, "rows {rows}");
        assert_eq!(&out[..body_rows * w * 4], &page[..body_rows * w * 4]);
    }
}
