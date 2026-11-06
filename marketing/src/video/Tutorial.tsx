import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { C, FONT } from "../theme";
import { Shot } from "../Shot";
import { Brand, Trust, Badge } from "../poster-parts";
import { QrCode } from "../ui/Qr";
import { KeyCombo } from "../ui/Keys";
import { keys } from "../site";
import { CHAPTERS, INTRO_SEC, OUTRO_SEC, FPS, Scene } from "./scenes";

const WALL = "radial-gradient(1400px 900px at 12% 8%,#2a3550 0,transparent 60%),radial-gradient(1200px 800px at 92% 96%,#3a2f55 0,transparent 55%),linear-gradient(160deg,#1b2338,#12182a)";

// ---- timeline -----------------------------------------------------------------------------------------------
interface Item { from: number; dur: number; kind: "intro" | "scene" | "outro"; scene?: Scene; ch?: number; first?: boolean; idx?: number }
const build = () => {
  const items: Item[] = [];
  let f = 0;
  items.push({ from: f, dur: INTRO_SEC * FPS, kind: "intro" }); f += INTRO_SEC * FPS;
  CHAPTERS.forEach((c, ci) => c.scenes.forEach((s, i) => { const d = Math.round(s.sec * FPS); items.push({ from: f, dur: d, kind: "scene", scene: s, ch: ci, first: i === 0, idx: i }); f += d; }));
  items.push({ from: f, dur: OUTRO_SEC * FPS, kind: "outro" }); f += OUTRO_SEC * FPS;
  return { items, total: f };
};
const T = build();
export const TUTORIAL_FRAMES = T.total;

const fade = (frame: number, dur: number, edge = 9) => interpolate(frame, [0, edge, dur - edge, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// ---- scene --------------------------------------------------------------------------------------------------
const SceneView: React.FC<{ it: Item }> = ({ it }) => {
  const frame = useCurrentFrame();
  const s = it.scene!;
  const ch = CHAPTERS[it.ch!];
  const k = interpolate(frame, [0, it.dur], [1, 1.045], { easing: Easing.inOut(Easing.quad) });
  const o = fade(frame, it.dur);
  const capY = interpolate(frame, [0, 14], [26, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: WALL, fontFamily: FONT, opacity: o }}>
      {/* chapter chip */}
      <div style={{ position: "absolute", left: 56, top: 40, display: "flex", gap: 16, alignItems: "center" }}>
        <Badge tone="red" size={26}>บทที่ {it.ch! + 1}/{CHAPTERS.length}</Badge>
        <span style={{ color: "#fff", fontSize: 32, fontWeight: 600 }}>{ch.th}</span>
        <span style={{ color: "#94a3b8", fontSize: 24 }}>{ch.en}</span>
      </div>
      <div style={{ position: "absolute", right: 56, top: 40 }}><Brand size={46} dark /></div>
      {/* the real capture */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 112, height: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${k})`, borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08)", maxWidth: 1480, maxHeight: 700, display: "flex" }}>
          <Shot src={s.img} style={{ maxWidth: 1480, maxHeight: 700, width: "auto", height: "auto", objectFit: "contain" }} />
        </div>
      </div>
      {s.keys && (
        <div style={{ position: "absolute", right: 70, top: 130, background: "rgba(15,23,42,.82)", padding: "12px 22px", borderRadius: 18, display: "flex", gap: 14, alignItems: "center", boxShadow: "0 8px 30px rgba(0,0,0,.4)" }}>
          <span style={{ color: "#cbd5e1", fontSize: 26, fontWeight: 600 }}>คีย์ลัด</span><KeyCombo keys={keys(s.keys)} size={30} dark />
        </div>
      )}
      {/* captions: Thai (main) + English (subtitle) */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 62, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, transform: `translateY(${capY}px)` }}>
        <div style={{ background: "rgba(0,0,0,.72)", color: "#fff", fontSize: 50, fontWeight: 700, padding: "12px 34px", borderRadius: 20, maxWidth: 1700, textAlign: "center", lineHeight: 1.25 }}>{s.th}</div>
        <div style={{ color: "#fde68a", fontSize: 32, fontWeight: 500, textShadow: "0 2px 10px rgba(0,0,0,.9)", textAlign: "center", maxWidth: 1700 }}>{s.en}</div>
        {s.note && <div style={{ color: "#cbd5e1", fontSize: 24, textShadow: "0 2px 8px rgba(0,0,0,.9)" }}>ⓘ {s.note}</div>}
      </div>
    </AbsoluteFill>
  );
};

const Intro: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const up = (d: number) => interpolate(frame, [d, d + 18], [34, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const op = (d: number) => interpolate(frame, [d, d + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: WALL, fontFamily: FONT, opacity: interpolate(frame, [dur - 9, dur], [1, 0], { extrapolateLeft: "clamp" }) }}>
      <div style={{ position: "absolute", left: 120, top: 170, width: 760, display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ opacity: op(0), transform: `translateY(${up(0)}px)` }}><Brand size={96} dark /></div>
        <div style={{ opacity: op(8), transform: `translateY(${up(8)}px)`, color: "#fff", fontSize: 92, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>สอนใช้ทีละเครื่องมือ<br /><span style={{ color: "#f87171" }}>ฟรี</span> บน Mac</div>
        <div style={{ opacity: op(16), transform: `translateY(${up(16)}px)`, color: "#fde68a", fontSize: 38, fontWeight: 500 }}>Learn every tool, one by one – free on Mac</div>
        <div style={{ opacity: op(24) }}><Trust size={22} /></div>
        <div style={{ opacity: op(30), color: "#94a3b8", fontSize: 26, lineHeight: 1.4 }}>ภาพในวิดีโอทั้งหมดเป็นหน้าต่างจริงของแอป ถ่ายบนหน้าจอโล่ง ๆ<br />All pictures are the real app, captured on an empty desktop.</div>
      </div>
      <div style={{ position: "absolute", left: 930, top: 150, width: 900, opacity: op(10), transform: `translateY(${up(10)}px)` }}>
        <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.55)" }}><Shot src="th/hero.webp" style={{ width: 900 }} /></div>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1200px 800px at 20% 0%,#ef4444 0,transparent 60%),linear-gradient(160deg,${C.red},${C.redDeep})`, fontFamily: FONT, color: "#fff", opacity: fade(frame, dur, 12), alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 90, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Brand size={100} dark />
          <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>ดาวน์โหลดฟรี</div>
          <div style={{ fontSize: 42, opacity: 0.92 }}>Free download · macOS 14+ · Apple Silicon + Intel</div>
          <div style={{ fontSize: 44, fontWeight: 600, background: "rgba(0,0,0,.28)", padding: "14px 30px", borderRadius: 20, alignSelf: "flex-start" }}>github.com/POBIM/captureme/releases/latest</div>
          <Trust size={24} />
          <div style={{ fontSize: 28, opacity: 0.85 }}>คู่มือพร้อมภาพจริง: docs/INSTALL-TH.md · docs/USER-GUIDE-TH.md</div>
        </div>
        <div style={{ padding: 28, background: "#fff", borderRadius: 36, boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}><QrCode size={400} pad={1} /></div>
      </div>
    </AbsoluteFill>
  );
};

export const Tutorial: React.FC = () => (
  <AbsoluteFill style={{ background: "#12182a" }}>
    {T.items.map((it, i) => (
      <Sequence key={i} from={it.from} durationInFrames={it.dur}>
        {it.kind === "intro" ? <Intro dur={it.dur} /> : it.kind === "outro" ? <Outro dur={it.dur} /> : <SceneView it={it} />}
      </Sequence>
    ))}
    {/* overall progress */}
    <ProgressBar />
  </AbsoluteFill>
);

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <div style={{ position: "absolute", left: 0, bottom: 0, height: 8, width: `${(frame / durationInFrames) * 100}%`, background: C.red }} />;
};
