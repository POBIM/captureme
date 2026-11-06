import React, { createContext, useContext } from "react";
import { Img, staticFile } from "remotion";

/** How pictures are resolved: inside Remotion → staticFile + <Img> (awaited before a frame is shot);
 *  in the static PDF page → plain <img> with file:// URLs. */
export const ImgCtx = createContext<{ src: (p: string) => string; plain: boolean }>({ src: (p) => staticFile(p), plain: false });

/** A real capture from docs/images, shown as-is (never redrawn). */
export const Shot: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => {
  const c = useContext(ImgCtx);
  const s: React.CSSProperties = { display: "block", ...style };
  return c.plain ? <img src={c.src(src)} style={s} alt="" /> : <Img src={c.src(src)} style={s} />;
};
