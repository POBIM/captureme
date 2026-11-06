# Privacy Policy · นโยบายความเป็นส่วนตัว

*Last updated / ปรับปรุงล่าสุด: 2026 · Applies to every version of CaptureME*

[ภาษาไทย](#ภาษาไทย) · [English](#english)

---

## ภาษาไทย

**สรุปสั้น ๆ: CaptureME ไม่เก็บข้อมูลของคุณ ไม่ส่งข้อมูลออกจากเครื่อง และไม่ใช้อินเทอร์เน็ตเลย**

### คำสัญญาของเรา
- ❌ **ไม่เก็บข้อมูลส่วนตัว** – ไม่มีบัญชีผู้ใช้ ไม่ต้องลงทะเบียน ไม่ต้องล็อกอิน
- ❌ **ไม่มี telemetry / analytics / crash report** – ไม่มีการนับว่าใครใช้อะไร
- ❌ **ไม่มีโฆษณา** และไม่มี SDK ของบุคคลที่สาม
- ❌ **ไม่ใช้เครือข่าย** – แอปไม่มีโค้ดสำหรับเชื่อมต่ออินเทอร์เน็ต ไม่มีระบบอัปเดตอัตโนมัติ ไม่ส่งภาพ/ข้อความ OCR ไปที่ใด (OCR ใช้ Apple Vision ที่ประมวลผลบนเครื่อง)
- ✅ **ข้อมูลทั้งหมดอยู่บนเครื่องของคุณ** และคุณลบได้ทุกเมื่อ
- ✅ **โอเพนซอร์ส (MIT)** – ตรวจสอบซอร์สโค้ดเองได้ที่ https://github.com/sitthichat/captureme

> หมายเหตุ: ตอนเปิดแอปครั้งแรก macOS เองอาจตรวจสอบแอปกับ Apple (Gatekeeper) นั่นเป็นการทำงานของระบบปฏิบัติการ ไม่ใช่ของ CaptureME

### ข้อมูลที่เก็บไว้ในเครื่อง และตำแหน่ง
| ข้อมูล | ตำแหน่ง |
|---|---|
| ภาพที่จับ (PNG) + ประวัติ | `~/Library/Application Support/com.sitthichat.captureme/` (โฟลเดอร์ `captures`, `history`) |
| การตั้งค่า (`settings.json`) และสถานะการใช้งานครั้งแรก | `~/Library/Application Support/com.sitthichat.captureme/` |
| ไฟล์ชั่วคราว (ระหว่างบันทึกวิดีโอ/ต่อภาพ) และแคช | `~/Library/Caches/com.sitthichat.captureme/` |
| รายการวิดีโอที่บันทึก (`recordings.json`) และสีที่เคยดูด | `~/Library/Application Support/com.sitthichat.captureme/` |
| ไฟล์ที่คุณสั่ง *บันทึก* (ภาพ/วิดีโอ/GIF) | โฟลเดอร์ที่ตั้งไว้ใน ตั้งค่า › บันทึก – ค่าเริ่มต้น `~/Pictures/CaptureME` (วิดีโออยู่ใน `…/Recordings`) |
| ข้อมูลของ WebView (ค่าภาษา/UI) | `~/Library/WebKit/com.sitthichat.captureme/` |
| ตัวเปิดอัตโนมัติ (เฉพาะเมื่อคุณเปิด "เปิดเมื่อเข้าสู่ระบบ") | `~/Library/LaunchAgents/CaptureME.plist` |

ข้อความที่ได้จาก OCR จะอยู่ในหน่วยความจำและคลิปบอร์ดเมื่อคุณกดคัดลอกเท่านั้น ไม่ถูกบันทึกลงดิสก์โดยแอป

### สิทธิ์ของ macOS ที่ใช้ และเหตุผล
| สิทธิ์ | ใช้เมื่อ | เหตุผล |
|---|---|---|
| **Screen & System Audio Recording** (การบันทึกหน้าจอ) | จับภาพ, OCR, สกรอลล์จับภาพ, บันทึกหน้าจอ | macOS บังคับให้ขอสิทธิ์ก่อนอ่านภาพหน้าจอ ใช้เฉพาะตอนคุณกดจับภาพ |
| **Accessibility** (การช่วยการเข้าถึง) | *เฉพาะ* ปุ่ม "เลื่อนอัตโนมัติ" ในสกรอลล์จับภาพ | ส่งเหตุการณ์เลื่อนเมาส์ไปยังหน้าต่างที่คุณเลือก ถ้าไม่ใช้ฟีเจอร์นี้ ไม่ต้องอนุญาต |
| **Microphone** (ไมโครโฟน) | *เฉพาะ* เมื่อคุณเปิด "ไมโครโฟน" ตอนบันทึกวิดีโอ | บันทึกเสียงพูดของคุณลงในวิดีโอ ไม่มีการเปิดไมค์ในกรณีอื่น |
| **Camera** (กล้อง) | *เฉพาะ* เมื่อคุณเปิด "กล้องเว็บแคม" ตอนบันทึกวิดีโอ | แสดงวงกล้องลอยซึ่งรวมอยู่ในวิดีโอ ภาพจากกล้องไม่ถูกเก็บแยกและไม่ถูกส่งไปที่ใด |
| **Input Monitoring** (การติดตามอินพุต) | *เฉพาะ* เมื่อคุณเปิด "แสดงปุ่มที่กด" ตอนบันทึกวิดีโอ | แสดงปุ่มที่คุณกดบนวิดีโอขณะบันทึกเท่านั้น ไม่มีการบันทึกลงไฟล์ตัวอักษรหรือส่งออก (ปิดไว้เป็นค่าเริ่มต้น) |
| **Files / Pictures folder** | ตอนบันทึกไฟล์ | เขียนไฟล์ลงโฟลเดอร์ที่คุณเลือก |

คุณเพิกถอนสิทธิ์ได้ทุกเมื่อที่ **ตั้งค่าระบบ › ความเป็นส่วนตัวและความปลอดภัย**

### วิธีลบข้อมูลทั้งหมด / ถอนการติดตั้ง
1. ในแอป: **ตั้งค่า › เกี่ยวกับ › ลบข้อมูลทั้งหมด…** (ลบประวัติ การตั้งค่า แคช และข้อมูล WebView ปิดการเปิดอัตโนมัติ แล้วปิดแอป – ไฟล์ที่คุณบันทึกไว้ในโฟลเดอร์ของคุณจะไม่ถูกแตะต้อง) หรือเลือกลบเฉพาะประวัติที่ **ตั้งค่า › ประวัติ › ล้างประวัติ**
2. ปิดแอป (ไอคอนบนแถบเมนู › *ออกจาก CaptureME*) แล้วลากแอปไปถังขยะ: `/Applications/CaptureME.app`
3. ลบข้อมูลที่เหลือ (Terminal):
   ```bash
   rm -rf ~/Library/Application\ Support/com.sitthichat.captureme \
          ~/Library/Caches/com.sitthichat.captureme \
          ~/Library/WebKit/com.sitthichat.captureme \
          ~/Library/LaunchAgents/CaptureME.plist \
          ~/Library/Preferences/com.sitthichat.captureme.plist \
          ~/Library/Saved\ Application\ State/com.sitthichat.captureme.savedState
   ```
4. ภาพที่คุณบันทึกไว้ใน `~/Pictures/CaptureME` เป็นไฟล์ของคุณ – ลบเองได้ตามต้องการ
5. (ไม่บังคับ) ล้างสิทธิ์: `tccutil reset All com.sitthichat.captureme`

### การติดต่อ / ปัญหาด้านความเป็นส่วนตัว
เปิด Issue ที่ https://github.com/sitthichat/captureme/issues – หากมีการเปลี่ยนแปลงนโยบายนี้ จะแจ้งในไฟล์นี้และใน release notes

---

## English

**In short: CaptureME collects nothing, sends nothing, and never uses the internet.**

### Our promise
- ❌ **No personal data collected** – no account, no sign-up, no login.
- ❌ **No telemetry, analytics or crash reporting.**
- ❌ **No ads** and no third-party SDKs.
- ❌ **No network access at all** – the app contains no code that connects to the internet, has no auto-updater, and never uploads images or OCR text. OCR runs on-device with Apple's Vision framework.
- ✅ **Everything stays on your Mac** and you can delete it at any time.
- ✅ **Open source (MIT)** – read the code at https://github.com/sitthichat/captureme

> Note: when you first open the app, macOS itself may check it with Apple (Gatekeeper). That is the operating system, not CaptureME.

### What is stored locally, and where
| Data | Location |
|---|---|
| Captured images (PNG) + history | `~/Library/Application Support/com.sitthichat.captureme/` (`captures`, `history`) |
| Settings (`settings.json`) and first-run flag | `~/Library/Application Support/com.sitthichat.captureme/` |
| Temporary files (during recording / stitching) and caches | `~/Library/Caches/com.sitthichat.captureme/` |
| List of recorded videos (`recordings.json`) and recently picked colours | `~/Library/Application Support/com.sitthichat.captureme/` |
| Files you explicitly *save* (images / videos / GIFs) | the folder set in Settings › Save – default `~/Pictures/CaptureME` (videos go to `…/Recordings`) |
| WebView data (UI preferences) | `~/Library/WebKit/com.sitthichat.captureme/` |
| Login item (only if you enable *Launch at login*) | `~/Library/LaunchAgents/CaptureME.plist` |

Text recognised by OCR lives in memory and on the clipboard only when you copy it; the app does not write it to disk.

### macOS permissions and why
| Permission | Used when | Why |
|---|---|---|
| **Screen & System Audio Recording** | capture, OCR, scrolling capture, screen recording | macOS requires it before any app can read screen pixels. Used only when you trigger a capture. |
| **Accessibility** | *only* the "Auto-scroll" button in scrolling capture | Sends scroll-wheel events to the window you selected. Not needed otherwise. |
| **Microphone** | *only* if you switch on "Microphone" when recording video | Adds your voice to the recording. The mic is never opened otherwise. |
| **Camera** | *only* if you switch on "Webcam" when recording video | Shows a floating camera bubble that becomes part of the video. Camera frames are neither stored separately nor sent anywhere. |
| **Input Monitoring** | *only* if you switch on "Show keys" when recording video | Draws the keys you press onto the video while recording. Nothing is logged to a file or sent out (off by default). |
| **Files / Pictures folder** | when saving | Writes files to the folder you choose. |

You can revoke any permission at any time in **System Settings › Privacy & Security**.

### Delete all data / uninstall
1. In the app: **Settings › About › Remove all data…** (deletes history, settings, caches and WebView data, turns off launch-at-login and quits – files you saved in your own folders are never touched). Or only clear history with **Settings › History › Clear history**.
2. Quit the app (menu-bar icon › *Quit CaptureME*) and move `/Applications/CaptureME.app` to the Trash.
3. Remove the remaining data (Terminal):
   ```bash
   rm -rf ~/Library/Application\ Support/com.sitthichat.captureme \
          ~/Library/Caches/com.sitthichat.captureme \
          ~/Library/WebKit/com.sitthichat.captureme \
          ~/Library/LaunchAgents/CaptureME.plist \
          ~/Library/Preferences/com.sitthichat.captureme.plist \
          ~/Library/Saved\ Application\ State/com.sitthichat.captureme.savedState
   ```
4. Images you saved to `~/Pictures/CaptureME` are your files – delete them if you wish.
5. (Optional) reset permissions: `tccutil reset All com.sitthichat.captureme`

### Contact / privacy questions
Open an issue at https://github.com/sitthichat/captureme/issues. Any change to this policy will be written in this file and in the release notes.
