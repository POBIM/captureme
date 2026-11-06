// Round 2 (Agent E): new tools, privacy/about, after-capture options. Keys are prefixed `more.`
// (plus the extra hotkey action names `cap.act.*` used by the onboarding cheat-sheet).
export const more: Record<string, { th: string; en: string }> = {
  // ---- hotkey action names (onboarding) ----
  "cap.act.repeat": { th: "จับภาพพื้นที่เดิมซ้ำ", en: "Repeat last region" },
  "cap.act.pin": { th: "ปักหมุดพื้นที่บนหน้าจอ", en: "Pin region to screen" },
  "cap.act.color": { th: "ดูดสีจากหน้าจอ", en: "Color picker" },
  "cap.act.measure": { th: "ไม้บรรทัดพิกเซล", en: "Pixel ruler" },
  "cap.act.qr": { th: "อ่าน QR / บาร์โค้ด", en: "QR / barcode reader" },
  "cap.act.clipboard": { th: "เขียนกำกับรูปจากคลิปบอร์ด", en: "Annotate clipboard image" },

  // ---- hotkey names (settings) ----
  "more.hk.repeat": { th: "จับภาพพื้นที่เดิมซ้ำ", en: "Repeat last region" },
  "more.hk.pin": { th: "ปักหมุดพื้นที่บนหน้าจอ", en: "Pin region to screen" },
  "more.hk.color": { th: "ดูดสีจากหน้าจอ", en: "Color picker" },
  "more.hk.measure": { th: "ไม้บรรทัดพิกเซล (วัดขนาด)", en: "Pixel ruler (measure)" },
  "more.hk.qr": { th: "อ่าน QR / บาร์โค้ด", en: "QR / barcode reader" },
  "more.hk.clipboard": { th: "เขียนกำกับรูปจากคลิปบอร์ด", en: "Annotate clipboard image" },
  "more.set.hk.clear": { th: "ปิดปุ่มลัดนี้", en: "Disable this shortcut" },
  "more.set.hk.off": { th: "ปิดอยู่", en: "Off" },

  // ---- settings: general ----
  "more.set.afterAction": { th: "การทำงานหลังจับภาพ", en: "After a capture" },
  "more.set.afterAction.hint": { th: "เลือกสิ่งที่เกิดขึ้นทันทีหลังจับภาพเสร็จ", en: "What happens right after a screenshot is taken" },
  "more.set.after.editor": { th: "เปิดตัวแก้ไขภาพ", en: "Open the editor" },
  "more.set.after.thumbnail": { th: "แสดงภาพย่อมุมจอ", en: "Show a floating thumbnail" },
  "more.set.after.copy": { th: "คัดลอกอย่างเดียว", en: "Copy to clipboard only" },
  "more.set.after.save": { th: "บันทึกไฟล์อย่างเดียว", en: "Save to folder only" },
  "more.set.thumbSecs": { th: "ภาพย่อหายเองใน (วินาที)", en: "Thumbnail disappears after (seconds)" },
  "more.set.thumbSecs.hint": { th: "0 = ค้างไว้จนกว่าจะปิดเอง", en: "0 = stay until dismissed" },
  "more.set.captureOptions": { th: "ตัวเลือกการจับภาพ", en: "Capture options" },
  "more.set.cursor": { th: "รวมเคอร์เซอร์เมาส์ในภาพ", en: "Include the mouse cursor" },
  "more.set.cursor.hint": { th: "ใช้กับการจับภาพพื้นที่ / เต็มจอ", en: "Applies to region and full-screen captures" },
  "more.set.shadow": { th: "จับภาพหน้าต่างพร้อมเงา", en: "Window capture with shadow" },
  "more.set.shadow.hint": { th: "เพิ่มเงาของหน้าต่างบนพื้นหลังโปร่งใส", en: "Keeps the window's drop shadow on a transparent background" },
  "more.set.colorFormat": { th: "รูปแบบสีที่ดูด", en: "Color picker format" },

  // ---- overlay: presets bar ----
  "more.preset.title": { th: "ขนาดและอัตราส่วน", en: "Size and aspect ratio" },
  "more.preset.free": { th: "อิสระ", en: "Free" },
  "more.preset.custom": { th: "กำหนดเอง…", en: "Custom…" },
  "more.preset.width": { th: "กว้าง (พิกเซล)", en: "Width (pixels)" },
  "more.preset.height": { th: "สูง (พิกเซล)", en: "Height (pixels)" },
  "more.tb.start_qr": { th: "อ่าน QR / บาร์โค้ด", en: "Read QR / barcode" },
  "more.badge.qr": { th: "QR", en: "QR" },
  "cap.hint.qr": { th: "ลากเลือกพื้นที่ที่มี QR หรือบาร์โค้ด · Esc ยกเลิก", en: "Select the area containing a QR code or barcode · Esc to cancel" },

  // ---- colour picker ----
  "more.color.hint": { th: "คลิกเพื่อคัดลอกสี · Shift+คลิก เลือกต่อเนื่อง · Esc ออก", en: "Click to copy the color · Shift+click keeps picking · Esc to exit" },
  "more.color.keys": { th: "F สลับรูปแบบ · ลูกศร ขยับทีละพิกเซล · Enter เลือก", en: "F switches format · arrows nudge 1 px · Enter picks" },
  "more.color.copied": { th: "คัดลอกแล้ว", en: "Copied" },
  "more.colors.title": { th: "สีที่เลือกล่าสุด", en: "Recent colors" },
  "more.colors.format": { th: "รูปแบบสี", en: "Color format" },
  "more.colors.copy": { th: "คลิกเพื่อคัดลอก", en: "Click to copy" },
  "more.colors.copied": { th: "คัดลอกแล้ว", en: "Copied" },
  "more.colors.empty": { th: "ยังไม่มีสีที่เลือก\nใช้ ‘ดูดสีจากหน้าจอ’ จากเมนูแถบบน", en: "No colors yet.\nUse “Color Picker” from the menu bar." },
  "more.colors.clear": { th: "ล้างรายการ", en: "Clear list" },
  "more.colors.hint": { th: "คลิกที่สีเพื่อคัดลอก", en: "Click a color to copy it" },

  // ---- pixel ruler ----
  "more.measure.hint": { th: "เลื่อนเมาส์เพื่อวัดวัตถุอัตโนมัติ · ลากเพื่อวัดระยะเอง · คลิกเพื่อคัดลอกขนาด", en: "Hover to auto-measure · drag to measure a distance · click to copy the size" },
  "more.measure.keys": { th: "↑↓ ปรับความไวขอบ · คลิกขวา ล้าง · Esc ออก", en: "↑↓ edge sensitivity · right-click clears · Esc exits" },
  "more.measure.tol": { th: "ความไว", en: "tolerance" },
  "more.measure.dist": { th: "ระยะ", en: "distance" },
  "more.measure.copied": { th: "คัดลอกขนาดแล้ว", en: "Copied size" },

  // ---- QR window ----
  "more.qr.title": { th: "ผลการอ่าน QR / บาร์โค้ด", en: "QR / barcode result" },
  "more.qr.none": { th: "ไม่พบ QR หรือบาร์โค้ดในพื้นที่ที่เลือก", en: "No QR code or barcode found in the selection" },
  "more.qr.copy": { th: "คัดลอก", en: "Copy" },
  "more.qr.copied": { th: "คัดลอกแล้ว ✓", en: "Copied ✓" },
  "more.qr.open": { th: "เปิดลิงก์", en: "Open link" },
  "more.qr.confirm": { th: "เปิดลิงก์นี้ในเบราว์เซอร์ใช่หรือไม่? ตรวจสอบก่อนว่าไว้ใจได้", en: "Open this link in your browser? Make sure you trust it." },
  "more.qr.foot": { th: "ข้อความถูกคัดลอกไปคลิปบอร์ดแล้ว · ลิงก์จะไม่ถูกเปิดโดยอัตโนมัติ", en: "The text was copied to the clipboard · links are never opened automatically" },

  // ---- floating thumbnail ----
  "more.thumb.edit": { th: "แก้ไข", en: "Edit" },
  "more.thumb.copy": { th: "คัดลอก", en: "Copy" },
  "more.thumb.save": { th: "บันทึก", en: "Save" },
  "more.thumb.pin": { th: "ปักหมุด", en: "Pin" },
  "more.thumb.close": { th: "ปิด (Esc)", en: "Close (Esc)" },
  "more.thumb.copied": { th: "คัดลอกแล้ว", en: "Copied" },
  "more.thumb.saved": { th: "บันทึกแล้ว", en: "Saved" },

  // ---- about / privacy / licence ----
  "more.about.privacyTitle": { th: "ความเป็นส่วนตัว", en: "Privacy" },
  "more.about.privacy": {
    th: "ฟรีและโอเพนซอร์ส (MIT) ไม่มีโฆษณา ไม่ต้องมีบัญชี ไม่เก็บข้อมูลการใช้งาน (no telemetry) ไม่เข้าถึงอินเทอร์เน็ต ภาพหน้าจอของคุณอยู่ในเครื่อง Mac ของคุณเท่านั้น",
    en: "Free & open-source (MIT). No ads, no account, no telemetry, no internet access. Screenshots stay only on your Mac.",
  },
  "more.about.p1": { th: "ไม่มีการเชื่อมต่อเครือข่ายใด ๆ — แม้แต่ตรวจสอบอัปเดต", en: "No network connections at all — not even update checks." },
  "more.about.p2": { th: "OCR และอ่าน QR ทำงานบนเครื่องด้วย Apple Vision", en: "OCR and QR reading run on-device with Apple Vision." },
  "more.about.p3": { th: "ข้อมูลทั้งหมด (ประวัติ การตั้งค่า สี) เก็บในโฟลเดอร์ของแอปเท่านั้น", en: "All data (history, settings, colors) lives in the app's own folders." },
  "more.about.p4": { th: "ลิงก์จาก QR จะเปิดเมื่อคุณกดยืนยันเท่านั้น", en: "Links found in QR codes open only after you confirm." },
  "more.about.licenseTitle": { th: "สัญญาอนุญาต: MIT", en: "License: MIT" },
  "more.about.license": {
    th: "คุณใช้ คัดลอก แก้ไข รวม เผยแพร่ แจกจ่าย และขายสำเนาซอฟต์แวร์นี้ได้อย่างอิสระ โดยต้องคงประกาศลิขสิทธิ์และข้อความสัญญานี้ไว้ ซอฟต์แวร์ให้ “ตามสภาพ” ไม่มีการรับประกันใด ๆ และผู้เขียนไม่ต้องรับผิดชอบต่อความเสียหายที่เกิดจากการใช้งาน",
    en: "You may use, copy, modify, merge, publish, distribute, sublicense and sell copies of this software, provided the copyright notice and licence text are kept. The software is provided “as is”, without warranty of any kind, and the authors are not liable for any damages arising from its use.",
  },
  "more.about.licenseShort": { th: "สัญญาอนุญาต MIT — ใช้ แก้ไข และแจกจ่ายได้อย่างอิสระ โดยไม่มีการรับประกัน", en: "MIT licence — free to use, modify and share, without warranty." },
  "more.about.repo": { th: "เปิดหน้า GitHub", en: "Open GitHub page" },
  "more.about.removeTitle": { th: "ลบข้อมูล CaptureME ทั้งหมด", en: "Remove all CaptureME data" },
  "more.about.removeText": {
    th: "ลบประวัติ ภาพที่จับไว้ในแอป การตั้งค่า รายการสี และแคช แล้วปิดแอป ไฟล์ที่คุณบันทึกลงโฟลเดอร์ของคุณจะไม่ถูกลบ ใช้ก่อนย้ายแอปไปถังขยะ",
    en: "Deletes the history, captures kept by the app, settings, color list and caches, then quits. Files you saved to your own folders are not touched. Use this before dragging the app to the Trash.",
  },
  "more.about.removeBtn": { th: "ลบข้อมูลทั้งหมด…", en: "Remove all data…" },
  "more.about.removeConfirm": {
    th: "ลบประวัติ ภาพ การตั้งค่า และแคชทั้งหมดของ CaptureME และปิดแอปใช่หรือไม่?",
    en: "Delete all CaptureME history, captures, settings and caches, and quit the app?",
  },
  "more.about.removeConfirm2": { th: "การกระทำนี้ย้อนกลับไม่ได้ ยืนยันอีกครั้ง", en: "This cannot be undone. Please confirm once more." },
  "more.about.removed": {
    th: "ลบข้อมูลทั้งหมดแล้ว แอปจะปิดตัวลง ตอนนี้คุณลาก CaptureME ไปที่ถังขยะได้",
    en: "All data was removed. The app will now quit — you can drag CaptureME to the Trash.",
  },
};
