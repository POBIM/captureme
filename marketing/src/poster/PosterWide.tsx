import React from "react";
import { C, FONT } from "../theme";
import { AppIcon } from "../ui/AppIcon";
import { QrCode } from "../ui/Qr";
import { SITE, APP } from "../site";
import { FEATURES, SHORTCUTS, STEPS, FeatureTile, ShortcutCell, Pill, PrivacyBadges, StepCard } from "./parts";
import { ArrowRight, Download } from "lucide-react";

export const WIDE_W = 1920;
export const WIDE_H = 1080;

export const PosterWide: React.FC = () => {
  const L = 700; // left panel
  const R0 = L + 44;
  const RW = WIDE_W - R0 - 48;
  const SC = SHORTCUTS.slice(0, 12);
  const cols = 4;
  return (
    <div style={{ position: "relative", width: WIDE_W, height: WIDE_H, background: C.bg, fontFamily: FONT, overflow: "hidden", color: C.ink }}>
      {/* left hero panel */}
      <div style={{ position: "absolute", left: 0, top: 0, width: L, height: WIDE_H, background: "linear-gradient(160deg,#ef4444 0%,#dc2626 40%,#7f1d1d 100%)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -180, top: -200, width: 600, height: 600, borderRadius: 300, background: "rgba(255,255,255,.07)" }} />
        <div style={{ position: "absolute", left: 220, bottom: -300, width: 700, height: 700, borderRadius: 350, background: "rgba(0,0,0,.1)" }} />
        <div style={{ position: "absolute", left: 56, top: 60 }}>
          <AppIcon size={128} />
          <div style={{ marginTop: 28, fontSize: 112, fontWeight: 700, color: "#fff", letterSpacing: -4, lineHeight: 1 }}>CaptureME</div>
          <div style={{ marginTop: 28, fontSize: 56, fontWeight: 700, color: "#fff", lineHeight: 1.22 }}>แอปจับภาพหน้าจอ<span style={{ color: "#fde68a" }}>ฟรี</span><br />สำหรับ Mac</div>
          <div style={{ marginTop: 10, fontSize: 28, fontWeight: 500, color: "rgba(255,255,255,.9)" }}>Free screenshot &amp; annotation app for Mac</div>
          <div style={{ marginTop: 30, display: "flex", flexWrap: "wrap", gap: 10, width: 600 }}>
            <Pill size={20}>♥ ฟรีตลอดไป</Pill><Pill size={20}>โอเพนซอร์ส MIT</Pill><Pill size={20}>Apple Silicon + Intel</Pill><Pill size={20}>macOS {APP.minMacOS.replace(".0", "")}+</Pill>
          </div>
        </div>
        <div style={{ position: "absolute", left: 56, bottom: 48, width: L - 112, height: 190, borderRadius: 26, background: "#fff", boxShadow: "0 20px 50px rgba(0,0,0,.35)", display: "flex", alignItems: "center", gap: 22, padding: "0 24px", boxSizing: "border-box" }}>
          <QrCode size={140} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 28, fontWeight: 700, color: C.red }}><Download size={26} strokeWidth={3} /> ดาวน์โหลดฟรี</div>
            <div style={{ fontSize: 15, color: C.slate }}>Scan or visit · สแกนหรือเข้าเว็บ</div>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700, color: C.ink, whiteSpace: "nowrap" }}>{SITE.urlShort}</div>
          </div>
        </div>
      </div>
      {/* right content */}
      <div style={{ position: "absolute", left: R0, top: 44, width: RW, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {FEATURES.map((f) => <FeatureTile key={f.th} f={f} w={(RW - 32) / 3} h={88} s={0.62} />)}
      </div>
      <div style={{ position: "absolute", left: R0, top: 44 + 4 * 88 + 3 * 12 + 24, width: RW, borderRadius: 26, background: C.ink, padding: "18px 30px 22px", boxSizing: "border-box" }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 12 }}>คีย์ลัด <span style={{ fontSize: 18, fontWeight: 500, color: "#94a3b8" }}>Keyboard shortcuts</span></div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, rowGap: 12, columnGap: 14 }}>
          {SC.map((s) => <ShortcutCell key={s.id} {...s} s={0.66} w={(RW - 60 - 14 * (cols - 1)) / cols} />)}
        </div>
      </div>
      <div style={{ position: "absolute", left: R0, top: 742, width: RW, fontSize: 24, fontWeight: 700 }}>ติดตั้งใน 4 ขั้นตอน <span style={{ fontSize: 18, fontWeight: 500, color: C.slate2 }}>Install in 4 steps</span></div>
      <div style={{ position: "absolute", left: R0, top: 782, width: RW, display: "flex", alignItems: "center" }}>
        {STEPS.map((st, i) => (
          <React.Fragment key={i}>
            <StepCard n={i + 1} step={st} s={0.6} w={(RW - 3 * 30) / 4} h={178} />
            {i < 3 && <div style={{ width: 30, display: "flex", justifyContent: "center" }}><ArrowRight size={22} color={C.red} strokeWidth={3} /></div>}
          </React.Fragment>
        ))}
      </div>
      <div style={{ position: "absolute", left: R0, bottom: 26, width: RW }}>
        <PrivacyBadges s={0.56} />
      </div>
    </div>
  );
};
