import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { C, FONT } from "../theme";
import { SITE, keys } from "../site";
import { AppIcon } from "../ui/AppIcon";
import { QrCode } from "../ui/Qr";
import { KeyCombo } from "../ui/Keys";
import { PrivacyBadges, Pill, STEPS } from "../poster/parts";
import { seg, ease, FPS, window01 } from "./anim";
import { RegionDemo } from "./demos-capture";
import { EditorDemo } from "./demos-editor";
import { OcrDemo } from "./demos-tools";
import { ScrollDemo } from "./demos-adv";
import { Download, ArrowDown } from "lucide-react";

const S = (sec: number) => Math.round(sec * FPS);

const Frame: React.FC<{ dur: number; th: string; en: string; cap?: { th: string; en: string }; chips?: React.ReactNode; children: React.ReactNode; scale?: number }> = ({ dur, th, en, cap, chips, children, scale = 0.88 }) => {
  const t = useCurrentFrame() / FPS;
  const p = seg(t, 0, 0.5, ease);
  const o = Math.min(seg(t, 0, 0.25), 1 - seg(t, dur - 0.25, dur));
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg,#f8fafc,#fde8e8)", opacity: o, fontFamily: FONT }}>
      <div style={{ position: "absolute", right: -200, top: -200, width: 640, height: 640, borderRadius: 320, background: "rgba(220,38,38,.09)" }} />
      <div style={{ position: "absolute", left: 60, right: 60, top: 150, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 26}px)` }}>
        <div style={{ fontSize: 96, fontWeight: 700, color: C.ink, lineHeight: 1.15, letterSpacing: -1 }}>{th}</div>
        <div style={{ marginTop: 8, fontSize: 44, fontWeight: 500, color: C.red }}>{en}</div>
      </div>
      <div style={{ position: "absolute", left: (1080 - 1200 * scale) / 2, top: 500, width: 1200, height: 720, transform: `scale(${scale}) translateY(${(1 - p) * 40}px)`, transformOrigin: "0 0", opacity: p }}>{children}</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 500 + 720 * scale + 50, display: "flex", justifyContent: "center", gap: 28, opacity: seg(t, 0.5, 1.0, ease) }}>{chips}</div>
      {cap && (
        <div style={{ position: "absolute", left: 60, right: 60, top: 1380, padding: "36px 44px", borderRadius: 44, background: "rgba(15,23,42,.92)", textAlign: "center", boxShadow: "0 24px 60px rgba(15,23,42,.35)", opacity: seg(t, 0.7, 1.2, ease), transform: `translateY(${(1 - seg(t, 0.7, 1.2, ease)) * 24}px)` }}>
          <div style={{ fontSize: 58, fontWeight: 600, color: "#fff", lineHeight: 1.3 }}>{cap.th}</div>
          <div style={{ marginTop: 10, fontSize: 36, color: "#fca5a5", lineHeight: 1.3 }}>{cap.en}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

const Chip: React.FC<{ k: string[]; label: string }> = ({ k, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 30px", borderRadius: 28, background: "#fff", boxShadow: "0 14px 34px rgba(15,23,42,.15), 0 0 0 1px #e2e8f0" }}>
    <KeyCombo keys={k} size={36} /><span style={{ fontSize: 38, fontWeight: 600, color: C.ink }}>{label}</span>
  </div>
);

const Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const t = useCurrentFrame() / FPS;
  const p = (a: number) => seg(t, a, a + 0.6, ease);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg,#ef4444,#dc2626 45%,#7f1d1d)", fontFamily: FONT, opacity: 1 - seg(t, dur - 0.25, dur) }}>
      <div style={{ position: "absolute", left: -260, top: 900, width: 900, height: 900, borderRadius: 450, background: "rgba(0,0,0,.1)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", justifyContent: "center", opacity: p(0), transform: `scale(${0.6 + 0.4 * p(0)})` }}><AppIcon size={300} /></div>
      <div style={{ position: "absolute", left: 40, right: 40, top: 700, textAlign: "center", opacity: p(0.4), transform: `translateY(${(1 - p(0.4)) * 40}px)` }}>
        <div style={{ fontSize: 150, fontWeight: 700, color: "#fff", letterSpacing: -5, lineHeight: 1 }}>CaptureME</div>
        <div style={{ marginTop: 30, fontSize: 92, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>แคปหน้าจอ Mac<br /><span style={{ color: "#fde68a" }}>ฟรี</span> ครบทุกอย่าง</div>
        <div style={{ marginTop: 16, fontSize: 46, color: "rgba(255,255,255,.9)" }}>Free screenshot app for Mac</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1420, display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", padding: "0 60px", opacity: p(1.4) }}>
        <Pill size={38}>ไม่เก็บข้อมูล</Pill><Pill size={38}>ไม่ใช้เน็ต</Pill><Pill size={38}>โอเพนซอร์ส MIT</Pill>
      </div>
    </AbsoluteFill>
  );
};

const Steps: React.FC<{ dur: number }> = ({ dur }) => {
  const t = useCurrentFrame() / FPS;
  const o = Math.min(seg(t, 0, 0.25), 1 - seg(t, dur - 0.25, dur));
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg,#f8fafc,#fde8e8)", fontFamily: FONT, opacity: o }}>
      <div style={{ position: "absolute", left: 60, right: 60, top: 150, textAlign: "center" }}>
        <div style={{ fontSize: 96, fontWeight: 700, color: C.ink }}>ติดตั้งใน 4 ขั้นตอน</div>
        <div style={{ fontSize: 44, fontWeight: 500, color: C.red }}>Install in 4 steps</div>
      </div>
      <div style={{ position: "absolute", left: 80, right: 80, top: 440, display: "flex", flexDirection: "column", gap: 34 }}>
        {STEPS.map((s, i) => {
          const p = seg(t, 0.4 + i * 0.55, 0.9 + i * 0.55, ease);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 34, padding: "34px 40px", borderRadius: 36, background: "#fff", boxShadow: "0 18px 44px rgba(15,23,42,.14), 0 0 0 1px #e2e8f0", opacity: p, transform: `translateX(${(1 - p) * 80}px)` }}>
              <div style={{ flex: "none", width: 110, height: 110, borderRadius: 55, background: C.red, color: "#fff", fontSize: 62, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px rgba(220,38,38,.4)" }}>{i + 1}</div>
              <div><div style={{ fontSize: 56, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>{s.th}</div><div style={{ fontSize: 34, color: C.red, fontWeight: 600 }}>{s.en}</div></div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const ShortOutro: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const p = (a: number) => seg(t, a, a + 0.6, ease);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg,#0f172a,#1e1b4b 60%,#7f1d1d)", fontFamily: FONT, opacity: seg(t, 0, 0.3) }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 200, textAlign: "center", opacity: p(0.1) }}>
        <div style={{ display: "flex", justifyContent: "center" }}><AppIcon size={200} /></div>
        <div style={{ marginTop: 26, fontSize: 130, fontWeight: 700, color: "#fff", letterSpacing: -4 }}>CaptureME</div>
        <div style={{ marginTop: 16, fontSize: 70, fontWeight: 700, color: "#fff", lineHeight: 1.25 }}>ใช้ฟรี · โอเพนซอร์ส<br />ไม่เก็บข้อมูล</div>
      </div>
      <div style={{ position: "absolute", left: 140, right: 140, top: 940, borderRadius: 50, background: "#fff", padding: "44px 40px", textAlign: "center", opacity: p(0.8), transform: `translateY(${(1 - p(0.8)) * 40}px)` }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, fontSize: 52, fontWeight: 700, color: C.red }}><Download size={50} strokeWidth={3} /> ดาวน์โหลดฟรี</div>
        <div style={{ margin: "26px auto 0", width: 460, borderRadius: 24, overflow: "hidden", boxShadow: "0 0 0 3px #e2e8f0" }}><QrCode size={460} /></div>
        <div style={{ marginTop: 24, fontSize: 38, fontWeight: 700, color: C.ink }}>{SITE.urlShort}</div>
      </div>
    </AbsoluteFill>
  );
};

const D = { hook: 3.5, capture: 6, editor: 8, ocr: 5, scroll: 5.5, steps: 5, outro: 5 };
export const SHORT_FRAMES = S(Object.values(D).reduce((a, b) => a + b, 0));

export const Short: React.FC = () => {
  let at = 0;
  const seq = (dur: number, node: React.ReactNode, key: string) => {
    const el = <Sequence key={key} from={S(at)} durationInFrames={S(dur)}>{node}</Sequence>;
    at += dur;
    return el;
  };
  const Timed: React.FC<{ speed: number; offset?: number; Comp: React.FC<{ t: number }> }> = ({ speed, offset = 0, Comp }) => <Comp t={offset + (useCurrentFrame() / FPS) * speed} />;
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      {seq(D.hook, <Hook dur={D.hook} />, "hook")}
      {seq(D.capture, <Frame dur={D.capture} th="จับภาพ ลากเลือกพื้นที่" en="Capture any area" cap={{ th: "กดคีย์ลัด ลากเลือก ก็ได้ภาพทันที", en: "Press the shortcut, drag – done." }} chips={<Chip k={keys("region")} label="พื้นที่" />}><Timed Comp={RegionDemo} speed={1.1} offset={1.0} /></Frame>, "capture")}
      {seq(D.editor, <Frame dur={D.editor} th="แก้ไข · เบลอ · ตกแต่ง" en="Annotate, blur, beautify" cap={{ th: "ลูกศร ข้อความ เบลอข้อมูลลับ ครอป และพื้นหลังสวย ๆ", en: "Arrows, text, blur, crop and a beautiful background." }} chips={<><Chip k={["A"]} label="ลูกศร" /><Chip k={["B"]} label="เบลอ" /></>}><Timed Comp={EditorDemo} speed={3.1} /></Frame>, "editor")}
      {seq(D.ocr, <Frame dur={D.ocr} th="OCR ไทย + อังกฤษ" en="Read text from the screen" cap={{ th: "ลากเลือกข้อความ คัดลอกได้ทันที ประมวลผลบนเครื่อง", en: "Drag over text and copy it – processed on your Mac." }} chips={<Chip k={keys("ocr")} label="OCR" />}><Timed Comp={OcrDemo} speed={1.4} offset={0.4} /></Frame>, "ocr")}
      {seq(D.scroll, <Frame dur={D.scroll} th="สกรอลล์จับภาพยาว ๆ" en="Stitch long pages into one" cap={{ th: "เลื่อนหน้าเว็บหรือเอกสารยาว ๆ แอปต่อภาพให้เอง", en: "Scroll a long page – CaptureME stitches it for you." }} chips={<Chip k={keys("scroll")} label="สกรอลล์" />}><Timed Comp={ScrollDemo} speed={1.45} /></Frame>, "scroll")}
      {seq(D.steps, <Steps dur={D.steps} />, "steps")}
      {seq(D.outro, <ShortOutro />, "outro")}
    </AbsoluteFill>
  );
};
export { ArrowDown, window01 };
