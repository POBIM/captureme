# CaptureME – user guide, tool by tool (English)

[ภาษาไทย](USER-GUIDE-TH.md) · [Install guide](INSTALL-EN.md) · [← README](../README.md)

> Every picture here is a **real window of the CaptureME app** (captured from the running app) placed on an empty desktop. The red numbered circles, red boxes and captions are only pointers we added. The sample content (a made-up coffee shop, in Thai) is authored by us – it contains nobody's real data.

## Contents
1. [Getting started](#1-getting-started)
2. [Capture](#2-capture) – region · window · fullscreen · repeat · delayed · selection tips · thumbnail
3. [The editor, tool by tool](#3-the-editor-tool-by-tool)
4. [Pin](#4-pin-to-screen)
5. [OCR](#5-ocr--read-text-from-an-image)
6. [QR · colour picker · pixel ruler](#6-qr--colour-picker--pixel-ruler)
7. [Annotate the clipboard / open an image file](#7-annotate-the-clipboard--open-an-image-file)
8. [Scrolling capture](#8-scrolling-capture)
9. [Screen recording & the video window](#9-screen-recording--the-video-window)
10. [History](#10-history)
11. [Settings](#11-settings)
12. [Privacy & removing your data](#12-privacy--removing-your-data)
13. [All shortcuts](#13-all-shortcuts)

---

## 1. Getting started
CaptureME lives in the **menu bar** (viewfinder icon, top right). There is no Dock icon.

![The app menu](images/en/i07-menu-bar-menu.webp)

1. **Click the icon** to open the menu – every tool is here (the grey text on the right is its shortcut).
2. Or **press a shortcut** from anywhere (see [section 13](#13-all-shortcuts)).
3. On first launch a welcome window asks for **Screen Recording** → see the [install guide](INSTALL-EN.md).

---

## 2. Capture
Press the shortcut or pick it from the menu. The screen **freezes** and a selection layer appears. **Esc** cancels any mode.

### 2.1 Capture a region — `⌃⇧2`
![Region capture](images/en/u01-capture-region.webp)

1. Press `⌃⇧2` and **drag** around what you need (**①** the size chip shows the pixel size of the result).
2. Adjust the frame **②**: drag corners/edges · `Space` + drag moves it · `Shift` makes a square · arrow keys nudge by 1 px (`Shift` = 10 px).
3. Toolbar **③**: **Confirm** (`Enter` or double-click) · **Copy** (`⌘C`) · **Pin** · **OCR** · **Cancel** (`Esc`).
4. The shot is saved to History, then handled as set in *Settings › General › After capture* (see [2.6](#26-after-capture-the-floating-thumbnail)).

### 2.2 Selection tips
![Pixel loupe](images/en/u02-capture-loupe.webp)

- The **pixel loupe ①** follows the mouse (15×15 px zoom + the HEX colour under the cursor) so you can land exactly on an edge · **②** live size.

![Size presets](images/en/u03-capture-presets.webp)

- **Presets ①** (bar at the bottom): *Free · 1:1 · 4:3 · 16:9 · 1280×720 · 1920×1080 · 800×600 · Custom…* – the aspect lock applies while drawing and resizing (16:9 selected above); fixed sizes are the **pixel** size of the output – just click to place the frame.

### 2.3 Capture a window — `⌃⇧3`
![Window capture](images/en/u04-capture-window.webp)

1. Press `⌃⇧3` and move over a window – a red outline with its name and size appears **①**.
2. **Click** to capture just that window (even if partly covered).
3. Turn on *Settings › General › Window capture with shadow* for a transparent drop shadow.

### 2.4 Capture the full screen — `⌃⇧1`
Captures the whole screen at once (the display under the mouse if you have several). No selection step.

### 2.5 Repeat last region — `⌃⇧4` · Delayed — `⌃⇧5`
- **Repeat last region** `⌃⇧4`: captures the last region/window again from the live screen without dragging (opens region mode if there is none yet).
- **Delayed** `⌃⇧5`: for menus and tooltips that vanish when you press a shortcut – a countdown appears mid-screen (5 s by shortcut; 3 / 5 / 10 s from the menu › Delayed capture), then region mode starts.

![Countdown](images/en/u05-delay-countdown.webp)

### 2.6 After capture: the floating thumbnail
*Settings › General › After capture* has 4 choices: **Open editor** (default) · **Show thumbnail** · **Copy only** · **Save file only**.

![Floating thumbnail](images/en/u06-thumbnail.webp)

The thumbnail floats at the bottom-right of the screen with **① Edit · ② Copy · ③ Save · ④ Pin · ⑤ Close (`Esc`)**. It fades after the configured time (0 = stays; it never fades while hovered) and you can **drag the image out** into Finder / Mail / chat.

---

## 3. The editor, tool by tool
Opens after a capture (or from History / the thumbnail) · press **`?`** for all shortcuts · `⌘Z` undo · `⇧⌘Z` redo

![Editor overview](images/en/e00-editor-overview.webp)

**① Tool bar** (click, or press the letter / `1`–`9`) · **② Style bar** of the current tool · **③ Canvas** (`Space` + drag pans · `⌘` + scroll zooms) · **④ Copy & close** `⌘↵`

One-key tools: `V` select/move · `C` crop · `A` arrow · `L` line · `R` rectangle · `O` ellipse · `P` pen · `H` highlighter · `T` text · `N` step counter · `Q` callout · `Y` marker box · `U` underline · `Z` measure · `D` redact · `B` blur · `X` pixelate · `S` spotlight · `M` magnifier · `E` emoji · `I` colour picker

### 3.1 Arrow — `A`
![Arrow](images/en/e01-arrow.webp)
1. Press `A` (①) and **drag from the start to where it should point**.
2. Pick a style in the style bar (②): **straight / curved / double / tapered** · colour · width · shadow.
3. `Shift` snaps the angle to 45°.

### 3.2 Line · Rectangle · Ellipse — `L` `R` `O`
![Shapes](images/en/e02-shapes.webp)
1. `R` rectangle / `O` ellipse / `L` line, then **drag** · `Shift` = proportional / straight.
2. Style bar: **outline / filled** · corner radius · colour · width · opacity.

### 3.3 Pen · Highlighter — `P` `H`
![Pen and highlighter](images/en/e03-pen.webp)
1. `P` freehand · `H` translucent highlighter (drag over text).
2. Adjust colour, width and opacity.

### 3.4 Text — `T`
![Text](images/en/e04-text.webp)
1. Press `T` and **click on the image** → type (Thai or English).
2. Style bar: **size · bold · background box · colour · shadow**.
3. Finish with `Esc` or `⌘↵`.

### 3.5 Step counter — `N`
![Step counter](images/en/e05-step.webp)
Click to drop 1, 2, 3… automatically – ideal for how-to screenshots. Styles: ●1 / ◯1 / ①.

### 3.6 Callout · Marker box · Underline — `Q` `Y` `U`
![Callout](images/en/e06-callout.webp)
- `Q` speech bubble with a pointer tail (double-click to edit the text) · `Y` highlighter box · `U` underline / strike-through / squiggle.

### 3.7 Redact · Blur · Pixelate — `D` `B` `X`
![Redact, blur, pixelate](images/en/e07-redact.webp)
1. Drag over what must not be seen: phone → **pixelate** · e-mail → **blur** · account number → **redact** (all three are used in this picture).
2. ⚠️ **Blur / pixelate** on small text can sometimes be reversed by software → for passwords, account numbers and personal data use **Redact**: a solid box that **cannot be recovered** (the app offers *Convert to redact* when you pick blur).

### 3.8 Spotlight — `S`
![Spotlight](images/en/e08-spotlight.webp)
Drag a frame around the important part → the rest dims (or switch to **blur outside** in the style bar). Adjust darkness / corner radius.

### 3.9 Magnifier — `M`
![Magnifier](images/en/e09-magnify.webp)
Drag a lens onto empty space, turn on **leader lines**, then drag the yellow dot to the area to enlarge (1.5×–6×).

### 3.10 Measure — `Z`
![Measure](images/en/e10-measure.webp)
Drag a measuring line – choose **ruler** or **dimension arrow**. Numbers are image pixels.

### 3.11 Crop — `C`
![Crop](images/en/e11-crop.webp)
1. Press `C` and **drag a frame** (aspect: free · 1:1 · 4:3 · 3:2 · 16:9 · 9:16).
2. `Enter` applies · `Esc` cancels · *Reset* restores the frame.

### 3.12 Background beautifier
![Background](images/en/e12-background.webp)
Click the background button in the top bar (①) → **Enable background** → pick a gradient / solid colour · adjust **padding · corner radius · shadow** for a post-ready look (here: padding 120, radius 28).

### 3.13 Watermark
![Watermark](images/en/e13-watermark.webp)
Watermark button (①) → enter text, choose corner or tiled, opacity, size, angle, colour · **Save preset** · it is applied **on export only** (tick *Add watermark on export*).

### 3.14 Padding & border · Resize · Rotate / flip
| | |
|---|---|
| ![Padding](images/en/e14-padding.webp) | **Padding / border** – padding, fill colour (or transparent), border width/colour, baked into the real pixels. |
| ![Resize](images/en/e15-resize.webp) | **Resize image / canvas** – change resolution (aspect lock) or enlarge the canvas. |
| ![Rotate and flip](images/en/e16-transform.webp) | **Rotate / flip** – 90° left/right (`⌘L` / `⌘R`), flip horizontal/vertical (`⇧⌘H` / `⇧⌘V`); drawn objects rotate with the image. |

### 3.15 Insert an image
![Insert image](images/en/e19-paste-image.webp)
Press `⌘V` to paste an image from the clipboard, or **drop an image file** onto the canvas – inserted images move/scale/rotate like any object (here a colour-swatch picture pasted on top).

### 3.16 Align · group · lock
![Align objects](images/en/e17-arrange.webp)
1. With `V`, select several objects (drag a frame / `Shift`+click) → the **Align** button at the right of the style bar: left/centre/right/top/middle/bottom and **distribute evenly**.
2. `⌘G` group · `⇧⌘G` ungroup · `⇧⌘L` lock · `⌘D` duplicate (or drag with `⌥`) · `⌘]` / `⌘[` bring forward / send back · `Delete` remove.

### 3.17 Export: copy · save · pin · OCR
![Export options](images/en/e18-export.webp)
- **Copy** `⌘C` · **Save** `⌘S` · **Save as…** `⇧⌘S` · **Copy & close** `⌘↵` · the **Pin** and **OCR** buttons are in the same bar.
- Export menu (①): **scale 50% / 100% / 200%** · save as JPEG · copy file path · show in Finder.
- `⌘W` closes – you are asked first if there are unsaved edits · the edited version is added to History automatically.

### 3.18 Help – every shortcut (`?`)
![Editor shortcuts](images/en/e20-shortcuts.webp)
Press `?` for the cheat-sheet · drag tool buttons to **reorder** the toolbar (the first nine are keys `1`–`9`) · reset the order on this page.

---

## 4. Pin to screen
![Pin](images/en/t01-pin.webp)
Keeps an image **floating above every window** – handy for reference while you work (this is a real pin window floating on the desktop).
1. Press `⌃⇧P` and drag a region (or use the **Pin** button in the selection bar / editor / thumbnail / History).
2. **Move:** drag the image · **opacity:** `⌥` + scroll · **close:** `Esc`
3. Buttons (hover the image): **Copy · Save · Edit · Close**

![Choosing the area to pin](images/en/u10-overlay-pin.webp)

---

## 5. OCR – read text from an image
![OCR area](images/en/u09-overlay-ocr.webp)
1. Press **`⌃⇧8`**, drag over the text → **Confirm**.
2. The recognised text (**Thai + English**) appears at the top right of the screen and is **already copied** to your clipboard.

![OCR result](images/en/t02-ocr-result.webp)

3. Press **① Copy text** to copy again · ✕ to close.
- Runs on your Mac with Apple Vision, nothing leaves the computer · also available from the editor (OCR button) and the selection bar.
- Tip: select just the text block, crisp and not too small · Thai needs macOS 14+.

---

## 6. QR · colour picker · pixel ruler
All three work on a "frozen picture of the screen from the moment you start" and exit with `Esc`.

### 6.1 Read QR / barcode — `⌃⇧Q`
![QR area](images/en/u11-overlay-qr.webp)
1. Press `⌃⇧Q` and drag over the QR code or barcode (include a little white margin) → **Read QR / barcode**.

![QR result](images/en/t03-qr-result.webp)

2. The text is **copied automatically** · for a link there is an **Open link** button that *always asks first* (links are never opened on their own).

### 6.2 Colour picker — `⌃⇧C`
![Colour picker](images/en/u12-overlay-color.webp)
1. Press `⌃⇧C` and move over a colour – the loupe **①** shows its code.
2. **Click** to copy it (HEX / RGB / HSL per Settings · press `F` to switch format) · `Shift`+click keeps picking · arrows nudge by 1 px.

![Recent colours](images/en/t04-colors-panel.webp)

3. The **Recent colors** window (keeps 30) – click a swatch to copy it again · open it from the menu › More tools › Recent colors…

### 6.3 Pixel ruler — `⌃⇧M`
![Pixel ruler](images/en/u13-overlay-measure.webp)
**Move** = auto-detects the object's edges and shows width × height (pt and px) · `↑`/`↓` edge sensitivity · **drag** = measure manually (with diagonal) · **click** = copy `W × H` · right-click = clear.

---

## 7. Annotate the clipboard / open an image file
- **`⌃⇧V`** – opens the image currently in your clipboard in the editor (saved to History as PNG; the original is never altered).
- **Menu › Open image…**, or **drop an image file onto an editor window** – PNG / JPG / WebP / GIF / HEIC / TIFF / BMP.

---

## 8. Scrolling capture
Stitches a long web page / document / chat into one image (up to 30,000 px).

![Choosing the scroll area](images/en/u07-overlay-scroll.webp)

1. Press **`⌃⇧6`**, drag over the scrollable content → **Start scroll capture (①)**.

![Scroll control window](images/en/t05-scroll-control.webp)

2. A blue frame appears around the area together with this control window and a live preview (height / frames).
3. **Scroll the content** slowly and steadily with the mouse/trackpad (pinned headers/footers are skipped automatically) – or switch on **Auto-scroll** and let the app scroll (needs **Accessibility** permission, and the mouse must hover the content).
4. Click **Done** or press `Esc` → the stitched image opens in the editor and is saved to History.
- Tip: avoid content that moves or refreshes by itself · slow down if you see seams.
- *The control window above is the real app window, but its 3,420 px sample is demo data (we did not scroll a real screen while taking the picture).*

---

## 9. Screen recording & the video window
![Choosing the recording area](images/en/u08-overlay-record.webp)

1. Press **`⌃⇧7`** and choose a **region** (drag), a **window** (click) or the **whole screen** (menu › Record full screen) → **Start recording**.

![Recording setup bar](images/en/t06-record-setup.webp)

2. Options: **MP4 / MOV / GIF** · frame rate · quality · **cursor** · **show clicks** (rings at clicks) · **show keys** · **microphone** · **system audio** · **webcam** (a floating camera bubble in the video; draggable, circle/rounded) · countdown · time limit · what to do when finished → **Start recording**.
   - *The webcam is not switched on in this picture for privacy – the camera/microphone options ask macOS for permission the first time you enable them.*

![Recording bar](images/en/t07-record-bar.webp)

3. While recording there is a red frame around the area (not in the video) and this bar: time · **pause/resume** (`Space`) · **Stop** (or `⌃⇧7` again) · 🗑 discard.
4. Files go to `<save folder>/Recordings` (default `~/Pictures/CaptureME/Recordings`).
- Recording a *window* excludes click rings / keys / webcam · GIF has no sound, cursor or camera.
- No mic/camera, or permission denied → recording continues without it (see [PRIVACY.md](../PRIVACY.md#english)).

### The video window: trim · export MP4 / GIF
![Video window](images/en/t08-video-window.webp)
Opens automatically when a recording ends (configurable) with two tabs: **Video** and **Recordings**.
1. Play/pause `Space` · **trim start `I` / end `O`** · frame step `←` `→` · reset trim.
2. **Remove audio** · **Export MP4** (fast = no re-encode / precise = re-encode) · **Export GIF** (original size or smaller).
3. **Copy file** (paste into Finder/chat) · show in Finder · move to Trash.

---

## 10. History — `⌃⇧9`
![History](images/en/t09-history.webp)
- Every capture, grouped by day (Today / Yesterday / …), with an **Edited** badge on edited ones · filter by date at the top.
- Per item: **open in editor · copy · show in Finder · pin · delete**.
- **Select several** → all / a whole day → delete selected.
- The maximum (default 200, newest first) and **Clear all history** are in *Settings › History*.

---

## 11. Settings
Menu-bar icon › **Settings…** (the windows below are shown in Thai – switch to English under General).

### General – language · after-capture action
![Settings: General](images/en/s-general.webp)
Language (Thai/English) · after-capture action + thumbnail time · auto-copy to clipboard · include cursor · window shadow · colour format · shutter sound · launch at login.

### Save – folder and file names
![Settings: Save](images/en/s-save.webp)
Destination folder · filename pattern (`{date}` `{time}` `{n}`) with a live example · file type PNG / JPG / WebP · JPG quality.

### Hotkeys – set your own
![Settings: Hotkeys](images/en/s-hotkeys.webp)
1. Click the field of an action and **press the new shortcut** (needs ⌘ ⌃ or ⌥) · `Esc` cancels.
2. **✕** disables that shortcut · reset to defaults at the end of the list.

### Video · History · About
| | |
|---|---|
| ![Settings: Video](images/en/s-recording.webp) | **Video** – format / fps / quality / codec (H.264 · HEVC) · system audio, mic, show clicks/keys, webcam · video folder · time limit. |
| ![Settings: History](images/en/s-history.webp) | **History** – maximum entries · clear all · open History. |
| ![Settings: About](images/en/s-about.webp) | **About** – version · privacy statement · MIT licence · GitHub link · **Delete all data**. |

---

## 12. Privacy & removing your data
- **No internet at all**, no telemetry, no account · captures, history and settings stay on your Mac.
- Delete shots one by one / all in **History** and *Settings › History › Clear all history*.
- Delete **all CaptureME data** (history, settings, picked colours…) at *Settings › About › Delete all CaptureME data…* (double confirmation) – details and uninstall steps in [PRIVACY.md](../PRIVACY.md#english).

---

## 13. All shortcuts
### System-wide (change/disable in Settings › Hotkeys)
| Action | Shortcut |
|---|---|
| Capture full screen | `⌃⇧1` |
| Capture region | `⌃⇧2` |
| Capture window | `⌃⇧3` |
| Repeat last region | `⌃⇧4` |
| Delayed capture (5 s) | `⌃⇧5` |
| Scrolling capture | `⌃⇧6` |
| Record screen / stop | `⌃⇧7` |
| OCR | `⌃⇧8` |
| History | `⌃⇧9` |
| Pin a region | `⌃⇧P` |
| Colour picker | `⌃⇧C` |
| Pixel ruler | `⌃⇧M` |
| QR / barcode reader | `⌃⇧Q` |
| Clipboard image → editor | `⌃⇧V` |

### Editor
`⌘Z` undo · `⇧⌘Z` redo · `⌘C` copy · `⌘S` save · `⇧⌘S` save as · `⌘↵` copy & close · `⌘D` duplicate · `⌘A` select all · `⌘G` group · `⌘V` paste image · `⌘+`/`⌘-`/`⌘0`/`⌘1` zoom · `⌘L`/`⌘R` rotate · `Delete` remove · `Esc` cancel · `?` help · tools: `V C A L R O P H T N Q Y U Z D B X S M E I` and `1`–`9`

> Problems? See [Troubleshooting](INSTALL-EN.md#troubleshooting) or open an issue at https://github.com/POBIM/captureme/issues
