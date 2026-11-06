export const capture: Record<string, { th: string; en: string }> = {
  // ---- hotkey action names (overlay hints, onboarding cheat-sheet) ----
  "cap.act.region": { th: "จับภาพพื้นที่", en: "Capture region" },
  "cap.act.window": { th: "จับภาพหน้าต่าง", en: "Capture window" },
  "cap.act.fullscreen": { th: "จับภาพเต็มหน้าจอ", en: "Capture fullscreen" },
  "cap.act.delayed": { th: "จับภาพหน่วงเวลา (5 วินาที)", en: "Delayed capture (5 s)" },
  "cap.act.scroll": { th: "จับภาพแบบเลื่อน", en: "Scrolling capture" },
  "cap.act.record": { th: "บันทึกหน้าจอ / หยุด", en: "Record screen / stop" },
  "cap.act.ocr": { th: "ดึงข้อความ (OCR)", en: "OCR text" },
  "cap.act.history": { th: "เปิดประวัติ", en: "Open history" },

  // ---- overlay ----
  "cap.hint.capture": {
    th: "ลากเพื่อเลือกพื้นที่ · คลิกเพื่อเลือกหน้าต่าง · Esc ยกเลิก",
    en: "Drag to select an area · click a window to snap · Esc to cancel",
  },
  "cap.hint.window": { th: "คลิกที่หน้าต่างที่ต้องการจับภาพ · Esc ยกเลิก", en: "Click the window you want to capture · Esc to cancel" },
  "cap.hint.ocr": { th: "ลากเลือกพื้นที่ที่ต้องการดึงข้อความ · Esc ยกเลิก", en: "Select the area to read text from · Esc to cancel" },
  "cap.hint.pin": { th: "ลากเลือกพื้นที่ที่ต้องการปักหมุด · Esc ยกเลิก", en: "Select the area to pin on screen · Esc to cancel" },
  "cap.hint.scroll": { th: "เลือกพื้นที่ที่จะเลื่อนจับภาพ · Esc ยกเลิก", en: "Select the area to scroll-capture · Esc to cancel" },
  "cap.hint.record": { th: "เลือกพื้นที่ที่จะบันทึกวิดีโอ · Esc ยกเลิก", en: "Select the area to record · Esc to cancel" },
  "cap.hint.keys": {
    th: "Enter ยืนยัน · Space+ลาก ย้าย · Shift สี่เหลี่ยมจัตุรัส · ลูกศร ขยับ",
    en: "Enter confirm · Space+drag move · Shift square · arrows nudge",
  },
  "cap.badge.scroll": { th: "จับภาพแบบเลื่อน", en: "Scroll capture" },
  "cap.badge.record": { th: "บันทึกหน้าจอ", en: "Record screen" },
  "cap.tb.confirm": { th: "ยืนยัน (Enter)", en: "Confirm (Enter)" },
  "cap.tb.copy": { th: "คัดลอกไปคลิปบอร์ด (⌘C)", en: "Copy to clipboard (⌘C)" },
  "cap.tb.pin": { th: "ปักหมุดบนหน้าจอ", en: "Pin to screen" },
  "cap.tb.ocr": { th: "ดึงข้อความ (OCR)", en: "Extract text (OCR)" },
  "cap.tb.cancel": { th: "ยกเลิก (Esc)", en: "Cancel (Esc)" },
  "cap.tb.start_scroll": { th: "เริ่มจับภาพแบบเลื่อน", en: "Start scroll capture" },
  "cap.tb.start_record": { th: "เริ่มบันทึก", en: "Start recording" },
  "cap.loupe.copyhex": { th: "สีใต้เมาส์", en: "Color under cursor" },
  "cap.countdown": { th: "เตรียมตัว…", en: "Get ready…" },

  // ---- onboarding ----
  "ob.title": { th: "ยินดีต้อนรับสู่ CaptureME", en: "Welcome to CaptureME" },
  "ob.subtitle": {
    th: "จับภาพหน้าจอ ใส่คำอธิบาย และแชร์ได้ในไม่กี่วินาที — อยู่บนแถบเมนูของคุณ",
    en: "Capture, annotate and share your screen in seconds — right from your menu bar.",
  },
  "ob.perm.title": { th: "สิทธิ์การบันทึกหน้าจอ", en: "Screen Recording permission" },
  "ob.perm.desc": {
    th: "macOS ต้องได้รับอนุญาตก่อนจึงจะจับภาพหน้าจอได้ CaptureME ไม่ส่งข้อมูลใด ๆ ออกจากเครื่องของคุณ",
    en: "macOS requires your permission before an app can capture the screen. CaptureME never sends anything off your Mac.",
  },
  "ob.perm.granted": { th: "อนุญาตแล้ว", en: "Granted" },
  "ob.perm.missing": { th: "ยังไม่ได้รับอนุญาต", en: "Not granted yet" },
  "ob.perm.request": { th: "ขอสิทธิ์", en: "Request permission" },
  "ob.perm.open": { th: "เปิดการตั้งค่าระบบ", en: "Open System Settings" },
  "ob.perm.restart_hint": {
    th: "เปิดสวิตช์ CaptureME ใน “การบันทึกหน้าจอ” แล้วหากสถานะยังไม่เปลี่ยน ให้เริ่มแอปใหม่",
    en: "Switch CaptureME on under “Screen Recording”. If the status doesn’t change, restart the app.",
  },
  "ob.perm.restart": { th: "เริ่มแอปใหม่", en: "Restart app" },
  "ob.keys.title": { th: "ปุ่มลัด", en: "Keyboard shortcuts" },
  "ob.keys.hint": { th: "เปลี่ยนปุ่มลัดได้ในหน้าตั้งค่า", en: "You can change shortcuts in Settings." },
  "ob.tip": {
    th: "CaptureME ทำงานบนแถบเมนู (ไอคอนช่องมองภาพ) คลิกเพื่อเริ่มจับภาพได้ทุกเมื่อ",
    en: "CaptureME lives in your menu bar (the viewfinder icon). Click it any time to start capturing.",
  },
  "ob.start": { th: "เริ่มใช้งาน", en: "Get started" },
};
