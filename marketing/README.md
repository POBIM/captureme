# CaptureME – marketing kit (posters · social cards · tutorial video)

Everything here is built from **real captures of the real app** – no drawn/mock UI. Decorative framing only
(wallpaper, captions, numbered callouts, key-caps). The kit is **separate from the app** (own `package.json`).

| Output (`out/`) | What |
|---|---|
| `poster-a3.png` / `poster-a3.pdf` | A3 poster, 3508×4960 px (A3 @ 300 dpi) + vector-text PDF (297×420 mm) |
| `poster-square.png`, `poster-wide.png` | 2160×2160 social post, 3840×2160 (16:9) banner |
| `cards/NN-<tool>.png` | 21 per-tool social cards (1080×1350: Thai headline + real screenshot + shortcut) + `22-install-steps.png` + `23-download.png` (QR → `…/releases/latest`) |
| `captureme-tutorial.mp4` | 1920×1080 · 30 fps · silent · Thai captions + English subtitles: download from GitHub → install → permission → every tool → recording → settings/privacy → outro with link + QR |
| `captureme-short-9x16.mp4` | 1080×1920 vertical short |

## How it fits together

```
src-tauri/src/demo.rs  ──►  capture/*.py  ──►  capture/raw/<lang>/*.png (+ .json geometry)
 (debug-only driver)         (drive + photograph)        │
                                                        ▼
capture/ext/ (GitHub pages, Finder DMG, System Settings crops) ──► capture/docs-images.mjs ──► docs/images/{th,en}/*.webp
                                                                                                   │
                                      docs/*.md, README.md  ◄──────────────────────────────────────┤
                                      marketing/ (Remotion: posters, cards, videos) ◄──────────────┘  (publicDir = ../docs/images)
```

### 1. The demo driver (how real UI is shown without touching your desktop)
`src-tauri/src/demo.rs` is compiled **only in debug builds** (`cargo build`, never `--release`) and is inert unless the
environment variable `CAPTUREME_DEMO=<dir>` is set. The frontend counterparts are `src/editor/demo.ts` (editor helpers) and
`src/shared/demo.ts` (page overrides); both are loaded only by `vite dev` – production bundles contain none of it.

In demo mode the app
* skips global hotkeys and first-launch onboarding, runs with a throw-away `HOME` (your settings/history are never read or changed),
* polls `<dir>/*.cmd.json` and executes JSON commands (`open`, `panel`, `overlay`, `eval`, `emit`, `place`, `editor`, `thumb`, `ocr`, `qr`, `pin`, `colors`, `history_add`, `settings`, `history_window`, `settings_window`, `tray_menu`, …),
* shows the capture overlay over a prepared PNG "scene" instead of grabbing the real screen (so the frozen "screenshot" is a clean sample page),
* drives the editor through its **real tools** (`__demo.drag('arrow', …)` dispatches the same pointer events a mouse would, inside the page only) and opens its real dialogs.

Nothing is ever sent to macOS as synthetic mouse/keyboard input, and no AppleScript / System Events is used.
Windows are photographed **one by one** with `screencapture -x -o -l <windowID>`; window IDs come from `capture/winlist.swift`, which lists only the
demo process's own windows. Windows are magnified (`set_zoom(2)`) and enlarged so the capture is a crisp 2× image even on a 1× display.

Sample content (a made-up coffee shop, in Thai) is authored in `capture/scenes/scenes.html` and rendered by headless Chrome.

### 2. Regenerate the captures + docs images
```bash
brew install webp                   # cwebp (docs images are lossy WebP ≈ 60 KB each)
bash capture/run-all.sh             # builds the debug app, shoots Thai + English, writes docs/images/{th,en}
bash capture/run-all.sh th          # Thai only
node capture/docs-images.mjs th e07 # rebuild only the images whose name contains "e07"
```
Needs: macOS, Rust, Node 20+, Xcode CLT (`swiftc`), and Screen Recording permission for your terminal (for `screencapture -l`).
The run touches your clipboard (copy / OCR / colour-pick put text there); the driver restores the previous *text* clipboard afterwards.
**Do not run it while you need the screen:** the app's windows briefly appear (on any display) while they are photographed.

### 3. Captures that are not made by the driver (`capture/ext/`, committed)
* **GitHub pages** – `node capture/ext-shot.mjs <url> <out.png> [height] [dsf]` (headless Chrome, 1440 px wide, light mode).
* **Finder DMG window** – `yes | hdiutil attach release/*.dmg; open /Volumes/CaptureME`, capture the Finder window by id, `hdiutil detach /Volumes/CaptureME`.
* **System Settings** – `open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"` (and `com.apple.settings.PrivacySecurity.extension?Security`), capture the window by id,
  then **crop to the right-hand pane only**: the sidebar shows the account name and the lists show other apps – never publish those.
  Only the privacy-cropped results (`ext/sys-*.png`) are kept; delete the full-window captures.

### 4. Render the marketing material
```bash
npm install                 # first time (Remotion downloads headless Chrome on first render, ~90 MB)
npm run sync                # re-read shortcuts + version from the app, regenerate the QR (→ releases/latest)
npm run render              # posters + cards + tutorial + short  (video ≈ 10–15 min on an M-series Mac)
npm run render:posters | render:cards | render:video | render:short
npm run studio              # live preview (Remotion Studio, public dir = ../docs/images)
npm run check               # TypeScript
npx remotion still src/index.ts Card out/x.png --public-dir=../docs/images --props='{"i":5}'
```
Spot-check a video frame: `npx remotion still src/index.ts Tutorial out/f.png --public-dir=../docs/images --frame=2400`.

## Where to edit what
| I want to change… | Edit |
|---|---|
| Texts / which capture a card shows | `src/content.ts` |
| Video storyboard (chapters, captions TH + EN, durations) | `src/video/scenes.ts` |
| Poster / card layout | `src/posters.tsx`, `src/poster-parts.tsx` |
| What each docs image shows (callouts, crops) | `capture/docs-images.mjs` |
| What the driver does / the sample screens | `capture/shoot_*.py`, `capture/scenes/scenes.html`, `src-tauri/src/demo.rs` |
| URL, version | `site.json` → `npm run sync` |

## Rendering notes
* Video: H.264, `crf 22`, `yuv420p` (QuickTime / browsers / phones). Silent on purpose (no music licensing). Add audio later with `ffmpeg -i in.mp4 -i music.mp3 -c:v copy -shortest out.mp4`.
* Fonts are self-hosted (`src/fonts/`), rendering works offline.
* The poster PDF is HTML printed by Remotion's headless Chrome (text stays vector, screenshots are raster).

## Licenses of fonts / assets
| Asset | License |
|---|---|
| **IBM Plex Sans Thai** (`src/fonts/*.woff2`, from `@fontsource/ibm-plex-sans-thai`) | SIL Open Font License 1.1 – © IBM Corp. (`src/fonts/OFL-IBM-Plex-Sans-Thai.txt`) |
| `qrcode` (offline QR generation) | MIT |
| Remotion | Remotion License – free for individuals and companies of up to 3 people; larger companies need a company licence (https://www.remotion.dev/license). The rendered output is yours. |
| CaptureME icon, screenshots, all artwork here | MIT, © 2026 Sitthichat – same as the app. Sample data (names, numbers, account `123-4-56789-0`) is fictional. |

The ⌃ ⌥ ⇧ ⌘ key symbols use the macOS system font, present when you render on a Mac.
