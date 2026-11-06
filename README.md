<img src="assets/icon.svg" width="64" height="64" alt="">

# CaptureME

Menu-bar screenshot & annotation app for macOS (Apple Silicon) – built with **Tauri 2** (Rust) and a **Vite + TypeScript** front end.
แอปจับภาพหน้าจอและวาดไฮไลต์บน menu bar ของ macOS (Apple Silicon)

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

### Features
- **Region / window / full-screen capture** with a frozen overlay, multi-monitor and Retina aware
- **Delayed capture** (timer) for menus and tooltips
- **Editor** – arrows, shapes, text, blur/pixelate, highlighter, numbered steps, crop, undo/redo; copy / save / pin
- **Scrolling capture** – select a region, scroll the content (or use *Auto-scroll*); frames are stitched automatically (sticky headers/footers are ignored) up to 30 000 px tall, with a live preview
- **Screen recording** – MP4, MOV or GIF of a selected region; optional cursor, click highlights and microphone (video); 10–15 fps GIF
- **OCR** – recognise text in any region (Vision framework, Thai + English) and copy it
- **Pin to screen** – keep a screenshot floating above other windows
- **History** – every capture is kept and can be re-opened, edited or deleted
- Thai / English UI, launch at login, configurable shortcuts

### Default shortcuts
| Action | Shortcut |
|---|---|
| Full screen | `⌘⇧1` |
| Region | `⌘⇧2` |
| Window | `⌘⇧3` |
| Delayed capture | `⌘⇧6` |
| **Scrolling capture** | `⌘⇧7` |
| **Record screen** (press again to stop) | `⌘⇧8` |
| OCR | `⌘⇧9` |
| History | `⌘⇧0` |

All shortcuts can be changed in **Settings**.

### Scrolling capture
1. Press `⌘⇧7` (or choose it from the menu-bar icon) and drag a region around the scrollable content.
2. A dashed blue frame marks the region and a small control window shows the live preview. Scroll the content with your mouse / trackpad – the window never blocks the scroll.
3. Press **Done** or **Esc**. The stitched PNG opens in the editor and is added to the history.
- *Auto-scroll* scrolls for you and stops at the end of the page (requires the **Accessibility** permission).
- Tips: scroll steadily downwards; scrolling back up is fine. Animated or auto-refreshing content may stitch badly.

### Screen recording
1. Press `⌘⇧8`, drag a region. An options bar appears: **MP4 / MOV / GIF**, GIF fps, cursor, show clicks, microphone, then **Start** (3-second countdown).
2. A red frame marks the recording region (it is not part of the video). Use **Stop** or press `⌘⇧8` again to finish; **✕** discards.
3. The file is saved to your *save folder* (Settings) as `<filename pattern> Recording.mp4|mov|gif` and revealed in Finder.
- MP4/MOV use macOS's own recorder (`screencapture -v`), so audio and click highlighting are exactly like the system recorder. MP4 is remuxed from the QuickTime recording without re-encoding.
- GIF frames are captured at the chosen fps, downscaled to max 960 px wide and encoded on the fly; unchanged frames are merged to keep files small. GIFs have no audio and no cursor.

### Install
**From the DMG** – open `CaptureME_<version>_aarch64.dmg`, drag *CaptureME* to *Applications*. The app is signed ad-hoc, so the first launch needs *right-click ▸ Open* (or `xattr -dr com.apple.quarantine /Applications/CaptureME.app`).

**Build it yourself** (macOS, Apple Silicon, Xcode command-line tools, [Rust](https://rustup.rs), Node.js 20+):
```bash
git clone <repo> && cd captureme
scripts/build-installer.sh            # → release/CaptureME_<version>_aarch64.dmg
scripts/build-installer.sh --universal  # Apple Silicon + Intel
scripts/install-local.sh              # build (if needed) + copy to /Applications + clear quarantine
scripts/install-local.sh --rebuild --reset-permissions
```
Developing: `npm ci && npm run tauri dev`. Checks: `npm run build` and `cd src-tauri && cargo build`.

**Signing & notarisation (optional)** – set these environment variables before `build-installer.sh`:
| Variable | Meaning |
|---|---|
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` – otherwise an ad-hoc signature is used |
| `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_PASSWORD` | Apple ID, team id and an *app-specific password* – when all are set the build is notarised and stapled |

### Permissions
CaptureME is a menu-bar app (no Dock icon). macOS asks for:
- **Screen & System Audio Recording** – required for all captures and recordings (System Settings ▸ Privacy & Security).
- **Accessibility** – only for *Auto-scroll* in scrolling capture.
- **Microphone** – only when you record with the microphone.

### Troubleshooting
| Problem | Fix |
|---|---|
| Screenshots are black / only show the desktop | Enable CaptureME under *Screen & System Audio Recording*, then quit and restart the app. |
| Permission enabled but still not working after an update | Ad-hoc builds get a new signature each time: `scripts/install-local.sh --reset-permissions` (or `tccutil reset ScreenCapture com.sitthichat.captureme`), then grant it again. |
| "CaptureME is damaged / can't be opened" | `xattr -dr com.apple.quarantine /Applications/CaptureME.app`, or right-click ▸ Open. |
| Recording shows "No capture audio device" / no sound | No microphone is available – the video is recorded without audio. Check *Microphone* permission. |
| Auto-scroll does nothing | Allow CaptureME in *Accessibility*; the pointer must be over the content. |
| Stitched image has a seam / duplicates | Scroll more slowly and steadily; avoid animated content; make the region cover only the scrolling area. |
| Hotkey does nothing | Another app may use the same shortcut – change it in Settings. |
| DMG build fails with a Finder/AppleScript error | Run the script from a logged-in desktop session; it falls back to a plain `hdiutil` DMG automatically. |

---

## ภาษาไทย

### ฟีเจอร์
- **จับภาพพื้นที่ / หน้าต่าง / เต็มจอ** รองรับหลายจอและ Retina
- **จับภาพหน่วงเวลา** สำหรับเมนูและ tooltip
- **ตัวแก้ไขภาพ** – ลูกศร รูปทรง ข้อความ เบลอ ไฮไลต์ ลำดับเลข ครอป undo/redo คัดลอก/บันทึก/ปักหมุด
- **สกรอลล์จับภาพ** – เลือกพื้นที่แล้วเลื่อนเนื้อหา (หรือใช้ *เลื่อนอัตโนมัติ*) แอปต่อภาพให้เองโดยไม่นับส่วนหัว/ท้ายที่ตรึงอยู่ สูงสุด 30,000 พิกเซล มีภาพตัวอย่างสด
- **บันทึกหน้าจอ** – MP4, MOV หรือ GIF ของพื้นที่ที่เลือก ตั้งค่าเคอร์เซอร์ การแสดงคลิก และไมโครโฟนได้ (วิดีโอ) GIF 10–15 fps
- **OCR** – อ่านข้อความจากภาพ (ไทย + อังกฤษ) แล้วคัดลอก
- **ปักหมุดภาพ** ไว้บนหน้าจอ
- **ประวัติ** – ทุกภาพถูกเก็บไว้ เปิดแก้ไขหรือลบได้
- ภาษาไทย/อังกฤษ เปิดอัตโนมัติเมื่อเข้าสู่ระบบ ปรับคีย์ลัดได้

### คีย์ลัดเริ่มต้น
| การทำงาน | คีย์ลัด |
|---|---|
| เต็มจอ | `⌘⇧1` |
| พื้นที่ | `⌘⇧2` |
| หน้าต่าง | `⌘⇧3` |
| จับภาพหน่วงเวลา | `⌘⇧6` |
| **สกรอลล์จับภาพ** | `⌘⇧7` |
| **บันทึกหน้าจอ** (กดอีกครั้งเพื่อหยุด) | `⌘⇧8` |
| OCR | `⌘⇧9` |
| ประวัติ | `⌘⇧0` |

### วิธีใช้สกรอลล์จับภาพ
1. กด `⌘⇧7` แล้วลากเลือกพื้นที่ที่มีเนื้อหาให้เลื่อน
2. กรอบสีน้ำเงินประ ๆ แสดงพื้นที่ และหน้าต่างควบคุมเล็ก ๆ แสดงภาพตัวอย่าง เลื่อนเนื้อหาด้วยเมาส์/แทร็กแพดได้ตามปกติ
3. กด **เสร็จสิ้น** หรือ **Esc** ภาพที่ต่อแล้วจะเปิดในตัวแก้ไขและบันทึกในประวัติ
- *เลื่อนอัตโนมัติ* จะเลื่อนให้และหยุดเองเมื่อสุดหน้า (ต้องอนุญาต **Accessibility**)

### วิธีใช้บันทึกหน้าจอ
1. กด `⌘⇧8` แล้วลากเลือกพื้นที่ จะมีแถบตัวเลือก: **MP4 / MOV / GIF**, fps ของ GIF, เคอร์เซอร์, แสดงคลิก, ไมโครโฟน แล้วกด **เริ่มบันทึก** (นับถอยหลัง 3 วินาที)
2. กรอบสีแดงแสดงพื้นที่บันทึก (ไม่ติดไปในวิดีโอ) กด **หยุด** หรือกด `⌘⇧8` อีกครั้งเพื่อจบ ปุ่ม **✕** คือทิ้งการบันทึก
3. ไฟล์จะถูกบันทึกในโฟลเดอร์ที่ตั้งไว้ใน ตั้งค่า และเปิดใน Finder ให้

### การติดตั้ง
**จากไฟล์ DMG** – เปิด `CaptureME_<version>_aarch64.dmg` แล้วลาก *CaptureME* ไปที่ *Applications* แอปเซ็นแบบ ad-hoc ครั้งแรกให้คลิกขวา ▸ เปิด (หรือ `xattr -dr com.apple.quarantine /Applications/CaptureME.app`)

**สร้างเอง** (ต้องมี Xcode command-line tools, Rust, Node.js 20+):
```bash
scripts/build-installer.sh              # → release/CaptureME_<version>_aarch64.dmg
scripts/build-installer.sh --universal  # รองรับทั้ง Apple Silicon และ Intel
scripts/install-local.sh                # สร้าง (ถ้ายังไม่มี) + ติดตั้งลง /Applications
scripts/install-local.sh --rebuild --reset-permissions
```
สำหรับนักพัฒนา: `npm ci && npm run tauri dev`

**เซ็นชื่อ + Notarize (ไม่บังคับ)** ตั้งตัวแปร `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_PASSWORD` (app-specific password) ก่อนรันสคริปต์

### สิทธิ์ที่ต้องอนุญาต
- **Screen & System Audio Recording** (บันทึกหน้าจอและเสียงระบบ) – จำเป็นสำหรับการจับภาพ/บันทึกทุกชนิด
- **Accessibility** – ใช้เฉพาะ *เลื่อนอัตโนมัติ*
- **Microphone** – ใช้เฉพาะเมื่อบันทึกพร้อมไมโครโฟน

### แก้ปัญหา
| ปัญหา | วิธีแก้ |
|---|---|
| ภาพที่จับเป็นสีดำ/เห็นแค่วอลเปเปอร์ | เปิดสิทธิ์ Screen Recording ให้ CaptureME แล้วปิด-เปิดแอปใหม่ |
| อนุญาตแล้วแต่ยังใช้ไม่ได้หลังอัปเดต | บิลด์แบบ ad-hoc ลายเซ็นเปลี่ยนทุกครั้ง: รัน `scripts/install-local.sh --reset-permissions` แล้วอนุญาตใหม่ |
| ขึ้นว่าแอปเสียหาย/เปิดไม่ได้ | `xattr -dr com.apple.quarantine /Applications/CaptureME.app` หรือคลิกขวา ▸ เปิด |
| บันทึกแล้วไม่มีเสียง | ไม่พบไมโครโฟนหรือยังไม่อนุญาตสิทธิ์ Microphone |
| ภาพสกรอลล์มีรอยต่อ/ซ้ำ | เลื่อนให้ช้าและสม่ำเสมอ เลือกเฉพาะส่วนที่เลื่อน หลีกเลี่ยงเนื้อหาที่เคลื่อนไหว |

---
Created in [T3 Code](https://t3.codes).
