# REVIEW-APP – Agent E (app review, privacy audit, new capture tools)

Scope: all Rust in `src-tauri/src/**` (except Agent H's recording/video work), all frontend pages except `src/editor/**`.

## 1. Fixes made

| Area | Problem | Fix |
|---|---|---|
| Panics | 29 × `Mutex::lock().unwrap()` in `recording.rs`, `scroll.rs`, `ocr.rs`, `settings.rs` – one panicking thread would poison the lock and take the whole app down | all use `unwrap_or_else(\|e\| e.into_inner())` |
| Race | `scroll::start_region` cloned the session with `.clone().unwrap()` after releasing the lock | session is created and cloned inside the same critical section |
| Settings file | written in place (crash → corrupt JSON → silently reset to defaults); `unwrap()` on serialisation | atomic write (tmp + rename), error propagated |
| Hotkeys | default ⌘⇧1/2/3/6… clash with macOS ⌘⇧3/4/5/6; empty accelerator was silently replaced by the default | new ⌃⇧ defaults (see §3), versioned migration, empty = "disabled" (✕ button in Settings) |
| Stuck overlay | if the overlay page failed to load / never got key focus there was no way out | global `Esc` is registered while an overlay session is open (and released on every exit path) |
| Silent failures | capture / repeat / fullscreen / import errors were only `log::error!` (and there was **no logger at all**, so even those vanished) | native error dialog in the user's language; tiny stderr logger (no crates, nothing written to disk) |
| Temp files | `pin-*.png`, `drag-*`, `rec-*` temp files were never cleaned | included in the startup/session temp cleanup (24 h) |
| Path traversal | `update_history_image(id)` used the id in a file name | id restricted to `[A-Za-z0-9-]` |
| Floating windows | OCR result window (and now thumbnail/colors/QR) did not follow the user to other Spaces / over full-screen apps – they were "never visible" when the user was in a full-screen app | `windows::float_over_fullscreen` (CanJoinAllSpaces + FullScreenAuxiliary) |
| Accessibility | icon-only buttons had only `title`; no focus outline; overlay toolbar unlabeled | `data-i18n-title` now also sets `aria-label` (re-applied on language change), overlay toolbar `aria-label`, `:focus-visible` outlines, `role=status/aria-live` on toasts, reduced-motion for the thumbnail animation, colour picker and presets fully keyboard-operable |
| i18n | new tools / hotkey names missing; OCR close button unnamed | `src/i18n/more.ts` (TH + EN) for everything new |
| Hotkey list | onboarding cheat-sheet and Settings listed a hard-coded old list | single list `HOTKEY_ACTIONS` in `shared/api.ts`; "reset" uses `default_settings` from Rust (single source of truth) |

### Reviewed, no change needed
`export.rs`, `history.rs` (locks already poison-safe), `pin.rs`, `permissions.rs`, `floating.rs`, monitor / Retina maths in `capture.rs` (global logical points ↔ pixels via per-monitor scale; Cocoa Y flip uses the primary display height – correct for multi-monitor), recording/scroll state machines.

### Known remaining issues (not fixed)
* `hotkey::register_all` calls `unregister_all`; saving settings **while** a scroll capture or overlay is open also drops its temporary `Esc` shortcut (the overlay page still handles Esc itself; scroll has its Done/Cancel buttons).
* `CGWindowListCreateImage` (used for window shadow capture, as xcap already did) is deprecated by Apple in favour of ScreenCaptureKit; it still works on macOS 27.
* Agent H's `recording.rs` / `video.rs` / `recording/sck.rs` currently produce compiler warnings (not mine).

## 2. Privacy audit – result: **no network access, nothing collected**

* **Crates**: `cargo tree --target aarch64-apple-darwin` contains no HTTP client (`reqwest`, `hyper`, `ureq`, `curl`, TLS, websocket, `sentry` …); only the `http`/`url` *types* crates pulled in by Tauri itself. No `updater`, no analytics plugin. The only new dependency of this round is `drag` (native macOS drag-and-drop, no network).
* **Plugins**: global-shortcut, autostart, dialog, opener. `opener` only opens a URL when the user clicks (GitHub link, or a QR link after an explicit confirm dialog).
* **Frontend**: only `fetch()` is `convertFileSrc(...)` in the editor (local `asset:` protocol). No remote scripts, fonts or images. External URLs in source: GitHub repo link only.
* **CSP** (`tauri.conf.json`, strict, also `devCsp` for `tauri dev`):
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost data: blob:; media-src 'self' asset: http://asset.localhost blob:; font-src 'self' data:; connect-src ipc: http://ipc.localhost asset: http://asset.localhost; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
  `dangerousDisableAssetCspModification: ["style-src"]` keeps `'unsafe-inline'` effective for inline `style=` attributes (otherwise Tauri's nonce injection would disable it).
* **Asset protocol scope** narrowed from `**` to `$APPDATA/**`, `$APPLOCALDATA/**`, `$APPCACHE/**` (captures, history, temp frames). Anything else is allowed *dynamically and per file*: `windows::open_editor*` calls `asset_protocol_scope().allow_file(path)`; image files **dropped on a window** are allowed by a Rust `on_window_event` hook; and the command `allow_image_file(path)` (images only) exists for the editor (see §5).
* **Data**: everything lives under `~/Library/Application Support/com.sitthichat.captureme`, caches under `~/Library/Caches/…`. "Remove all data" (Settings → About) deletes all of it (+ WebKit storage), disables launch-at-login and quits; files saved to the user's own folders are never touched.

## 3. New features, default hotkeys

New defaults (⌃⇧ + key; none collide with macOS ⌘⇧3/4/5/6). Users still on the old defaults are migrated automatically (`hotkeys_version`); customised hotkeys are kept; a new default that would clash with a custom hotkey stays disabled.

| Action | Default | Notes |
|---|---|---|
| Fullscreen | ⌃⇧1 | (was ⌘⇧1) |
| Region | ⌃⇧2 | (was ⌘⇧2) |
| Window | ⌃⇧3 | (was ⌘⇧3 – clashed) |
| **Repeat last region** | ⌃⇧4 | re-captures the last region/window frame from the live screen, no overlay |
| Delayed | ⌃⇧5 | |
| Scroll | ⌃⇧6 | |
| Record | ⌃⇧7 | |
| OCR | ⌃⇧8 | |
| History | ⌃⇧9 | |
| **Pin region** | ⌃⇧P | overlay mode "pin" now reachable from tray/hotkey |
| **Colour picker** | ⌃⇧C | overlay mode `color` |
| **Pixel ruler** | ⌃⇧M | overlay mode `measure` |
| **QR / barcode** | ⌃⇧Q | overlay mode `qr` |
| **Annotate clipboard image** | ⌃⇧V | |
| Open image… | – | tray only |

1. **Repeat last region** – tray + hotkey; falls back to the normal region overlay when nothing was captured yet.
2. **Floating thumbnail** – Settings → General → "After a capture": editor / thumbnail / copy only / save only (old `open_editor_after_capture` migrated; `copy_after_capture` still works as "also copy"). Thumbnail bottom-right of the work area, buttons edit / copy / save / pin / close, auto-dismiss after N s (0 = stay; paused while hovering), hidden from screenshots, and **drag the image out** into Finder/Mail/etc. (native `drag` crate; drops a PNG named after the filename pattern).
3. **Colour picker** – frozen screen + 15×15 loupe, click copies HEX / RGB / HSL (setting, **F** cycles), Shift+click keeps picking, arrows nudge 1 px; "Recent colors" panel (30 entries, click to copy, format switch, clear).
4. **Pixel ruler** – hover = Shottr-style auto edge detection (scan in 4 directions in Rust on the full-resolution frozen image, ↑/↓ = tolerance), drag = free distance (w × h, diagonal), size shown in pt **and** px, click/drag-release copies `W × H`.
5. **QR / barcode** – Apple Vision `VNDetectBarcodesRequest` on the selection; payload copied; result window with Copy and, for http(s), **Open link** that asks for confirmation first.
6. **Open image… / Annotate clipboard image** – imports into the captures dir as PNG + history entry (original never modified; HEIC/TIFF/BMP via AppKit fallback), then opens the editor.
7. **Capture options** – *include cursor* (region/fullscreen/repeat; composited from `NSCursor`), *window capture with shadow* (transparent padding via CoreGraphics; off = plain window), overlay **presets bar**: Free, 1:1, 4:3, 16:9 (aspect lock for drawing *and* resizing), 1280×720, 1920×1080, 800×600, Custom W×H (remembered). Sizes are output **pixels** (shrunk to fit the monitor).
8. **Hide desktop icons** – *skipped.* The capture is a frozen frame, so covering the desktop would need a wallpaper-cover window per Space; not worth the flicker/risk. (Alternative for users: hide icons in Finder.)
9. Translate – skipped on purpose (needs network).
10. **Remove all CaptureME data** – Settings → About (double confirmation), plus About tab reachable from the tray's "About CaptureME".

About / privacy: Settings → About (version, privacy statement TH+EN, MIT summary, GitHub link `https://github.com/POBIM/captureme` opened through the opener plugin, remove-data) and an equivalent privacy card in onboarding.

## 4. Limitations
* The frozen-frame overlay means colour/measure work on the screenshot taken when the tool was started (not live).
* Cursor is composited at overlay start (window-snap captures never include it). macOS may deprecate `NSCursor.currentSystemCursor`; we fall back to the arrow cursor.
* One thumbnail at a time (a new capture replaces it; the capture itself is always in History).
* Drag-out and the thumbnail's hover/timer logic were verified to render, but the actual drag gesture could not be exercised without UI automation.
* QR: only symbologies Apple Vision supports; multi-code selections list all payloads (all are copied, newline separated).
* Window shadow capture is raster only at the window's own scale (no padding colour option).

## 5. Notes for Agent F (editor)
* Opening an arbitrary image path in the editor via `windows::open_editor*` is allowed automatically. If the editor itself inserts an image from a user-picked path (not a drop), call `invoke("allow_image_file", { path })` **before** `fetch(convertFileSrc(path))` – otherwise the strict asset scope returns 403. Dropped files are allowed automatically by a Rust hook.
* CSP: inline `<style>`/`style=""` are allowed; remote resources, `eval`, inline scripts are not. `blob:`/`data:` images and `fetch(asset:)` work.
* Captures are now opened with their history id (`open_editor_with_id`) so edits are stored in the history.
