// Shared typed wrappers around Rust commands. Contract defined in src-tauri/src/types.rs.
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

export interface CaptureResult {
  id: string;
  path: string; // absolute PNG path
  width: number; // pixels
  height: number;
  scale: number; // display scale factor at capture time
  created_at: string; // ISO 8601
}

export interface Settings {
  language: "th" | "en";
  save_dir: string;
  filename_pattern: string; // e.g. "CaptureME {date} {time}"
  image_format: "png" | "jpg" | "webp";
  jpg_quality: number;
  copy_after_capture: boolean;
  open_editor_after_capture: boolean;
  play_sound: boolean;
  launch_at_login: boolean;
  history_limit: number;
  hotkeys: Record<string, string>; // action -> accelerator ("" = disabled), e.g. { region: "Ctrl+Shift+2" }
  // ---- Round 2 additions (mirror of src-tauri/src/types.rs) ----
  after_capture: "editor" | "thumbnail" | "copy" | "save";
  thumbnail_seconds: number; // 0 = stay until dismissed
  color_format: "hex" | "rgb" | "hsl";
  include_cursor: boolean;
  window_shadow: boolean;
  hotkeys_version: number;
}

/** Hotkey actions in display order (settings + onboarding). Defaults live in Rust (types.rs). */
export const HOTKEY_ACTIONS = [
  "fullscreen", "region", "window", "repeat", "delayed", "scroll", "record", "ocr", "pin", "color", "measure", "qr", "clipboard", "history",
] as const;

export const REPO_URL = "https://github.com/sitthichat/captureme";

export const api = {
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
  fileSrc: (path: string) => convertFileSrc(path),
};

export function queryParam(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}
