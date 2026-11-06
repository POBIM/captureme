import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { seg, ease, window01 } from "./anim";
import { KeyCombo, Rich } from "../ui/Keys";
import type { LucideIcon } from "lucide-react";

export const STAGE_W = 1200;
export const STAGE_H = 720;

/** Rounded "screen" that holds every animated demo (1200×720). */
export const Stage: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; bg?: string }> = ({ children, style, bg = "#0b1020" }) => (
  <div style={{ position: "relative", width: STAGE_W, height: STAGE_H, borderRadius: 26, overflow: "hidden", background: bg, boxShadow: "0 40px 90px rgba(15,23,42,.35), 0 0 0 1px rgba(15,23,42,.15)", fontFamily: FONT, ...style }}>{children}</div>
);

export type Cue = { from: number; to: number; th: string; en: string };

export const CaptionBar: React.FC<{ t: number; cues: Cue[]; width?: number; thSize?: number; enSize?: number; bottom?: number }> = ({ t, cues, width = 1560, thSize = 46, enSize = 28, bottom = 64 }) => {
  const cue = cues.find((c) => t >= c.from && t < c.to);
  if (!cue) return null;
  const a = window01(t, cue.from, cue.to, 0.3);
  const y = (1 - seg(t, cue.from, cue.from + 0.4, ease)) * 14;
  return (
    <div style={{ position: "absolute", left: "50%", bottom, width, transform: `translate(-50%, ${y}px)`, opacity: a, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: width, textAlign: "center", padding: `${thSize * 0.45}px ${thSize * 0.9}px`, borderRadius: thSize * 0.8, background: "rgba(15,23,42,.9)", boxShadow: "0 20px 50px rgba(15,23,42,.35)", backdropFilter: "blur(10px)" }}>
        <div style={{ fontSize: thSize, fontWeight: 600, color: "#fff", lineHeight: 1.35, fontFamily: FONT }}><Rich text={cue.th} /></div>
        <div style={{ fontSize: enSize, fontWeight: 400, color: "#fca5a5", lineHeight: 1.35, marginTop: 4, fontFamily: FONT }}><Rich text={cue.en} /></div>
      </div>
    </div>
  );
};

export const Backdrop: React.FC<{ variant?: "light" | "dark" }> = ({ variant = "light" }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 20;
  return (
    <AbsoluteFill style={{ background: variant === "light" ? "linear-gradient(135deg,#f8fafc 0%,#eef2f7 55%,#fde8e8 100%)" : "linear-gradient(135deg,#0f172a,#1e1b4b)" }}>
      <div style={{ position: "absolute", right: -220 + drift, top: -260, width: 760, height: 760, borderRadius: 380, background: "rgba(220,38,38,.08)" }} />
      <div style={{ position: "absolute", left: -260, bottom: -300 - drift, width: 700, height: 700, borderRadius: 350, background: "rgba(99,102,241,.07)" }} />
    </AbsoluteFill>
  );
};

export const SectionBadge: React.FC<{ n: number; label: string; Icon: LucideIcon; t: number }> = ({ n, label, Icon, t }) => {
  const p = seg(t, 0, 0.6, ease);
  return (
    <div style={{ position: "absolute", left: 80, top: 62, display: "flex", alignItems: "center", gap: 16, opacity: p, transform: `translateX(${(1 - p) * -40}px)` }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: C.red, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px rgba(220,38,38,.35)" }}><Icon size={34} strokeWidth={2.2} /></div>
      <div style={{ fontFamily: FONT }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: C.red, letterSpacing: 2 }}>STEP {n}</div>
      </div>
    </div>
  );
};

/** Left-side title block for a scene. */
export const SideTitle: React.FC<{ t: number; th: string; en: string; keysList?: { keys: string[]; label: string }[]; extra?: React.ReactNode; top?: number }> = ({ t, th, en, keysList, extra, top = 170 }) => {
  const p = seg(t, 0.15, 0.85, ease);
  return (
    <div style={{ position: "absolute", left: 80, top, width: 500, fontFamily: FONT, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
      <div style={{ fontSize: 76, fontWeight: 700, color: C.ink, lineHeight: 1.12, letterSpacing: -1 }}>{th}</div>
      <div style={{ marginTop: 10, fontSize: 36, fontWeight: 500, color: C.red }}>{en}</div>
      {keysList && (
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 20 }}>
          {keysList.map((k, i) => {
            const pp = seg(t, 0.8 + i * 0.25, 1.3 + i * 0.25, ease);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, opacity: pp, transform: `translateX(${(1 - pp) * -20}px)` }}>
                <KeyCombo keys={k.keys} size={26} />
                <span style={{ fontSize: 28, fontWeight: 500, color: C.slate }}>{k.label}</span>
              </div>
            );
          })}
        </div>
      )}
      {extra}
    </div>
  );
};

/** Places a 1200×720 demo at the tutorial position. */
export const DemoSlot: React.FC<{ children: React.ReactNode; t: number }> = ({ children, t }) => {
  const p = seg(t, 0.1, 0.8, ease);
  return <div style={{ position: "absolute", left: 640, top: 60, opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${0.97 + 0.03 * p})`, transformOrigin: "50% 50%" }}>{children}</div>;
};

/** Standard 1920×1080 tutorial scene: backdrop, badge, side title, demo and captions. `t` = seconds since scene start. */
export const TutorialScene: React.FC<{
  n: number; label: string; Icon: LucideIcon; th: string; en: string; cues: Cue[]; keysList?: { keys: string[]; label: string }[];
  extra?: React.ReactNode; duration: number; render: (t: number) => React.ReactNode;
}> = ({ n, label, Icon, th, en, cues, keysList, extra, duration, render }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const fadeIn = seg(t, 0, 0.4);
  const fadeOut = 1 - seg(t, duration - 0.4, duration);
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      <Backdrop />
      <SectionBadge n={n} label={label} Icon={Icon} t={t} />
      <SideTitle t={t} th={th} en={en} keysList={keysList} extra={extra} />
      <DemoSlot t={t}>{render(t)}</DemoSlot>
      <CaptionBar t={t} cues={cues} />
    </AbsoluteFill>
  );
};
