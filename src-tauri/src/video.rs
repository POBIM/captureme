//! Video window backend (trim / export MP4 / export GIF / clipboard / trash) and the list of
//! recent recordings. Owner: Agent H. All media work is done with AVFoundation through objc2.
use crate::recording::store::{self, Recording};
use crate::types::{AppError, CmdResult};
use block2::RcBlock;
use objc2::rc::Retained;
use objc2_av_foundation::{
    AVAsset, AVAssetExportSession, AVAssetExportSessionStatus, AVAssetImageGenerator, AVAssetImageGeneratorResult, AVMutableComposition, AVURLAsset,
    NSValueAVFoundationExtensions,
};
use objc2_core_foundation::{CFRetained, CGPoint, CGRect, CGSize};
use objc2_core_graphics::CGImage;
use objc2_core_media::{CMTime, CMTimeRange};
use objc2_foundation::{NSArray, NSError, NSString, NSURL, NSValue};
use serde::Serialize;
use std::ffi::c_void;
use std::path::{Path, PathBuf};
use std::ptr::NonNull;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub const WINDOW: &str = "video";

// ------------------------------------------------------------------------------------------------
// window
// ------------------------------------------------------------------------------------------------

/// Open (or focus) the video window, optionally loading `path` into it.
pub fn open_window(app: &AppHandle, path: Option<&str>) -> tauri::Result<()> {
    if let Some(p) = path {
        crate::windows::allow_asset(app, p);
    }
    if let Some(w) = app.get_webview_window(WINDOW) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        if let Some(p) = path {
            let _ = app.emit_to(WINDOW, "video-open", p);
        }
        return Ok(());
    }
    let q = path.map(|p| format!("path={}", crate::windows::url_encode(p))).unwrap_or_default();
    crate::windows::open_page(app, WINDOW, "video", &q, "CaptureME Video", 1080.0, 740.0)?;
    Ok(())
}

#[tauri::command]
pub fn video_open(app: AppHandle, path: Option<String>) -> CmdResult<()> {
    open_window(&app, path.as_deref()).map_err(|e| AppError::Msg(e.to_string()))
}

/// Open the video window on the "Recordings" tab.
pub fn open_recordings(app: &AppHandle) {
    if open_window(app, None).is_ok() {
        let _ = app.emit_to(WINDOW, "video-tab", "recordings");
    }
}

// ------------------------------------------------------------------------------------------------
// AVFoundation helpers
// ------------------------------------------------------------------------------------------------

fn url_for(path: &Path) -> Retained<NSURL> {
    NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()))
}

fn asset_for(path: &Path) -> Retained<AVURLAsset> {
    unsafe { AVURLAsset::URLAssetWithURL_options(&url_for(path), None) }
}

fn secs(t: CMTime) -> f64 {
    if t.flags.0 & 1 == 0 {
        return 0.0;
    }
    unsafe { t.seconds() }
}

fn cm(s: f64) -> CMTime {
    unsafe { CMTime::with_seconds(s.max(0.0), 60_000) }
}

#[derive(Serialize, Clone, Default)]
pub struct VideoInfo {
    pub path: String,
    pub format: String,
    pub duration_ms: u64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub has_audio: bool,
    pub audio_tracks: u32,
    pub size_bytes: u64,
}

#[allow(deprecated)] // sync track loading is fine here: local files, worker thread
fn probe(app: Option<&AppHandle>, path: &Path) -> VideoInfo {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    let mut info = VideoInfo {
        path: path.to_string_lossy().into_owned(),
        format: ext.clone(),
        size_bytes: std::fs::metadata(path).map(|m| m.len()).unwrap_or(0),
        ..Default::default()
    };
    if ext == "gif" {
        if let Ok(r) = image::ImageReader::open(path).and_then(|r| r.with_guessed_format()) {
            if let Ok((w, h)) = r.into_dimensions() {
                info.width = w;
                info.height = h;
            }
        }
        if let Some(r) = app.and_then(|a| store::find_by_path(a, &info.path)) {
            info.duration_ms = r.duration_ms;
        }
        return info;
    }
    unsafe {
        let asset = asset_for(path);
        info.duration_ms = (secs(asset.duration()) * 1000.0).round() as u64;
        if let Some(mt) = objc2_av_foundation::AVMediaTypeVideo {
            if let Some(t) = asset.tracksWithMediaType(mt).firstObject() {
                let s = t.naturalSize();
                info.width = s.width.round().max(0.0) as u32;
                info.height = s.height.round().max(0.0) as u32;
                info.fps = t.nominalFrameRate() as f64;
            }
        }
        if let Some(mt) = objc2_av_foundation::AVMediaTypeAudio {
            let n = asset.tracksWithMediaType(mt).count();
            info.audio_tracks = n as u32;
            info.has_audio = n > 0;
        }
    }
    info
}

#[tauri::command]
pub async fn video_probe(app: AppHandle, path: String) -> CmdResult<VideoInfo> {
    crate::windows::allow_asset(&app, &path);
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("file not found".into());
    }
    let a = app.clone();
    tauri::async_runtime::spawn_blocking(move || probe(Some(&a), &p)).await.map_err(|e| AppError::Msg(e.to_string()))
}

// ---- frames ------------------------------------------------------------------------------------

struct Frame {
    w: u32,
    h: u32,
    rgba: Vec<u8>,
}

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGBitmapContextCreate(
        data: *mut c_void,
        width: usize,
        height: usize,
        bits_per_component: usize,
        bytes_per_row: usize,
        space: *const c_void,
        bitmap_info: u32,
    ) -> *mut objc2_core_graphics::CGContext;
}

/// Draw a CGImage into an RGBA8 (non-premultiplied-looking, alpha ignored) buffer.
fn cgimage_rgba(img: &CGImage) -> Option<Frame> {
    let (w, h) = (CGImage::width(Some(img)), CGImage::height(Some(img)));
    if w == 0 || h == 0 {
        return None;
    }
    let mut buf = vec![0u8; w * h * 4];
    unsafe {
        let space = objc2_core_graphics::CGColorSpace::new_device_rgb()?;
        // kCGImageAlphaNoneSkipLast (5) | kCGBitmapByteOrder32Big (4 << 12)
        let ctx_ptr = CGBitmapContextCreate(buf.as_mut_ptr() as *mut c_void, w, h, 8, w * 4, &*space as *const _ as *const c_void, 5 | (4 << 12));
        let ctx: CFRetained<objc2_core_graphics::CGContext> = CFRetained::from_raw(NonNull::new(ctx_ptr)?);
        objc2_core_graphics::CGContext::draw_image(
            Some(&ctx),
            CGRect { origin: CGPoint { x: 0.0, y: 0.0 }, size: CGSize { width: w as f64, height: h as f64 } },
            Some(img),
        );
    }
    for px in buf.chunks_exact_mut(4) {
        px[3] = 255;
    }
    Some(Frame { w: w as u32, h: h as u32, rgba: buf })
}

/// Decode frames at `times` (seconds) with AVAssetImageGenerator and hand them to `sink` in
/// request order. Blocks until every frame was delivered (or failed).
fn with_frames(path: &Path, times: &[f64], max_w: u32, tolerance: f64, mut sink: impl FnMut(usize, Option<Frame>) -> bool) -> Result<(), String> {
    if times.is_empty() {
        return Ok(());
    }
    let n = times.len();
    let (tx, rx) = mpsc::channel::<(usize, Option<Frame>)>();
    let t0 = times[0];
    let tvec: Vec<f64> = times.to_vec();
    unsafe {
        let asset = asset_for(path);
        let gen = AVAssetImageGenerator::assetImageGeneratorWithAsset(&asset);
        gen.setAppliesPreferredTrackTransform(true);
        if max_w > 0 {
            gen.setMaximumSize(CGSize { width: max_w as f64, height: 100_000.0 });
        }
        gen.setRequestedTimeToleranceBefore(cm(tolerance));
        gen.setRequestedTimeToleranceAfter(cm(tolerance));
        let values: Vec<Retained<NSValue>> = times.iter().map(|t| NSValue::valueWithCMTime(cm(*t))).collect();
        let arr = NSArray::from_retained_slice(&values);
        let lookup = move |requested: CMTime| -> usize {
            let r = secs(requested);
            tvec.iter().enumerate().min_by(|a, b| (a.1 - r).abs().partial_cmp(&(b.1 - r).abs()).unwrap()).map(|(i, _)| i).unwrap_or(0)
        };
        let _ = t0;
        let block = RcBlock::new(move |requested: CMTime, image: *mut CGImage, _actual: CMTime, result: objc2_av_foundation::AVAssetImageGeneratorResult, _err: *mut NSError| {
            let idx = lookup(requested);
            let frame = if result == AVAssetImageGeneratorResult::Succeeded && !image.is_null() { cgimage_rgba(&*image) } else { None };
            let _ = tx.send((idx, frame));
        });
        gen.generateCGImagesAsynchronouslyForTimes_completionHandler(&arr, &*block as *const _ as *mut _);
        let mut got = 0usize;
        while got < n {
            match rx.recv_timeout(Duration::from_secs(60)) {
                Ok((i, f)) => {
                    got += 1;
                    if !sink(i, f) {
                        gen.cancelAllCGImageGeneration();
                        break;
                    }
                }
                Err(_) => {
                    gen.cancelAllCGImageGeneration();
                    return Err("timed out while reading video frames".into());
                }
            }
        }
        drop(gen);
    }
    Ok(())
}

fn encode_jpeg(f: &Frame, max_w: u32, quality: u8) -> Option<Vec<u8>> {
    let img = image::RgbaImage::from_raw(f.w, f.h, f.rgba.clone())?;
    let mut dynimg = image::DynamicImage::ImageRgba8(img);
    if max_w > 0 && f.w > max_w {
        dynimg = dynimg.resize(max_w, u32::MAX, image::imageops::FilterType::Triangle);
    }
    let mut out = Vec::new();
    let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality);
    image::DynamicImage::ImageRgb8(dynimg.to_rgb8()).write_with_encoder(enc).ok()?;
    Some(out)
}

/// Poster frame (JPEG) for lists. Returns (width, height, duration_ms).
pub fn poster(path: &Path, out_jpg: &Path, max_w: u32) -> Option<(u32, u32, u64)> {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    if ext == "gif" {
        let img = image::open(path).ok()?;
        let (w, h) = (img.width(), img.height());
        let small = img.resize(max_w, u32::MAX, image::imageops::FilterType::Triangle).to_rgb8();
        small.save_with_format(out_jpg, image::ImageFormat::Jpeg).ok()?;
        return Some((w, h, 0));
    }
    let info = probe(None, path);
    let mid = (info.duration_ms as f64 / 1000.0 * 0.05).min(1.0);
    let mut jpg: Option<Vec<u8>> = None;
    let _ = with_frames(path, &[mid], max_w * 2, 0.5, |_, f| {
        jpg = f.and_then(|f| encode_jpeg(&f, max_w, 80));
        true
    });
    std::fs::write(out_jpg, jpg?).ok()?;
    Some((info.width, info.height, info.duration_ms))
}

/// `count` evenly spaced thumbnails (as data: URLs) for the trim timeline.
#[tauri::command]
pub async fn video_thumbs(path: String, count: u32, width: u32) -> CmdResult<Vec<String>> {
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<String>, String> {
        use base64::Engine;
        let p = PathBuf::from(&path);
        let info = probe(None, &p);
        let dur = info.duration_ms as f64 / 1000.0;
        let count = count.clamp(1, 40) as usize;
        if dur <= 0.0 {
            return Ok(vec![]);
        }
        let times: Vec<f64> = (0..count).map(|i| ((i as f64 + 0.5) / count as f64 * dur).min((dur - 0.05).max(0.0))).collect();
        let mut out: Vec<String> = vec![String::new(); count];
        let w = width.clamp(40, 480);
        with_frames(&p, &times, w * 2, dur / count as f64 / 2.0, |i, f| {
            if let Some(jpg) = f.and_then(|f| encode_jpeg(&f, w, 70)) {
                out[i] = format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(jpg));
            }
            true
        })?;
        Ok(out)
    })
    .await
    .map_err(|e| AppError::Msg(e.to_string()))?
    .map_err(AppError::Msg)
}

// ------------------------------------------------------------------------------------------------
// export
// ------------------------------------------------------------------------------------------------

#[derive(Serialize, Clone)]
struct Progress {
    job: String,
    progress: f64,
}

fn emit_progress(app: &AppHandle, job: &str, p: f64) {
    let _ = app.emit("video-export-progress", Progress { job: job.to_string(), progress: p.clamp(0.0, 1.0) });
}

fn output_path(app: &AppHandle, src: &Path, suffix: &str, ext: &str) -> PathBuf {
    let dir = src.parent().map(|p| p.to_path_buf()).filter(|p| p.is_dir()).unwrap_or_else(|| crate::recording::recordings_dir(app, &Default::default()));
    let stem = src.file_stem().and_then(|s| s.to_str()).unwrap_or("Recording");
    let mut p = dir.join(format!("{stem} {suffix}.{ext}"));
    let mut n = 2;
    while p.exists() {
        p = dir.join(format!("{stem} {suffix} ({n}).{ext}"));
        n += 1;
    }
    p
}

/// Add a freshly exported file to the recordings list.
fn register(app: &AppHandle, path: &Path, format: &str, duration_ms: u64) {
    let id = uuid::Uuid::new_v4().simple().to_string();
    let thumb = store::thumbs_dir(app).join(format!("{id}.jpg"));
    let info = poster(path, &thumb, 360);
    store::add(
        app,
        Recording {
            id,
            path: path.to_string_lossy().into_owned(),
            format: format.to_string(),
            duration_ms: if duration_ms > 0 { duration_ms } else { info.map(|i| i.2).unwrap_or(0) },
            width: info.map(|i| i.0).unwrap_or(0),
            height: info.map(|i| i.1).unwrap_or(0),
            size_bytes: std::fs::metadata(path).map(|m| m.len()).unwrap_or(0),
            created_at: chrono::Local::now().to_rfc3339(),
            thumb: thumb.exists().then(|| thumb.to_string_lossy().into_owned()),
        },
    );
}

#[derive(Serialize)]
pub struct Exported {
    pub path: String,
    pub size_bytes: u64,
}

/// Export `[start_ms, end_ms]` as MP4 (optionally without audio). `precise` re-encodes
/// (frame-accurate cut); otherwise samples are copied (fast, cut at the nearest keyframe edit).
#[tauri::command]
pub async fn video_export_mp4(app: AppHandle, path: String, start_ms: u64, end_ms: u64, mute: bool, precise: bool, job: String) -> CmdResult<Exported> {
    let a = app.clone();
    let res = tauri::async_runtime::spawn_blocking(move || export_mp4(&a, Path::new(&path), start_ms, end_ms, mute, precise, &job))
        .await
        .map_err(|e| AppError::Msg(e.to_string()))?;
    res.map_err(AppError::Msg)
}

fn export_mp4(app: &AppHandle, src: &Path, start_ms: u64, end_ms: u64, mute: bool, precise: bool, job: &str) -> Result<Exported, String> {
    let out = output_path(app, src, "edited", "mp4");
    let dur = export_mp4_core(src, &out, start_ms, end_ms, mute, precise, &|p| emit_progress(app, job, p))?;
    emit_progress(app, job, 1.0);
    register(app, &out, "mp4", dur);
    Ok(Exported { path: out.to_string_lossy().into_owned(), size_bytes: std::fs::metadata(&out).map(|m| m.len()).unwrap_or(0) })
}

/// Returns the exported duration in ms.
#[allow(deprecated)]
fn export_mp4_core(src: &Path, out: &Path, start_ms: u64, end_ms: u64, mute: bool, precise: bool, progress: &dyn Fn(f64)) -> Result<u64, String> {
    let _ = std::fs::remove_file(out);
    unsafe {
        let asset = asset_for(src);
        let total = secs(asset.duration());
        let start = (start_ms as f64 / 1000.0).clamp(0.0, total);
        let end = (end_ms as f64 / 1000.0).clamp(start, total);
        if end - start < 0.05 {
            return Err("the selected range is empty".into());
        }
        let comp = AVMutableComposition::composition();
        let range = CMTimeRange { start: cm(start), duration: cm(end - start) };
        let mut kinds = vec![objc2_av_foundation::AVMediaTypeVideo];
        if !mute {
            kinds.push(objc2_av_foundation::AVMediaTypeAudio);
        }
        let mut video_tracks = 0;
        for kind in kinds.into_iter().flatten() {
            for track in asset.tracksWithMediaType(kind).iter() {
                let Some(ct) = comp.addMutableTrackWithMediaType_preferredTrackID(kind, 0) else { continue };
                ct.insertTimeRange_ofTrack_atTime_error(range, &track, cm(0.0)).map_err(|e| e.localizedDescription().to_string())?;
                if kind == objc2_av_foundation::AVMediaTypeVideo.unwrap() {
                    video_tracks += 1;
                    ct.setPreferredTransform(track.preferredTransform());
                }
            }
        }
        if video_tracks == 0 {
            return Err("no video track found".into());
        }
        let preset = if precise { objc2_av_foundation::AVAssetExportPresetHighestQuality } else { objc2_av_foundation::AVAssetExportPresetPassthrough };
        let session = AVAssetExportSession::exportSessionWithAsset_presetName(&comp, preset).ok_or("export is not available for this video")?;
        session.setOutputURL(Some(&url_for(out)));
        session.setOutputFileType(objc2_av_foundation::AVFileTypeMPEG4);
        session.setShouldOptimizeForNetworkUse(true);
        let (tx, rx) = mpsc::channel::<()>();
        let block = RcBlock::new(move || {
            let _ = tx.send(());
        });
        session.exportAsynchronouslyWithCompletionHandler(&block);
        loop {
            match rx.recv_timeout(Duration::from_millis(200)) {
                Ok(_) => break,
                Err(mpsc::RecvTimeoutError::Timeout) => progress(session.progress() as f64),
                Err(_) => break,
            }
        }
        if session.status() != AVAssetExportSessionStatus::Completed {
            let _ = std::fs::remove_file(out);
            return Err(session.error().map(|e| e.localizedDescription().to_string()).unwrap_or_else(|| "export failed".into()));
        }
        Ok(((end - start) * 1000.0) as u64)
    }
}

/// Export `[start_ms, end_ms]` as an animated GIF (`fps` 5–30, `width` px, 0 = original).
#[tauri::command]
pub async fn video_export_gif(app: AppHandle, path: String, start_ms: u64, end_ms: u64, fps: u32, width: u32, job: String) -> CmdResult<Exported> {
    let a = app.clone();
    let res = tauri::async_runtime::spawn_blocking(move || export_gif(&a, Path::new(&path), start_ms, end_ms, fps, width, &job))
        .await
        .map_err(|e| AppError::Msg(e.to_string()))?;
    res.map_err(AppError::Msg)
}

fn export_gif(app: &AppHandle, src: &Path, start_ms: u64, end_ms: u64, fps: u32, width: u32, job: &str) -> Result<Exported, String> {
    let out = output_path(app, src, "clip", "gif");
    let dur = export_gif_core(src, &out, start_ms, end_ms, fps, width, &|p| emit_progress(app, job, p))?;
    emit_progress(app, job, 1.0);
    register(app, &out, "gif", dur);
    Ok(Exported { path: out.to_string_lossy().into_owned(), size_bytes: std::fs::metadata(&out).map(|m| m.len()).unwrap_or(0) })
}

/// Returns the exported duration in ms.
fn export_gif_core(src: &Path, out: &Path, start_ms: u64, end_ms: u64, fps: u32, width: u32, progress: &dyn Fn(f64)) -> Result<u64, String> {
    let info = probe(None, src);
    let total = info.duration_ms as f64 / 1000.0;
    let start = (start_ms as f64 / 1000.0).clamp(0.0, total);
    let end = (end_ms as f64 / 1000.0).clamp(start, total);
    let fps = fps.clamp(5, 30) as f64;
    if end - start < 0.1 {
        return Err("the selected range is empty".into());
    }
    let mut n = ((end - start) * fps).floor() as usize;
    n = n.clamp(1, 1800);
    let step = (end - start) / n as f64;
    let times: Vec<f64> = (0..n).map(|i| (start + i as f64 * step).min((total - 0.02).max(0.0))).collect();
    let delay_cs = ((step * 100.0).round() as u64).max(2) as u16;

    let file = std::fs::File::create(out).map_err(|e| e.to_string())?;
    let mut enc: Option<gif::Encoder<std::fs::File>> = None;
    let mut file_slot = Some(file);
    let mut pending: Option<(Frame, u16)> = None;
    let mut err: Option<String> = None;
    let mut next = 0usize;
    let mut buffered: std::collections::BTreeMap<usize, Option<Frame>> = Default::default();
    let mut written_frames = 0usize;

    let mut flush = |f: Frame, delay: u16, enc: &mut Option<gif::Encoder<std::fs::File>>| -> Result<(), String> {
        if enc.is_none() {
            let file = file_slot.take().ok_or("file already used")?;
            let mut e = gif::Encoder::new(file, f.w as u16, f.h as u16, &[]).map_err(|e| e.to_string())?;
            e.set_repeat(gif::Repeat::Infinite).map_err(|e| e.to_string())?;
            *enc = Some(e);
        }
        let mut rgba = f.rgba;
        let mut frame = gif::Frame::from_rgba_speed(f.w as u16, f.h as u16, &mut rgba, 10);
        frame.delay = delay;
        enc.as_mut().unwrap().write_frame(&frame).map_err(|e| e.to_string())
    };

    let tol = step / 2.0;
    let res = with_frames(src, &times, width.min(3840), tol, |i, f| {
        buffered.insert(i, f);
        // consume in order
        while let Some(fr) = buffered.remove(&next) {
            next += 1;
            progress(next as f64 / n as f64 * 0.98);
            let Some(mut fr) = fr else { continue };
            // scale to the requested width (the generator limit is only an upper bound)
            if width > 0 && fr.w > width {
                if let Some(img) = image::RgbaImage::from_raw(fr.w, fr.h, std::mem::take(&mut fr.rgba)) {
                    let nh = ((fr.h as f64) * (width as f64) / (fr.w as f64)).round().max(2.0) as u32;
                    let r = image::imageops::resize(&img, width, nh, image::imageops::FilterType::Triangle);
                    fr = Frame { w: width, h: nh, rgba: r.into_raw() };
                }
            }
            match pending.take() {
                None => pending = Some((fr, delay_cs)),
                Some((p, d)) => {
                    if p.w == fr.w && p.h == fr.h && p.rgba == fr.rgba {
                        pending = Some((p, d.saturating_add(delay_cs)));
                    } else {
                        if let Err(e) = flush(p, d, &mut enc) {
                            err = Some(e);
                            return false;
                        }
                        written_frames += 1;
                        pending = Some((fr, delay_cs));
                    }
                }
            }
        }
        true
    });
    if let Some((p, d)) = pending.take() {
        if err.is_none() {
            if let Err(e) = flush(p, d, &mut enc) {
                err = Some(e);
            } else {
                written_frames += 1;
            }
        }
    }
    drop(enc);
    if let Err(e) = res {
        let _ = std::fs::remove_file(out);
        return Err(e);
    }
    if let Some(e) = err {
        let _ = std::fs::remove_file(out);
        return Err(e);
    }
    if written_frames == 0 {
        let _ = std::fs::remove_file(out);
        return Err("no frames could be read from the video".into());
    }
    Ok(((end - start) * 1000.0) as u64)
}

// ------------------------------------------------------------------------------------------------
// clipboard / trash / list
// ------------------------------------------------------------------------------------------------

/// Put the file itself on the clipboard (paste into Finder, Messages, Slack…).
#[tauri::command]
pub fn video_copy_file(app: AppHandle, path: String) -> CmdResult<()> {
    if !Path::new(&path).exists() {
        return Err("file not found".into());
    }
    let (tx, rx) = mpsc::channel();
    let p = path.clone();
    app.run_on_main_thread(move || {
        let r = copy_file_url(&p);
        let _ = tx.send(r);
    })
    .map_err(|e| AppError::Msg(e.to_string()))?;
    rx.recv_timeout(Duration::from_secs(5)).map_err(|_| AppError::Msg("clipboard timed out".into()))?.map_err(AppError::Msg)
}

fn copy_file_url(path: &str) -> Result<(), String> {
    use objc2::runtime::ProtocolObject;
    use objc2_app_kit::{NSPasteboard, NSPasteboardWriting};
    let pb = NSPasteboard::generalPasteboard();
    pb.clearContents();
    let url = url_for(Path::new(path));
    let item: Retained<ProtocolObject<dyn NSPasteboardWriting>> = ProtocolObject::from_retained(url);
    let arr = NSArray::from_retained_slice(&[item]);
    if pb.writeObjects(&arr) {
        Ok(())
    } else {
        Err("the pasteboard refused the file".into())
    }
}

/// Move a file to the Trash (falls back to deleting it) and forget it.
#[tauri::command]
pub fn video_trash(app: AppHandle, path: String) -> CmdResult<()> {
    let p = PathBuf::from(&path);
    if p.exists() {
        let fm = objc2_foundation::NSFileManager::defaultManager();
        let trashed = fm.trashItemAtURL_resultingItemURL_error(&url_for(&p), None).is_ok();
        if !trashed {
            std::fs::remove_file(&p)?;
        }
    }
    store::remove_by_path(&app, &path);
    Ok(())
}

#[tauri::command]
pub fn recordings_list(app: AppHandle) -> Vec<Recording> {
    store::list(&app)
}

/// Forget a recording; with `delete_file` the file goes to the Trash as well.
#[tauri::command]
pub fn recordings_remove(app: AppHandle, id: String, delete_file: bool) -> CmdResult<()> {
    if let Some(r) = store::remove(&app, &id) {
        if delete_file {
            video_trash(app, r.path)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn recordings_open_folder(app: AppHandle) {
    let opts: crate::recording::RecordingOptions = std::fs::read_to_string(crate::paths::config_file(&app).with_file_name("recording.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    let dir = crate::recording::recordings_dir(&app, &opts);
    let _ = std::process::Command::new("/usr/bin/open").arg(dir).spawn();
}

#[allow(dead_code)]
fn _keep(_: &AVAsset) {}

#[cfg(test)]
mod tests {
    use super::*;

    /// Run `sck_smoke` first: `cargo test --lib video_smoke -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn video_smoke() {
        let p = std::env::temp_dir().join("captureme-sck-smoke.mp4");
        let info = probe(None, &p);
        eprintln!("probe: dur={}ms {}x{} fps={} audio={} ({} tracks)", info.duration_ms, info.width, info.height, info.fps, info.has_audio, info.audio_tracks);
        assert!(info.duration_ms > 2000 && info.width == 1280);
        let thumb = std::env::temp_dir().join("captureme-smoke-thumb.jpg");
        let r = poster(&p, &thumb, 360);
        eprintln!("poster: {r:?} {}", thumb.display());
        assert!(thumb.exists());
        let mut n = 0;
        with_frames(&p, &[0.2, 1.0, 2.0], 320, 0.2, |_, f| {
            n += f.is_some() as u32;
            true
        })
        .unwrap();
        assert_eq!(n, 3);

        let mp4 = std::env::temp_dir().join("captureme-smoke-trim.mp4");
        for (mute, precise) in [(false, false), (true, true)] {
            let d = export_mp4_core(&p, &mp4, 500, 2500, mute, precise, &|_| {}).expect("mp4 export");
            let i = probe(None, &mp4);
            eprintln!("mp4 export mute={mute} precise={precise}: {d}ms -> dur={}ms audio={} size={}", i.duration_ms, i.has_audio, i.size_bytes);
            assert!((i.duration_ms as i64 - 2000).abs() < 400, "duration {}", i.duration_ms);
            assert_eq!(i.has_audio, !mute && info.has_audio);
        }
        let gif = std::env::temp_dir().join("captureme-smoke-clip.gif");
        let d = export_gif_core(&p, &gif, 0, 2000, 10, 320, &|_| {}).expect("gif export");
        let r = image::ImageReader::open(&gif).unwrap().with_guessed_format().unwrap().into_dimensions().unwrap();
        eprintln!("gif export: {d}ms {r:?} {} bytes", std::fs::metadata(&gif).unwrap().len());
        assert_eq!(r.0, 320);
    }
}
