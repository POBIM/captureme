// Texts + which REAL capture (docs/images/th/*.webp, produced by marketing/capture) each social card / video scene shows.
export interface Tool {
  id: string;
  th: string; // Thai headline
  en: string; // English subtitle
  img: string; // path inside docs/images
  keys?: string; // action id in generated/app.json (shortcut)
  hint?: { th: string; en: string }; // shown instead of a shortcut
  /** how to show the picture: "fill" crops to the frame, "contain" shows it whole */
  fit?: "fill" | "contain";
  pos?: string; // object-position when cropping
  /** magnify the picture around a focus point (fractions of the picture) – used for the busy editor shots */
  crop?: { zoom: number; fx: number; fy: number };
}

export const TOOLS: Tool[] = [
  { id: "capture-region", th: "ลากเลือกพื้นที่ จับภาพได้ทันที", en: "Drag a region – capture instantly", img: "th/u01-capture-region.webp", keys: "region" },
  { id: "capture-window", th: "คลิกเดียว จับทั้งหน้าต่าง", en: "One click captures a whole window", img: "th/u04-capture-window.webp", keys: "window" },
  { id: "capture-presets", th: "ล็อกอัตราส่วน 16:9 · 1:1 · ขนาดสำเร็จรูป", en: "Lock the aspect ratio or pick a preset size", img: "th/u03-capture-presets.webp", keys: "region" },
  { id: "thumbnail", th: "ภาพย่อมุมจอ แก้ไข คัดลอก หรือลากไปวางได้เลย", en: "Floating thumbnail – edit, copy or drag it out", img: "th/u06-thumbnail.webp", hint: { th: "ตั้งได้ที่ ตั้งค่า › ทั่วไป", en: "Settings › General" }, fit: "contain" },
  { id: "editor", crop: { zoom: 1.35, fx: 0.5, fy: 0.45 }, th: "ตัวแก้ไขภาพ 20+ เครื่องมือ", en: "A 20+ tool annotation editor", img: "th/e00-editor-overview.webp", hint: { th: "กด ? ดูคีย์ลัดทั้งหมด", en: "Press ? for every shortcut" } },
  { id: "arrow", crop: { zoom: 1.5, fx: 0.5, fy: 0.55 }, th: "ลูกศร เส้น รูปทรง ชี้จุดสำคัญ", en: "Arrows, lines and shapes", img: "th/e01-arrow.webp", hint: { th: "กด A", en: "Press A" } },
  { id: "steps", crop: { zoom: 1.5, fx: 0.45, fy: 0.55 }, th: "ตัวนับลำดับ อธิบายขั้นตอนง่ายขึ้น", en: "Step counters for how-to shots", img: "th/e05-step.webp", hint: { th: "กด N", en: "Press N" } },
  { id: "redact", crop: { zoom: 1.5, fx: 0.62, fy: 0.55 }, th: "ซ่อนข้อมูลส่วนตัวให้ปลอดภัย", en: "Redact · blur · pixelate – hide private data", img: "th/e07-redact.webp", hint: { th: "กด D · B · X", en: "Press D · B · X" } },
  { id: "spotlight", crop: { zoom: 1.5, fx: 0.45, fy: 0.55 }, th: "สปอตไลต์ ดึงสายตาไปจุดสำคัญ", en: "Spotlight what matters", img: "th/e08-spotlight.webp", hint: { th: "กด S", en: "Press S" } },
  { id: "magnify", crop: { zoom: 1.5, fx: 0.6, fy: 0.55 }, th: "แว่นขยาย ขยายรายละเอียดเล็ก ๆ", en: "Magnify tiny details", img: "th/e09-magnify.webp", hint: { th: "กด M", en: "Press M" } },
  { id: "background", crop: { zoom: 1.3, fx: 0.5, fy: 0.5 }, th: "พื้นหลังตกแต่ง ภาพสวยพร้อมโพสต์", en: "Beautify with a gradient background", img: "th/e12-background.webp", hint: { th: "ปุ่มพื้นหลังบนแถบเครื่องมือ", en: "Background button in the toolbar" } },
  { id: "ocr", th: "OCR อ่านข้อความไทย + อังกฤษจากภาพ", en: "OCR – read Thai + English text", img: "th/t02-ocr-result.webp", keys: "ocr", fit: "contain" },
  { id: "qr", th: "อ่าน QR ลิงก์ไม่เปิดเองจนกว่าคุณยืนยัน", en: "Read QR codes – links never open on their own", img: "th/t03-qr-result.webp", keys: "qr", fit: "contain" },
  { id: "color", th: "ดูดสีจากหน้าจอ HEX · RGB · HSL", en: "Pick any colour from the screen", img: "th/u12-overlay-color.webp", keys: "color" },
  { id: "ruler", th: "ไม้บรรทัดพิกเซล วัดขนาดอัตโนมัติ", en: "Pixel ruler – auto-measure anything", img: "th/u13-overlay-measure.webp", keys: "measure" },
  { id: "pin", th: "ปักหมุด ภาพลอยเหนือทุกหน้าต่าง", en: "Pin images above every window", img: "th/t01-pin.webp", keys: "pin", fit: "contain" },
  { id: "scroll", th: "สกรอลล์จับภาพ ต่อหน้ายาวเป็นภาพเดียว", en: "Scrolling capture – one tall image", img: "th/t05-scroll-control.webp", keys: "scroll", fit: "contain" },
  { id: "record", th: "บันทึกหน้าจอ MP4 · MOV · GIF", en: "Record the screen – MP4, MOV or GIF", img: "th/t06-record-setup.webp", keys: "record", fit: "contain" },
  { id: "video", th: "ตัดต้น-ท้าย ส่งออก MP4 / GIF ในแอป", en: "Trim and export MP4 / GIF in the app", img: "th/t08-video-window.webp", hint: { th: "เปิดอัตโนมัติหลังบันทึก", en: "Opens after every recording" } },
  { id: "history", th: "ประวัติ ย้อนหาได้ทุกภาพ", en: "History – find every capture again", img: "th/t09-history.webp", keys: "history" },
  { id: "privacy", th: "ไม่เก็บข้อมูล ไม่ใช้อินเทอร์เน็ต", en: "No data collected · no network access", img: "th/s-about.webp", hint: { th: "ลบข้อมูลทั้งหมดได้ในปุ่มเดียว", en: "Delete all data with one button" } },
];

export const STEPS: { img: string; th: string; en: string; pos?: string; fit?: "fill" | "contain" }[] = [
  { img: "th/i02-github-release.webp", th: "ดาวน์โหลด .dmg จาก GitHub", en: "Download the .dmg from GitHub", pos: "center 76%" },
  { img: "th/i03-dmg-window.webp", th: "ลาก CaptureME ไปที่ Applications", en: "Drag CaptureME to Applications" },
  { img: "th/i04-open-anyway.webp", th: "เปิดครั้งแรก: Privacy & Security › Open Anyway", en: "First launch: Privacy & Security › Open Anyway", fit: "contain" },
  { img: "th/i06-onboarding.webp", th: "อนุญาต Screen Recording แล้วเริ่มจับภาพ", en: "Allow Screen Recording and start capturing" },
];

export const DOWNLOAD_URL = "github.com/POBIM/captureme/releases/latest";
