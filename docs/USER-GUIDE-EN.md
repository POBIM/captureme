# CaptureME – User Guide (English)

[ภาษาไทย](USER-GUIDE-TH.md) · [Install guide](INSTALL-EN.md) · [← README](../README.md)

## Contents
1. [Getting started](#1-getting-started)
2. [Capturing](#2-capturing) – region · window · full screen · repeat last · delayed · size presets · floating thumbnail
3. [The editor](#3-the-editor)
4. [Pin to screen](#4-pin-to-screen)
5. [OCR – read text from the screen](#5-ocr--read-text-from-the-screen)
6. [Colour picker · pixel ruler · QR reader](#6-colour-picker--pixel-ruler--qr-reader)
7. [Annotate a clipboard image / open an image file](#7-annotate-a-clipboard-image--open-an-image-file)
8. [History](#8-history)
9. [Scrolling capture](#9-scrolling-capture)
10. [Screen recording & the video window](#10-screen-recording--the-video-window)
11. [Settings](#11-settings)
12. [All shortcuts](#12-all-shortcuts)

---

## 1. Getting started
CaptureME lives in the **menu bar** (viewfinder icon at the top right). There is no Dock icon.
- **Click the icon** for the menu: capture (region / window / full screen / repeat last / delayed) · scrolling capture · record screen · OCR · pin · colour picker · ruler · QR · clipboard image · open image · history · settings · quit.
- Or press a **shortcut** from anywhere (see [section 12](#12-all-shortcuts)).
- The first launch shows a welcome window to allow **Screen Recording** (see the [install guide](INSTALL-EN.md)).

## 2. Capturing
Press a shortcut or pick it from the menu. The screen **freezes** and a selection layer appears.

### 2.1 Region — `⌃⇧2`
1. **Drag** to select an area (or **click** to snap to the window under the pointer).
2. Adjust: drag handles · **Space + drag** moves the frame · **Shift** makes a square · **arrow keys** nudge by one pixel.
3. **Size presets:** the top bar offers *Free · 1:1 · 4:3 · 16:9 · 1280×720 · 1920×1080 · 800×600 · Custom…* (the aspect lock applies to drawing *and* resizing; sizes are output **pixels**).
4. A small toolbar appears beside the frame: **Confirm (Enter)** · **Copy (⌘C)** · **Pin** · **OCR** · **Cancel (Esc)**.
5. The loupe at the pointer shows magnified pixels and the colour code (HEX) under the cursor.
6. On confirm the image goes to History and then does what *Settings › General › After a capture* says (see 2.6).

### 2.2 Window — `⌃⇧3`
Hover a window to highlight it → **click** to capture just that window (turn on *Window capture with shadow* in Settings for the drop shadow on a transparent background).

### 2.3 Full screen — `⌃⇧1`
Captures the whole display at once (multi-monitor: the display under the pointer).

### 2.4 Repeat last region — `⌃⇧4`
Re-captures the last region/window from the live screen without dragging again (if nothing was captured yet it opens the region selector).

### 2.5 Delayed — `⌃⇧5`
For menus and tooltips that vanish when you press a shortcut. Choose **3 / 5 / 10 s** from the menu (the shortcut uses 5 s), then arrange your screen.

### 2.6 After a capture: the floating thumbnail
In **Settings › General › After a capture** choose: *Open the editor* · *Show a floating thumbnail* · *Copy to clipboard only* · *Save to folder only*.
- The **thumbnail** sits at the bottom right with **Edit · Copy · Save · Pin · Close (Esc)**, disappears after the time you set (0 = stays; paused while hovering) and can be **dragged out** into Finder, Mail or a chat.
- Other options: include the mouse cursor in captures · colour-picker output format (HEX / RGB / HSL).

> **Esc** cancels any mode.

## 3. The editor
Opens after a capture (per settings) or from History / the thumbnail. Press **`?`** inside the editor for the full shortcut sheet.

**One-key tools:** `V` select/move · `C` crop · `A` arrow · `L` line · `R` rectangle · `O` ellipse · `P` pen · `H` highlighter · `T` text · `N` step counter · `Q` callout · `Y` marker box · `U` underline/strike · `Z` measure · `D` redact · `B` blur · `X` pixelate · `S` spotlight · `M` magnifier · `E` stamp · `I` colour picker
and the **number keys `1`–`9`** = the first nine tools on the toolbar (drag toolbar buttons to reorder them; reset in the `?` sheet).

| Tool | How to use |
|---|---|
| **Arrow** | Drag from start to tip. Styles: straight / curved / double / tapered. Colour, width, shadow. |
| **Line / Rectangle / Ellipse** | Drag to draw (Shift = constrain angle / aspect); filled or outline; rounded corners. |
| **Pen · Highlighter** | Freehand · semi-transparent highlighting over text. |
| **Text** | Click and type (Thai/English); size, colour, background box · `Esc` or `⌘↵` to finish. |
| **Step counter** | Click to place 1, 2, 3… in sequence – ideal for tutorials. |
| **Callout · Marker · Underline** | Speech bubble with a leader line · highlight box · underline / strike / squiggle. |
| **Measure** | A ruler or a dimension arrow on the image. |
| **Blur / Pixelate** | Drag over sensitive data; adjustable strength. ⚠️ small text can sometimes be reversed. |
| **Redact** | Solid box, **irreversible** – use it for passwords and personal data (the editor offers *Convert to Redact* when you blur something sensitive). |
| **Spotlight** | Dims (or blurs) everything except the area you choose. |
| **Magnifier · Stamp** | Zoom into a small region · place emoji / symbols. |
| **Colour picker** | Click the image to pick a colour; applied to the selection and all tools. |
| **Crop** | Drag a frame (free or aspect ratio) → `Enter` apply / `Esc` cancel. |
| **Resize image / canvas** | Change resolution, or enlarge the canvas with a fill colour / transparency. |
| **Rotate / flip** | 90° left/right, flip horizontally/vertically (annotations follow the image). |
| **Padding / border** | Bakes padding and a border colour into the image pixels. |
| **Beautify background** | Gradient background + padding + rounded corners + drop shadow. |
| **Insert image** | `⌘V` pastes an image from the clipboard, or drop an image file onto the canvas. |
| **Watermark** | Text, corner or tiled, angle, colour; save presets – applied on export only. |

**Selecting & editing objects:** use `V`, click an object (drag to marquee, Shift = add) and tune its style in the side panel · `⌘D` duplicate (or drag with `⌥`) · `⌘G` / `⇧⌘G` group / ungroup · `⇧⌘L` lock · the *Align / Distribute* panel · `⌘]` / `⌘[` bring to front / send to back · `Delete` remove · arrows nudge (Shift = 10 px).

**Undo:** `⌘Z` undo · `⇧⌘Z` redo

**Zoom / pan:** `⌘+` / `⌘-` zoom · `⌘0` fit · `⌘1` 100 % · **Space + drag** pan · `⌘ + scroll/pinch` zoom

**Image:** `⌘L` / `⌘R` rotate left / right · `⇧⌘H` / `⇧⌘V` flip horizontally / vertically

**Export:** `⌘C` copy image (PNG) · `⌘S` save · `⇧⌘S` save as… · `⌘↵` copy & close · export options: scale, save as JPEG, copy file path, reveal in Finder · **Pin** and **OCR** buttons · `⌘W` close (asks first if there are unsaved edits)

> Whenever you save or copy, the edited version is stored in History too · light / dark theme follows the system.

## 4. Pin to screen
Keeps an image **floating above all windows** – handy as a reference while you work.
- **Start:** `⌃⇧P` (drag a region) · the *Pin* button in the region selector / editor / thumbnail / History.
- **Move:** drag the image · **Opacity:** `⌥ + scroll` · **Close:** `Esc`
- Buttons on the image: **Copy · Save · Edit (opens the editor) · Close**.

## 5. OCR – read text from the screen
Press **`⌃⇧8`** → drag over the text → the recognised text (Thai + English) appears in a small window → click **Copy text**.
- Runs on-device with Apple Vision; nothing leaves your Mac.
- Also available from the editor (OCR button) and the region-selector toolbar.
- Tips: select only the text block, use sharp images, avoid tiny text · Thai requires macOS 14+.

## 6. Colour picker · pixel ruler · QR reader
All three work on a frozen frame of the screen taken when you start them; `Esc` exits.

### Colour picker — `⌃⇧C`
15×15 pixel loupe · **click** copies the colour (HEX / RGB / HSL per Settings; press **F** to cycle formats) · **Shift+click** keeps picking · arrows nudge one pixel · the *Recent colors* window (30 entries, from the menu bar) lets you click to copy again.

### Pixel ruler — `⌃⇧M`
**Hover** = automatic edge detection showing width × height (pt **and** px) · `↑/↓` change edge tolerance · **drag** = measure any distance (w × h and diagonal) · **click / release** copies `W × H` · right-click clears.

### QR / barcode reader — `⌃⇧Q`
Drag over a QR code or barcode (Apple Vision, on-device) → the text is **copied automatically** → for http(s) links an **Open link** button appears, which *always asks for confirmation first* (links are never opened on their own).

## 7. Annotate a clipboard image / open an image file
- **`⌃⇧V`** – opens the image currently on the clipboard in the editor (stored as PNG in History; the original is never modified).
- **Menu › Open image…** or **drop an image file onto the editor** – PNG / JPG / WebP / GIF and HEIC / TIFF / BMP.

## 8. History
Open with **`⌃⇧9`** or menu › History.
- Every capture, grouped by day (Today / Yesterday / …), with an **Edited** badge on modified images.
- **Filter by date** from the dropdown.
- Per image: **Open in editor · Copy · Reveal in Finder · Pin · Delete**.
- **Select** multiple → select all / whole day → delete selected.
- Set the maximum (default 200 – oldest are removed first) and **clear everything** in Settings › History.

## 9. Scrolling capture
Stitches a long web page, document or chat into one image.
1. Press **`⌃⇧6`** and drag a region around the scrollable content (only the scrolling part; fixed headers/footers are ignored automatically).
2. A dashed blue frame and a control window with a live preview (height / frames) appear.
3. **Scroll the content** with your mouse / trackpad, slowly and steadily (scrolling back up is fine).
   - Or press **Auto-scroll** to let the app scroll and stop at the end → requires the **Accessibility** permission and the pointer over the content.
4. Press **Done** or **Esc** → the stitched image opens in the editor and is added to History (up to 30 000 px tall).
- Tips: avoid animated or auto-refreshing content; if you see a seam, scroll more slowly.

## 10. Screen recording & the video window
1. Press **`⌃⇧7`** and choose a **region** (drag), a **window** (click) or the **full screen**.
2. Options bar: format **MP4 / MOV / GIF** · quality (low / medium / high) · frame rate · codec **H.264 / HEVC** (Settings › Recording) · **Cursor** · **Show clicks** (yellow rings) · **Show keys** · **Microphone** · **System audio** · **Webcam** (a floating camera bubble in the video – drag it where you want, circle or rounded) · max length · what to do when done → press **Start recording** (3-second countdown).
3. A red frame surrounds the region (not part of the video) with a timer.
4. **Pause / Resume** any time · **Stop:** press *Stop* or `⌃⇧7` again · **✕** discards the recording.
5. The file is saved to `<save folder>/Recordings` (default `~/Pictures/CaptureME/Recordings`) as `<filename pattern> Recording.mp4|mov|gif`.
- *Window* recordings leave out click rings, key display and webcam · GIFs have no audio, cursor or webcam.
- Permissions asked when used: Microphone / **Camera** (webcam) / **Input Monitoring** (show keys) – see [PRIVACY.md](../PRIVACY.md). Without a mic or camera the video is recorded without it.

### The video window
Opens when a recording finishes (configurable) with two tabs: **Video** and **Recordings**.
- Play / pause `Space` · set start / end `I` / `O` · frame step `←` / `→` · reset trim.
- **Remove audio** · **Export MP4** (fast = no re-encode / precise = re-encode) · **Export GIF** (original or reduced size).
- **Copy file** (paste into Finder / chats) · Reveal in Finder · Move to Trash.

## 11. Settings
Menu-bar icon › **Settings…**
| Tab | What you can set |
|---|---|
| **General** | Language (ไทย/English) · after a capture (editor / thumbnail / copy / save) + thumbnail timeout · auto-copy · include cursor · window capture with shadow · colour-picker format · shutter sound · launch at login |
| **Save** | Destination folder · filename pattern (`{date}` `{time}` `{n}`) with preview · PNG/JPG/WebP · JPG quality |
| **Recording** | Format / frame rate / codec · system audio, microphone, click rings, keys, webcam (size/shape) · recordings folder · max length · what to do when done |
| **Hotkeys** | Click a field and press the new shortcut (needs ⌘ ⌃ or ⌥) · `Esc` cancels · ✕ disables a shortcut · reset to defaults |
| **History** | Maximum items · clear history · open the history window |
| **About** | Version · privacy statement · MIT licence · GitHub link · **Remove all CaptureME data…** (double confirmation) |

## 12. All shortcuts
### Global (changeable / disableable in Settings › Hotkeys)
| Action | Shortcut |
|---|---|
| Capture full screen | `⌃⇧1` |
| Capture region | `⌃⇧2` |
| Capture window | `⌃⇧3` |
| Repeat last region | `⌃⇧4` |
| Delayed capture | `⌃⇧5` |
| Scrolling capture | `⌃⇧6` |
| Record screen / stop | `⌃⇧7` |
| OCR | `⌃⇧8` |
| History | `⌃⇧9` |
| Pin region | `⌃⇧P` |
| Colour picker | `⌃⇧C` |
| Pixel ruler | `⌃⇧M` |
| QR / barcode reader | `⌃⇧Q` |
| Clipboard image → editor | `⌃⇧V` |

### Editor
`⌘Z` undo · `⇧⌘Z` redo · `⌘C` copy · `⌘S` save · `⇧⌘S` save as · `⌘↵` copy & close · `⌘D` duplicate · `⌘A` select all · `⌘G` group · `⌘V` paste image · `⌘+`/`⌘-`/`⌘0`/`⌘1` zoom · `⌘L`/`⌘R` rotate · `Delete` remove · `Esc` cancel/deselect · `?` help · tools: `V C A L R O P H T N Q Y U Z D B X S M E I` and `1`–`9`

> Having trouble? See [Troubleshooting](INSTALL-EN.md#troubleshooting) or open an issue at https://github.com/sitthichat/captureme/issues
