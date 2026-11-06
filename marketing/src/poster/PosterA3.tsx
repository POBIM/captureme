import React from "react";
import { C, FONT } from "../theme";
import { AppIcon } from "../ui/AppIcon";
import { QrCode } from "../ui/Qr";
import { SITE, APP } from "../site";
import { FEATURES, SHORTCUTS, STEPS, FeatureTile, ShortcutCell, StepCard, Pill, PrivacyBadges, AnnotatedShot } from "./parts";
import { ArrowRight, Download, Heart } from "lucide-react";

export const A3_W = 1754;
export const A3_H = 2480;

const Section: React.FC<{ y: number; h: number; bg?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ y, h, bg, children, style }) => (
  <div style={{ position: "absolute", left: 0, top: y, width: A3_W, height: h, background: bg, ...style }}>{children}</div>
);
const SectionTitle: React.FC<{ th: string; en: string; dark?: boolean; color?: string }> = ({ th, en, dark, color }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
    <div style={{ width: 10, height: 44, borderRadius: 5, background: color ?? C.red, alignSelf: "center" }} />
    <span style={{ fontSize: 54, fontWeight: 700, color: dark ? "#fff" : C.ink }}>{th}</span>
    <span style={{ fontSize: 30, fontWeight: 500, color: dark ? "#94a3b8" : C.slate2 }}>{en}</span>
  </div>
);

const SC_COLS = 5;

export const PosterA3: React.FC = () => {
  const P = 96;
  return (
    <div style={{ position: "relative", width: A3_W, height: A3_H, background: C.bg, fontFamily: FONT, overflow: "hidden", color: C.ink }}>
      {/* ---------------- HERO ---------------- */}
      <Section y={0} h={720} style={{ background: "linear-gradient(135deg,#ef4444 0%,#dc2626 38%,#991b1b 100%)", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -200, top: -260, width: 900, height: 900, borderRadius: 450, background: "rgba(255,255,255,.07)" }} />
        <div style={{ position: "absolute", left: -260, bottom: -420, width: 800, height: 800, borderRadius: 400, background: "rgba(0,0,0,.08)" }} />
        <div style={{ position: "absolute", left: P, top: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <AppIcon size={168} />
            <div style={{ fontSize: 148, fontWeight: 700, color: "#fff", letterSpacing: -4, lineHeight: 1 }}>CaptureME</div>
          </div>
          <div style={{ marginTop: 40, fontSize: 82, fontWeight: 700, color: "#fff", lineHeight: 1.2, letterSpacing: -1 }}>
            แอปจับภาพหน้าจอ<span style={{ color: "#fde68a" }}>ฟรี</span><br />สำหรับ Mac
          </div>
          <div style={{ marginTop: 14, fontSize: 40, fontWeight: 500, color: "rgba(255,255,255,.88)" }}>Free screenshot &amp; annotation app for Mac</div>
          <div style={{ marginTop: 30, display: "flex", flexWrap: "wrap", gap: 14, width: 780 }}>
            <Pill size={27}>♥ ฟรีตลอดไป</Pill>
            <Pill size={27}>โอเพนซอร์ส MIT</Pill>
            <Pill size={27}>Apple Silicon + Intel</Pill>
            <Pill size={27}>macOS {APP.minMacOS.replace(".0", "")}+</Pill>
          </div>
        </div>
        <div style={{ position: "absolute", left: 900, top: 270, transform: "rotate(-3deg)", filter: "drop-shadow(0 40px 60px rgba(0,0,0,.35))" }}>
          <AnnotatedShot scale={0.72} />
        </div>
      </Section>

      {/* ---------------- FEATURES ---------------- */}
      <Section y={720} h={690}>
        <div style={{ position: "absolute", left: P, top: 50 }}><SectionTitle th="ฟีเจอร์ครบ ใช้ฟรี" en="Everything you need – free" /></div>
        <div style={{ position: "absolute", left: P, top: 138, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, width: A3_W - P * 2 }}>
          {FEATURES.map((f) => <FeatureTile key={f.th} f={f} w={(A3_W - P * 2 - 60) / 4} h={150} s={0.86} />)}
        </div>
      </Section>

      {/* ---------------- SHORTCUTS ---------------- */}
      <Section y={1410} h={380} bg={C.ink}>
        <div style={{ position: "absolute", left: P, top: 48 }}><SectionTitle th="คีย์ลัด" en="Keyboard shortcuts" dark /></div>
        <div style={{ position: "absolute", left: P, top: 140, width: A3_W - P * 2, display: "grid", gridTemplateColumns: `repeat(${SC_COLS}, 1fr)`, rowGap: 28, columnGap: 16 }}>
          {SHORTCUTS.map((s) => <ShortcutCell key={s.id} {...s} s={0.88} w={(A3_W - P * 2 - 16 * (SC_COLS - 1)) / SC_COLS} />)}
        </div>
      </Section>

      {/* ---------------- INSTALL ---------------- */}
      <Section y={1790} h={400}>
        <div style={{ position: "absolute", left: P, top: 50 }}><SectionTitle th="ติดตั้งใน 4 ขั้นตอน" en="Install in 4 steps" /></div>
        <div style={{ position: "absolute", left: P, top: 140, display: "flex", alignItems: "center", gap: 0 }}>
          {STEPS.map((st, i) => (
            <React.Fragment key={i}>
              <StepCard n={i + 1} step={st} s={1} w={(A3_W - P * 2 - 3 * 46) / 4} h={250} />
              {i < 3 && <div style={{ width: 46, display: "flex", justifyContent: "center" }}><ArrowRight size={34} color={C.red} strokeWidth={3} /></div>}
            </React.Fragment>
          ))}
        </div>
      </Section>

      {/* ---------------- PRIVACY + FOOTER ---------------- */}
      <Section y={2190} h={290} style={{ background: "linear-gradient(135deg,#14532d,#166534)" }}>
        <div style={{ position: "absolute", left: P, top: 34 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#fff", marginBottom: 16 }}>คำสัญญาของเรา · <span style={{ fontWeight: 500, color: "#bbf7d0" }}>Our privacy promise</span></div>
          <PrivacyBadges s={0.8} dark />
          <div style={{ marginTop: 24, fontSize: 25, color: "#dcfce7", lineHeight: 1.45 }}>
            ภาพและประวัติอยู่ในเครื่องคุณเท่านั้น · ใช้ฟรี แจกต่อ แก้ไขได้ ไม่มีการรับประกัน<br />
            <span style={{ fontSize: 20, color: "#86efac" }}>Images &amp; history never leave your Mac · MIT License · © 2026 {SITE.author} · v{APP.version}</span>
          </div>
        </div>
        <div style={{ position: "absolute", right: P, top: 22, width: 640, height: 244, borderRadius: 30, background: "#fff", boxShadow: "0 20px 50px rgba(0,0,0,.3)", display: "flex", alignItems: "center", gap: 26, padding: "0 28px", boxSizing: "border-box" }}>
          <div style={{ flex: "none", borderRadius: 14, overflow: "hidden", boxShadow: "0 0 0 2px #e2e8f0" }}><QrCode size={180} /></div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 28, fontWeight: 700, color: C.red }}><Download size={28} strokeWidth={3} /> ดาวน์โหลดฟรี</div>
            <div style={{ fontSize: 17, color: C.slate, marginTop: 2 }}>Scan or visit · สแกนหรือเข้าเว็บ</div>
            <div style={{ marginTop: 12, fontSize: 21, fontWeight: 700, color: C.ink, lineHeight: 1.25, whiteSpace: "nowrap" }}>{SITE.urlShort}</div>
            <div style={{ marginTop: 8, fontSize: 16, color: C.slate2, display: "flex", alignItems: "center", gap: 6 }}>ทำด้วย <Heart size={15} color={C.red} fill={C.red} /> โดย {SITE.author}</div>
          </div>
        </div>
      </Section>
    </div>
  );
};
