import React from "react";
import { FONT } from "../theme";

export const TrafficLights: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <div style={{ display: "flex", gap: size * 0.6 }}>
    {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
      <div key={c} style={{ width: size, height: size, borderRadius: size, background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }} />
    ))}
  </div>
);

export const MacWindow: React.FC<{
  width: number; height: number; title?: string; x?: number; y?: number; dark?: boolean; titleH?: number;
  children?: React.ReactNode; style?: React.CSSProperties; bodyStyle?: React.CSSProperties; right?: React.ReactNode;
}> = ({ width, height, title, x, y, dark, titleH = 44, children, style, bodyStyle, right }) => (
  <div
    style={{
      position: x !== undefined ? "absolute" : "relative", left: x, top: y, width, height, borderRadius: 14, overflow: "hidden",
      background: dark ? "#1e1e22" : "#fff", fontFamily: FONT,
      boxShadow: "0 30px 70px rgba(15,23,42,.35), 0 0 0 1px rgba(15,23,42,.12)", ...style,
    }}
  >
    <div style={{ height: titleH, display: "flex", alignItems: "center", padding: "0 16px", gap: 16, background: dark ? "#2a2a30" : "linear-gradient(#f6f6f8,#e9e9ee)", borderBottom: `1px solid ${dark ? "#111" : "#d4d4da"}`, position: "relative" }}>
      <TrafficLights />
      <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 15, fontWeight: 500, color: dark ? "#d4d4d8" : "#3f3f46", pointerEvents: "none" }}>{title}</div>
      <div style={{ marginLeft: "auto", zIndex: 1 }}>{right}</div>
    </div>
    <div style={{ position: "absolute", top: titleH, left: 0, right: 0, bottom: 0, ...bodyStyle }}>{children}</div>
  </div>
);
