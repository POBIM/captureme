//! Screen recording (video + GIF). Owner: Agent D.
//!
//! * MP4 / MOV: `/usr/sbin/screencapture -v -R x,y,w,h` child process, stopped with SIGINT
//!   (verified: the QuickTime file is finalised). MP4 is remuxed from the .mov with `avconvert`.
//! * GIF: xcap frames -> downscale -> `gif` encoder (streaming, on a worker thread).
//!
//! Flow: overlay -> `start_region` -> floating options bar ("setup") -> `recording_begin` ->
//! floating control bar (timer / stop / cancel) + click-through region border.
use crate::floating::{self, Side};
pub use crate::types::SelectionRect;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

const BAR: &str = "recorder";
const BORDER: &str = "rec-border";
const SETUP_SIZE: (f64, f64) = (520.0, 132.0);
const REC_SIZE: (f64, f64) = (270.0, 52.0);
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
    /// GIF frame rate (10–15)
    pub fps: u32,
    pub cursor: bool,
    pub clicks: bool,
    pub mic: bool,
    /// Countdown seconds before recording starts (0 = none)
    pub countdown: u32,
}
impl Default for RecordingOptions {
    fn default() -> Self {
        Self { format: "mp4".into(), fps: 12, cursor: true, clicks: false, mic: false, countdown: 3 }
    }
}
impl RecordingOptions {
    fn sanitized(mut self) -> Self {
        if !matches!(self.format.as_str(), "mp4" | "mov" | "gif") {
            self.format = "mp4".into();
        }
        self.fps = self.fps.clamp(5, 15);
        self.countdown = self.countdown.min(10);
        self
    }
}

fn options_file(app: &AppHandle) -> std::path::PathBuf {
    crate::paths::config_file(app).with_file_name("recording.json")
}
fn load_options(app: &AppHandle) -> RecordingOptions {
    std::fs::read_to_string(options_file(app)).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}

struct Active {
    /// screencapture pid (video mode)
    pid: Option<u32>,
    /// GIF capture loop stop flag
    stop: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
    started_ms: u64,
    opts: RecordingOptions,
    rect: SelectionRect,
}

static RECORDING: AtomicBool = AtomicBool::new(false);
static ACTIVE: Mutex<Option<Active>> = Mutex::new(None);
static PENDING: Mutex<Option<SelectionRect>> = Mutex::new(None);

#[derive(Serialize, Clone)]
pub struct RecordingStatus {
    pub recording: bool,
    pub pending: bool,
    pub started_ms: u64,
    pub width: f64,
    pub height: f64,
    pub options: RecordingOptions,
}

#[derive(Serialize, Clone)]
struct Finished {
    path: String,
    format: String,
    duration_ms: u64,
}

fn set_state(app: &AppHandle, on: bool) {
    RECORDING.store(on, Ordering::SeqCst);
    let _ = app.emit("recording-state", on);
}

// ------------------------------------------------------------------------------------------------
// public API (called by capture.rs / tray / hotkey)
// ------------------------------------------------------------------------------------------------

/// Called by capture.rs when overlay mode "record" finishes: shows the options bar.
pub fn start_region(app: &AppHandle, rect: SelectionRect) {
    if is_recording() {
        return;
    }
    *PENDING.lock().unwrap() = Some(rect);
    let (x, y) = floating::place(&rect, SETUP_SIZE.0, SETUP_SIZE.1, &[Side::Below, Side::Above, Side::Right, Side::Left]);
    if let Err(e) = floating::open_border(app, BORDER, "recorder", "rec", &rect) {
        log::warn!("recording border: {e}");
    }
    if let Err(e) = floating::open_panel(app, BAR, "recorder.html?mode=setup", (x, y), SETUP_SIZE, true) {
        log::error!("recorder window: {e}");
        *PENDING.lock().unwrap() = None;
        floating::close(app, BORDER);
    }
}

/// Stop an active recording if any (or dismiss the pending options bar).
/// Returns true if something was stopped (used by hotkey/tray toggle).
pub fn stop_if_recording(app: &AppHandle) -> bool {
    if is_recording() {
        stop(app, false);
        true
    } else if PENDING.lock().unwrap().take().is_some() {
        floating::close(app, BAR);
        floating::close(app, BORDER);
        true
    } else {
        false
    }
}

pub fn is_recording() -> bool {
    RECORDING.load(Ordering::SeqCst)
}

// ------------------------------------------------------------------------------------------------
// commands
// ------------------------------------------------------------------------------------------------

#[tauri::command]
pub fn recording_status(app: AppHandle) -> RecordingStatus {
    let guard = ACTIVE.lock().unwrap();
    if let Some(a) = guard.as_ref() {
        return RecordingStatus { recording: true, pending: false, started_ms: a.started_ms, width: a.rect.width, height: a.rect.height, options: a.opts.clone() };
    }
    let pending = PENDING.lock().unwrap();
    let (w, h) = pending.as_ref().map(|r| (r.width, r.height)).unwrap_or((0.0, 0.0));
    RecordingStatus { recording: false, pending: pending.is_some(), started_ms: 0, width: w, height: h, options: load_options(&app) }
}

#[tauri::command]
pub fn recording_begin(app: AppHandle, options: RecordingOptions) -> Result<u64, String> {
    if is_recording() {
        return Err("already recording".into());
    }
    let rect = PENDING.lock().unwrap().take().ok_or("no region selected")?;
    let opts = options.sanitized();
    if let Ok(s) = serde_json::to_string_pretty(&opts) {
        let _ = std::fs::write(options_file(&app), s);
    }

    let stop = Arc::new(AtomicBool::new(false));
    let cancel = Arc::new(AtomicBool::new(false));
    let started_ms = floating::now_ms();

    *ACTIVE.lock().unwrap() = Some(Active { pid: None, stop: stop.clone(), cancel: cancel.clone(), started_ms, opts: opts.clone(), rect });
    set_state(&app, true);
    if opts.format == "gif" {
        spawn_gif(&app, rect, opts.clone(), stop, cancel);
    } else {
        match spawn_video(&app, rect, opts.clone(), cancel) {
            Ok(pid) => {
                if let Some(a) = ACTIVE.lock().unwrap().as_mut() {
                    a.pid = Some(pid);
                }
            }
            Err(e) => {
                ACTIVE.lock().unwrap().take();
                set_state(&app, false);
                floating::close(&app, BAR);
                floating::close(&app, BORDER);
                floating::alert(&app, "เริ่มบันทึกหน้าจอไม่สำเร็จ", "Could not start recording", &e);
                let _ = app.emit("recording-error", e.clone());
                return Err(e);
            }
        }
    }

    // Shrink the options bar into the compact control bar.
    if let Some(w) = app.get_webview_window(BAR) {
        let (x, y) = floating::place(&rect, REC_SIZE.0, REC_SIZE.1, &[Side::Below, Side::Above, Side::Right, Side::Left]);
        let _ = w.set_size(tauri::LogicalSize::new(REC_SIZE.0, REC_SIZE.1));
        let _ = w.set_position(tauri::LogicalPosition::new(x, y));
    }
    Ok(started_ms)
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
        *PENDING.lock().unwrap() = None;
        floating::close(&app, BAR);
        floating::close(&app, BORDER);
    }
}

fn stop(app: &AppHandle, cancel: bool) {
    let active = ACTIVE.lock().unwrap().take();
    let Some(a) = active else { return };
    if cancel {
        a.cancel.store(true, Ordering::SeqCst);
    }
    // Stopping: video -> SIGINT lets screencapture finalise the movie; GIF -> flag.
    if let Some(pid) = a.pid {
        unsafe {
            libc::kill(pid as i32, libc::SIGINT);
        }
    }
    a.stop.store(true, Ordering::SeqCst);
    floating::close(app, BAR);
    floating::close(app, BORDER);
    set_state(app, false);
}

// ------------------------------------------------------------------------------------------------
// video via screencapture
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
        let mut pid_now = pid;
        // Microphone not available -> retry without it.
        if opts.mic && !cancel.load(Ordering::SeqCst) && started.elapsed() < Duration::from_secs(3) && !tmp.exists() && status.as_ref().map(|s| !s.success()).unwrap_or(true) {
            log::warn!("screencapture failed with mic ({stderr}); retrying without audio");
            let _ = app2.emit("recording-warning", "mic-unavailable");
            if let Ok(mut c2) = build_video_cmd(&rect, &opts, false, &tmp).spawn() {
                pid_now = c2.id();
                if let Some(a) = ACTIVE.lock().unwrap().as_mut() {
                    a.pid = Some(pid_now);
                }
                status = c2.wait();
                stderr = read_stderr(&mut c2);
            }
        }
        let _ = pid_now;
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

fn finish_video(app: &AppHandle, opts: &RecordingOptions, tmp: &std::path::Path, ok: bool, stderr: &str, cancelled: bool, started: Instant) {
    // If screencapture died on its own (not through stop()), make sure the UI resets.
    if ACTIVE.lock().unwrap().take().is_some() {
        floating::close(app, BAR);
        floating::close(app, BORDER);
        set_state(app, false);
    }
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
    let mut dest = floating::unique_path(app, "Recording", &format);
    if format == "mp4" {
        let st = std::process::Command::new("/usr/bin/avconvert")
            .args(["--source"])
            .arg(tmp)
            .args(["--preset", "PresetPassthrough", "--output"])
            .arg(&dest)
            .arg("--replace")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
        let good = st.map(|s| s.success()).unwrap_or(false) && std::fs::metadata(&dest).map(|m| m.len() > 0).unwrap_or(false);
        if good {
            let _ = std::fs::remove_file(tmp);
        } else {
            // Fall back to the original QuickTime movie.
            log::warn!("avconvert failed; keeping .mov");
            let _ = std::fs::remove_file(&dest);
            format = "mov".into();
            dest = floating::unique_path(app, "Recording", "mov");
            move_file(tmp, &dest);
        }
    } else {
        move_file(tmp, &dest);
    }
    publish(app, &dest, &format, duration_ms);
}

fn move_file(from: &std::path::Path, to: &std::path::Path) {
    if std::fs::rename(from, to).is_err() && std::fs::copy(from, to).is_ok() {
        let _ = std::fs::remove_file(from);
    }
}

fn publish(app: &AppHandle, dest: &std::path::Path, format: &str, duration_ms: u64) {
    let path = dest.to_string_lossy().into_owned();
    let _ = app.emit("recording-finished", Finished { path: path.clone(), format: format.to_string(), duration_ms });
    // Reveal the file in Finder.
    let _ = std::process::Command::new("/usr/bin/open").arg("-R").arg(&path).spawn();
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
    std::thread::spawn(move || {
        let started = Instant::now();
        let result = encode_gif(&rx, &tmp, opts.fps);
        // Make sure the UI is reset if the capture ended by itself (max duration).
        if ACTIVE.lock().unwrap().take().is_some() {
            floating::close(&app2, BAR);
            floating::close(&app2, BORDER);
            set_state(&app2, false);
        }
        let cancelled = cancel.load(Ordering::SeqCst);
        match result {
            _ if cancelled => {
                let _ = std::fs::remove_file(&tmp);
            }
            Ok(duration_ms) => {
                let dest = floating::unique_path(&app2, "Recording", "gif");
                move_file(&tmp, &dest);
                publish(&app2, &dest, "gif", duration_ms.max(started.elapsed().as_millis() as u64 / 2));
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
