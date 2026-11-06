import React from "react";
import { C, FONT } from "../theme";

/** CaptureME app icon (mirrors ../../assets/icon.svg). */
export const AppIcon: React.FC<{ size: number; shadow?: boolean; style?: React.CSSProperties }> = ({ size, shadow = true, style }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block", filter: shadow ? `drop-shadow(0 ${size * 0.06}px ${size * 0.1}px rgba(0,0,0,.28))` : undefined, ...style }}>
    <rect width="64" height="64" rx="14" fill={C.red} />
    <text x="32" y="32" dy="0.35em" textAnchor="middle" fontFamily={FONT} fontSize="32" fontWeight="600" fill="#fff">C</text>
  </svg>
);
