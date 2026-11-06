# CaptureME – marketing kit (poster + tutorial video)

Everything here is **separate from the app** (own `package.json`, own `node_modules`). It is built with
[Remotion](https://www.remotion.dev) (React → still images / video) and contains:

| Output (in `out/`) | What | Size |
|---|---|---|
| `poster-a3.png` | A3 portrait poster, 3508×4960 px (A3 @ 300 dpi) | 3.0 MB |
| `poster-a3.pdf` | same poster as **vector PDF**, A3 (297×420 mm), fonts embedded | 0.7 MB |
| `poster-square.png` | 2160×2160 social post | 1.0 MB |
| `poster-wide.png` | 3840×2160 (16:9) poster / banner | 1.5 MB |
| `captureme-tutorial.mp4` | 1920×1080, 30 fps, H.264, 2 min 26 s, Thai captions + English subtitles, silent | 22.6 MB |
| `captureme-short-9x16.mp4` | 1080×1920 vertical short, 38 s, silent | 5.2 MB |

## Quick start

```bash
cd marketing
npm install                 # first time only (Remotion downloads a headless Chrome on first render, ~90 MB)
npm run sync                # re-read shortcuts + version from the app (src-tauri/src/types.rs, tauri.conf.json) and regenerate the QR code
npm run render              # posters + tutorial video + short   (≈ 12–15 min on an M-series Mac, mostly the long video)
```

Individual targets:

```bash
npm run render:posters      # poster-a3.png/.pdf, poster-square.png, poster-wide.png   (~10 s)
npm run render:video        # captureme-tutorial.mp4
npm run render:short        # captureme-short-9x16.mp4
npm run studio              # live preview / scrub timeline in the browser (Remotion Studio)
npm run check               # TypeScript type-check
```

Single frame as PNG (handy to proof-read a scene):

```bash
npx remotion still src/index.ts Tutorial out/frame.png --frame=1500     # frame / 30 = seconds
npx remotion still src/index.ts Short out/frame.png --frame=200
```

## Where to edit what

| I want to change… | Edit |
|---|---|
| GitHub URL, version, author | `site.json` → `npm run sync` (regenerates the QR code) |
| Default shortcuts shown everywhere | change them in the app (`src-tauri/src/types.rs`) → `npm run sync` (auto-parsed into `src/generated/app.json`) |
| Brand colours / fonts | `src/theme.ts` |
| Poster text, features, steps, shortcut list | `src/poster/parts.tsx` (`FEATURES`, `SHORTCUTS`, `STEPS`) and `src/poster/Poster*.tsx` for layout |
| Video captions (Thai + English) | `src/video/Tutorial.tsx` – each scene has a `cues` list `{from, to, th, en}` (seconds, local to the scene) |
| Scene order / length | `D = {…}` durations in `src/video/Tutorial.tsx` (seconds) and `src/video/Short.tsx` |
| The animated mock UI | `src/video/demos-*.tsx` (each demo is a pure function of `t` seconds – no hidden state), shared pieces in `src/ui/` |
| Fake screenshot content | `src/ui/FakePage.tsx` |

All demo UIs are **React mock-ups** (macOS-like windows, menu bar, cursor, key chips) – they are drawn, not recorded
from the real app, so they never contain anyone's real data. To use real app screenshots instead, drop PNGs into
`public/` and show them with `<Img src={staticFile("x.png")} />`.

### How the poster PDF is made
`scripts/render-posters.mjs` renders the PNGs with `remotion still`, then bundles `src/poster/static.tsx`
with esbuild into a static HTML page (fonts inlined) and prints it with the headless Chrome that Remotion downloaded
(`--print-to-pdf`, page size A3). The page is therefore real vector text, not an image.

### Rendering notes
* Video: `--codec=h264 --crf=18`, `yuv420p` pixel format (`remotion.config.ts`) so it plays everywhere (QuickTime, browsers, phones).
* There is **no sound** on purpose (no music licensing issues; Remotion writes a silent AAC track). Add narration/music later with e.g. `ffmpeg -i in.mp4 -i music.mp3 -c:v copy -shortest out.mp4`.
* Fonts are self-hosted (`src/fonts/`) – rendering works offline.
* `out/` is committed-friendly (PNG / PDF / MP4). `node_modules/` and scratch files are git-ignored.

## Licenses of fonts / assets used

| Asset | License |
|---|---|
| **IBM Plex Sans Thai** (Thai + Latin subsets, `src/fonts/*.woff2`, from the `@fontsource/ibm-plex-sans-thai` package) | SIL Open Font License 1.1 – © IBM Corp. Full text: `src/fonts/OFL-IBM-Plex-Sans-Thai.txt`. Free to use/embed/redistribute; the fonts must not be sold on their own. |
| **Lucide** icons (`lucide-react`) | ISC License |
| `qrcode` (generates the QR code offline) | MIT |
| Remotion (`remotion`, `@remotion/cli`) | Remotion License – free for individuals and companies of up to 3 people; larger companies need a company license. See https://www.remotion.dev/license . (The rendered videos/posters themselves are yours.) |
| CaptureME app icon (`../assets/icon.svg`) and all artwork in this folder | MIT, © 2026 Sitthichat – same as the app |
| Mock UI content (names, numbers, account no. `123-4-56789-0`) | fictional |

The ⌃ ⌥ ⇧ ⌘ key symbols in keycaps use the macOS system font (Helvetica Neue / Lucida Grande), which is present when you render on a Mac.
