// Strings for scrolling capture + screen recording (Agent D). Keys are prefixed `extras.`.
export const extras: Record<string, { th: string; en: string }> = {
  // ---- recorder: setup bar ----
  "extras.rec.title": { th: "บันทึกหน้าจอ", en: "Screen recording" },
  "extras.rec.format": { th: "รูปแบบ", en: "Format" },
  "extras.rec.fps": { th: "เฟรมเรต", en: "FPS" },
  "extras.rec.cursor": { th: "เคอร์เซอร์", en: "Cursor" },
  "extras.rec.clicks": { th: "แสดงการคลิก", en: "Show clicks" },
  "extras.rec.mic": { th: "ไมโครโฟน", en: "Microphone" },
  "extras.rec.start": { th: "เริ่มบันทึก", en: "Start recording" },
  "extras.rec.cancel": { th: "ยกเลิก", en: "Cancel" },
  "extras.rec.countdown": { th: "นับถอยหลัง", en: "Countdown" },
  "extras.rec.gifHint": { th: "GIF: ไม่มีเสียงและไม่แสดงเคอร์เซอร์", en: "GIF: no audio, no cursor" },
  "extras.rec.region": { th: "พื้นที่", en: "Region" },
  // ---- recorder: running bar ----
  "extras.rec.recording": { th: "กำลังบันทึก", en: "Recording" },
  "extras.rec.stop": { th: "หยุด", en: "Stop" },
  "extras.rec.discard": { th: "ยกเลิกการบันทึก", en: "Discard recording" },
  "extras.rec.saving": { th: "กำลังบันทึกไฟล์…", en: "Saving…" },
  "extras.rec.micMissing": { th: "ไม่พบไมโครโฟน – บันทึกโดยไม่มีเสียง", en: "No microphone available – recording without audio" },
  "extras.rec.error": { th: "บันทึกหน้าจอไม่สำเร็จ", en: "Recording failed" },
  "extras.rec.errorHint": {
    th: "ตรวจสอบว่าได้อนุญาต Screen Recording ใน ตั้งค่าระบบ › ความเป็นส่วนตัวและความปลอดภัย",
    en: "Check that Screen Recording is allowed in System Settings › Privacy & Security.",
  },
  // ---- scroll capture ----
  "extras.scroll.title": { th: "สกรอลล์จับภาพ", en: "Scrolling capture" },
  "extras.scroll.hint": {
    th: "กำลังจับภาพ… เลื่อนเนื้อหาลงไปเรื่อย ๆ แล้วกด เสร็จสิ้น หรือ Esc",
    en: "Scrolling… scroll the content, then press Done or Esc.",
  },
  "extras.scroll.done": { th: "เสร็จสิ้น", en: "Done" },
  "extras.scroll.cancel": { th: "ยกเลิก", en: "Cancel" },
  "extras.scroll.auto": { th: "เลื่อนอัตโนมัติ", en: "Auto-scroll" },
  "extras.scroll.autoNeedsAx": {
    th: "ต้องอนุญาต Accessibility ให้ CaptureME ใน ตั้งค่าระบบ แล้วลองใหม่",
    en: "Allow CaptureME under Accessibility in System Settings, then try again.",
  },
  "extras.scroll.height": { th: "ความสูง", en: "Height" },
  "extras.scroll.frames": { th: "เฟรม", en: "frames" },
  "extras.scroll.waiting": { th: "รอการเลื่อน…", en: "Waiting for scroll…" },
  "extras.scroll.limit": { th: "ถึงความสูงสูงสุดแล้ว", en: "Maximum height reached" },
  "extras.scroll.error": { th: "สกรอลล์จับภาพไม่สำเร็จ", en: "Scrolling capture failed" },
};
