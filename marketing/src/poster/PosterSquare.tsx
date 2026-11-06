import React from "react";
import { C, FONT } from "../theme";
import { AppIcon } from "../ui/AppIcon";
import { QrCode } from "../ui/Qr";
import { SITE, APP } from "../site";
import { FEATURES, SHORTCUTS, STEPS, FeatureTile, ShortcutCell, Pill, PrivacyBadges } from "./parts";
import { ArrowRight, Download } from "lucide-react";

export const SQ = 1080;

export const PosterSquare: React.FC = () => {
  const P = 48;
  const SC = ["region", "window", "fullscreen", "delayed", "scroll", "record", "ocr", "history"].map((id) => SHORTCUTS.find((x) => x.id === id)!).filter(Boolean);
  const cols = 4;
  const shortcutRows = Math.ceil(SC.length / cols);
  return (
    <div style={{ position: "relative", width: SQ, height: SQ, background: C.bg, fontFamily: FONT, overflow: "hidden", color: C.ink }}>
      {/* hero */}
      <div style={{ position: "absolute", left: 0, top: 0, width: SQ, height: 330, background: "linear-gradient(135deg,#ef4444 0%,#dc2626 40%,#991b1b 100%)", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -120, top: -180, width: 520, height: 520, borderRadius: 260, background: "rgba(255,255,255,.08)" }} />
        <div style={{ position: "absolute", left: P, top: 40, display: "flex", alignItems: "center", gap: 22 }}>
          <AppIcon size={104} />
          <div style={{ fontSize: 92, fontWeight: 700, color: "#fff", letterSpacing: -3, lineHeight: 1 }}>CaptureME</div>
        </div>
        <div style={{ position: "absolute", left: P, top: 170, fontSize: 49, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>แอปจับภาพหน้าจอ<span style={{ color: "#fde68a" }}>ฟรี</span>สำหรับ Mac</div>
        <div style={{ position: "absolute", left: P, top: 236, fontSize: 25, fontWeight: 500, color: "rgba(255,255,255,.9)" }}>Free screenshot &amp; annotation app for Mac</div>
        <div style={{ position: "absolute", left: P, top: 278, display: "flex", gap: 10 }}>
          <Pill size={17}>♥ ฟรีตลอดไป</Pill><Pill size={17}>โอเพนซอร์ส MIT</Pill><Pill size={17}>Apple Silicon + Intel</Pill><Pill size={17}>macOS {APP.minMacOS.replace(".0", "")}+</Pill>
        </div>
      </div>
      {/* features */}
      <div style={{ position: "absolute", left: P, top: 352, width: SQ - P * 2, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {FEATURES.map((f) => <FeatureTile key={f.th} f={f} w={(SQ - P * 2 - 16) / 3} h={62} s={0.5} />)}
      </div>
      {/* shortcuts */}
      <div style={{ position: "absolute", left: 0, top: 636, width: SQ, height: 62 + shortcutRows * 56 + 14, background: C.ink }}>
        <div style={{ position: "absolute", left: P, top: 16, fontSize: 26, fontWeight: 700, color: "#fff" }}>คีย์ลัด <span style={{ fontSize: 17, fontWeight: 500, color: "#94a3b8" }}>Keyboard shortcuts · + pin · colour · ruler · QR</span></div>
        <div style={{ position: "absolute", left: P, top: 62, width: SQ - P * 2, display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, rowGap: 8, columnGap: 10 }}>
          {SC.map((s) => <ShortcutCell key={s.id} {...s} s={0.6} w={(SQ - P * 2 - 10 * (cols - 1)) / cols} />)}
        </div>
      </div>
      {/* install */}
      <div style={{ position: "absolute", left: P, top: 636 + 62 + shortcutRows * 56 + 14 + 12, width: SQ - P * 2, display: "flex", alignItems: "stretch", gap: 0 }}>
        {STEPS.map((st, i) => (
          <React.Fragment key={i}>
            <div style={{ flex: 1, borderRadius: 16, background: "#fff", boxShadow: "0 1px 3px rgba(15,23,42,.08), 0 0 0 1px #e2e8f0", padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: "none", width: 38, height: 38, borderRadius: 19, background: C.red, color: "#fff", fontSize: 21, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div><div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>{st.th}</div><div style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>{st.en}</div></div>
            </div>
            {i < 3 && <div style={{ width: 22, display: "flex", alignItems: "center", justifyContent: "center" }}><ArrowRight size={18} color={C.red} strokeWidth={3} /></div>}
          </React.Fragment>
        ))}
      </div>
      {/* footer */}
      <div style={{ position: "absolute", left: 0, bottom: 0, width: SQ, height: 148, background: "linear-gradient(135deg,#14532d,#166534)" }}>
        <div style={{ position: "absolute", left: P, top: 20 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: "#fff", marginBottom: 10 }}>ไม่เก็บข้อมูล · ไม่ใช้อินเทอร์เน็ต · โอเพนซอร์ส <span style={{ color: "#bbf7d0", fontWeight: 500, fontSize: 16 }}>MIT</span></div>
          <PrivacyBadges s={0.5} dark />
          <div style={{ marginTop: 9, fontSize: 14, color: "#bbf7d0" }}>ใช้ฟรี แจกต่อ แก้ไขได้ · ไม่มีการรับประกัน · © 2026 {SITE.author}</div>
        </div>
        <div style={{ position: "absolute", right: 28, top: 22, height: 104, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", gap: 14, padding: "0 16px 0 12px", boxShadow: "0 8px 22px rgba(0,0,0,.3)" }}>
          <QrCode size={84} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 19, fontWeight: 700, color: C.red }}><Download size={19} strokeWidth={3} /> ดาวน์โหลดฟรี</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 4 }}>{SITE.urlShort}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
