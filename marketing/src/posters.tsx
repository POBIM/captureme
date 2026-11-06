import React from "react";
import { C, FONT } from "./theme";
import { Shot } from "./Shot";
import { Brand, Frame, Trust, Download, Shortcut, Badge } from "./poster-parts";
import { KeyCombo } from "./ui/Keys";
import { QrCode } from "./ui/Qr";
import { TOOLS, STEPS, DOWNLOAD_URL } from "./content";
import { keys } from "./site";

const WALL = "radial-gradient(1200px 800px at 15% 10%,#eef2fa 0,transparent 60%),radial-gradient(1000px 700px at 90% 95%,#ece8f6 0,transparent 55%),linear-gradient(160deg,#e6ecf6,#d9dfec)";
const ASPECT: Record<string, number> = { "th/e00-editor-overview.webp": 1640 / 1176, "th/e01-arrow.webp": 1640 / 1176, "th/e05-step.webp": 1640 / 1176, "th/e07-redact.webp": 1640 / 1176, "th/e08-spotlight.webp": 1640 / 1176, "th/e09-magnify.webp": 1640 / 1176, "th/e12-background.webp": 1640 / 1176 };
const tool = (id: string) => TOOLS.find((t) => t.id === id)!;
const col = (gap: number): React.CSSProperties => ({ display: "flex", flexDirection: "column", gap });
const row = (gap: number): React.CSSProperties => ({ display: "flex", gap, alignItems: "center" });

/* ------------------------------------------------------------------ A3 poster (1754 x 2480 -> x2 = 3508 x 4960 px) */
export const A3_W = 1754, A3_H = 2480;
export const PosterA3: React.FC = () => {
  const tiles = ["capture-region", "redact", "background"].map(tool);
  const tiles2 = ["ocr", "color", "video"].map(tool);
  return (
    <div style={{ width: A3_W, height: A3_H, background: WALL, fontFamily: FONT, color: C.ink, padding: 90, display: "flex", flexDirection: "column", gap: 40, boxSizing: "border-box" }}>
      <div style={{ ...row(0), justifyContent: "space-between" }}>
        <Brand size={110} />
        <Trust size={26} />
      </div>
      <div>
        <div style={{ fontSize: 150, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>จับภาพหน้าจอ Mac <span style={{ color: C.red }}>ฟรี</span></div>
        <div style={{ fontSize: 56, fontWeight: 500, marginTop: 18, color: C.ink2 }}>เขียนกำกับ · OCR ไทย/อังกฤษ · สกรอลล์จับภาพ · บันทึกหน้าจอ</div>
        <div style={{ fontSize: 38, color: C.slate2, marginTop: 6 }}>Free screenshot, annotation, OCR & screen-recording app for Mac</div>
      </div>
      <div style={{ alignSelf: "center" }}><Frame src="th/hero.webp" width={1496} height={831} fit="contain" radius={30} /></div>
      <div style={{ fontSize: 30, color: C.slate2, marginTop: -18 }}>ภาพทั้งหมดบนโปสเตอร์นี้เป็นหน้าต่างจริงของแอป (เนื้อหาตัวอย่างเขียนขึ้นเอง) · All pictures are the real app.</div>
      <div style={{ ...row(34), alignItems: "flex-start" }}>
        {[...tiles, ...tiles2].slice(0, 3).map((t) => (
          <div key={t.id} style={{ ...col(14), width: 502 }}>
            <Frame src={t.img} width={502} height={290} fit={t.fit === "contain" ? "contain" : "fill"} pos="center top" bg="#dfe6f1" radius={20} />
            <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>{t.th}</div>
            <div style={{ fontSize: 24, color: C.slate2 }}>{t.en}</div>
          </div>
        ))}
      </div>
      <div style={{ ...row(34), alignItems: "flex-start" }}>
        {STEPS.filter((_, i) => i !== 2).map((s, i) => (
          <div key={s.img} style={{ ...col(14), width: 502 }}>
            <div style={{ position: "relative" }}>
              <Frame src={s.img} width={502} height={230} fit="fill" pos={s.pos ?? "center top"} bg="#dfe6f1" radius={20} />
              <div style={{ position: "absolute", left: -14, top: -14, width: 64, height: 64, borderRadius: 32, background: C.red, color: "#fff", fontSize: 38, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 5px #fff" }}>{i + 1}</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{s.th}</div>
            <div style={{ fontSize: 24, color: C.slate2 }}>{s.en}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ background: C.ink, borderRadius: 36, padding: "40px 56px", ...row(0), justifyContent: "space-between" }}>
        <Download qr={210} size={40} dark />
        <div style={{ ...col(18), color: "#fff", alignItems: "flex-start" }}>
          <div style={{ fontSize: 28, fontWeight: 600, opacity: 0.8 }}>คีย์ลัดเริ่มต้น</div>
          {[["จับพื้นที่", "region"], ["OCR", "ocr"], ["บันทึกหน้าจอ", "record"]].map(([n, a]) => (
            <div key={a} style={{ ...row(18) }}><span style={{ fontSize: 30, width: 190 }}>{n}</span><KeyCombo keys={keys(a)} size={30} dark /></div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ square (1080 -> x2) */
export const SQ = 1080;
export const PosterSquare: React.FC = () => (
  <div style={{ width: SQ, height: SQ, background: WALL, fontFamily: FONT, color: C.ink, padding: 56, boxSizing: "border-box", ...col(22) }}>
    <div style={{ ...row(0), justifyContent: "space-between" }}><Brand size={68} /><Badge tone="red" size={26}>ฟรี · MIT</Badge></div>
    <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>จับภาพหน้าจอ Mac <span style={{ color: C.red }}>ฟรี</span></div>
    <div style={{ fontSize: 32, color: C.ink2, fontWeight: 500 }}>เขียนกำกับ · OCR ไทย · สกรอลล์ · บันทึกหน้าจอ · ไม่เก็บข้อมูล</div>
    <Frame src="th/hero.webp" width={968} height={470} fit="fill" pos="center 30%" radius={24} />
    <div style={{ flex: 1 }} />
    <div style={{ ...row(0), justifyContent: "space-between" }}>
      <Download qr={150} size={30} />
      <KeyCombo keys={keys("region")} size={34} />
    </div>
  </div>
);

/* ------------------------------------------------------------------ wide (1920x1080 -> x2) */
export const WIDE_W = 1920, WIDE_H = 1080;
export const PosterWide: React.FC = () => (
  <div style={{ width: WIDE_W, height: WIDE_H, background: WALL, fontFamily: FONT, color: C.ink, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", left: 80, top: 70, width: 760, ...col(26) }}>
      <Brand size={78} />
      <div style={{ fontSize: 98, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2 }}>จับภาพหน้าจอ<br />Mac <span style={{ color: C.red }}>ฟรี</span></div>
      <div style={{ fontSize: 36, fontWeight: 500, color: C.ink2, lineHeight: 1.35 }}>เขียนกำกับ 20+ เครื่องมือ · OCR ไทย/อังกฤษ<br />สกรอลล์จับภาพ · บันทึกหน้าจอ</div>
      <div style={{ fontSize: 26, color: C.slate2 }}>Free screenshot, annotation & recording app for Mac</div>
      <Trust size={22} />
    </div>
    <div style={{ position: "absolute", left: 80, bottom: 64 }}><Download qr={190} size={34} /></div>
    <div style={{ position: "absolute", left: 880, top: 110, width: 1010 }}>
      <Frame src="th/hero.webp" width={1010} height={560} fit="fill" pos="left 40%" radius={26} />
    </div>
    <div style={{ position: "absolute", left: 930, top: 700, ...row(28), alignItems: "flex-start" }}>
      {["capture-region", "background", "ocr"].map((id) => { const t = tool(id); return (
        <div key={id} style={{ ...col(10), width: 300 }}>
          <Frame src={t.img} width={300} height={170} fit={t.fit === "contain" ? "contain" : "fill"} pos="center top" bg="#dfe6f1" radius={16} />
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{t.th}</div>
        </div>); })}
    </div>
  </div>
);

/* ------------------------------------------------------------------ per-tool social card (1080 x 1350) */
export const CARD_W = 1080, CARD_H = 1350;
export const ToolCard: React.FC<{ i: number }> = ({ i }) => {
  const t = TOOLS[i];
  return (
    <div style={{ width: CARD_W, height: CARD_H, background: WALL, fontFamily: FONT, color: C.ink, padding: 64, boxSizing: "border-box", ...col(0) }}>
      <div style={{ ...row(0), justifyContent: "space-between" }}>
        <Brand size={60} />
        <Badge tone="red" size={26}>เครื่องมือที่ {i + 1}/{TOOLS.length}</Badge>
      </div>
      <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.12, marginTop: 44, letterSpacing: -1 }}>{t.th}</div>
      <div style={{ fontSize: 34, color: C.slate2, marginTop: 12, lineHeight: 1.3 }}>{t.en}</div>
      <div style={{ marginTop: 40, flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Frame src={t.img} width={952} height={640} fit={t.fit === "contain" ? "contain" : "fill"} pos={t.pos ?? "center top"} bg={t.fit === "contain" ? "#dfe6f1" : "transparent"} radius={26} crop={t.crop} aspect={ASPECT[t.img]} />
      </div>
      <div style={{ ...row(0), justifyContent: "space-between", marginTop: 36 }}>
        <Shortcut action={t.keys} hint={t.hint} size={40} />
        <div style={{ textAlign: "right", fontSize: 26, fontWeight: 600, color: C.redDark }}>ฟรี · ไม่เก็บข้อมูล<br /><span style={{ fontWeight: 400, color: C.slate2 }}>{DOWNLOAD_URL}</span></div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ install-steps card */
export const InstallCard: React.FC = () => (
  <div style={{ width: CARD_W, height: CARD_H, background: WALL, fontFamily: FONT, color: C.ink, padding: 64, boxSizing: "border-box", ...col(0) }}>
    <Brand size={60} />
    <div style={{ fontSize: 86, fontWeight: 700, lineHeight: 1.1, marginTop: 38, letterSpacing: -1 }}>ติดตั้งใน <span style={{ color: C.red }}>4 ขั้นตอน</span></div>
    <div style={{ fontSize: 32, color: C.slate2, marginTop: 8 }}>Install in 4 steps · ภาพจริงจากเครื่อง Mac</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34, marginTop: 44 }}>
      {STEPS.map((s, i) => (
        <div key={s.img} style={col(14)}>
          <div style={{ position: "relative" }}>
            <Frame src={s.img} width={459} height={290} fit={s.fit ?? "fill"} pos={s.pos ?? "center top"} bg="#dfe6f1" radius={20} />
            <div style={{ position: "absolute", left: -12, top: -12, width: 60, height: 60, borderRadius: 30, background: C.red, color: "#fff", fontSize: 36, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 5px #fff" }}>{i + 1}</div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>{s.th}</div>
          <div style={{ fontSize: 22, color: C.slate2, lineHeight: 1.25 }}>{s.en}</div>
        </div>
      ))}
    </div>
    <div style={{ flex: 1 }} />
    <div style={{ ...row(0), justifyContent: "space-between" }}>
      <div style={{ fontSize: 26, fontWeight: 600, color: C.slate, whiteSpace: "nowrap" }}>คู่มือ: docs/INSTALL-TH.md</div>
      <Badge tone="dark" size={26}>{DOWNLOAD_URL}</Badge>
    </div>
  </div>
);

/* ------------------------------------------------------------------ download card with QR */
export const DownloadCard: React.FC = () => (
  <div style={{ width: CARD_W, height: CARD_H, background: `radial-gradient(900px 700px at 20% 0%,#ef4444 0,transparent 60%),linear-gradient(160deg,${C.red},${C.redDeep})`, fontFamily: FONT, color: "#fff", padding: 64, boxSizing: "border-box", ...col(0) }}>
    <Brand size={64} dark />
    <div style={{ fontSize: 108, fontWeight: 700, lineHeight: 1.05, marginTop: 56, letterSpacing: -2 }}>ดาวน์โหลด<br />CaptureME<br />ฟรี</div>
    <div style={{ fontSize: 36, opacity: 0.9, marginTop: 16 }}>Free screenshot & recording app for Mac</div>
    <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
      <div style={{ padding: 26, background: "#fff", borderRadius: 34, boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}><QrCode size={380} pad={1} /></div>
    </div>
    <div style={{ textAlign: "center", fontSize: 36, fontWeight: 600, marginTop: 34, background: "rgba(0,0,0,.25)", borderRadius: 20, padding: "16px 0" }}>{DOWNLOAD_URL}</div>
    <div style={{ flex: 1 }} />
    <div style={{ ...row(14), justifyContent: "center", flexWrap: "wrap" }}><Trust size={19} /></div>
  </div>
);
