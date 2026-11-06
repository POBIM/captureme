// Watermark / text-stamp overlay applied on export (and previewed live). A preference, not part of the document.
import type { Rect } from "./types";
import { FONT_FAMILY, clamp } from "./geom";
import { contrastColor } from "./props";
import { requestRender } from "./state";

export interface Watermark {
  enabled: boolean;
  text: string;
  mode: "corner" | "tiled";
  corner: "tl" | "tr" | "bl" | "br" | "c";
  opacity: number; // 0.05 – 1
  size: number; // font size as % of the image width
  color: string;
  angle: number; // degrees, tiled mode
}
export type WmStyle = Omit<Watermark, "enabled">;
export interface WmPreset { name: string; wm: WmStyle }

const LS = "captureme.editor.wm.v1";
const DEFAULT: Watermark = { enabled: false, text: "CaptureME", mode: "corner", corner: "br", opacity: 0.5, size: 4, color: "#ffffff", angle: -30 };

interface Store { wm: Watermark; presets: WmPreset[] }
function load(): Store {
  try {
    const j = JSON.parse(localStorage.getItem(LS) || "{}");
    return { wm: { ...DEFAULT, ...(j.wm ?? {}) }, presets: Array.isArray(j.presets) ? j.presets : [] };
  } catch { return { wm: { ...DEFAULT }, presets: [] }; }
}
const store = load();
const persist = () => { try { localStorage.setItem(LS, JSON.stringify(store)); } catch { /* ignore */ } };

export const getWm = () => store.wm;
export const getPresets = () => store.presets;
export function setWm(patch: Partial<Watermark>) {
  Object.assign(store.wm, patch);
  persist(); requestRender(); // repaint preview
}
/** The watermark to draw, or null when off / empty. */
export function activeWm(): Watermark | null {
  return store.wm.enabled && store.wm.text.trim() ? store.wm : null;
}
export function savePreset(name: string) {
  const { enabled: _e, ...style } = store.wm; void _e;
  const i = store.presets.findIndex((p) => p.name === name);
  const p = { name, wm: { ...style } };
  if (i >= 0) store.presets[i] = p; else store.presets.push(p);
  persist();
}
export function deletePreset(name: string) { store.presets = store.presets.filter((p) => p.name !== name); persist(); }
export function applyPreset(name: string) {
  const p = store.presets.find((x) => x.name === name);
  if (p) setWm({ ...p.wm, enabled: true });
}

export function drawWatermark(ctx: CanvasRenderingContext2D, r: Rect, wm: Watermark) {
  const text = wm.text.replace(/\s*\n\s*/g, " ").trim();
  if (!text) return;
  const fs = clamp(r.w * wm.size / 100, 8, Math.max(12, r.h));
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.globalAlpha = clamp(wm.opacity, 0.05, 1);
  ctx.font = `700 ${fs}px ${FONT_FAMILY}`;
  ctx.fillStyle = wm.color;
  ctx.strokeStyle = contrastColor(wm.color) === "#ffffff" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)";
  ctx.lineWidth = Math.max(1, fs * 0.07);
  ctx.lineJoin = "round";
  const put = (x: number, y: number) => { ctx.strokeText(text, x, y); ctx.fillText(text, x, y); };
  if (wm.mode === "tiled") {
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const tw = ctx.measureText(text).width;
    const sx = tw + fs * 2.5, sy = fs * 3.4;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, diag = Math.hypot(r.w, r.h);
    ctx.translate(cx, cy); ctx.rotate((wm.angle * Math.PI) / 180);
    let row = 0;
    for (let y = -diag / 2; y < diag / 2 + sy; y += sy, row++) {
      for (let x = -diag / 2 - (row % 2 ? sx / 2 : 0); x < diag / 2 + sx; x += sx) put(x, y);
    }
  } else {
    const m = fs * 0.7;
    ctx.textBaseline = wm.corner[0] === "t" ? "top" : wm.corner[0] === "b" ? "bottom" : "middle";
    ctx.textAlign = wm.corner[1] === "l" ? "left" : wm.corner[1] === "r" ? "right" : "center";
    if (wm.corner === "c") put(r.x + r.w / 2, r.y + r.h / 2);
    else put(wm.corner[1] === "l" ? r.x + m : r.x + r.w - m, wm.corner[0] === "t" ? r.y + m : r.y + r.h - m);
  }
  ctx.restore();
}
