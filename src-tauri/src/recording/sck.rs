//! ScreenCaptureKit + AVAssetWriter recording engine (H.264 / HEVC, system audio, microphone).
//!
//! * `SCStream` delivers video / system-audio / microphone sample buffers on a serial queue.
//! * Samples are re-timed with [`Retimer`] (pause = drop + shift) and appended to an
//!   `AVAssetWriter` (MP4 or QuickTime).
//! * Everything that touches Objective-C objects is wrapped in `Send`-able holders; the writer
//!   state is protected by a mutex that the sample queue and the control threads share.
use super::retime::Retimer;
use block2::RcBlock;
use dispatch2::{DispatchQueue, DispatchRetained};
use objc2::rc::Retained;
use objc2::runtime::{AnyObject, ProtocolObject};
use objc2::{define_class, msg_send, AnyThread, DefinedClass, Message};
use objc2_av_foundation::{AVAssetWriter, AVAssetWriterInput, AVAssetWriterStatus, AVCaptureAudioDataOutputSampleBufferDelegate};
use objc2_core_foundation::{CGPoint, CGRect, CGSize};
use objc2_core_media::{CMClock, CMSampleBuffer, CMSampleTimingInfo, CMTime};
use objc2_foundation::{NSArray, NSDictionary, NSError, NSNumber, NSObject, NSObjectProtocol, NSString, NSURL};
use objc2_screen_capture_kit::{
    SCContentFilter, SCDisplay, SCShareableContent, SCStream, SCStreamConfiguration, SCStreamDelegate, SCStreamOutput, SCStreamOutputType, SCWindow,
};
use std::path::PathBuf;
use std::ptr::NonNull;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// What to record.
#[derive(Debug, Clone)]
pub enum Target {
    /// A whole display (`id` = CGDirectDisplayID = xcap monitor id).
    Display { id: u32, scale: f64 },
    /// A rectangle of a display, in points relative to the display's top-left corner.
    Region { id: u32, x: f64, y: f64, w: f64, h: f64, scale: f64 },
    /// One window (follows it while it moves).
    Window { id: u32, scale: f64 },
}

#[derive(Debug, Clone)]
pub struct Config {
    pub target: Target,
    pub fps: u32,
    /// Bits per pixel per frame for the video encoder.
    pub bits_per_pixel: f64,
    pub hevc: bool,
    pub mov: bool,
    pub cursor: bool,
    pub system_audio: bool,
    pub mic: bool,
    pub out: PathBuf,
    /// CGWindowIDs / NSWindow numbers of CaptureME windows that must stay *in* the recording
    /// (webcam bubble, click / key overlay). All other CaptureME windows are excluded.
    pub keep_windows: Vec<u32>,
}

#[derive(Debug, Clone)]
pub struct Finished {
    pub duration_s: f64,
    pub width: u32,
    pub height: u32,
    #[allow(dead_code)]
    pub frames: u64,
}

// ------------------------------------------------------------------------------------------------
// Send wrapper for Objective-C objects we only touch under our own locking.
// ------------------------------------------------------------------------------------------------

struct Sendable<T>(T);
unsafe impl<T> Send for Sendable<T> {}
unsafe impl<T> Sync for Sendable<T> {}

struct Inputs {
    writer: Retained<AVAssetWriter>,
    video: Retained<AVAssetWriterInput>,
    sys: Option<Retained<AVAssetWriterInput>>,
    mic: Option<Retained<AVAssetWriterInput>>,
}

struct State {
    retimer: Retimer,
    /// Source time of the first accepted video frame (output timeline).
    started_at: Option<f64>,
    /// Latest output time we have seen (end of the last accepted sample).
    last_out: f64,
    frames: u64,
    dropped: u64,
    error: Option<String>,
    finished: bool,
    stopped_by_system: Option<String>,
}

struct Shared {
    inputs: Sendable<Inputs>,
    state: Mutex<State>,
    host_clock: Sendable<objc2_core_foundation::CFRetained<CMClock>>,
    on_stopped: Box<dyn Fn(String) + Send + Sync>,
}

fn host_now(sh: &Shared) -> f64 {
    unsafe { sh.host_clock.0.time().seconds() }
}

fn cm_seconds(s: f64) -> CMTime {
    unsafe { CMTime::with_seconds(s, 1_000_000_000) }
}

impl Shared {
    fn on_sample(&self, sb: &CMSampleBuffer, ty: SCStreamOutputType) {
        unsafe {
            if !sb.is_valid() || !sb.data_is_ready() {
                return;
            }
            let pts_t = sb.presentation_time_stamp();
            if pts_t.flags.0 & 1 == 0 {
                return; // invalid time
            }
            let pts = pts_t.seconds();
            let mut st = self.state.lock().unwrap_or_else(|e| e.into_inner());
            if st.finished || st.error.is_some() {
                return;
            }
            let is_video = ty == SCStreamOutputType::Screen;
            if is_video {
                if sb.image_buffer().is_none() || !frame_is_complete(sb) {
                    return; // idle / blank frame
                }
            }
            let Some(out) = st.retimer.map(pts) else { return };
            let inp = &self.inputs.0;
            let target = match ty {
                SCStreamOutputType::Screen => &inp.video,
                SCStreamOutputType::Audio => match &inp.sys {
                    Some(i) => i,
                    None => return,
                },
                _ => match &inp.mic {
                    Some(i) => i,
                    None => return,
                },
            };
            match st.started_at {
                None => {
                    if !is_video {
                        return; // audio before the first frame is dropped
                    }
                    if !inp.writer.startWriting() {
                        st.error = Some(describe_writer_error(&inp.writer));
                        return;
                    }
                    inp.writer.startSessionAtSourceTime(cm_seconds(out));
                    st.started_at = Some(out);
                }
                Some(t0) => {
                    if out < t0 {
                        return;
                    }
                }
            }
            if inp.writer.status() != AVAssetWriterStatus::Writing {
                st.error = Some(describe_writer_error(&inp.writer));
                return;
            }
            if !target.isReadyForMoreMediaData() {
                st.dropped += 1;
                return;
            }
            let delta = pts - out;
            match retime_buffer(sb, delta) {
                Some(copy) => {
                    if !target.appendSampleBuffer(&copy) {
                        st.error = Some(describe_writer_error(&inp.writer));
                        return;
                    }
                }
                None => {
                    // Could not copy timing: append the original when nothing was shifted.
                    if delta.abs() < 1e-9 {
                        let _ = target.appendSampleBuffer(sb);
                    } else {
                        st.dropped += 1;
                        return;
                    }
                }
            }
            let dur = sb.duration();
            let dur_s = if dur.flags.0 & 1 != 0 { dur.seconds().max(0.0) } else { 0.0 };
            if out + dur_s > st.last_out {
                st.last_out = out + dur_s;
            }
            if is_video {
                st.frames += 1;
            }
        }
    }
}

fn describe_writer_error(w: &AVAssetWriter) -> String {
    unsafe {
        match w.error() {
            Some(e) => e.localizedDescription().to_string(),
            None => format!("asset writer status {}", w.status().0),
        }
    }
}

/// `SCStreamFrameInfoStatus` of the frame: only `Complete (0)` / `Started (4)` carry new pixels.
unsafe fn frame_is_complete(sb: &CMSampleBuffer) -> bool {
    let Some(arr) = sb.sample_attachments_array(false) else { return true };
    let arr: &NSArray<NSDictionary<NSString, AnyObject>> = &*(&*arr as *const _ as *const NSArray<NSDictionary<NSString, AnyObject>>);
    let Some(dict) = arr.firstObject() else { return true };
    let key = NSString::from_str("SCStreamUpdateFrameStatus");
    let key2 = NSString::from_str("SCStreamFrameInfoStatus");
    for k in [&key2, &key] {
        if let Some(v) = dict.objectForKey(k) {
            if let Some(n) = v.downcast_ref::<NSNumber>() {
                let s = n.integerValue();
                return s == 0 || s == 4;
            }
        }
    }
    true
}

/// Copy `sb` with every timestamp shifted back by `delta` seconds.
unsafe fn retime_buffer(sb: &CMSampleBuffer, delta: f64) -> Option<objc2_core_foundation::CFRetained<CMSampleBuffer>> {
    let mut needed: isize = 0;
    let st = sb.sample_timing_info_array(0, std::ptr::null_mut(), &mut needed);
    let n = if st == 0 && needed > 0 { needed } else { 1 };
    let blank = CMTime { value: 0, timescale: 0, flags: objc2_core_media::CMTimeFlags(0), epoch: 0 };
    let mut infos = vec![CMSampleTimingInfo { duration: blank, presentationTimeStamp: blank, decodeTimeStamp: blank }; n as usize];
    let mut got: isize = 0;
    if sb.sample_timing_info_array(n, infos.as_mut_ptr(), &mut got) != 0 {
        return None;
    }
    let shift = cm_seconds(delta);
    for i in infos.iter_mut() {
        if i.presentationTimeStamp.flags.0 & 1 != 0 {
            i.presentationTimeStamp = i.presentationTimeStamp.subtract(shift);
        }
        if i.decodeTimeStamp.flags.0 & 1 != 0 {
            i.decodeTimeStamp = i.decodeTimeStamp.subtract(shift);
        }
    }
    let mut out: *mut CMSampleBuffer = std::ptr::null_mut();
    let rc = CMSampleBuffer::create_copy_with_new_timing(None, sb, n, infos.as_ptr(), NonNull::new(&mut out as *mut *mut CMSampleBuffer)?);
    if rc != 0 || out.is_null() {
        return None;
    }
    Some(objc2_core_foundation::CFRetained::from_raw(NonNull::new(out)?))
}

// ------------------------------------------------------------------------------------------------
// Objective-C delegate / output object
// ------------------------------------------------------------------------------------------------

struct HandlerIvars {
    shared: Arc<Shared>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[ivars = HandlerIvars]
    #[name = "CaptureMEStreamHandler"]
    struct StreamHandler;

    unsafe impl NSObjectProtocol for StreamHandler {}

    unsafe impl SCStreamOutput for StreamHandler {
        #[unsafe(method(stream:didOutputSampleBuffer:ofType:))]
        unsafe fn stream_did_output(&self, _stream: &SCStream, sample_buffer: &CMSampleBuffer, ty: SCStreamOutputType) {
            self.ivars().shared.on_sample(sample_buffer, ty);
        }
    }

    unsafe impl SCStreamDelegate for StreamHandler {
        #[unsafe(method(stream:didStopWithError:))]
        unsafe fn stream_did_stop(&self, _stream: &SCStream, error: &NSError) {
            let msg = error.localizedDescription().to_string();
            let sh = &self.ivars().shared;
            {
                let mut st = sh.state.lock().unwrap_or_else(|e| e.into_inner());
                if st.finished {
                    return;
                }
                st.stopped_by_system = Some(msg.clone());
            }
            (sh.on_stopped)(msg);
        }
    }
);

impl StreamHandler {
    fn new(shared: Arc<Shared>) -> Retained<Self> {
        let this = Self::alloc().set_ivars(HandlerIvars { shared });
        unsafe { msg_send![super(this), init] }
    }
}

// ------------------------------------------------------------------------------------------------
// Microphone helpers: availability check + AVCaptureSession fallback for macOS 13 / 14
// ------------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MicState {
    Ok,
    NoDevice,
    Denied,
}

pub fn mic_state() -> MicState {
    use objc2_av_foundation::{AVCaptureDevice, AVMediaTypeAudio};
    unsafe {
        let Some(t) = AVMediaTypeAudio else { return MicState::NoDevice };
        if AVCaptureDevice::defaultDeviceWithMediaType(t).is_none() {
            return MicState::NoDevice;
        }
        let st = AVCaptureDevice::authorizationStatusForMediaType(t).0;
        if st == 1 || st == 2 {
            MicState::Denied
        } else {
            MicState::Ok
        }
    }
}

define_class!(
    #[unsafe(super(NSObject))]
    #[ivars = HandlerIvars]
    #[name = "CaptureMEMicHandler"]
    struct MicHandler;

    unsafe impl NSObjectProtocol for MicHandler {}

    unsafe impl AVCaptureAudioDataOutputSampleBufferDelegate for MicHandler {
        #[unsafe(method(captureOutput:didOutputSampleBuffer:fromConnection:))]
        unsafe fn capture_output(&self, _output: &objc2_av_foundation::AVCaptureOutput, sample_buffer: &CMSampleBuffer, _connection: &objc2_av_foundation::AVCaptureConnection) {
            self.ivars().shared.on_sample(sample_buffer, SCStreamOutputType::Microphone);
        }
    }
);

struct MicSession {
    session: Retained<objc2_av_foundation::AVCaptureSession>,
    _handler: Retained<MicHandler>,
    _output: Retained<objc2_av_foundation::AVCaptureAudioDataOutput>,
    _queue: DispatchRetained<DispatchQueue>,
}

impl MicSession {
    unsafe fn start(shared: Arc<Shared>) -> Result<MicSession, String> {
        use objc2_av_foundation::{AVCaptureAudioDataOutput, AVCaptureDevice, AVCaptureDeviceInput, AVCaptureSession, AVMediaTypeAudio};
        let t = AVMediaTypeAudio.ok_or("no audio media type")?;
        let dev = AVCaptureDevice::defaultDeviceWithMediaType(t).ok_or("no microphone")?;
        let input = AVCaptureDeviceInput::deviceInputWithDevice_error(&dev).map_err(|e| e.localizedDescription().to_string())?;
        let session = AVCaptureSession::new();
        if !session.canAddInput(&input) {
            return Err("cannot use the microphone input".into());
        }
        session.addInput(&input);
        let output = AVCaptureAudioDataOutput::new();
        if !session.canAddOutput(&output) {
            return Err("cannot read microphone samples".into());
        }
        session.addOutput(&output);
        let handler: Retained<MicHandler> = {
            let this = MicHandler::alloc().set_ivars(HandlerIvars { shared });
            msg_send![super(this), init]
        };
        let queue = DispatchQueue::new("com.sitthichat.captureme.mic", DispatchQueue_attr_serial());
        let delegate: &ProtocolObject<dyn objc2_av_foundation::AVCaptureAudioDataOutputSampleBufferDelegate> = ProtocolObject::from_ref(&*handler);
        output.setSampleBufferDelegate_queue(Some(delegate), Some(&queue));
        session.startRunning();
        Ok(MicSession { session, _handler: handler, _output: output, _queue: queue })
    }
}

// ------------------------------------------------------------------------------------------------
// Engine
// ------------------------------------------------------------------------------------------------

pub struct Engine {
    stream: Sendable<Retained<SCStream>>,
    _handler: Sendable<Retained<StreamHandler>>,
    _queue: Sendable<DispatchRetained<DispatchQueue>>,
    shared: Arc<Shared>,
    out: PathBuf,
    size: (u32, u32),
    #[allow(dead_code)]
    pub has_system_audio: bool,
    pub has_mic: bool,
    /// Why the microphone is missing (only when it was requested).
    pub mic_state: Option<MicState>,
    _mic_session: Mutex<Option<Sendable<MicSession>>>,
}

fn even(v: f64) -> usize {
    let n = v.round().max(2.0) as usize;
    n & !1
}

fn ns_num_f(v: f64) -> Retained<AnyObject> {
    let n = NSNumber::numberWithDouble(v);
    unsafe { Retained::cast_unchecked(n) }
}
fn ns_num_i(v: isize) -> Retained<AnyObject> {
    let n = NSNumber::numberWithInteger(v);
    unsafe { Retained::cast_unchecked(n) }
}
fn ns_str_any(s: &str) -> Retained<AnyObject> {
    let n = NSString::from_str(s);
    unsafe { Retained::cast_unchecked(n) }
}
fn dict(pairs: Vec<(Retained<NSString>, Retained<AnyObject>)>) -> Retained<NSDictionary<NSString, AnyObject>> {
    let keys: Vec<&NSString> = pairs.iter().map(|(k, _)| &**k).collect();
    let vals: Vec<Retained<AnyObject>> = pairs.iter().map(|(_, v)| v.clone()).collect();
    NSDictionary::from_retained_objects(&keys, &vals)
}
fn nsstr(s: &str) -> Retained<NSString> {
    NSString::from_str(s)
}

fn os_at_least(major: isize) -> bool {
    use objc2_foundation::{NSOperatingSystemVersion, NSProcessInfo};
    NSProcessInfo::processInfo().isOperatingSystemAtLeastVersion(NSOperatingSystemVersion { majorVersion: major, minorVersion: 0, patchVersion: 0 })
}

/// Wait for an async ObjC completion handler that reports `*mut NSError`.
fn wait_err(rx: mpsc::Receiver<Option<String>>, secs: u64, what: &str) -> Result<(), String> {
    match rx.recv_timeout(Duration::from_secs(secs)) {
        Ok(None) => Ok(()),
        Ok(Some(e)) => Err(e),
        Err(_) => Err(format!("{what} timed out")),
    }
}

fn shareable_content() -> Result<Retained<SCShareableContent>, String> {
    let (tx, rx) = mpsc::channel::<Result<Sendable<Retained<SCShareableContent>>, String>>();
    let block = RcBlock::new(move |content: *mut SCShareableContent, err: *mut NSError| {
        let r = unsafe {
            if !content.is_null() {
                Retained::retain(content).map(Sendable).ok_or_else(|| "no content".to_string())
            } else if !err.is_null() {
                Err((*err).localizedDescription().to_string())
            } else {
                Err("no shareable content".to_string())
            }
        };
        let _ = tx.send(r);
    });
    unsafe { SCShareableContent::getShareableContentWithCompletionHandler(&block) };
    match rx.recv_timeout(Duration::from_secs(8)) {
        Ok(Ok(c)) => Ok(c.0),
        Ok(Err(e)) => Err(e),
        Err(_) => Err("ScreenCaptureKit did not answer (is Screen Recording permission granted?)".into()),
    }
}

impl Engine {
    /// Build the stream and start capturing. `on_stopped` is called if the system stops the stream.
    pub fn start(cfg: Config, on_stopped: Box<dyn Fn(String) + Send + Sync>) -> Result<Engine, String> {
        unsafe {
            let content = shareable_content()?;
            let pid = std::process::id() as i32;

            // ---- content filter + output geometry
            let displays = content.displays();
            let find_display = |id: u32| -> Option<Retained<SCDisplay>> { displays.iter().find(|d| d.displayID() == id) };
            let windows: Vec<Retained<SCWindow>> = content.windows().iter().collect();
            let excluded: Vec<Retained<SCWindow>> = windows
                .iter()
                .filter(|w| w.owningApplication().map(|a| a.processID() == pid).unwrap_or(false) && !cfg.keep_windows.contains(&w.windowID()))
                .cloned()
                .collect();
            let excluded_arr = NSArray::from_retained_slice(&excluded);

            let config = SCStreamConfiguration::new();
            let (filter, px_w, px_h) = match &cfg.target {
                Target::Display { id, scale } => {
                    let d = find_display(*id).or_else(|| displays.firstObject()).ok_or("display not found")?;
                    let f = SCContentFilter::initWithDisplay_excludingWindows(SCContentFilter::alloc(), &d, &excluded_arr);
                    let (w, h) = (d.width() as f64 * scale, d.height() as f64 * scale);
                    (f, even(w), even(h))
                }
                Target::Region { id, x, y, w, h, scale } => {
                    let d = find_display(*id).or_else(|| displays.firstObject()).ok_or("display not found")?;
                    let f = SCContentFilter::initWithDisplay_excludingWindows(SCContentFilter::alloc(), &d, &excluded_arr);
                    config.setSourceRect(CGRect { origin: CGPoint { x: *x, y: *y }, size: CGSize { width: *w, height: *h } });
                    (f, even(w * scale), even(h * scale))
                }
                Target::Window { id, scale } => {
                    let win = windows.iter().find(|w| w.windowID() == *id).ok_or("window not found")?;
                    let f = SCContentFilter::initWithDesktopIndependentWindow(SCContentFilter::alloc(), win);
                    let fr = win.frame();
                    (f, even(fr.size.width * scale), even(fr.size.height * scale))
                }
            };
            config.setWidth(px_w);
            config.setHeight(px_h);
            config.setMinimumFrameInterval(CMTime::new(1, cfg.fps.max(1) as i32));
            config.setShowsCursor(cfg.cursor);
            config.setQueueDepth(6);
            config.setPixelFormat(u32::from_be_bytes(*b"BGRA"));
            config.setScalesToFit(true);
            if cfg.system_audio {
                config.setCapturesAudio(true);
                config.setSampleRate(48_000);
                config.setChannelCount(2);
                config.setExcludesCurrentProcessAudio(true);
            }
            let mic_state = if cfg.mic { mic_state() } else { MicState::Ok };
            let mic_usable = cfg.mic && mic_state == MicState::Ok;
            let mic_native = mic_usable && os_at_least(15);
            let mic_av = mic_usable && !mic_native;
            if mic_native {
                config.setCaptureMicrophone(true);
            }

            // ---- asset writer
            let url = NSURL::fileURLWithPath(&nsstr(&cfg.out.to_string_lossy()));
            let file_type = if cfg.mov {
                objc2_av_foundation::AVFileTypeQuickTimeMovie.ok_or("no AVFileType")?
            } else {
                objc2_av_foundation::AVFileTypeMPEG4.ok_or("no AVFileType")?
            };
            let writer = AVAssetWriter::assetWriterWithURL_fileType_error(&url, file_type).map_err(|e| e.localizedDescription().to_string())?;

            let codec = if cfg.hevc { objc2_av_foundation::AVVideoCodecTypeHEVC } else { objc2_av_foundation::AVVideoCodecTypeH264 }.ok_or("no codec constant")?;
            let bitrate = ((px_w * px_h) as f64 * cfg.fps as f64 * cfg.bits_per_pixel).clamp(1_000_000.0, 120_000_000.0);
            let mut comp = vec![
                (nsstr("AverageBitRate"), ns_num_f(bitrate)),
                (nsstr("ExpectedFrameRate"), ns_num_i(cfg.fps as isize)),
                (nsstr("MaxKeyFrameInterval"), ns_num_i((cfg.fps * 2) as isize)),
            ];
            if let Some(k) = objc2_av_foundation::AVVideoAverageBitRateKey {
                comp[0].0 = k.retain();
            }
            if let Some(k) = objc2_av_foundation::AVVideoExpectedSourceFrameRateKey {
                comp[1].0 = k.retain();
            }
            if let Some(k) = objc2_av_foundation::AVVideoMaxKeyFrameIntervalKey {
                comp[2].0 = k.retain();
            }
            let comp_dict = dict(comp);
            let key = |k: Option<&'static NSString>, fallback: &str| k.map(|k| k.retain()).unwrap_or_else(|| nsstr(fallback));
            let video_settings = dict(vec![
                (key(objc2_av_foundation::AVVideoCodecKey, "AVVideoCodecKey"), ns_str_any(&codec.to_string())),
                (key(objc2_av_foundation::AVVideoWidthKey, "AVVideoWidthKey"), ns_num_i(px_w as isize)),
                (key(objc2_av_foundation::AVVideoHeightKey, "AVVideoHeightKey"), ns_num_i(px_h as isize)),
                (key(objc2_av_foundation::AVVideoCompressionPropertiesKey, "AVVideoCompressionProperties"), Retained::cast_unchecked(comp_dict)),
            ]);
            let video_type = objc2_av_foundation::AVMediaTypeVideo.ok_or("no media type")?;
            let video = AVAssetWriterInput::initWithMediaType_outputSettings(AVAssetWriterInput::alloc(), video_type, Some(&video_settings));
            video.setExpectsMediaDataInRealTime(true);
            if !writer.canAddInput(&video) {
                return Err("cannot add the video input to the writer".into());
            }
            writer.addInput(&video);

            let audio_type = objc2_av_foundation::AVMediaTypeAudio.ok_or("no media type")?;
            let audio_settings = |channels: isize, bitrate: isize| {
                dict(vec![
                    (nsstr("AVFormatIDKey"), ns_num_i(u32::from_be_bytes(*b"aac ") as isize)),
                    (nsstr("AVSampleRateKey"), ns_num_f(48_000.0)),
                    (nsstr("AVNumberOfChannelsKey"), ns_num_i(channels)),
                    (nsstr("AVEncoderBitRateKey"), ns_num_i(bitrate)),
                ])
            };
            let mk_audio = |channels: isize, bitrate: isize| -> Option<Retained<AVAssetWriterInput>> {
                let i = AVAssetWriterInput::initWithMediaType_outputSettings(AVAssetWriterInput::alloc(), audio_type, Some(&audio_settings(channels, bitrate)));
                i.setExpectsMediaDataInRealTime(true);
                if writer.canAddInput(&i) {
                    writer.addInput(&i);
                    Some(i)
                } else {
                    None
                }
            };
            let sys = if cfg.system_audio { mk_audio(2, 160_000) } else { None };
            let mic = if mic_native || mic_av { mk_audio(1, 96_000) } else { None };

            let shared = Arc::new(Shared {
                inputs: Sendable(Inputs { writer: writer.clone(), video, sys: sys.clone(), mic: mic.clone() }),
                state: Mutex::new(State {
                    retimer: Retimer::new(),
                    started_at: None,
                    last_out: 0.0,
                    frames: 0,
                    dropped: 0,
                    error: None,
                    finished: false,
                    stopped_by_system: None,
                }),
                host_clock: Sendable(CMClock::host_time_clock()),
                on_stopped,
            });

            // ---- stream
            let handler = StreamHandler::new(shared.clone());
            let delegate: &ProtocolObject<dyn SCStreamDelegate> = ProtocolObject::from_ref(&*handler);
            let stream = SCStream::initWithFilter_configuration_delegate(SCStream::alloc(), &filter, &config, Some(delegate));
            let queue = DispatchQueue::new("com.sitthichat.captureme.recording", DispatchQueue_attr_serial());
            let output: &ProtocolObject<dyn SCStreamOutput> = ProtocolObject::from_ref(&*handler);
            stream
                .addStreamOutput_type_sampleHandlerQueue_error(output, SCStreamOutputType::Screen, Some(&queue))
                .map_err(|e| e.localizedDescription().to_string())?;
            if cfg.system_audio {
                stream
                    .addStreamOutput_type_sampleHandlerQueue_error(output, SCStreamOutputType::Audio, Some(&queue))
                    .map_err(|e| e.localizedDescription().to_string())?;
            }
            if mic_native {
                stream
                    .addStreamOutput_type_sampleHandlerQueue_error(output, SCStreamOutputType::Microphone, Some(&queue))
                    .map_err(|e| e.localizedDescription().to_string())?;
            }

            let (tx, rx) = mpsc::channel::<Option<String>>();
            let block = RcBlock::new(move |err: *mut NSError| {
                let _ = tx.send(if err.is_null() { None } else { Some((*err).localizedDescription().to_string()) });
            });
            stream.startCaptureWithCompletionHandler(Some(&block));
            if let Err(e) = wait_err(rx, 15, "starting the capture stream") {
                writer.cancelWriting();
                return Err(e);
            }
            let mic_session = if mic_av {
                match MicSession::start(shared.clone()) {
                    Ok(m) => Some(Sendable(m)),
                    Err(e) => {
                        log::warn!("microphone fallback failed: {e}");
                        None
                    }
                }
            } else {
                None
            };

            Ok(Engine {
                stream: Sendable(stream),
                _handler: Sendable(handler),
                _queue: Sendable(queue),
                shared,
                out: cfg.out.clone(),
                size: (px_w as u32, px_h as u32),
                has_system_audio: sys.is_some(),
                has_mic: mic.is_some() && (mic_native || mic_session.is_some()),
                mic_state: if cfg.mic { Some(mic_state) } else { None },
                _mic_session: Mutex::new(mic_session),
            })
        }
    }

    pub fn pause(&self) {
        let now = host_now(&self.shared);
        self.shared.state.lock().unwrap_or_else(|e| e.into_inner()).retimer.pause(now);
    }

    pub fn resume(&self) {
        let now = host_now(&self.shared);
        self.shared.state.lock().unwrap_or_else(|e| e.into_inner()).retimer.resume(now);
    }

    /// Error recorded by the writer, if any.
    #[allow(dead_code)]
    pub fn error(&self) -> Option<String> {
        let st = self.shared.state.lock().unwrap_or_else(|e| e.into_inner());
        st.error.clone().or_else(|| st.stopped_by_system.clone())
    }

    /// Stop capturing and finish (or, with `cancel`, delete) the movie.
    pub fn stop(&self, cancel: bool) -> Result<Finished, String> {
        unsafe {
            // 0. stop the microphone fallback session (if any)
            if let Some(m) = self._mic_session.lock().unwrap_or_else(|e| e.into_inner()).take() {
                m.0.session.stopRunning();
            }
            // 1. stop the stream (no more samples afterwards)
            let (tx, rx) = mpsc::channel::<Option<String>>();
            let block = RcBlock::new(move |err: *mut NSError| {
                let _ = tx.send(if err.is_null() { None } else { Some((*err).localizedDescription().to_string()) });
            });
            self.stream.0.stopCaptureWithCompletionHandler(Some(&block));
            let _ = wait_err(rx, 10, "stopping the capture stream");

            // 2. close the writer
            let inp = &self.shared.inputs.0;
            let (started, end_out, frames, error) = {
                let mut st = self.shared.state.lock().unwrap_or_else(|e| e.into_inner());
                st.finished = true;
                let now = host_now(&self.shared);
                let end_by_clock = now - st.retimer.paused_before(now);
                // the last frame lasts until the stop time (static screens produce few frames)
                let end = end_by_clock.max(st.last_out);
                (st.started_at, end, st.frames, st.error.clone().or_else(|| st.stopped_by_system.clone()))
            };
            if cancel || started.is_none() {
                if inp.writer.status() == AVAssetWriterStatus::Writing {
                    inp.writer.cancelWriting();
                }
                let _ = std::fs::remove_file(&self.out);
                return if cancel { Ok(Finished { duration_s: 0.0, width: self.size.0, height: self.size.1, frames: 0 }) } else { Err(error.unwrap_or_else(|| "no frames were captured (is Screen Recording permission granted?)".into())) };
            }
            if inp.writer.status() != AVAssetWriterStatus::Writing {
                let _ = std::fs::remove_file(&self.out);
                return Err(describe_writer_error(&inp.writer));
            }
            inp.writer.endSessionAtSourceTime(cm_seconds(end_out));
            inp.video.markAsFinished();
            if let Some(i) = &inp.sys {
                i.markAsFinished();
            }
            if let Some(i) = &inp.mic {
                i.markAsFinished();
            }
            let (tx, rx) = mpsc::channel::<()>();
            let block = RcBlock::new(move || {
                let _ = tx.send(());
            });
            inp.writer.finishWritingWithCompletionHandler(&block);
            if rx.recv_timeout(Duration::from_secs(60)).is_err() {
                return Err("finishing the movie timed out".into());
            }
            if inp.writer.status() != AVAssetWriterStatus::Completed {
                let _ = std::fs::remove_file(&self.out);
                return Err(describe_writer_error(&inp.writer));
            }
            Ok(Finished { duration_s: (end_out - started.unwrap_or(0.0)).max(0.0), width: self.size.0, height: self.size.1, frames })
        }
    }
}

#[allow(non_snake_case)]
fn DispatchQueue_attr_serial() -> Option<&'static dispatch2::DispatchQueueAttr> {
    dispatch2::DispatchQueueAttr::SERIAL
}

/// True if ScreenCaptureKit looks usable on this machine (macOS 12.3+).
pub fn available() -> bool {
    os_at_least(13)
}

/// `Message` import keeps `retain()` on NSString statics available.
#[allow(dead_code)]
fn _assert_message<T: Message>() {}

#[cfg(test)]
mod tests {
    use super::*;

    /// Manual smoke test (needs Screen Recording permission for the test runner):
    /// `cargo test --lib sck_smoke -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn sck_smoke() {
        let env = |k: &str| std::env::var(k).ok();
        let mov = env("SCK_MOV").is_some();
        let out = std::env::temp_dir().join(if mov { "captureme-sck-smoke.mov" } else { "captureme-sck-smoke.mp4" });
        let _ = std::fs::remove_file(&out);
        let mon = &xcap::Monitor::all().unwrap()[0];
        let id = mon.id().unwrap();
        let scale = mon.scale_factor().unwrap_or(1.0) as f64;
        let target = match env("SCK_TARGET").as_deref() {
            Some("display") => Target::Display { id, scale },
            Some("window") => {
                let w = xcap::Window::all().unwrap().into_iter().find(|w| w.width().unwrap_or(0) > 300 && w.height().unwrap_or(0) > 200 && !w.is_minimized().unwrap_or(true)).expect("a window");
                eprintln!("window: {:?} {}x{}", w.title(), w.width().unwrap(), w.height().unwrap());
                Target::Window { id: w.id().unwrap(), scale }
            }
            _ => Target::Region { id, x: 0.0, y: 0.0, w: 640.0, h: 360.0, scale },
        };
        let cfg = Config {
            target,
            fps: env("SCK_FPS").and_then(|v| v.parse().ok()).unwrap_or(30),
            bits_per_pixel: 0.1,
            hevc: env("SCK_HEVC").is_some(),
            mov,
            cursor: true,
            system_audio: env("SCK_AUDIO").is_some(),
            mic: env("SCK_MIC").is_some(),
            out: out.clone(),
            keep_windows: vec![],
        };
        let e = Engine::start(cfg, Box::new(|m| eprintln!("stopped: {m}"))).expect("start");
        std::thread::sleep(Duration::from_millis(1500));
        e.pause();
        std::thread::sleep(Duration::from_millis(1500));
        e.resume();
        std::thread::sleep(Duration::from_millis(1500));
        let f = e.stop(false).expect("stop");
        eprintln!("finished: {f:?}");
        eprintln!("has_mic={} mic_state={:?}", e.has_mic, e.mic_state);
        assert!(f.duration_s > 2.0 && f.duration_s < 3.8, "duration {}", f.duration_s);
        assert!(std::fs::metadata(&out).unwrap().len() > 1000);
    }
}
