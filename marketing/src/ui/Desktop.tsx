import React from "react";
import { FONT } from "../theme";
import { AppIcon } from "./AppIcon";
import { Camera } from "lucide-react";

export const Wallpaper: React.FC<{ width: number; height: number; variant?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ width, height, variant = 0, style, children }) => {
  const g = [
    "radial-gradient(1200px 700px at 15% 10%, #6366f1 0%, transparent 60%), radial-gradient(900px 700px at 90% 90%, #ec4899 0%, transparent 55%), linear-gradient(135deg,#1e1b4b,#312e81 50%,#7c3aed)",
    "radial-gradient(1000px 700px at 80% 0%, #38bdf8 0%, transparent 60%), radial-gradient(900px 600px at 0% 100%, #f472b6 0%, transparent 55%), linear-gradient(135deg,#0f172a,#1d4ed8 60%,#06b6d4)",
  ][variant % 2];
  return <div style={{ position: "absolute", left: 0, top: 0, width, height, background: g, overflow: "hidden", ...style }}>{children}</div>;
};

/** Mock macOS menu bar with the CaptureME status icon. */
export const MenuBar: React.FC<{ width: number; trayActive?: boolean; recording?: boolean; time?: string; scale?: number }> = ({ width, trayActive, recording, time = "9:41", scale = 1 }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width, height: 34 * scale, background: "rgba(20,20,28,.55)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", padding: `0 ${14 * scale}px`, gap: 18 * scale, fontFamily: FONT, fontSize: 15 * scale, color: "#fff", fontWeight: 500, zIndex: 50 }}>
    <span style={{ fontSize: 18 * scale }}></span>
    <b style={{ fontWeight: 700 }}>Finder</b>
    <span style={{ opacity: .9 }}>File</span><span style={{ opacity: .9 }}>Edit</span><span style={{ opacity: .9 }}>View</span>
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 * scale }}>
      <div style={{ width: 30 * scale, height: 24 * scale, borderRadius: 6 * scale, display: "flex", alignItems: "center", justifyContent: "center", background: trayActive ? "rgba(255,255,255,.28)" : "transparent", color: recording ? "#ef4444" : "#fff" }}>
        <Camera size={18 * scale} strokeWidth={2.2} />
      </div>
      <span>Wi-Fi</span>
      <span>{time}</span>
    </div>
  </div>
);

export const TrayMenu: React.FC<{ x: number; y: number; scale?: number; highlight?: number; items?: { label: string; keys?: string; sep?: boolean }[]; width?: number }> = ({ x, y, scale = 1, highlight = -1, items = [], width = 330 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: width * scale, borderRadius: 12 * scale, padding: `${6 * scale}px`, background: "rgba(245,245,247,.92)", backdropFilter: "blur(30px)", boxShadow: "0 20px 50px rgba(0,0,0,.4), 0 0 0 1px rgba(0,0,0,.15)", fontFamily: FONT, fontSize: 16 * scale, color: "#111", zIndex: 60 }}>
    {items.map((it, i) =>
      it.sep ? <div key={i} style={{ height: 1, background: "rgba(0,0,0,.12)", margin: `${5 * scale}px ${8 * scale}px` }} /> : (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: `${5 * scale}px ${10 * scale}px`, borderRadius: 7 * scale, background: highlight === i ? "#2563eb" : "transparent", color: highlight === i ? "#fff" : "#111" }}>
          <span>{it.label}</span><span style={{ opacity: highlight === i ? .95 : .55, letterSpacing: 2 }}>{it.keys}</span>
        </div>
      ),
    )}
  </div>
);

export const Dock: React.FC<{ width: number; y: number }> = ({ width, y }) => (
  <div style={{ position: "absolute", left: width / 2 - 230, top: y, width: 460, height: 78, borderRadius: 24, background: "rgba(255,255,255,.22)", backdropFilter: "blur(20px)", boxShadow: "0 0 0 1px rgba(255,255,255,.3)", display: "flex", gap: 14, alignItems: "center", justifyContent: "center" }}>
    {["#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb7185"].map((c, i) => <div key={i} style={{ width: 52, height: 52, borderRadius: 13, background: `linear-gradient(${c},#0f172a55)` }} />)}
  </div>
);
export { AppIcon };
