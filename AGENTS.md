# CaptureME – agent guide

macOS menu-bar screenshot + annotation app. **Tauri 2** (Rust, `src-tauri/`) + **Vite + vanilla TypeScript** (`src/`, one `<page>.html` per window in repo root). Apple Silicon, macOS 27, Xcode installed.

## Commands
- `npm run build` – type-check + build frontend (must pass)
- `cd src-tauri && cargo build` – build Rust (must pass, no new warnings in your files ideally)
- `npm run tauri dev` – run app (menu-bar only app, `LSUIElement`)
- `scripts/build-installer.sh` – release `.app` + `.dmg`

## Architecture & contracts (do not break)
- `src-tauri/src/types.rs` – shared types: `CaptureResult`, `Settings`, `SelectionRect`, `AppError`/`CmdResult`. Mirror TS types in `src/shared/api.ts`. Only **add** fields/types.
- `src-tauri/src/windows.rs` – window helpers (`open_page`, `open_editor`, `open_settings`, `open_history`, `open_onboarding`). Append only.
- `src-tauri/src/settings.rs` – `settings::get(app)`; `save_settings` emits `settings-changed` event (payload: Settings).
- `src-tauri/src/lib.rs` – register commands **only inside your own marked section** of `generate_handler!` / setup. Re-read the file right before editing; keep edits minimal (other agents edit it concurrently).
- `src-tauri/Cargo.toml` – add deps **only under your `# ---- Agent X deps ----` marker**.
- `src-tauri/capabilities/default.json` – may append permissions.
- i18n: `src/shared/i18n.ts` (`t(key)`, `applyI18n()`, `data-i18n="key"`, `setLang`). Each area owns its dictionary file in `src/i18n/`. Keys prefixed by area. Thai + English required.
- Captures are PNG files in `paths::captures_dir(app)`; windows load them with `convertFileSrc(path)` (asset protocol enabled, scope `**`).
- Frontend calling Rust: `invoke("command_name", {camelCaseArgs})`.

### Cross-module Rust functions (signatures fixed; owner implements bodies)
| fn | owner |
|---|---|
| `capture::start_region/start_window/start_fullscreen(app)`, `capture::start_delayed(app, secs)`, `capture::start_overlay(app, mode)` | A |
| `recording::start_region(app, SelectionRect)`, `recording::stop_if_recording(app) -> bool`, `recording::is_recording()` | D |
| `scroll::start_region(app, SelectionRect)` | D |
| `ocr::run_on_image(app, path)` | C |
| `pin::open_pin(app, path)` | C |
| `history::record(app, &CaptureResult)` | C |
| `export::copy_file_to_clipboard(app, path)`, `export::save_file_auto(app, path) -> Result<String,String>` | C |

Overlay flow: hotkey/tray → `capture::start_overlay(app, mode)` → screenshot every monitor, show fullscreen frozen overlay per monitor (`overlay.html?mode=..&monitor=..`) → user selects → overlay invokes A's command → A crops and dispatches by mode: `capture` → save PNG, `history::record`, copy if setting, open editor; `ocr` → `ocr::run_on_image`; `pin` → `pin::open_pin`; `scroll`/`record` → D's `start_region` with the `SelectionRect` (no crop).

### Commands the editor (B) relies on – implemented by C
- `copy_image_png(pngBase64: string)` – copy to clipboard
- `save_image_png(pngBase64: string, path?: string) -> string` – save (auto path from settings if none; converts to settings format by extension)
- `pin_image_png(pngBase64: string)` – pin to screen
- `ocr_image_png(pngBase64: string) -> string` – recognised text
- `update_history_image(id: string, pngBase64: string)` – store edited version for history entry (id from `CaptureResult`)
- `history_list() -> CaptureResult[]`, `history_delete(id)`, `history_clear()`, `history_open(id)` (opens editor)
Editor URL: `editor.html?path=<abs path>` (+ optional `&id=<capture id>`).

## Ownership
- **A – Capture core**: `capture.rs`, `hotkey.rs`, `tray.rs`, `permissions.rs`, `src/overlay/`, `src/onboarding/` (also `index.html`), `src/i18n/capture.ts`, `src/i18n/common.ts`, `src/shared/base.css`.
- **B – Editor**: `src/editor/`, `editor.html`, `src/i18n/editor.ts`.
- **C – Tools**: `export.rs`, `history.rs`, `ocr.rs`, `pin.rs`, `settings.rs`, `src/pin/`, `src/history/`, `src/settings/`, `src/i18n/tools.ts`.
- **D – Advanced + installer**: `scroll.rs`, `recording.rs`, `src/scroll/`, `src/recorder/`, `src/i18n/extras.ts`, `scripts/`, `README.md`.
Don't edit files you don't own except the marked shared spots above. Don't `git commit` (the lead commits).
