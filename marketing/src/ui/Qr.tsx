import React from "react";
import { QR } from "../site";

/** Offline-generated QR code (see scripts/gen-qr.mjs) drawn as a single SVG path. */
export const QrCode: React.FC<{ size: number; fg?: string; bg?: string; pad?: number; radius?: number }> = ({ size, fg = "#0f172a", bg = "#fff", pad = 2, radius = 0 }) => {
  const n = QR.size;
  let d = "";
  QR.rows.forEach((row, y) => {
    for (let x = 0; x < n; ) {
      if (row[x] === "1") {
        let w = 1;
        while (x + w < n && row[x + w] === "1") w++;
        d += `M${x + pad} ${y + pad}h${w}v1h-${w}z`;
        x += w;
      } else x++;
    }
  });
  const v = n + pad * 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${v} ${v}`} shapeRendering="crispEdges" style={{ display: "block" }}>
      <rect width={v} height={v} rx={radius} fill={bg} />
      <path d={d} fill={fg} />
    </svg>
  );
};
