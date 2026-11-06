import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, MONO } from "../theme";
import { SITE, keys } from "../site";
import { AppIcon } from "../ui/AppIcon";
import { QrCode } from "../ui/Qr";
import { KeyCombo } from "../ui/Keys";
import { AnnotatedShot, PrivacyBadges, Pill } from "../poster/parts";
import { seg, ease, window01, FPS } from "./anim";
import { CaptionBar, TutorialScene, Backdrop, Cue } from "./common";
import { InstallDemo } from "./demos-install";
import { CaptureDemo } from "./demos-capture";
import { EditorDemo } from "./demos-editor";
import { ToolsDemo } from "./demos-tools";
import { AdvDemo } from "./demos-adv";
import { SettingsDemo } from "./demos-settings";
import { Download, Camera, PenTool, Pin, ChevronsDown, SlidersHorizontal, Heart, Code2 } from "lucide-react";

const S = (sec: number) => Math.round(sec * FPS);
const k = keys;

/* ----------------------------------------------------------------------------- intro */
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const pIcon = seg(t, 0.1, 0.8, ease);
  const pTitle = seg(t, 0.4, 1.1, ease);
  const pTag = seg(t, 1.0, 1.7, ease);
  const pShot = seg(t, 0.6, 1.5, ease);
  const float = Math.sin(t * 1.4) * 8;
  const out = 1 - seg(t, 10.6, 11);
  const cues: Cue[] = [
    { from: 0.8, to: 4.2, th: "สวัสดีครับ! นี่คือ CaptureME แอปจับภาพหน้าจอฟรีสำหรับ Mac", en: "Hi! This is CaptureME – a free screenshot app for Mac." },
    { from: 4.4, to: 7.6, th: "ไม่เก็บข้อมูล ไม่ต้องสมัคร ไม่มีโฆษณา และไม่ใช้อินเทอร์เน็ตเลย", en: "No data collected, no sign-up, no ads – and no internet access at all." },
    { from: 7.8, to: 10.7, th: "โอเพนซอร์ส MIT ใช้ฟรีตลอดไป มาดูวิธีใช้กันเลย", en: "Open source under MIT, free forever. Let's take a look." },
  ];
  return (
    <AbsoluteFill style={{ opacity: out, background: "linear-gradient(135deg,#ef4444 0%,#dc2626 40%,#7f1d1d 100%)", fontFamily: FONT }}>
      <div style={{ position: "absolute", right: -240, top: -300, width: 900, height: 900, borderRadius: 450, background: "rgba(255,255,255,.07)" }} />
      <div style={{ position: "absolute", left: -300, bottom: -420, width: 800, height: 800, borderRadius: 400, background: "rgba(0,0,0,.1)" }} />
      <div style={{ position: "absolute", left: 110, top: 150, display: "flex", alignItems: "center", gap: 30 }}>
        <div style={{ opacity: pIcon, transform: `scale(${0.6 + 0.4 * pIcon}) rotate(${(1 - pIcon) * -12}deg)` }}><AppIcon size={170} /></div>
        <div style={{ opacity: pTitle, transform: `translateX(${(1 - pTitle) * 60}px)`, fontSize: 138, fontWeight: 700, color: "#fff", letterSpacing: -5 }}>CaptureME</div>
      </div>
      <div style={{ position: "absolute", left: 110, top: 410, opacity: pTag, transform: `translateY(${(1 - pTag) * 30}px)` }}>
        <div style={{ fontSize: 84, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>แอปจับภาพหน้าจอ<span style={{ color: "#fde68a" }}>ฟรี</span><br />สำหรับ Mac</div>
        <div style={{ marginTop: 14, fontSize: 40, fontWeight: 500, color: "rgba(255,255,255,.9)" }}>Free screenshot &amp; annotation app for Mac</div>
      </div>
      <div style={{ position: "absolute", left: 1090, top: 120, opacity: pShot, transform: `translateY(${(1 - pShot) * 60 + float}px) rotate(-3deg)`, filter: "drop-shadow(0 40px 60px rgba(0,0,0,.4))" }}>
        <AnnotatedShot scale={0.62} />
      </div>
      <div style={{ position: "absolute", left: 110, top: 740, opacity: seg(t, 4.4, 5.2, ease), transform: `translateY(${(1 - seg(t, 4.4, 5.2, ease)) * 20}px)` }}>
        <PrivacyBadges s={0.92} dark />
      </div>
      <CaptionBar t={t} cues={cues} bottom={56} />
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------------------- outro */
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const p = (a: number) => seg(t, a, a + 0.6, ease);
  const cues: Cue[] = [
    { from: 0.6, to: 3.4, th: "CaptureME ใช้ฟรี โอเพนซอร์ส ไม่เก็บข้อมูล", en: "CaptureME is free, open source and collects nothing." },
    { from: 3.6, to: 6.4, th: `ดาวน์โหลดได้ที่ ${SITE.urlShort}`, en: `Download it at ${SITE.urlShort}` },
    { from: 6.6, to: 8.7, th: "ขอบคุณที่ใช้งานครับ ♥", en: "Thanks for using it!" },
  ];
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1e1b4b 60%,#7f1d1d)", fontFamily: FONT, opacity: seg(t, 0, 0.4) * (1 - seg(t, 8.6, 9)) }}>
      <div style={{ position: "absolute", left: 140, top: 150, opacity: p(0.2), transform: `translateY(${(1 - p(0.2)) * 30}px)` }}>
        <AppIcon size={150} />
        <div style={{ marginTop: 30, fontSize: 120, fontWeight: 700, color: "#fff", letterSpacing: -3, lineHeight: 1 }}>CaptureME</div>
        <div style={{ marginTop: 24, fontSize: 56, fontWeight: 700, color: "#fff", lineHeight: 1.25 }}>ใช้ฟรี · โอเพนซอร์ส<br />ไม่เก็บข้อมูล</div>
        <div style={{ marginTop: 14, fontSize: 30, color: "#fca5a5" }}>Free · Open source (MIT) · Private</div>
        <div style={{ marginTop: 34, opacity: p(1.4), display: "flex", gap: 14 }}>
          <Pill size={26}>macOS 14+</Pill><Pill size={26}>Apple Silicon + Intel</Pill><Pill size={26}><Heart size={22} fill="#fff" /> MIT</Pill>
        </div>
      </div>
      <div style={{ position: "absolute", right: 150, top: 150, width: 640, borderRadius: 40, background: "#fff", padding: 40, boxShadow: "0 40px 90px rgba(0,0,0,.5)", opacity: p(0.9), transform: `translateY(${(1 - p(0.9)) * 40}px) scale(${0.96 + 0.04 * p(0.9)})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 40, fontWeight: 700, color: C.red }}><Download size={40} strokeWidth={3} /> ดาวน์โหลดฟรี</div>
        <div style={{ fontSize: 24, color: C.slate, marginTop: 4 }}>Scan the QR code or visit the page</div>
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}><div style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 0 0 3px #e2e8f0" }}><QrCode size={400} /></div></div>
        <div style={{ marginTop: 22, textAlign: "center", fontSize: 30, fontWeight: 700, color: C.ink, display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}><Code2 size={30} /> {SITE.urlShort}</div>
      </div>
      <CaptionBar t={t} cues={cues} bottom={56} />
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------------------- composition */
const D = { intro: 11, install: 24, capture: 20, editor: 26, tools: 28, adv: 18, settings: 10, outro: 9 };
export const TUTORIAL_FRAMES = S(Object.values(D).reduce((a, b) => a + b, 0));

export const Tutorial: React.FC = () => {
  let at = 0;
  const seq = (dur: number, node: React.ReactNode, key: string) => {
    const el = <Sequence key={key} from={S(at)} durationInFrames={S(dur)}>{node}</Sequence>;
    at += dur;
    return el;
  };
  return (
    <AbsoluteFill style={{ background: "#f8fafc" }}>
      {seq(D.intro, <IntroScene />, "intro")}
      {seq(D.install, (
        <TutorialScene n={1} label="ติดตั้ง" Icon={Download} th="ติดตั้ง" en="Install" duration={D.install}
          extra={<InstallExtra />}
          cues={[
            { from: 0.6, to: 7.6, th: "ดาวน์โหลดไฟล์ .dmg แล้วลาก CaptureME ไปไว้ในโฟลเดอร์ Applications", en: "Download the .dmg and drag CaptureME into Applications." },
            { from: 8.4, to: 11.8, th: "ครั้งแรก macOS จะเตือนเพราะแอปไม่ได้ลงนามกับ Apple – กด เสร็จสิ้น (Done)", en: "macOS warns on first launch because the app isn't Apple-signed – click Done." },
            { from: 12, to: 15.8, th: "ไปที่ ตั้งค่าระบบ › ความเป็นส่วนตัวและความปลอดภัย แล้วกด Open Anyway", en: "Open System Settings › Privacy & Security and click Open Anyway." },
            { from: 16.5, to: 23.6, th: "เปิดสวิตช์ Screen Recording ให้ CaptureME แล้วเปิดแอปใหม่ – ทำครั้งเดียวจบ", en: "Switch Screen Recording on for CaptureME, then reopen the app – a one-time setup." },
          ]}
          render={(t) => <InstallDemo t={t} />} />
      ), "install")}
      {seq(D.capture, (
        <TutorialScene n={2} label="จับภาพ" Icon={Camera} th="จับภาพ" en="Capture" duration={D.capture}
          keysList={[
            { keys: k("region"), label: "พื้นที่ · Region" }, { keys: k("window"), label: "หน้าต่าง · Window" },
            { keys: k("fullscreen"), label: "เต็มจอ · Full screen" }, { keys: k("delayed"), label: "หน่วงเวลา · Delayed" },
          ]}
          cues={[
            { from: 0.5, to: 5, th: `กด ${k("region").join("")} แล้วลากเลือกพื้นที่ที่ต้องการ`, en: `Press ${k("region").join("")} and drag to select an area.` },
            { from: 5.2, to: 8.8, th: "หน้าจอจะหยุดนิ่ง ปรับกรอบได้ละเอียด แล้วกดยืนยัน", en: "The screen freezes so you can fine-tune the frame, then confirm." },
            { from: 9.4, to: 13.8, th: `จับภาพหน้าต่างด้วย ${k("window").join("")} – แค่ชี้แล้วคลิก`, en: `Capture a window with ${k("window").join("")} – just point and click.` },
            { from: 14.4, to: 19.6, th: `${k("fullscreen").join("")} เต็มหน้าจอ · ${k("delayed").join("")} หน่วงเวลา เหมาะกับเมนูที่หายเร็ว`, en: "Full screen, or delayed – great for menus that disappear." },
          ]}
          render={(t) => <CaptureDemo t={t} />} />
      ), "capture")}
      {seq(D.editor, (
        <TutorialScene n={3} label="แก้ไข" Icon={PenTool} th="ตัวแก้ไขภาพ" en="Editor" duration={D.editor}
          keysList={[{ keys: ["A"], label: "ลูกศร" }, { keys: ["T"], label: "ข้อความ" }, { keys: ["N"], label: "ตัวนับลำดับ" }, { keys: ["B"], label: "เบลอ" }, { keys: ["C"], label: "ครอป" }]}
          cues={[
            { from: 0.5, to: 4.8, th: "ตัวแก้ไขเปิดทันที – ลากลูกศรและกรอบชี้จุดสำคัญ", en: "The editor opens instantly – draw arrows and boxes to point at what matters." },
            { from: 5, to: 9.8, th: "พิมพ์ข้อความไทยหรืออังกฤษ และใส่เลขลำดับ 1 2 3 อธิบายขั้นตอน", en: "Add Thai or English text and numbered steps." },
            { from: 10.2, to: 14.6, th: "เบลอหรือโมเสกข้อมูลลับ เช่น เลขบัญชี ก่อนส่งให้ใคร", en: "Blur or pixelate secrets such as account numbers before sharing." },
            { from: 14.9, to: 19.6, th: "ครอปตามสัดส่วนที่ต้องการ แล้วกด Enter", en: "Crop to any aspect ratio, then press Enter." },
            { from: 20.2, to: 25.9, th: "เปิดพื้นหลังตกแต่ง ใส่เงาและมุมโค้ง ได้ภาพพร้อมโพสต์ – แล้วกดคัดลอก", en: "Turn on the background for padding, shadow and rounded corners – ready to post." },
          ]}
          render={(t) => <EditorDemo t={t} />} />
      ), "editor")}
      {seq(D.tools, (
        <TutorialScene n={4} label="เครื่องมือ" Icon={Pin} th="ปักหมุด · OCR · ประวัติ" en="Pin · OCR · History · more" duration={D.tools}
          keysList={[{ keys: k("ocr"), label: "OCR อ่านข้อความ" }, { keys: k("history"), label: "ประวัติ" }, { keys: k("color"), label: "ดูดสี" }, { keys: k("measure"), label: "ไม้บรรทัด" }, { keys: k("qr"), label: "อ่าน QR" }]}
          cues={[
            { from: 0.5, to: 6.6, th: "ปักหมุดภาพให้ลอยเหนือหน้าต่างอื่น ปรับความโปร่งใสได้ ไว้ดูอ้างอิงระหว่างทำงาน", en: "Pin an image above all windows and adjust its opacity – a handy reference while you work." },
            { from: 7.4, to: 13.4, th: `OCR ${k("ocr").join("")} ลากเลือกข้อความ ได้ทั้งไทยและอังกฤษ ประมวลผลบนเครื่องคุณ`, en: "OCR: drag over text – Thai and English, processed on your Mac." },
            { from: 14.4, to: 20.6, th: `ทุกภาพถูกเก็บในประวัติ (${k("history").join("")}) เปิดแก้ไข คัดลอก หรือลบได้`, en: "Every capture is kept in History – re-open, edit, copy or delete." },
            { from: 21.5, to: 27.6, th: "ยังมีดูดสี ไม้บรรทัดพิกเซล อ่าน QR / บาร์โค้ด – บนเครื่องคุณทั้งหมด", en: "Plus a colour picker, pixel ruler and QR reader – all on your Mac." },
          ]}
          render={(t) => <ToolsDemo t={t} />} />
      ), "tools")}
      {seq(D.adv, (
        <TutorialScene n={5} label="ขั้นสูง" Icon={ChevronsDown} th="สกรอลล์ & บันทึกหน้าจอ" en="Scroll capture & recording" duration={D.adv}
          keysList={[{ keys: k("scroll"), label: "สกรอลล์จับภาพ" }, { keys: k("record"), label: "บันทึกหน้าจอ" }]}
          cues={[
            { from: 0.5, to: 8.6, th: `สกรอลล์จับภาพ ${k("scroll").join("")} เลื่อนหน้ายาว ๆ แล้วแอปต่อเป็นภาพเดียว`, en: "Scrolling capture: scroll a long page and CaptureME stitches it into one image." },
            { from: 9.6, to: 17.6, th: `บันทึกหน้าจอ ${k("record").join("")} เป็น MP4, MOV หรือ GIF พร้อมเสียงและวงกล้องเว็บแคม`, en: "Record as MP4, MOV or GIF – with audio, click rings and a webcam bubble." },
          ]}
          render={(t) => <AdvDemo t={t} />} />
      ), "adv")}
      {seq(D.settings, (
        <TutorialScene n={6} label="ตั้งค่า" Icon={SlidersHorizontal} th="ตั้งค่า & คีย์ลัด" en="Settings & shortcuts" duration={D.settings}
          cues={[
            { from: 0.5, to: 5.0, th: "เลือกภาษา โฟลเดอร์ปลายทาง และรูปแบบไฟล์ PNG / JPG / WebP", en: "Choose language, save folder and file format – PNG / JPG / WebP." },
            { from: 5.3, to: 9.6, th: "ปรับคีย์ลัดทุกตัวได้เอง – คลิกช่องแล้วกดคีย์ที่ต้องการ", en: "Customise every shortcut – click a field and press your keys." },
          ]}
          render={(t) => <SettingsDemo t={t} />} />
      ), "settings")}
      {seq(D.outro, <OutroScene />, "outro")}
    </AbsoluteFill>
  );
};

const InstallExtra: React.FC = () => (
  <div style={{ marginTop: 44, padding: "18px 22px", borderRadius: 18, background: C.ink, boxShadow: "0 18px 40px rgba(15,23,42,.25)" }}>
    <div style={{ fontSize: 20, color: "#94a3b8", marginBottom: 8, fontFamily: FONT }}>ทางลัดผ่าน Terminal · Terminal shortcut</div>
    <div style={{ fontFamily: MONO, fontSize: 19, color: "#86efac", lineHeight: 1.45, wordBreak: "break-all" }}>$ xattr -dr com.apple.quarantine /Applications/CaptureME.app</div>
  </div>
);
export { window01, useVideoConfig, KeyCombo };
