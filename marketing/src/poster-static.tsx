// Entry for the static (non-Remotion) HTML used to print the vector A3 PDF: scripts/render-all.mjs
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./fonts/fonts.css";
import { PosterA3, A3_W, A3_H } from "./posters";
import { ImgCtx } from "./Shot";

declare const DOCS_IMAGES: string;
const SCALE = 0.64; // 1754px design width -> ~1122px (= 297 mm at 96 dpi)
(globalThis as any).__POSTER_HTML__ = renderToStaticMarkup(
  <ImgCtx.Provider value={{ src: (p) => `file://${DOCS_IMAGES}/${p}`, plain: true }}>
    <div style={{ width: A3_W * SCALE, height: A3_H * SCALE, overflow: "hidden", position: "relative" }}>
      <div style={{ transform: `scale(${SCALE})`, transformOrigin: "0 0", width: A3_W, height: A3_H }}>
        <PosterA3 />
      </div>
    </div>
  </ImgCtx.Provider>,
);
