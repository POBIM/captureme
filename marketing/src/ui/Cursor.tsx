import React from "react";

/** macOS-style arrow pointer. (x,y) is the hotspot. `press` 0..1 shrinks it slightly like a click. */
export const Cursor: React.FC<{ x: number; y: number; scale?: number; press?: number; opacity?: number }> = ({ x, y, scale = 1, press = 0, opacity = 1 }) => (
  <svg
    width={28 * scale} height={40 * scale} viewBox="0 0 28 40"
    style={{ position: "absolute", left: x, top: y, opacity, pointerEvents: "none", zIndex: 999, transform: `scale(${1 - press * 0.12})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))" }}
  >
    <path d="M3 2 L3 29 L10 23 L15 35 L20 33 L15 21 L24 21 Z" fill="#fff" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

/** Expanding click ripple at (x,y); `p` 0..1. */
export const ClickRipple: React.FC<{ x: number; y: number; p: number; color?: string }> = ({ x, y, p, color = "#dc2626" }) =>
  p <= 0 || p >= 1 ? null : (
    <div style={{ position: "absolute", left: x - 30, top: y - 30, width: 60, height: 60, borderRadius: 30, border: `4px solid ${color}`, opacity: 1 - p, transform: `scale(${0.3 + p * 1.1})`, pointerEvents: "none", zIndex: 998 }} />
  );
