import React from "react";
import { C, FONT } from "./theme";
import { Shot } from "./Shot";
import { AppIcon } from "./ui/AppIcon";
import { KeyCombo, Rich } from "./ui/Keys";
import { QrCode } from "./ui/Qr";
import { keys, DOWNLOAD_URL_FULL } from "./site";

export const Brand: React.FC<{ size?: number; dark?: boolean }> = ({ size = 56, dark }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
    <AppIcon size={size} />
    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: size * 0.8, color: dark ? "#fff" : C.ink, letterSpacing: -0.5 }}>CaptureME</div>
  </div>
);

export const Frame: React.FC<{ src: string; width: number; height?: number; fit?: "fill" | "contain"; pos?: string; radius?: number; bg?: string; crop?: { zoom: number; fx: number; fy: number }; aspect?: number }> = ({ src, width, height, fit = "contain", pos = "center top", radius = 22, bg = "transparent", crop, aspect }) => {
  const shell: React.CSSProperties = { width, height, borderRadius: radius, overflow: "hidden", background: bg, position: "relative", boxShadow: "0 18px 50px rgba(15,23,42,.22), 0 2px 8px rgba(15,23,42,.12)" };
  if (crop && height && aspect) {
    // magnified crop: picture drawn crop.zoom times the frame width, focus point centred (clamped to the picture)
    const w = width * crop.zoom, h = w / aspect;
    const left = Math.min(0, Math.max(width - w, width / 2 - crop.fx * w));
    const top = Math.min(0, Math.max(height - h, height / 2 - crop.fy * h));
    return <div style={shell}><Shot src={src} style={{ position: "absolute", left, top, width: w, height: h }} /></div>;
  }
  return (
    <div style={shell}>
      <Shot src={src} style={{ width: "100%", height: height ? "100%" : "auto", objectFit: fit === "fill" ? "cover" : "contain", objectPosition: pos }} />
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; tone?: "red" | "green" | "dark" | "light"; size?: number }> = ({ children, tone = "light", size = 26 }) => {
  const t = { red: [C.red, "#fff"], green: [C.green, "#fff"], dark: [C.ink, "#fff"], light: ["#fff", C.ink] }[tone];
  return <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: size, background: t[0], color: t[1], padding: `${size * 0.28}px ${size * 0.7}px`, borderRadius: 99, boxShadow: "0 4px 14px rgba(15,23,42,.15)", whiteSpace: "nowrap" }}>{children}</span>;
};

export const Trust: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <div style={{ display: "flex", gap: size * 0.5, flexWrap: "wrap" }}>
    <Badge size={size}>ฟรี · Free</Badge><Badge size={size}>MIT โอเพนซอร์ส</Badge><Badge size={size}>ไม่เก็บข้อมูล</Badge><Badge size={size}>ไม่ใช้อินเทอร์เน็ต</Badge><Badge size={size}>macOS 14+</Badge>
  </div>
);

export const Download: React.FC<{ qr?: number; size?: number; dark?: boolean }> = ({ qr = 220, size = 40, dark }) => (
  <div style={{ display: "flex", gap: size * 0.8, alignItems: "center", fontFamily: FONT }}>
    <div style={{ padding: qr * 0.06, background: "#fff", borderRadius: qr * 0.08, boxShadow: "0 10px 30px rgba(15,23,42,.25)" }}><QrCode size={qr} pad={1} /></div>
    <div style={{ color: dark ? "#fff" : C.ink }}>
      <div style={{ fontSize: size * 1.35, fontWeight: 700, lineHeight: 1.1 }}>⬇️ ดาวน์โหลดฟรี</div>
      <div style={{ fontSize: size * 0.62, fontWeight: 500, opacity: 0.85, marginTop: size * 0.1 }}>Free download</div>
      <div style={{ fontSize: size * 0.58, fontWeight: 600, marginTop: size * 0.45, background: dark ? "rgba(255,255,255,.14)" : C.red50, color: dark ? "#fff" : C.redDark, padding: `${size * 0.2}px ${size * 0.4}px`, borderRadius: 14, display: "inline-block" }}>{DOWNLOAD_URL_FULL}</div>
    </div>
  </div>
);

export const Shortcut: React.FC<{ action?: string; hint?: { th: string; en: string }; size?: number; dark?: boolean }> = ({ action, hint, size = 38, dark }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.5, fontFamily: FONT }}>
    {action ? (
      <>
        <span style={{ fontSize: size * 0.62, fontWeight: 600, color: dark ? "#cbd5e1" : C.slate2 }}>คีย์ลัด · Shortcut</span>
        <KeyCombo keys={keys(action)} size={size} dark={dark} />
      </>
    ) : (
      <span style={{ fontSize: size * 0.7, fontWeight: 600, color: dark ? "#fff" : C.ink }}><Rich text={hint ? hint.th : ""} /> <span style={{ opacity: 0.6, fontWeight: 400 }}>· {hint?.en}</span></span>
    )}
  </div>
);
