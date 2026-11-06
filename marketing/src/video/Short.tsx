import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { C, FONT } from "../theme";
import { Shot } from "../Shot";
import { Brand, Trust } from "../poster-parts";
import { KeyCombo } from "../ui/Keys";
import { QrCode } from "../ui/Qr";
import { keys } from "../site";
import { TOOLS } from "../content";
import { FPS } from "./scenes";

const WALL = "radial-gradient(1000px 900px at 10% 0%,#2a3550 0,transparent 60%),radial-gradient(900px 800px at 100% 100%,#3a2f55 0,transparent 55%),linear-gradient(170deg,#1b2338,#12182a)";
const PICKS = ["capture-region", "redact", "background", "ocr", "pin", "record"].map((id) => TOOLS.find((t) => t.id === id)!);
const INTRO = 4 * FPS, PER = 5 * FPS, OUTRO = 7 * FPS;
export const SHORT_FRAMES = INTRO + PICKS.length * PER + OUTRO;

const useFade = (dur: number) => {
  const f = useCurrentFrame();
  return interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const o = useFade(INTRO);
  const y = interpolate(f, [0, 20], [40, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: WALL, fontFamily: FONT, opacity: o, padding: 70, justifyContent: "center", gap: 36 }}>
      <Brand size={90} dark />
      <div style={{ color: "#fff", fontSize: 128, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2, transform: `translateY(${y}px)` }}>จับภาพหน้าจอ<br />Mac <span style={{ color: "#f87171" }}>ฟรี</span></div>
      <div style={{ color: "#fde68a", fontSize: 42 }}>Free screenshot, annotation & recording app</div>
      <div style={{ borderRadius: 26, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.55)", marginTop: 20 }}><Shot src="th/hero.webp" style={{ width: 940 }} /></div>
      <Trust size={24} />
    </AbsoluteFill>
  );
};

const Tool: React.FC<{ i: number }> = ({ i }) => {
  const t = PICKS[i];
  const f = useCurrentFrame();
  const o = useFade(PER);
  const k = interpolate(f, [0, PER], [1, 1.05], { easing: Easing.inOut(Easing.quad) });
  return (
    <AbsoluteFill style={{ background: WALL, fontFamily: FONT, opacity: o, padding: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Brand size={54} dark /><span style={{ color: "#94a3b8", fontSize: 30 }}>{i + 1}/{PICKS.length}</span></div>
      <div style={{ color: "#fff", fontSize: 86, fontWeight: 700, lineHeight: 1.12, marginTop: 60, letterSpacing: -1 }}>{t.th}</div>
      <div style={{ color: "#fde68a", fontSize: 38, marginTop: 14, lineHeight: 1.3 }}>{t.en}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ borderRadius: 26, overflow: "hidden", transform: `scale(${k})`, boxShadow: "0 30px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08)" }}>
          <Shot src={t.img} style={{ width: 960, maxHeight: 760, objectFit: "contain", background: "#dfe6f1" }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, color: "#fff", fontSize: 38, fontWeight: 600, marginBottom: 20 }}>
        {t.keys ? <><span style={{ color: "#cbd5e1" }}>คีย์ลัด</span><KeyCombo keys={keys(t.keys)} size={44} dark /></> : <span>{t.hint?.th}</span>}
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const o = useFade(OUTRO);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1000px 800px at 20% 0%,#ef4444 0,transparent 60%),linear-gradient(170deg,${C.red},${C.redDeep})`, fontFamily: FONT, color: "#fff", opacity: o, alignItems: "center", justifyContent: "center", gap: 40, padding: 60 }}>
      <Brand size={90} dark />
      <div style={{ fontSize: 132, fontWeight: 700, lineHeight: 1.05, textAlign: "center", letterSpacing: -2 }}>ดาวน์โหลดฟรี</div>
      <div style={{ padding: 28, background: "#fff", borderRadius: 36, boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}><QrCode size={500} pad={1} /></div>
      <div style={{ fontSize: 40, fontWeight: 600, background: "rgba(0,0,0,.28)", padding: "14px 26px", borderRadius: 20, textAlign: "center" }}>github.com/POBIM/captureme/releases/latest</div>
      <Trust size={24} />
    </AbsoluteFill>
  );
};

export const Short: React.FC = () => (
  <AbsoluteFill style={{ background: "#12182a" }}>
    <Sequence from={0} durationInFrames={INTRO}><Intro /></Sequence>
    {PICKS.map((_, i) => <Sequence key={i} from={INTRO + i * PER} durationInFrames={PER}><Tool i={i} /></Sequence>)}
    <Sequence from={INTRO + PICKS.length * PER} durationInFrames={OUTRO}><Outro /></Sequence>
  </AbsoluteFill>
);
