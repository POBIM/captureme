import React from "react";
import { C, FONT } from "../theme";
import { KeyCombo } from "../ui/Keys";
import { ANCHORS } from "../ui/FakePage";
import { EditorMock } from "../ui/EditorMock";
import {
  ScanLine, PenTool, EyeOff, Sparkles, Pin, ScanText, ChevronsDown, Video, History, ShieldCheck, WifiOff, Code2,
  Download, Check, Heart, Pipette, Ruler, QrCode as QrIcon,
} from "lucide-react";
import { keys } from "../site";
import type { LucideIcon } from "lucide-react";

export type Feature = { Icon: LucideIcon; th: string; en: string; color: string };

export const FEATURES: Feature[] = [
  { Icon: ScanLine, th: "จับภาพ 3 แบบ", en: "Region · Window · Full screen", color: "#dc2626" },
  { Icon: PenTool, th: "ตัวแก้ไขภาพครบมือ", en: "Arrows, text, steps, callouts", color: "#ea580c" },
  { Icon: EyeOff, th: "เบลอ / ปิดข้อมูลลับ", en: "Blur, pixelate, solid redact", color: "#7c3aed" },
  { Icon: Sparkles, th: "ครอป พื้นหลัง ลายน้ำ", en: "Crop, gradient, watermark", color: "#db2777" },
  { Icon: Pin, th: "ปักหมุดบนหน้าจอ", en: "Pin images above all windows", color: "#0891b2" },
  { Icon: ScanText, th: "OCR ไทย + อังกฤษ", en: "On-device text recognition", color: "#2563eb" },
  { Icon: ChevronsDown, th: "สกรอลล์จับภาพ", en: "Stitch long pages into one", color: "#16a34a" },
  { Icon: Video, th: "บันทึกหน้าจอ MP4/GIF", en: "Mic, system audio, webcam", color: "#e11d48" },
  { Icon: Pipette, th: "ดูดสีจากหน้าจอ", en: "Colour picker HEX · RGB · HSL", color: "#d97706" },
  { Icon: Ruler, th: "ไม้บรรทัดพิกเซล", en: "Auto-measure anything on screen", color: "#0d9488" },
  { Icon: QrIcon, th: "อ่าน QR / บาร์โค้ด", en: "Scan on your Mac, privately", color: "#4f46e5" },
  { Icon: History, th: "ประวัติ & ภาพย่อ", en: "Re-open, edit, drag out", color: "#475569" },
];

export const SHORTCUTS: { id: string; th: string; en: string }[] = [
  { id: "fullscreen", th: "เต็มหน้าจอ", en: "Full screen" },
  { id: "region", th: "จับภาพพื้นที่", en: "Region" },
  { id: "window", th: "จับภาพหน้าต่าง", en: "Window" },
  { id: "repeat", th: "ซ้ำพื้นที่เดิม", en: "Repeat last" },
  { id: "delayed", th: "หน่วงเวลา", en: "Delayed" },
  { id: "scroll", th: "สกรอลล์จับภาพ", en: "Scrolling" },
  { id: "record", th: "บันทึกหน้าจอ", en: "Record" },
  { id: "ocr", th: "OCR อ่านข้อความ", en: "OCR text" },
  { id: "history", th: "ประวัติ", en: "History" },
  { id: "pin", th: "ปักหมุด", en: "Pin" },
  { id: "color", th: "ดูดสี", en: "Colour picker" },
  { id: "measure", th: "ไม้บรรทัด", en: "Pixel ruler" },
  { id: "qr", th: "อ่าน QR", en: "QR reader" },
  { id: "clipboard", th: "แก้ภาพคลิปบอร์ด", en: "Clipboard image" },
].filter((x) => keys(x.id).length > 0);

export const STEPS = [
  { th: "ดาวน์โหลด", en: "Download", hint: "ไฟล์ .dmg จากหน้า Releases", hintEn: "the .dmg from Releases" },
  { th: "ลากไปที่ Applications", en: "Drag to Applications", hint: "ลากไอคอน CaptureME ลงโฟลเดอร์", hintEn: "drop CaptureME into the folder" },
  { th: "เปิดครั้งแรก: Open Anyway", en: "Open Anyway", hint: "Privacy & Security › Open Anyway", hintEn: "System Settings › Privacy & Security" },
  { th: "อนุญาต Screen Recording", en: "Allow Screen Recording", hint: "เปิดสวิตช์ CaptureME แล้วเปิดแอปใหม่", hintEn: "switch it on, then reopen the app" },
];

export const Pill: React.FC<{ children: React.ReactNode; size: number; bg?: string; color?: string; border?: string; style?: React.CSSProperties }> = ({ children, size, bg = "rgba(255,255,255,.16)", color = "#fff", border = "rgba(255,255,255,.35)", style }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.35, padding: `${size * 0.32}px ${size * 0.7}px`, borderRadius: 999, background: bg, color, border: `${Math.max(1, size * 0.07)}px solid ${border}`, fontFamily: FONT, fontWeight: 600, fontSize: size, lineHeight: 1.1, whiteSpace: "nowrap", ...style }}>{children}</span>
);

export const FeatureTile: React.FC<{ f: Feature; w: number; h: number; s: number }> = ({ f, w, h, s }) => (
  <div style={{ width: w, height: h, borderRadius: s * 22, background: "#fff", boxShadow: "0 2px 4px rgba(15,23,42,.06), 0 10px 30px rgba(15,23,42,.08), 0 0 0 1px #e2e8f0", display: "flex", alignItems: "center", gap: s * 22, padding: `0 ${s * 24}px`, boxSizing: "border-box" }}>
    <div style={{ flex: "none", width: s * 78, height: s * 78, borderRadius: s * 22, background: f.color + "1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <f.Icon size={s * 42} strokeWidth={2} color={f.color} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: s * 31, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>{f.th}</div>
      <div style={{ fontSize: s * 20, color: C.slate2, lineHeight: 1.3, marginTop: s * 3 }}>{f.en}</div>
    </div>
  </div>
);

export const ShortcutCell: React.FC<{ id: string; th: string; en: string; s: number; w: number }> = ({ id, th, en, s, w }) => (
  <div style={{ width: w, display: "flex", alignItems: "center", gap: s * 18 }}>
    <div style={{ flex: "none" }}><KeyCombo keys={keys(id)} size={s * 25} dark /></div>
    <div>
      <div style={{ fontSize: s * 27, fontWeight: 600, color: "#fff", lineHeight: 1.2, whiteSpace: "nowrap" }}>{th}</div>
      <div style={{ fontSize: s * 18, color: "#94a3b8" }}>{en}</div>
    </div>
  </div>
);

export const StepCard: React.FC<{ n: number; s: number; w: number; h: number; step: (typeof STEPS)[number] }> = ({ n, s, w, h, step }) => (
  <div style={{ width: w, height: h, borderRadius: s * 24, background: "#fff", boxShadow: "0 2px 4px rgba(15,23,42,.06), 0 12px 30px rgba(15,23,42,.1), 0 0 0 1px #e2e8f0", padding: s * 26, boxSizing: "border-box", position: "relative" }}>
    <div style={{ width: s * 62, height: s * 62, borderRadius: s * 31, background: C.red, color: "#fff", fontSize: s * 34, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px rgba(220,38,38,.4)" }}>{n}</div>
    <div style={{ marginTop: s * 18, fontSize: s * 30, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>{step.th}</div>
    <div style={{ fontSize: s * 20, fontWeight: 600, color: C.red, marginTop: s * 2 }}>{step.en}</div>
    <div style={{ marginTop: s * 10, fontSize: s * 19, color: C.slate, lineHeight: 1.4 }}>{step.hint}</div>
  </div>
);

export const PrivacyBadges: React.FC<{ s: number; dark?: boolean }> = ({ s, dark }) => {
  const items = [
    { Icon: ShieldCheck, th: "ไม่เก็บข้อมูล", en: "No data collected" },
    { Icon: WifiOff, th: "ไม่ใช้อินเทอร์เน็ต", en: "No network access" },
    { Icon: Code2, th: "โอเพนซอร์ส MIT", en: "Open source · MIT" },
  ];
  return (
    <div style={{ display: "flex", gap: s * 22 }}>
      {items.map(({ Icon, th, en }) => (
        <div key={th} style={{ display: "flex", alignItems: "center", gap: s * 16, padding: `${s * 16}px ${s * 24}px`, borderRadius: s * 22, background: dark ? "rgba(255,255,255,.1)" : C.green50, border: `${s * 2}px solid ${dark ? "rgba(255,255,255,.25)" : "#bbf7d0"}` }}>
          <Icon size={s * 44} color={dark ? "#86efac" : C.green} strokeWidth={2.2} />
          <div>
            <div style={{ fontSize: s * 28, fontWeight: 700, color: dark ? "#fff" : "#14532d", lineHeight: 1.2 }}>{th}</div>
            <div style={{ fontSize: s * 18, color: dark ? "#bbf7d0" : "#166534" }}>{en}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

/** Static annotated editor screenshot used as hero artwork. */
export const AnnotatedShot: React.FC<{ scale?: number; style?: React.CSSProperties }> = ({ scale = 1, style }) => {
  const a = ANCHORS.card2, acc = ANCHORS.account;
  return (
    <div style={{ width: 1200 * scale, height: 720 * scale, ...style }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: 1200, height: 720 }}>
        <EditorMock active="arrow" blur={7}>
          <svg width="960" height="600" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <rect x={a.x - 6} y={a.y - 6} width={a.w + 12} height={a.h + 12} rx="16" fill="none" stroke={C.red} strokeWidth="5" />
            <path d="M 560 238 C 600 224 630 222 662 246" fill="none" stroke={C.red} strokeWidth="6" strokeLinecap="round" />
            <path d="M 662 246 L 640 244 M 662 246 L 654 224" fill="none" stroke={C.red} strokeWidth="6" strokeLinecap="round" />
            <rect x={acc.x - 4} y={acc.y - 4} width={acc.w + 8} height={acc.h + 8} rx="8" fill="none" stroke={C.red} strokeWidth="3" strokeDasharray="8 6" />
            {[[a.x - 2, a.y - 2, "1"], [acc.x - 2, acc.y - 22, "2"], [236, 212, "3"]].map(([x, y, n]) => (
              <g key={n as string}><circle cx={x as number} cy={y as number} r="16" fill={C.red} stroke="#fff" strokeWidth="3" /><text x={x as number} y={(y as number) + 7} textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize="20" fill="#fff">{n}</text></g>
            ))}
          </svg>
          <div style={{ position: "absolute", left: 440, top: 190, padding: "6px 14px", background: C.red, color: "#fff", fontFamily: FONT, fontWeight: 700, fontSize: 20, borderRadius: 10, boxShadow: "0 6px 14px rgba(220,38,38,.35)" }}>ยอดพุ่ง!</div>
        </EditorMock>
      </div>
    </div>
  );
};

export { Download, Check, Heart };
