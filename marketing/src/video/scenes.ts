// The tutorial storyboard: every picture is a REAL capture from docs/images (see marketing/capture). th = caption, en = subtitle.
export interface Scene { img: string; th: string; en: string; sec: number; keys?: string; note?: string }
export interface Chapter { id: string; th: string; en: string; scenes: Scene[] }

const S = (img: string, sec: number, th: string, en: string, keys?: string, note?: string): Scene => ({ img: `th/${img}.webp`, sec, th, en, keys, note });

export const CHAPTERS: Chapter[] = [
  { id: "download", th: "ดาวน์โหลดจาก GitHub", en: "Download from GitHub", scenes: [
    S("i01-github-repo", 5, "เปิดหน้าโปรเจกต์บน GitHub แล้วกด Releases", "Open the project on GitHub and click Releases"),
    S("i02-github-release", 5.5, "ในส่วน Assets คลิกไฟล์ .dmg เพื่อดาวน์โหลด (~8 MB)", "Under Assets, click the .dmg file (~8 MB)"),
  ] },
  { id: "install", th: "ติดตั้ง", en: "Install", scenes: [
    S("i03-dmg-window", 5, "ดับเบิลคลิก DMG แล้วลาก CaptureME ไปที่ Applications", "Open the DMG and drag CaptureME to Applications"),
    S("i04-open-anyway", 7, "เปิดครั้งแรก: ตั้งค่าระบบ › ความเป็นส่วนตัวและความปลอดภัย › Open Anyway", "First launch: Privacy & Security › Open Anyway", undefined, "ปุ่มจะโผล่หลังเปิดแอปแล้วถูกบล็อก · The button appears after a blocked launch"),
  ] },
  { id: "permission", th: "สิทธิ์ Screen Recording", en: "Screen Recording permission", scenes: [
    S("i06-onboarding", 5, "หน้าต้อนรับของแอป: กดขอสิทธิ์ Screen Recording", "The welcome window: request Screen Recording"),
    S("i05-screen-recording", 5.5, "เปิดสวิตช์ CaptureME แล้วปิด-เปิดแอปใหม่", "Turn CaptureME on, then quit and reopen the app"),
    S("i07-menu-bar-menu", 5, "ไอคอนบนแถบเมนู: ทุกเครื่องมืออยู่ในเมนูนี้", "The menu-bar icon: every tool is in this menu"),
  ] },
  { id: "capture", th: "จับภาพ", en: "Capture", scenes: [
    S("u01-capture-region", 5.5, "จับภาพพื้นที่: ลากเลือก ปรับกรอบ แล้วกดยืนยัน", "Region capture: drag, adjust, confirm", "region"),
    S("u02-capture-loupe", 4, "แว่นขยายพิกเซลช่วยให้ลากชิดขอบเป๊ะ ๆ", "The pixel loupe helps you land on the exact edge", "region"),
    S("u03-capture-presets", 4.5, "ล็อกอัตราส่วน 16:9, 1:1 หรือเลือกขนาดสำเร็จรูป", "Lock the aspect ratio or pick a preset size", "region"),
    S("u04-capture-window", 4, "จับภาพหน้าต่าง: ชี้แล้วคลิก", "Window capture: point and click", "window"),
    S("u05-delay-countdown", 3.5, "หน่วงเวลา: สำหรับเมนูที่หายเมื่อกดคีย์ลัด", "Delayed capture, for menus that vanish", "delayed"),
    S("u06-thumbnail", 5, "ภาพย่อมุมจอ: แก้ไข คัดลอก บันทึก ปักหมุด หรือลากไปวาง", "Floating thumbnail: edit, copy, save, pin or drag out"),
  ] },
  { id: "editor", th: "ตัวแก้ไขภาพ ทีละเครื่องมือ", en: "The editor, tool by tool", scenes: [
    S("e00-editor-overview", 5, "ตัวแก้ไข: แถบเครื่องมือ แถบสไตล์ และผืนภาพ", "The editor: toolbar, style bar and canvas"),
    S("e01-arrow", 4, "ลูกศร ตรง โค้ง สองหัว เรียว", "Arrows: straight, curved, double, tapered"),
    S("e02-shapes", 3.5, "เส้น สี่เหลี่ยม วงรี", "Line, rectangle, ellipse"),
    S("e03-pen", 3.5, "ปากกาและไฮไลต์", "Pen and highlighter"),
    S("e04-text", 3.5, "ข้อความไทย/อังกฤษ พร้อมกล่องพื้นหลัง", "Thai / English text with a background box"),
    S("e05-step", 3.5, "ตัวนับลำดับ 1 2 3 อัตโนมัติ", "Step counters: 1, 2, 3 automatically"),
    S("e06-callout", 3.5, "ฟองคำพูดพร้อมหางชี้", "Speech-bubble callouts"),
    S("e07-redact", 5, "ปิดทึบ เบลอ โมเสก: ข้อมูลสำคัญใช้ปิดทึบ กู้คืนไม่ได้", "Redact, blur, pixelate – use solid redact for secrets"),
    S("e08-spotlight", 3.5, "สปอตไลต์: ทำให้ส่วนอื่นมืดลง", "Spotlight: dim everything else"),
    S("e09-magnify", 3.5, "แว่นขยายพร้อมเส้นนำ", "Magnifier with leader lines"),
    S("e10-measure", 3.5, "วัดระยะเป็นพิกเซล", "Measure in pixels"),
    S("e11-crop", 3.5, "ครอปตามสัดส่วน", "Crop with an aspect ratio"),
    S("e12-background", 4.5, "พื้นหลังตกแต่ง: ไล่สี ระยะขอบ มุมโค้ง เงา", "Background beautifier: gradient, padding, corners, shadow"),
    S("e13-watermark", 4, "ลายน้ำ ใส่ตอนส่งออก", "Watermark, applied on export"),
    S("e14-padding", 3.5, "เพิ่มขอบและกรอบ", "Padding and border"),
    S("e16-transform", 3.5, "หมุนและพลิกภาพ", "Rotate and flip"),
    S("e19-paste-image", 3.5, "วางรูปซ้อนทับ ⌘V", "Paste an image on top – ⌘V"),
    S("e17-arrange", 4, "จัดวาง จัดกลุ่ม ล็อกวัตถุ", "Align, group and lock objects"),
    S("e18-export", 4, "ส่งออก: คัดลอก บันทึก สเกล JPEG", "Export: copy, save, scale, JPEG"),
    S("e20-shortcuts", 4.5, "กด ? เพื่อดูคีย์ลัดทั้งหมด", "Press ? for every shortcut"),
  ] },
  { id: "more", th: "เครื่องมือเสริม", en: "More tools", scenes: [
    S("t01-pin", 4, "ปักหมุดภาพลอยเหนือทุกหน้าต่าง", "Pin images above every window", "pin"),
    S("u09-overlay-ocr", 3.5, "OCR: ลากเลือกข้อความบนหน้าจอ", "OCR: drag over the text", "ocr"),
    S("t02-ocr-result", 4.5, "อ่านไทย + อังกฤษ บนเครื่อง แล้วคัดลอกให้", "Thai + English, on-device, copied for you", "ocr"),
    S("t03-qr-result", 4, "อ่าน QR: ลิงก์ไม่เปิดเองจนกว่าจะยืนยัน", "QR reader: links never open on their own", "qr"),
    S("u12-overlay-color", 4, "ดูดสีจากหน้าจอ HEX · RGB · HSL", "Pick any colour: HEX, RGB, HSL", "color"),
    S("t04-colors-panel", 3.5, "ประวัติสีที่เลือกล่าสุด", "Recent colours", "color"),
    S("u13-overlay-measure", 4, "ไม้บรรทัดพิกเซล: วัดขนาดอัตโนมัติ", "Pixel ruler: auto-measure", "measure"),
    S("t05-scroll-control", 4.5, "สกรอลล์จับภาพ: ต่อหน้ายาวเป็นภาพเดียว", "Scrolling capture: one tall image", "scroll", "ตัวอย่างความสูงเป็นค่าสาธิต · the sample height is demo data"),
  ] },
  { id: "record", th: "บันทึกหน้าจอ", en: "Screen recording", scenes: [
    S("u08-overlay-record", 4, "เลือกพื้นที่ที่จะบันทึก", "Choose the area to record", "record"),
    S("t06-record-setup", 5.5, "MP4 · MOV · GIF · เสียง · แสดงคลิก/ปุ่มที่กด · เว็บแคม", "MP4 · MOV · GIF · audio · clicks/keys · webcam", "record", "ไม่ได้เปิดเว็บแคมในภาพนี้ · the webcam is off in this picture"),
    S("t07-record-bar", 3.5, "แถบบันทึก: พัก หยุด ทิ้ง", "Recording bar: pause, stop, discard", "record"),
    S("t08-video-window", 5, "หน้าต่างวิดีโอ: ตัดต้น-ท้าย ส่งออก MP4 / GIF", "Video window: trim, export MP4 / GIF"),
  ] },
  { id: "settings", th: "ประวัติ · ตั้งค่า · ความเป็นส่วนตัว", en: "History · settings · privacy", scenes: [
    S("t09-history", 4, "ประวัติ: ย้อนหาได้ทุกภาพ", "History: find every capture again", "history"),
    S("s-hotkeys", 4, "ตั้งคีย์ลัดเองได้ทุกคำสั่ง", "Set your own shortcuts", undefined),
    S("s-general", 3.5, "ตั้งค่า: ภาษาไทย/English หลังจับภาพ โฟลเดอร์", "Settings: language, after-capture action, folder"),
    S("s-about", 5, "ไม่เก็บข้อมูล ไม่ใช้อินเทอร์เน็ต ลบข้อมูลทั้งหมดได้ในปุ่มเดียว", "No data, no network – delete everything with one button"),
  ] },
];

export const INTRO_SEC = 5;
export const OUTRO_SEC = 9;
export const FPS = 30;
