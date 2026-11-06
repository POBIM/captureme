// Entry for the static (non-Remotion) HTML build used to print the vector PDF: scripts/render-posters.mjs
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "../fonts/fonts.css";
import { PosterA3, A3_W, A3_H } from "./PosterA3";

const SCALE = 0.64; // 1754px design width -> ~1122px (= 297 mm at 96 dpi)
(globalThis as any).__POSTER_HTML__ = renderToStaticMarkup(
  <div style={{ width: A3_W * SCALE, height: A3_H * SCALE, overflow: "hidden", position: "relative" }}>
    <div style={{ transform: `scale(${SCALE})`, transformOrigin: "0 0", width: A3_W, height: A3_H }}>
      <PosterA3 />
    </div>
  </div>,
);
