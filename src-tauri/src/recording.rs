//! Screen recording (video + GIF). Owner: Agent D → Agent H (round 3).
//!
//! * MP4 / MOV: **ScreenCaptureKit + AVAssetWriter** (`recording/sck.rs`) – H.264 / HEVC, region /
//!   display / window, system audio, microphone, pause / resume. If SCK cannot start, the old
//!   `/usr/sbin/screencapture -v -R` path is used automatically (no pause, mic only).
//! * GIF: xcap frames -> downscale -> `gif` encoder (streaming, on a worker thread).
//! * Extras (`recording/fx.rs`): click rings, key display, webcam bubble.
//! * Finished recordings are registered in `recording/store.rs` and handed to the video window.
//!
//! Flow: overlay / tray -> `start_region|start_display|start_window` -> floating options bar
//! ("setup") -> `recording_begin` -> floating control bar (timer / pause / stop / discard).
pub mod fx;
mod retime;
#[cfg(target_os = "macos")]
mod sck;
pub mod store;

use crate::floating::{self, Side};
pub use crate::types::SelectionRect;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

const BAR: &str = "recorder";
const BORDER: &str = "rec-border";
const SETUP_SIZE: (f64, f64) = (600.0, 276.0);
const REC_SIZE: (f64, f64) = (330.0, 52.0);
const GIF_MAX_WIDTH: u32 = 960;
const GIF_MAX_SECS: u64 = 600;

// ------------------------------------------------------------------------------------------------
// options + state
// ------------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct RecordingOptions {
    /// "mp4" | "mov" | "gif"
    pub format: String,
    /// GIF frame rate (5–15)
    pub fps: u32,
    /// Video frame rate (30 | 60)
    pub video_fps: u32,
    /// "low" | "medium" | "high"
    pub quality: String,
    /// "h264" | "hevc"
    pub codec: String,
    pub cursor: bool,
    /// Click-highlight rings
    pub clicks: bool,
    /// Keystroke display (needs Input Monitoring)
    pub keys: bool,
    pub mic: bool,
    pub system_audio: bool,
    pub webcam: bool,
    /// "s" | "m" | "l"
    pub webcam_size: String,
    /// "circle" | "rounded"
    pub webcam_shape: String,
    /// Countdown seconds before recording starts (0 = none)
    pub countdown: u32,
    /// Stop automatically after N minutes (0 = unlimited)
    pub max_minutes: u32,
    /// After recording: "video" (open the video window) | "reveal" (Finder) | "none"
    pub after: String,
    /// Destination folder ("" = <save folder>/Recordings)
    pub save_dir: String,
}
impl Default for RecordingOptions {
    fn default() -> Self {
        Self {
            format: "mp4".into(),
            fps: 12,
            video_fps: 30,
            quality: "medium".into(),
            codec: "h264".into(),
            cursor: true,
            clicks: false,
            keys: false,
            mic: false,
            system_audio: false,
            webcam: false,
            webcam_size: "m".into(),
            webcam_shape: "circle".into(),
            countdown: 3,
            max_minutes: 0,
            after: "video".into(),
            save_dir: String::new(),
        }
    }
}
impl RecordingOptions {
    fn sanitized(mut self) -> Self {
        if !matches!(self.format.as_str(), "mp4" | "mov" | "gif") {
            self.format = "mp4".into();
        }
        self.fps = self.fps.clamp(5, 15);
        self.video_fps = if self.video_fps >= 45 { 60 } else { 30 };
        if !matches!(self.quality.as_str(), "low" | "medium" | "high") {
            self.quality = "medium".into();
        }
        if !matches!(self.codec.as_str(), "h264" | "hevc") {
            self.codec = "h264".into();
        }
        if !matches!(self.webcam_size.as_str(), "s" | "m" | "l") {
            self.webcam_size = "m".into();
        }
        if !matches!(self.webcam_shape.as_str(), "circle" | "rounded") {
            self.webcam_shape = "circle".into();
        }
        if !matches!(self.after.as_str(), "video" | "reveal" | "none") {
            self.after = "video".into();
        }
        self.countdown = self.countdown.min(10);
        self.max_minutes = self.max_minutes.min(600);
        self
    }
}

fn options_file(app: &AppHandle) -> std::path::PathBuf {
    crate::paths::config_file(app).with_file_name("recording.json")
}
fn load_options(app: &AppHandle) -> RecordingOptions {
    std::fs::read_to_string(options_file(app)).ok().and_then(|s| serde_json::from_str::<RecordingOptions>(&s).ok()).unwrap_or_default().sanitized()
}
fn save_options(app: &AppHandle, o: &RecordingOptions) {
    if let Ok(s) = serde_json::to_string_pretty(o) {
        let _ = std::fs::write(options_file(app), s);
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Target {
    Region,
    Display,
    Window(u32),
}
impl Target {
    fn name(&self) -> &'static str {
        match self {
            Target::Region => "region",
            Target::Display => "display",
            Target::Window(_) => "window",
        }
    }
}

#[derive(Clone, Copy)]
struct Pending {
    rect: SelectionRect,
    target: Target,
}

/// Recording clock: wall time minus paused time.
#[derive(Debug, Clone)]
struct Clock {
    start: Instant,
    paused_total: Duration,
    paused_at: Option<Instant>,
}
impl Clock {
    fn new() -> Self {
        Self { start: Instant::now(), paused_total: Duration::ZERO, paused_at: None }
    }
    fn elapsed_at(&self, now: Instant) -> Duration {
        let end = self.paused_at.unwrap_or(now);
        end.saturating_duration_since(self.start).saturating_sub(self.paused_total)
    }
    fn elapsed(&self) -> Duration {
        self.elapsed_at(Instant::now())
    }
    fn pause(&mut self) {
        if self.paused_at.is_none() {
            self.paused_at = Some(Instant::now());
        }
    }
    fn resume(&mut self) {
        if let Some(p) = self.paused_at.take() {
            self.paused_total += p.elapsed();
        }
    }
}

enum Kind {
    #[cfg(target_os = "macos")]
    Sck(Arc<sck::Engine>),
    /// `screencapture` child pid
    Screencapture(u32),
    Gif,
}

struct Active {
    kind: Kind,
    /// GIF capture loop stop flag
    stop: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
    clock: Clock,
    opts: RecordingOptions,
    rect: SelectionRect,
    target: Target,
    session: u64,
}

static RECORDING: AtomicBool = AtomicBool::new(false);
static SESSION: AtomicU64 = AtomicU64::new(0);
static ACTIVE: Mutex<Option<Active>> = Mutex::new(None);
static PENDING: Mutex<Option<Pending>> = Mutex::new(None);

fn active() -> std::sync::MutexGuard<'static, Option<Active>> {
    ACTIVE.lock().unwrap_or_else(|e| e.into_inner())
}
fn pending() -> std::sync::MutexGuard<'static, Option<Pending>> {
    PENDING.lock().unwrap_or_else(|e| e.into_inner())
}

#[derive(Serialize, Clone)]
pub struct RecordingStatus {
    pub recording: bool,
    pub pending: bool,
    pub paused: bool,
    pub started_ms: u64,
    pub elapsed_ms: u64,
    pub width: f64,
    pub height: f64,
    /// "region" | "display" | "window"
    pub target: String,
    pub can_pause: bool,
    pub options: RecordingOptions,
    pub keys_access: bool,
    /// ScreenCaptureKit engine available (else the screencapture fallback is used)
    pub sck: bool,
}

#[derive(Serialize, Clone)]
struct Finished {
    path: String,
    format: String,
    duration_ms: u64,
    id: String,
    width: u32,
    height: u32,
}

#[derive(Serialize, Clone)]
struct Tick {
    elapsed_ms: u64,
    paused: bool,
}

fn set_state(app: &AppHandle, on: bool) {
    RECORDING.store(on, Ordering::SeqCst);
    let _ = app.emit("recording-state", on);
    crate::tray::refresh(app);
}

fn sck_available() -> bool {
    #[cfg(target_os = "macos")]
    {
        sck::available()
    }
    #[cfg(not(target_os = "macos"))]
    false
}

// ------------------------------------------------------------------------------------------------
// public API (called by capture.rs / tray / hotkey)
// ------------------------------------------------------------------------------------------------

/// Called by capture.rs when overlay mode "record" finishes: shows the options bar.
pub fn start_region(app: &AppHandle, rect: SelectionRect) {
    begin_setup(app, rect, Target::Region);
}

/// Called by capture.rs when overlay mode "record-window" finishes (`rect` = the window's frame).
pub fn start_window(app: &AppHandle, rect: SelectionRect, window_id: u32) {
    begin_setup(app, rect, Target::Window(window_id));
}

/// Record the whole display under the cursor (tray / hotkey). Stops a running recording instead.
pub fn start_display(app: &AppHandle) {
    if stop_if_recording(app) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        if !crate::permissions::has_screen_access() {
            let a = app.clone();
            let _ = app.run_on_main_thread(move || crate::permissions::show_onboarding(&a));
            return;
        }
        let Some(rect) = cursor_monitor_rect() else {
            floating::alert(&app, "ไม่พบจอภาพ", "No display found", "");
            return;
        };
        begin_setup(&app, rect, Target::Display);
    });
}

/// Tray icon click: stops a running recording.
pub fn on_tray_click(app: &AppHandle) {
    if is_recording() {
        stop(app, false);
    }
}

/// Stop an active recording if any (or dismiss the pending options bar).
/// Returns true if something was stopped (used by hotkey/tray toggle).
pub fn stop_if_recording(app: &AppHandle) -> bool {
    if is_recording() {
        stop(app, false);
        true
    } else if pending().take().is_some() {
        close_setup(app);
        true
    } else {
        false
    }
}

pub fn is_recording() -> bool {
    RECORDING.load(Ordering::SeqCst)
}

fn close_setup(app: &AppHandle) {
    floating::close(app, BAR);
    floating::close(app, BORDER);
    fx::close_camera(app);
}

fn cursor_monitor_rect() -> Option<SelectionRect> {
    use core_graphics::event::CGEvent;
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    let monitors = xcap::Monitor::all().ok()?;
    let cur = CGEventSource::new(CGEventSourceStateID::HIDSystemState).ok().and_then(|s| CGEvent::new(s).ok()).map(|e| e.location());
    let pick = cur
        .and_then(|p| {
            monitors.iter().find(|m| {
                let (Ok(x), Ok(y), Ok(w), Ok(h)) = (m.x(), m.y(), m.width(), m.height()) else { return false };
                p.x >= x as f64 && p.x < (x + w as i32) as f64 && p.y >= y as f64 && p.y < (y + h as i32) as f64
            })
        })
        .or_else(|| monitors.iter().find(|m| m.is_primary().unwrap_or(false)))
        .or(monitors.first())?;
    let (x, y, w, h) = (pick.x().ok()? as f64, pick.y().ok()? as f64, pick.width().ok()? as f64, pick.height().ok()? as f64);
    let scale = pick.scale_factor().map(|s| s as f64).unwrap_or(2.0);
    Some(SelectionRect { monitor_id: pick.id().ok()?, monitor_x: x, monitor_y: y, scale, x: 0.0, y: 0.0, width: w, height: h })
}

fn begin_setup(app: &AppHandle, rect: SelectionRect, target: Target) {
    if is_recording() {
        return;
    }
    *pending() = Some(Pending { rect, target });
    let (x, y) = floating::place(&rect, SETUP_SIZE.0, SETUP_SIZE.1, &[Side::Below, Side::Above, Side::Right, Side::Left]);
    if target != Target::Display {
        if let Err(e) = floating::open_border(app, BORDER, "recorder", "rec", &rect) {
            log::warn!("recording border: {e}");
        }
    }
    match floating::open_panel(app, BAR, "recorder.html?mode=setup", (x, y), SETUP_SIZE, true) {
        Ok(w) => fx::style_float(app, &w, 1000),
        Err(e) => {
            log::error!("recorder window: {e}");
            *pending() = None;
            floating::close(app, BORDER);
            return;
        }
    }
    if let Some(b) = app.get_webview_window(BORDER) {
        fx::style_float(app, &b, 999);
    }
    // Webcam bubble preview (so it can be placed before the recording starts).
    let o = load_options(app);
    if o.webcam && !matches!(target, Target::Window(_)) && o.format != "gif" {
        if let Err(e) = fx::open_camera(app, &rect, &o.webcam_size, &o.webcam_shape) {
            log::warn!("camera window: {e}");
        }
    }
}

// ------------------------------------------------------------------------------------------------
// commands
// ------------------------------------------------------------------------------------------------

#[tauri::command]
pub fn recording_status(app: AppHandle) -> RecordingStatus {
    let guard = active();
    if let Some(a) = guard.as_ref() {
        let el = a.clock.elapsed().as_millis() as u64;
        return RecordingStatus {
            recording: true,
            pending: false,
            paused: a.clock.paused_at.is_some(),
            started_ms: floating::now_ms().saturating_sub(el),
            elapsed_ms: el,
            width: a.rect.width,
            height: a.rect.height,
            target: a.target.name().into(),
            can_pause: can_pause(&a.kind),
            options: a.opts.clone(),
            keys_access: fx::keys_access(),
            sck: sck_available(),
        };
    }
    drop(guard);
    let p = pending();
    let (w, h, t) = p.as_ref().map(|p| (p.rect.width, p.rect.height, p.target.name())).unwrap_or((0.0, 0.0, "region"));
    RecordingStatus {
        recording: false,
        pending: p.is_some(),
        paused: false,
        started_ms: 0,
        elapsed_ms: 0,
        width: w,
        height: h,
        target: t.into(),
        can_pause: sck_available(),
        options: load_options(&app),
        keys_access: fx::keys_access(),
        sck: sck_available(),
    }
}

fn can_pause(k: &Kind) -> bool {
    match k {
        #[cfg(target_os = "macos")]
        Kind::Sck(_) => true,
        _ => false,
    }
}

/// Persist options without starting (used by the setup bar when toggling the webcam, etc.).
#[tauri::command]
pub fn recording_options_get(app: AppHandle) -> RecordingOptions {
    load_options(&app)
}

#[tauri::command]
pub fn recording_options_save(app: AppHandle, options: RecordingOptions) -> RecordingOptions {
    let o = options.sanitized();
    save_options(&app, &o);
    let _ = app.emit("recording-options-changed", o.clone());
    o
}

/// The default folder recordings are saved to.
#[tauri::command]
pub fn recording_default_dir(app: AppHandle) -> String {
    floating::save_dir(&app).join("Recordings").to_string_lossy().into_owned()
}

#[tauri::command]
pub async fn recording_begin(app: AppHandle, options: RecordingOptions) -> Result<u64, String> {
    let a = app.clone();
    tauri::async_runtime::spawn_blocking(move || begin(&a, options)).await.map_err(|e| e.to_string())?
}

fn begin(app: &AppHandle, options: RecordingOptions) -> Result<u64, String> {
    if is_recording() {
        return Err("already recording".into());
    }
    let Pending { rect, target } = pending().take().ok_or("no region selected")?;
    let opts = options.sanitized();
    save_options(app, &opts);

    let is_window = matches!(target, Target::Window(_));
    let gif = opts.format == "gif";

    // ---- extras (they must exist before the stream starts so they can be kept in the capture)
    let mut keep: Vec<u32> = Vec::new();
    if !is_window && !gif && (opts.clicks || opts.keys) {
        match fx::open_fx(app, &rect) {
            Ok(_) => {
                let (mx, my, _, _) = floating::monitor_bounds(&rect);
                fx::start_monitors(app, (mx, my), opts.clicks, opts.keys);
            }
            Err(e) => log::warn!("fx window: {e}"),
        }
    }
    if !is_window && !gif && opts.webcam {
        if let Err(e) = fx::open_camera(app, &rect, &opts.webcam_size, &opts.webcam_shape) {
            log::warn!("camera window: {e}");
        }
    } else {
        fx::close_camera(app);
    }
    if app.get_webview_window(fx::FX).is_some() || app.get_webview_window(fx::CAMERA).is_some() {
        std::thread::sleep(Duration::from_millis(350)); // let the window server know them
        keep.extend(fx::window_number(app, fx::FX));
        keep.extend(fx::window_number(app, fx::CAMERA));
    }

    let stop_flag = Arc::new(AtomicBool::new(false));
    let cancel = Arc::new(AtomicBool::new(false));
    let session = SESSION.fetch_add(1, Ordering::SeqCst) + 1;

    let kind = if gif {
        spawn_gif(app, rect, opts.clone(), stop_flag.clone(), cancel.clone());
        Ok(Kind::Gif)
    } else {
        start_video(app, rect, target, &opts, &keep, &cancel)
    };
    let kind = match kind {
        Ok(k) => k,
        Err(e) => {
            fx::close_fx(app);
            fx::close_camera(app);
            floating::close(app, BAR);
            floating::close(app, BORDER);
            floating::alert(app, "เริ่มบันทึกหน้าจอไม่สำเร็จ", "Could not start recording", &e);
            let _ = app.emit("recording-error", e.clone());
            return Err(e);
        }
    };

    let clock = Clock::new();
    let started_ms = floating::now_ms();
    *active() = Some(Active { kind, stop: stop_flag, cancel, clock, opts: opts.clone(), rect, target, session });
    set_state(app, true);
    spawn_ticker(app, session, opts.max_minutes);

    // Shrink the options bar into the compact control bar.
    if let Some(w) = app.get_webview_window(BAR) {
        let (x, y) = floating::place(&rect, REC_SIZE.0, REC_SIZE.1, &[Side::Below, Side::Above, Side::Right, Side::Left]);
        let _ = w.set_size(tauri::LogicalSize::new(REC_SIZE.0, REC_SIZE.1));
        let _ = w.set_position(tauri::LogicalPosition::new(x, y));
    }
    Ok(started_ms)
}

/// Timer thread: `recording-tick` events, the menu-bar title (`● 00:42`) and the max duration.
fn spawn_ticker(app: &AppHandle, session: u64, max_minutes: u32) {
    let app = app.clone();
    std::thread::spawn(move || {
        let mut last_title = String::new();
        loop {
            std::thread::sleep(Duration::from_millis(250));
            let (el, paused) = {
                let g = active();
                match g.as_ref() {
                    Some(a) if a.session == session => (a.clock.elapsed(), a.clock.paused_at.is_some()),
                    _ => break,
                }
            };
            let secs = el.as_secs();
            let _ = app.emit("recording-tick", Tick { elapsed_ms: el.as_millis() as u64, paused });
            let title = format!("{} {}", if paused { "⏸" } else { "●" }, fmt_clock(secs));
            if title != last_title {
                set_tray_title(&app, Some(&title));
                last_title = title;
            }
            if max_minutes > 0 && secs >= max_minutes as u64 * 60 {
                let a = app.clone();
                std::thread::spawn(move || {
                    if active().as_ref().map(|x| x.session == session).unwrap_or(false) {
                        stop(&a, false);
                    }
                });
                break;
            }
        }
        set_tray_title(&app, None);
    });
}

fn fmt_clock(secs: u64) -> String {
    if secs >= 3600 {
        format!("{}:{:02}:{:02}", secs / 3600, (secs / 60) % 60, secs % 60)
    } else {
        format!("{:02}:{:02}", secs / 60, secs % 60)
    }
}

fn set_tray_title(app: &AppHandle, title: Option<&str>) {
    let a = app.clone();
    let t = title.map(|s| s.to_string());
    let _ = app.run_on_main_thread(move || {
        if let Some(tray) = a.tray_by_id("main") {
            let _ = tray.set_title(t.as_deref());
        }
    });
}

#[tauri::command]
pub fn recording_stop(app: AppHandle) {
    if is_recording() {
        stop(&app, false);
    }
}

/// Cancel: discards the recording (or just dismisses the options bar).
#[tauri::command]
pub fn recording_cancel(app: AppHandle) {
    if is_recording() {
        stop(&app, true);
    } else {
        *pending() = None;
        close_setup(&app);
    }
}

/// Pause / resume (ScreenCaptureKit engine only). Returns the new paused state.
#[tauri::command]
pub fn recording_pause(app: AppHandle) -> Result<bool, String> {
    let mut g = active();
    let a = g.as_mut().ok_or("not recording")?;
    let paused_now = a.clock.paused_at.is_some();
    match &a.kind {
        #[cfg(target_os = "macos")]
        Kind::Sck(e) => {
            if paused_now {
                e.resume();
                a.clock.resume();
            } else {
                e.pause();
                a.clock.pause();
            }
        }
        _ => return Err("pause is not supported for this recording mode".into()),
    }
    let paused = a.clock.paused_at.is_some();
    let el = a.clock.elapsed().as_millis() as u64;
    drop(g);
    let _ = app.emit("recording-paused", paused);
    let _ = app.emit("recording-tick", Tick { elapsed_ms: el, paused });
    Ok(paused)
}

/// Show / hide / restyle the webcam bubble (setup bar and control bar).
#[tauri::command]
pub fn recording_camera(app: AppHandle, on: bool, size: String, shape: String) -> Result<(), String> {
    let size = if matches!(size.as_str(), "s" | "m" | "l") { size } else { "m".into() };
    let shape = if matches!(shape.as_str(), "circle" | "rounded") { shape } else { "circle".into() };
    if !on {
        fx::close_camera(&app);
        return Ok(());
    }
    let rect = pending().as_ref().map(|p| p.rect).or_else(|| active().as_ref().map(|a| a.rect)).ok_or("no recording")?;
    fx::open_camera(&app, &rect, &size, &shape).map_err(|e| e.to_string())?;
    Ok(())
}

/// "ok" | "none" (no microphone) | "denied" (Microphone permission refused)
#[tauri::command]
pub fn recording_mic_status() -> String {
    #[cfg(target_os = "macos")]
    {
        match sck::mic_state() {
            sck::MicState::Ok => "ok",
            sck::MicState::NoDevice => "none",
            sck::MicState::Denied => "denied",
        }
        .into()
    }
    #[cfg(not(target_os = "macos"))]
    "none".into()
}

#[tauri::command]
pub fn recording_keys_access() -> bool {
    fx::keys_access()
}

#[tauri::command]
pub fn recording_keys_request() -> bool {
    let ok = fx::keys_request();
    if !ok {
        let _ = std::process::Command::new("open").arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent").spawn();
    }
    ok
}

fn stop(app: &AppHandle, cancel: bool) {
    let a = active().take();
    let Some(a) = a else { return };
    if cancel {
        a.cancel.store(true, Ordering::SeqCst);
    }
    a.stop.store(true, Ordering::SeqCst);
    floating::close(app, BAR);
    floating::close(app, BORDER);
    fx::close_fx(app);
    set_state(app, false);
    match a.kind {
        #[cfg(target_os = "macos")]
        Kind::Sck(engine) => {
            let app2 = app.clone();
            let opts = a.opts.clone();
            let tmp = sck_tmp_path(&app2, &opts);
            std::thread::spawn(move || {
                let res = engine.stop(cancel);
                fx::close_camera(&app2);
                match res {
                    _ if cancel => {
                        let _ = std::fs::remove_file(&tmp);
                    }
                    Ok(f) => finalize(&app2, &tmp, &opts.format, (f.duration_s * 1000.0) as u64, Some((f.width, f.height)), &opts),
                    Err(e) => {
                        let _ = std::fs::remove_file(&tmp);
                        log::error!("recording failed: {e}");
                        eprintln!("recording failed: {e}");
                        floating::alert(&app2, "บันทึกหน้าจอไม่สำเร็จ – ตรวจสอบสิทธิ์ Screen Recording ใน ตั้งค่าระบบ", "Recording failed – check the Screen Recording permission in System Settings", &e);
                        let _ = app2.emit("recording-error", e);
                    }
                }
            });
        }
        Kind::Screencapture(pid) => {
            fx::close_camera(app);
            // Stopping: SIGINT lets screencapture finalise the movie.
            unsafe {
                libc::kill(pid as i32, libc::SIGINT);
            }
        }
        Kind::Gif => {
            fx::close_camera(app);
        }
    }
}

// ------------------------------------------------------------------------------------------------
// video: ScreenCaptureKit engine, with the screencapture fallback
// ------------------------------------------------------------------------------------------------

fn sck_tmp_path(app: &AppHandle, opts: &RecordingOptions) -> std::path::PathBuf {
    // one temp file per active recording; derived from the session id so stop() can find it again
    let id = SESSION.load(Ordering::SeqCst);
    crate::paths::temp_dir(app).join(format!("rec-sck-{id}.{}", if opts.format == "mov" { "mov" } else { "mp4" }))
}

fn start_video(app: &AppHandle, rect: SelectionRect, target: Target, opts: &RecordingOptions, keep: &[u32], cancel: &Arc<AtomicBool>) -> Result<Kind, String> {
    #[cfg(target_os = "macos")]
    if sck_available() {
        let tmp = sck_tmp_path(app, opts);
        let _ = std::fs::remove_file(&tmp);
        let bpp = match opts.quality.as_str() {
            "low" => 0.05,
            "high" => 0.20,
            _ => 0.10,
        } * if opts.codec == "hevc" { 0.6 } else { 1.0 };
        let t = match target {
            Target::Region => sck::Target::Region { id: rect.monitor_id, x: rect.x, y: rect.y, w: rect.width, h: rect.height, scale: rect.scale.max(1.0) },
            Target::Display => sck::Target::Display { id: rect.monitor_id, scale: rect.scale.max(1.0) },
            Target::Window(id) => sck::Target::Window { id, scale: rect.scale.max(1.0) },
        };
        let cfg = sck::Config {
            target: t,
            fps: opts.video_fps,
            bits_per_pixel: bpp,
            hevc: opts.codec == "hevc",
            mov: opts.format == "mov",
            cursor: opts.cursor,
            system_audio: opts.system_audio,
            mic: opts.mic,
            out: tmp,
            keep_windows: keep.to_vec(),
        };
        let a = app.clone();
        let on_stopped: Box<dyn Fn(String) + Send + Sync> = Box::new(move |msg| {
            log::warn!("capture stream stopped by the system: {msg}");
            let a2 = a.clone();
            std::thread::spawn(move || {
                floating::alert(&a2, "การบันทึกหยุดโดยระบบ", "Recording was stopped by the system", &msg);
                if is_recording() {
                    stop(&a2, false);
                }
            });
        });
        match sck::Engine::start(cfg, on_stopped) {
            Ok(engine) => {
                if opts.mic && !engine.has_mic {
                    let why = match engine.mic_state {
                        Some(sck::MicState::Denied) => "mic-denied",
                        _ => "mic-unavailable",
                    };
                    let _ = app.emit("recording-warning", why);
                }
                return Ok(Kind::Sck(Arc::new(engine)));
            }
            Err(e) => {
                log::warn!("ScreenCaptureKit start failed ({e}); falling back to screencapture");
                let _ = app.emit("recording-warning", "sck-fallback");
            }
        }
    }
    let (rect2, opts2) = (rect, opts.clone());
    spawn_video(app, rect2, opts2, cancel.clone()).map(Kind::Screencapture)
}

// ------------------------------------------------------------------------------------------------
// video via screencapture (fallback)
// ------------------------------------------------------------------------------------------------

fn build_video_cmd(rect: &SelectionRect, opts: &RecordingOptions, mic: bool, out: &std::path::Path) -> std::process::Command {
    let (gx, gy, w, h) = floating::global_rect(rect);
    let mut cmd = std::process::Command::new("/usr/sbin/screencapture");
    cmd.arg("-v").arg("-x");
    if opts.cursor {
        cmd.arg("-C");
    }
    if opts.clicks {
        cmd.arg("-k");
    }
    if mic {
        cmd.arg("-g");
    }
    cmd.arg("-R").arg(format!("{},{},{},{}", gx.round() as i64, gy.round() as i64, w.round() as i64, h.round() as i64));
    cmd.arg(out);
    cmd.stdin(std::process::Stdio::null()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::piped());
    cmd
}

fn spawn_video(app: &AppHandle, rect: SelectionRect, opts: RecordingOptions, cancel: Arc<AtomicBool>) -> Result<u32, String> {
    let tmp = crate::paths::temp_dir(app).join(format!("rec-{}.mov", uuid::Uuid::new_v4().simple()));
    let mut child = build_video_cmd(&rect, &opts, opts.mic, &tmp).spawn().map_err(|e| format!("cannot start screencapture: {e}"))?;
    let pid = child.id();
    let app2 = app.clone();
    let started = Instant::now();
    std::thread::spawn(move || {
        let mut status = child.wait();
        let mut stderr = read_stderr(&mut child);
        // Microphone not available -> retry without it.
        if opts.mic && !cancel.load(Ordering::SeqCst) && started.elapsed() < Duration::from_secs(3) && !tmp.exists() && status.as_ref().map(|s| !s.success()).unwrap_or(true) {
            log::warn!("screencapture failed with mic ({stderr}); retrying without audio");
            let _ = app2.emit("recording-warning", "mic-unavailable");
            if let Ok(mut c2) = build_video_cmd(&rect, &opts, false, &tmp).spawn() {
                if let Some(a) = active().as_mut() {
                    a.kind = Kind::Screencapture(c2.id());
                }
                status = c2.wait();
                stderr = read_stderr(&mut c2);
            }
        }
        finish_video(&app2, &opts, &tmp, status.map(|s| s.success()).unwrap_or(false), &stderr, cancel.load(Ordering::SeqCst), started);
    });
    Ok(pid)
}

fn read_stderr(child: &mut std::process::Child) -> String {
    use std::io::Read;
    let mut s = String::new();
    if let Some(mut e) = child.stderr.take() {
        let _ = e.read_to_string(&mut s);
    }
    s.trim().to_string()
}

/// Tear down the UI if a recording ended on its own (screencapture died, GIF max length…).
fn reset_if_active(app: &AppHandle) {
    if active().take().is_some() {
        floating::close(app, BAR);
        floating::close(app, BORDER);
        fx::close_fx(app);
        fx::close_camera(app);
        set_state(app, false);
    }
}

fn finish_video(app: &AppHandle, opts: &RecordingOptions, tmp: &std::path::Path, ok: bool, stderr: &str, cancelled: bool, started: Instant) {
    reset_if_active(app);
    let size = std::fs::metadata(tmp).map(|m| m.len()).unwrap_or(0);
    if cancelled {
        let _ = std::fs::remove_file(tmp);
        return;
    }
    if size == 0 {
        let _ = std::fs::remove_file(tmp);
        let msg = if stderr.is_empty() { format!("screencapture exited without output (ok={ok})") } else { stderr.to_string() };
        log::error!("recording failed: {msg}");
        floating::alert(app, "บันทึกหน้าจอไม่สำเร็จ – ตรวจสอบสิทธิ์ Screen Recording ใน ตั้งค่าระบบ", "Recording failed – check the Screen Recording permission in System Settings", &msg);
        let _ = app.emit("recording-error", msg);
        return;
    }
    let duration_ms = started.elapsed().as_millis() as u64;
    let mut format = opts.format.clone();
    let mut src = tmp.to_path_buf();
    if format == "mp4" {
        let converted = tmp.with_extension("mp4");
        let st = std::process::Command::new("/usr/bin/avconvert")
            .args(["--source"])
            .arg(tmp)
            .args(["--preset", "PresetPassthrough", "--output"])
            .arg(&converted)
            .arg("--replace")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
        let good = st.map(|s| s.success()).unwrap_or(false) && std::fs::metadata(&converted).map(|m| m.len() > 0).unwrap_or(false);
        if good {
            let _ = std::fs::remove_file(tmp);
            src = converted;
        } else {
            // Fall back to the original QuickTime movie.
            log::warn!("avconvert failed; keeping .mov");
            let _ = std::fs::remove_file(&converted);
            format = "mov".into();
        }
    }
    finalize(app, &src, &format, duration_ms, None, opts);
}

// ------------------------------------------------------------------------------------------------
// finishing: move into the recordings folder, thumbnail, list, open
// ------------------------------------------------------------------------------------------------

fn move_file(from: &std::path::Path, to: &std::path::Path) {
    if std::fs::rename(from, to).is_err() && std::fs::copy(from, to).is_ok() {
        let _ = std::fs::remove_file(from);
    }
}

/// The folder recordings go to.
pub fn recordings_dir(app: &AppHandle, opts: &RecordingOptions) -> std::path::PathBuf {
    let raw = opts.save_dir.trim();
    if !raw.is_empty() {
        let dir = if let Some(rest) = raw.strip_prefix("~/") { dirs::home_dir().map(|h| h.join(rest)).unwrap_or_default() } else { std::path::PathBuf::from(raw) };
        if !dir.as_os_str().is_empty() && std::fs::create_dir_all(&dir).is_ok() {
            return dir;
        }
    }
    let d = floating::save_dir(app).join("Recordings");
    let _ = std::fs::create_dir_all(&d);
    d
}

/// `<pattern> Recording[ (n)].<ext>` inside `dir`.
pub fn unique_in(app: &AppHandle, dir: &std::path::Path, suffix: &str, ext: &str) -> std::path::PathBuf {
    let s = crate::settings::get(app);
    let now = chrono::Local::now();
    let base = s
        .filename_pattern
        .replace("{date}", &now.format("%Y-%m-%d").to_string())
        .replace("{time}", &now.format("%H.%M.%S").to_string())
        .replace("{n}", "");
    let base: String = base.chars().map(|c| if matches!(c, '/' | '\\' | ':' | '\0') { '-' } else { c }).collect();
    let base = format!("{} {}", base.trim(), suffix);
    let mut p = dir.join(format!("{base}.{ext}"));
    let mut n = 2;
    while p.exists() {
        p = dir.join(format!("{base} ({n}).{ext}"));
        n += 1;
    }
    p
}

fn finalize(app: &AppHandle, tmp: &std::path::Path, format: &str, duration_ms: u64, dims: Option<(u32, u32)>, opts: &RecordingOptions) {
    let dir = recordings_dir(app, opts);
    let dest = unique_in(app, &dir, "Recording", format);
    move_file(tmp, &dest);
    if !dest.exists() {
        log::error!("recording: cannot move {} to {}", tmp.display(), dest.display());
        eprintln!("recording: cannot move {} to {}", tmp.display(), dest.display());
        let _ = app.emit("recording-error", "cannot save the recording");
        return;
    }
    let id = uuid::Uuid::new_v4().simple().to_string();
    let thumb_path = store::thumbs_dir(app).join(format!("{id}.jpg"));
    let info = crate::video::poster(&dest, &thumb_path, 360);
    let (w, h) = dims.or(info.map(|i| (i.0, i.1))).unwrap_or((0, 0));
    let dur = if duration_ms > 0 { duration_ms } else { info.map(|i| i.2).unwrap_or(0) };
    let path = dest.to_string_lossy().into_owned();
    store::add(
        app,
        store::Recording {
            id: id.clone(),
            path: path.clone(),
            format: format.to_string(),
            duration_ms: dur,
            width: w,
            height: h,
            size_bytes: std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0),
            created_at: chrono::Local::now().to_rfc3339(),
            thumb: thumb_path.exists().then(|| thumb_path.to_string_lossy().into_owned()),
        },
    );
    let _ = app.emit("recording-finished", Finished { path: path.clone(), format: format.to_string(), duration_ms: dur, id, width: w, height: h });
    match opts.after.as_str() {
        "none" => {}
        "reveal" => {
            let _ = std::process::Command::new("/usr/bin/open").arg("-R").arg(&path).spawn();
        }
        _ => {
            let a = app.clone();
            let p = path.clone();
            let _ = app.run_on_main_thread(move || {
                if let Err(e) = crate::video::open_window(&a, Some(&p)) {
                    log::error!("open video window: {e}");
                    let _ = std::process::Command::new("/usr/bin/open").arg("-R").arg(&p).spawn();
                }
            });
        }
    }
}

// ------------------------------------------------------------------------------------------------
// GIF
// ------------------------------------------------------------------------------------------------

struct GifFrame {
    ms: u64,
    w: u32,
    h: u32,
    rgba: Vec<u8>,
}

fn spawn_gif(app: &AppHandle, rect: SelectionRect, opts: RecordingOptions, stop: Arc<AtomicBool>, cancel: Arc<AtomicBool>) {
    let (tx, rx) = std::sync::mpsc::sync_channel::<GifFrame>(3);
    let tmp = crate::paths::temp_dir(app).join(format!("rec-{}.gif", uuid::Uuid::new_v4().simple()));

    // --- capture thread ---
    let stop_c = stop.clone();
    let fps = opts.fps.max(1) as u64;
    std::thread::spawn(move || {
        let monitor = xcap::Monitor::all().ok().and_then(|l| l.into_iter().find(|m| m.id().ok() == Some(rect.monitor_id)));
        let Some(monitor) = monitor else {
            log::error!("gif: monitor not found");
            return;
        };
        let interval = Duration::from_millis(1000 / fps);
        let begin = Instant::now();
        let (rx_, ry_) = (rect.x.max(0.0).round() as u32, rect.y.max(0.0).round() as u32);
        let (rw, rh) = (rect.width.round().max(2.0) as u32, rect.height.round().max(2.0) as u32);
        let mut next = begin;
        while !stop_c.load(Ordering::SeqCst) && begin.elapsed() < Duration::from_secs(GIF_MAX_SECS) {
            let now = Instant::now();
            if now < next {
                std::thread::sleep((next - now).min(Duration::from_millis(20)));
                continue;
            }
            next += interval;
            if next < now {
                next = now + interval; // we're behind: don't burst
            }
            let ts = begin.elapsed().as_millis() as u64;
            match monitor.capture_region(rx_, ry_, rw, rh) {
                Ok(img) => {
                    let (iw, ih) = (img.width(), img.height());
                    let frame = if iw > GIF_MAX_WIDTH {
                        let th = ((ih as f64) * (GIF_MAX_WIDTH as f64) / (iw as f64)).round().max(2.0) as u32;
                        let r = image::imageops::resize(&img, GIF_MAX_WIDTH, th, image::imageops::FilterType::Triangle);
                        GifFrame { ms: ts, w: GIF_MAX_WIDTH, h: th, rgba: r.into_raw() }
                    } else {
                        GifFrame { ms: ts, w: iw, h: ih, rgba: img.into_raw() }
                    };
                    // Drop frames if the encoder can't keep up.
                    let _ = tx.try_send(frame);
                }
                Err(e) => log::warn!("gif capture: {e}"),
            }
        }
        // `tx` dropped here -> encoder finishes.
        if !stop_c.load(Ordering::SeqCst) {
            // max duration reached: behave like a stop
            stop_c.store(true, Ordering::SeqCst);
        }
    });

    // --- encoder thread ---
    let app2 = app.clone();
    let opts2 = opts.clone();
    std::thread::spawn(move || {
        let started = Instant::now();
        let result = encode_gif(&rx, &tmp, opts.fps);
        // Make sure the UI is reset if the capture ended by itself (max duration).
        reset_if_active(&app2);
        let cancelled = cancel.load(Ordering::SeqCst);
        match result {
            _ if cancelled => {
                let _ = std::fs::remove_file(&tmp);
            }
            Ok(duration_ms) => {
                finalize(&app2, &tmp, "gif", duration_ms.max(started.elapsed().as_millis() as u64 / 2), None, &opts2);
            }
            Err(e) => {
                let _ = std::fs::remove_file(&tmp);
                log::error!("gif encode: {e}");
                floating::alert(&app2, "บันทึก GIF ไม่สำเร็จ – ตรวจสอบสิทธิ์ Screen Recording ใน ตั้งค่าระบบ", "GIF recording failed – check the Screen Recording permission in System Settings", &e);
                let _ = app2.emit("recording-error", e);
            }
        }
    });
}

/// Streaming GIF encoder. Identical consecutive frames are merged by extending the delay.
/// Returns the recorded duration in ms.
fn encode_gif(rx: &std::sync::mpsc::Receiver<GifFrame>, path: &std::path::Path, fps: u32) -> Result<u64, String> {
    let mut encoder: Option<gif::Encoder<std::fs::File>> = None;
    let mut pending: Option<GifFrame> = None;
    let mut emitted_cs: u64 = 0; // centiseconds already written
    let mut last_ms: u64 = 0;
    let interval_ms = 1000 / fps.max(1) as u64;

    let write = |enc: &mut Option<gif::Encoder<std::fs::File>>, mut f: GifFrame, until_ms: u64, emitted: &mut u64| -> Result<(), String> {
        if enc.is_none() {
            let file = std::fs::File::create(path).map_err(|e| e.to_string())?;
            let mut e = gif::Encoder::new(file, f.w as u16, f.h as u16, &[]).map_err(|e| e.to_string())?;
            e.set_repeat(gif::Repeat::Infinite).map_err(|e| e.to_string())?;
            *enc = Some(e);
        }
        let target_cs = until_ms / 10;
        let delay = target_cs.saturating_sub(*emitted).max(2);
        *emitted += delay;
        let mut frame = gif::Frame::from_rgba_speed(f.w as u16, f.h as u16, &mut f.rgba, 12);
        frame.delay = delay.min(u16::MAX as u64) as u16;
        enc.as_mut().unwrap().write_frame(&frame).map_err(|e| e.to_string())
    };

    while let Ok(f) = rx.recv() {
        last_ms = f.ms;
        match pending.take() {
            None => pending = Some(f),
            Some(p) => {
                if p.w == f.w && p.h == f.h && p.rgba == f.rgba {
                    pending = Some(p); // unchanged -> keep waiting, delay grows
                } else {
                    write(&mut encoder, p, f.ms, &mut emitted_cs)?;
                    pending = Some(f);
                }
            }
        }
    }
    if let Some(p) = pending.take() {
        let end = last_ms + interval_ms;
        write(&mut encoder, p, end, &mut emitted_cs)?;
    }
    if encoder.is_none() {
        return Err("no frames captured (is Screen Recording permission granted?)".into());
    }
    Ok(last_ms + interval_ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clock_excludes_paused_time() {
        let mut c = Clock::new();
        let t0 = c.start;
        // 5 s running, 3 s paused, 2 s running
        assert_eq!(c.elapsed_at(t0 + Duration::from_secs(5)), Duration::from_secs(5));
        c.paused_at = Some(t0 + Duration::from_secs(5));
        assert_eq!(c.elapsed_at(t0 + Duration::from_secs(8)), Duration::from_secs(5)); // frozen while paused
        c.paused_total = Duration::from_secs(3);
        c.paused_at = None;
        assert_eq!(c.elapsed_at(t0 + Duration::from_secs(10)), Duration::from_secs(7));
    }

    #[test]
    fn options_are_sanitised_and_old_json_loads() {
        let o: RecordingOptions = serde_json::from_str(r#"{"format":"gif","fps":99,"cursor":false,"clicks":true,"mic":false,"countdown":3}"#).unwrap();
        let o = o.sanitized();
        assert_eq!((o.format.as_str(), o.fps, o.video_fps, o.after.as_str()), ("gif", 15, 30, "video"));
        let bad = RecordingOptions { format: "avi".into(), video_fps: 120, quality: "x".into(), countdown: 99, ..Default::default() }.sanitized();
        assert_eq!((bad.format.as_str(), bad.video_fps, bad.quality.as_str(), bad.countdown), ("mp4", 60, "medium", 10));
    }

    #[test]
    fn clock_text() {
        assert_eq!(fmt_clock(42), "00:42");
        assert_eq!(fmt_clock(3725), "1:02:05");
    }

    #[test]
    fn gif_encoder_merges_identical_frames() {
        let (tx, rx) = std::sync::mpsc::sync_channel::<GifFrame>(16);
        let mk = |ms: u64, v: u8| GifFrame { ms, w: 64, h: 48, rgba: (0..64 * 48).flat_map(|i| [(i % 64) as u8 * 3, v, 100, 255]).collect() };
        for (ms, v) in [(0, 10), (83, 10), (166, 10), (250, 200), (333, 200), (416, 90)] {
            tx.send(mk(ms, v)).unwrap();
        }
        drop(tx);
        let path = std::env::temp_dir().join("captureme-test.gif");
        let dur = encode_gif(&rx, &path, 12).unwrap();
        assert!(dur >= 416);
        let mut dec = gif::DecodeOptions::new();
        dec.set_color_output(gif::ColorOutput::RGBA);
        let mut d = dec.read_info(std::fs::File::open(&path).unwrap()).unwrap();
        let mut frames = 0;
        let mut total = 0u32;
        while let Some(f) = d.read_next_frame().unwrap() {
            frames += 1;
            total += f.delay as u32;
        }
        assert_eq!(frames, 3);
        assert!(total >= 40, "{total}");
        let _ = std::fs::remove_file(path);
    }
}

/// Dev-only end-to-end check: `CAPTUREME_AUTOTEST_RECORD=1 npm run tauri dev` records a small
/// region for ~6 s (with a pause in the middle) and prints the result to stderr.
/// Optional: CAPTUREME_AUTOTEST_FX=1 (click rings + webcam), CAPTUREME_AUTOTEST_AFTER=video|none.
#[cfg(debug_assertions)]
pub fn debug_autotest(app: &AppHandle) {
    if std::env::var("CAPTUREME_AUTOTEST_RECORD").is_err() {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let sleep = |ms| std::thread::sleep(Duration::from_millis(ms));
        let shot = |name: &str| {
            let _ = std::process::Command::new("/usr/sbin/screencapture").arg("-x").arg(format!("/tmp/at-{name}.png")).status();
        };
        // CAPTUREME_AUTOTEST_SHOW=1: let screencapture see our (normally capture-hidden) windows
        let show = |app: &AppHandle| {
            if std::env::var("CAPTUREME_AUTOTEST_SHOW").is_ok() {
                for l in [BAR, BORDER] {
                    if let Some(w) = app.get_webview_window(l) {
                        if let Ok(ptr) = w.ns_window() {
                            let addr = ptr as usize;
                            let _ = app.run_on_main_thread(move || unsafe {
                                let obj = addr as *mut objc2::runtime::AnyObject;
                                let _: () = objc2::msg_send![obj, setSharingType: 1usize];
                            });
                        }
                    }
                }
            }
        };
        {
            use tauri::Listener;
            app.listen("camera-error", |e| eprintln!("autotest: camera-error {}", e.payload()));
            app.listen("camera-ready", |_| eprintln!("autotest: camera-ready"));
        }
        sleep(3000);
        if let Ok(page) = std::env::var("CAPTUREME_AUTOTEST_PAGE") {
            let a = app.clone();
            let _ = app.run_on_main_thread(move || {
                let r = if page == "settings" {
                    crate::windows::open_page(&a, "settings", "settings", "tab=recording", "CaptureME Settings", 720.0, 760.0).map(|_| ())
                } else {
                    crate::video::open_window(&a, None).map(|_| ()).and_then(|_| Ok(crate::video::open_recordings(&a)))
                };
                eprintln!("autotest: page {page} -> {r:?}");
            });
            sleep(3500);
            shot("page");
            return;
        }
        let Some(mut rect) = cursor_monitor_rect() else { return eprintln!("autotest: no monitor") };
        rect.x = 120.0;
        rect.y = 140.0;
        rect.width = 760.0;
        rect.height = 470.0;
        begin_setup(&app, rect, Target::Region);
        sleep(1500);
        show(&app);
        sleep(500);
        shot("setup");
        if std::env::var("CAPTUREME_AUTOTEST_UI").is_ok() {
            // drive the real floating bar through its DOM: start -> pause -> resume -> stop
            let click = |sel: &str| {
                if let Some(w) = app.get_webview_window(BAR) {
                    let _ = w.eval(format!("document.querySelector('{sel}')?.click()"));
                }
            };
            save_options(&app, &RecordingOptions { countdown: 0, after: "video".into(), ..Default::default() });
            click(".btn.primary");
            sleep(1500);
            eprintln!("autotest-ui: recording={} status={:?}", is_recording(), active().as_ref().map(|a| (a.clock.paused_at.is_some(), a.clock.elapsed().as_millis())));
            show(&app);
            sleep(300);
            shot("ui-rec");
            click(".pause");
            sleep(1500);
            eprintln!("autotest-ui: paused={:?}", active().as_ref().map(|a| a.clock.paused_at.is_some()));
            shot("ui-paused");
            click(".pause");
            sleep(1500);
            eprintln!("autotest-ui: paused={:?}", active().as_ref().map(|a| a.clock.paused_at.is_some()));
            click(".btn.primary");
            sleep(6000);
            shot("ui-video");
            eprintln!("autotest: recordings = {:#?}", store::list(&app).first());
            return;
        }
        let fx = std::env::var("CAPTUREME_AUTOTEST_FX").is_ok();
        let opts = RecordingOptions {
            clicks: fx,
            webcam: fx,
            countdown: 0,
            after: std::env::var("CAPTUREME_AUTOTEST_AFTER").unwrap_or_else(|_| "none".into()),
            system_audio: std::env::var("CAPTUREME_AUTOTEST_AUDIO").is_ok(),
            ..Default::default()
        };
        let r = begin(&app, opts);
        eprintln!("autotest: begin -> {r:?}  keys_access={}", fx::keys_access());
        sleep(1200);
        show(&app);
        if fx {
            // synthetic events: the overlay page draws them like real clicks / key presses
            let _ = app.emit("rec-click", serde_json::json!({ "x": 500.0, "y": 300.0, "button": 0 }));
            for k in ["H", "e", "l", "l", "o"] {
                let _ = app.emit("rec-key", serde_json::json!({ "label": k, "chord": false }));
            }
            let _ = app.emit("rec-key", serde_json::json!({ "label": "⌘⇧4", "chord": true }));
            sleep(180);
        }
        shot("rec");
        sleep(600);
        eprintln!("autotest: pause -> {:?}", recording_pause(app.clone()));
        sleep(1500);
        eprintln!("autotest: resume -> {:?}", recording_pause(app.clone()));
        sleep(2000);
        stop(&app, false);
        sleep(5000);
        shot("video");
        eprintln!("autotest: recordings = {:#?}", store::list(&app).first());
    });
}
