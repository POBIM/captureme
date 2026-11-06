// Mirror of src-tauri/src/recording.rs (RecordingOptions, RecordingStatus).
export interface RecOptions {
  format: "mp4" | "mov" | "gif";
  fps: number; // GIF fps
  video_fps: number; // 30 | 60
  quality: "low" | "medium" | "high";
  codec: "h264" | "hevc";
  cursor: boolean;
  clicks: boolean;
  keys: boolean;
  mic: boolean;
  system_audio: boolean;
  webcam: boolean;
  webcam_size: "s" | "m" | "l";
  webcam_shape: "circle" | "rounded";
  countdown: number;
  max_minutes: number;
  after: "video" | "reveal" | "none";
  save_dir: string;
}

export interface RecStatus {
  recording: boolean;
  pending: boolean;
  paused: boolean;
  started_ms: number;
  elapsed_ms: number;
  width: number;
  height: number;
  target: "region" | "display" | "window";
  can_pause: boolean;
  options: RecOptions;
  keys_access: boolean;
  sck: boolean;
}

export interface RecordingEntry {
  id: string;
  path: string;
  format: "mp4" | "mov" | "gif";
  duration_ms: number;
  width: number;
  height: number;
  size_bytes: number;
  created_at: string;
  thumb: string | null;
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
}
