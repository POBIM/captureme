import type { Bg, Obj, Pt, Rect, BoxObj, ArrowObj, TextObj, StepObj, CalloutObj, LineObj, ImageObj } from "./types";
import {
  fontString, textLayout, stepRadius, intRect, rectIntersect, inflate, clamp, LINE_H, FONT_FAMILY,
  rotatable, rotCenter, calloutTail, measureInfo, magnifySource, bounds, bodyRect,
} from "./geom";
import { contrastColor } from "./props";
import { getImage } from "./images";
import { drawWatermark, type Watermark } from "./watermark";

export interface Doc { base: HTMLCanvasElement; objects: Obj[] }
export interface RC {
  px: number; // device pixels per image pixel (for shadow scaling)
  rev: number;
  skipId?: string | null;
  /** callout being edited: draw the bubble but not its text (the <textarea> shows it) */
  noTextId?: string | null;
  /** interactive rendering: may draw down-scaled copies of the base image for speed */
  zoom?: number;
  wm?: Watermark | null;
}

export const GRADIENTS: [string, string][] = [
  ["#667eea", "#764ba2"], ["#f093fb", "#f5576c"], ["#4facfe", "#00f2fe"], ["#43e97b", "#38f9d7"],
  ["#fa709a", "#fee140"], ["#30cfd0", "#330867"], ["#2b2b30", "#55555f"], ["#ffecd2", "#fcb69f"],
];

const FILTER_OK = (() => { try { return "filter" in document.createElement("canvas").getContext("2d")!; } catch { return false; } })();

function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}
/** Free the backing store of a temporary canvas right away (WebKit keeps them until GC otherwise). */
export function release(c: HTMLCanvasElement) { c.width = 0; c.height = 0; }

export function pathRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = clamp(r, 0, Math.min(Math.abs(w), Math.abs(h)) / 2);
  ctx.beginPath();
  if (r <= 0) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- per-object signatures (cache keys for blur / pixelate / magnify) ---------- */
let canvasIds = new WeakMap<HTMLCanvasElement, number>();
let canvasCounter = 0;
const canvasId = (c: HTMLCanvasElement) => { let v = canvasIds.get(c); if (v === undefined) { v = ++canvasCounter; canvasIds.set(c, v); } return v; };

let sigMemo: { objs: Obj[]; rev: number; n: number; arr: string[] } | null = null;
function sigs(doc: Doc, rev: number): string[] {
  if (sigMemo && sigMemo.objs === doc.objects && sigMemo.rev === rev && sigMemo.n === doc.objects.length) return sigMemo.arr;
  const arr = doc.objects.map((o) => JSON.stringify(o));
  sigMemo = { objs: doc.objects, rev, n: arr.length, arr };
  return arr;
}
function hash(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36) + str.length.toString(36);
}
/** Anything below object `idx` that can change the pixels of `region` – hashed. */
function belowSig(doc: Doc, idx: number, region: Rect, rc: RC): string {
  const arr = sigs(doc, rc.rev);
  let acc = `b${canvasId(doc.base)}:${doc.base.width}x${doc.base.height}|`;
  for (let j = 0; j < idx; j++) {
    const o = doc.objects[j];
    if (o.id === rc.skipId) continue;
    const reach = (o.s.shadow ? 250 : 0) + (o.s.width || 0) * 2 + 8;
    if (o.type === "spotlight" || rectIntersect(inflate(bounds(o), reach), region)) acc += arr[j] + (rc.noTextId === o.id ? "!" : "") + ";";
  }
  return hash(acc);
}

interface Fx { sig: string; cv: HTMLCanvasElement; ox: number; oy: number }
const fxCache = new Map<string, Fx>();
function fxGet(key: string, sig: string): Fx | null {
  const h = fxCache.get(key);
  return h && h.sig === sig ? h : null;
}
function fxPut(key: string, fx: Fx) {
  const old = fxCache.get(key);
  if (old && old.cv !== fx.cv) release(old.cv);
  fxCache.set(key, fx);
}
/** Drop cached effect bitmaps of objects that no longer exist (deleted / undone). */
export function pruneFx(liveIds: Set<string>) {
  for (const [k, v] of fxCache) if (!liveIds.has(k.split(":")[0])) { release(v.cv); fxCache.delete(k); }
}
export function clearFx() { for (const v of fxCache.values()) release(v.cv); fxCache.clear(); }

/* ---------- down-scaled copies of the base (fast panning / zooming of huge images) ---------- */
const mips = new WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>();
function baseFor(base: HTMLCanvasElement, zoom: number | undefined): HTMLCanvasElement {
  if (!zoom || zoom >= 0.5 || base.width * base.height < 4_000_000) return base;
  let lvl = 0;
  while (lvl < 4 && 1 / 2 ** (lvl + 1) >= zoom) lvl++;
  if (lvl === 0) return base;
  let chain = mips.get(base);
  if (!chain) { chain = []; mips.set(base, chain); }
  let prev = base;
  for (let l = 1; l <= lvl; l++) {
    if (!chain[l]) {
      const c = mk(Math.ceil(prev.width / 2), Math.ceil(prev.height / 2));
      const cx = c.getContext("2d")!;
      cx.imageSmoothingQuality = "high";
      cx.drawImage(prev, 0, 0, c.width, c.height);
      chain[l] = c;
    }
    prev = chain[l];
  }
  return prev;
}

/** Render base + objects[0..upTo) into a fresh canvas covering `rect` (image coords, 1:1). */
function renderBelow(doc: Doc, upTo: number, rect: Rect, rc: RC, readback = false): HTMLCanvasElement {
  const cv = mk(rect.w, rect.h);
  const ctx = cv.getContext("2d", readback ? { willReadFrequently: true } : undefined)!;
  ctx.translate(-rect.x, -rect.y);
  drawScene(ctx, doc, { px: 1, rev: rc.rev, skipId: rc.skipId, noTextId: rc.noTextId }, upTo, rect);
  return cv;
}

export function drawScene(ctx: CanvasRenderingContext2D, doc: Doc, rc: RC, upTo = doc.objects.length, region?: Rect) {
  const bw = doc.base.width, bh = doc.base.height;
  if (region) {
    const r = rectIntersect(region, { x: 0, y: 0, w: bw, h: bh });
    if (r) ctx.drawImage(doc.base, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  } else {
    const src = baseFor(doc.base, rc.zoom);
    if (src === doc.base) ctx.drawImage(src, 0, 0); else ctx.drawImage(src, 0, 0, bw, bh);
  }
  for (let i = 0; i < upTo; i++) {
    const o = doc.objects[i];
    if (o.id === rc.skipId) continue;
    ctx.save();
    drawObj(ctx, doc, o, i, rc);
    ctx.restore();
  }
}

function setShadow(ctx: CanvasRenderingContext2D, on: boolean, rc: RC, size: number) {
  if (!on) return;
  ctx.shadowColor = "rgba(0,0,0,0.42)";
  ctx.shadowBlur = Math.max(4, size * 0.9) * rc.px;
  ctx.shadowOffsetY = Math.max(2, size * 0.35) * rc.px;
}

function drawObj(ctx: CanvasRenderingContext2D, doc: Doc, o: Obj, idx: number, rc: RC) {
  const s = o.s;
  ctx.globalAlpha = s.opacity;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.width;
  if (o.rot && rotatable(o)) {
    const c = rotCenter(o);
    ctx.translate(c.x, c.y); ctx.rotate(o.rot); ctx.translate(-c.x, -c.y);
  }
  switch (o.type) {
    case "arrow": setShadow(ctx, s.shadow, rc, s.width * 1.5); drawArrow(ctx, o); break;
    case "line":
      setShadow(ctx, s.shadow, rc, s.width * 1.5);
      ctx.beginPath(); ctx.moveTo(o.a.x, o.a.y); ctx.lineTo(o.b.x, o.b.y); ctx.stroke(); break;
    case "measure": drawMeasure(ctx, o, rc); break;
    case "rect":
      setShadow(ctx, s.shadow, rc, Math.max(s.width, 6) * 1.5);
      pathRoundRect(ctx, o.x, o.y, o.w, o.h, s.radius);
      if (s.fill === "solid") ctx.fill(); else ctx.stroke();
      break;
    case "ellipse":
      setShadow(ctx, s.shadow, rc, Math.max(s.width, 6) * 1.5);
      ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, Math.max(0.1, o.w / 2), Math.max(0.1, o.h / 2), 0, 0, Math.PI * 2);
      if (s.fill === "solid") ctx.fill(); else ctx.stroke();
      break;
    case "redact": {
      // True redaction: always fully opaque, snapped outwards to whole pixels so no edge pixel leaks.
      ctx.globalAlpha = 1;
      if (s.radius <= 0 && !o.rot) { const r = intRect(o); ctx.fillRect(r.x, r.y, r.w, r.h); }
      else { pathRoundRect(ctx, o.x, o.y, o.w, o.h, s.radius); ctx.fill(); }
      break;
    }
    case "marker":
      ctx.globalCompositeOperation = "multiply";
      pathRoundRect(ctx, o.x, o.y, o.w, o.h, s.radius); ctx.fill();
      break;
    case "underline": drawMark(ctx, o); break;
    case "pen": case "highlighter":
      if (o.type === "highlighter") ctx.globalCompositeOperation = "multiply";
      else setShadow(ctx, s.shadow, rc, s.width * 1.5);
      drawStroke(ctx, o.pts, s.width);
      break;
    case "text": drawText(ctx, o, rc); break;
    case "callout": drawCallout(ctx, o, rc); break;
    case "step": drawStep(ctx, o, rc); break;
    case "stamp":
      setShadow(ctx, s.shadow, rc, o.size * 0.15);
      ctx.font = `${o.size * 0.82}px ${FONT_FAMILY}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(s.emoji, o.x, o.y + o.size * 0.04);
      break;
    case "image": drawImageObj(ctx, o, rc); break;
    case "spotlight": drawSpotlight(ctx, doc, o, idx, rc); break;
    case "blur": case "pixelate": drawFx(ctx, doc, o, idx, rc); break;
    case "magnify": drawMagnify(ctx, doc, o, idx, rc); break;
  }
}

function pathSub(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = clamp(r, 0, Math.min(w, h) / 2);
  if (r <= 0) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStroke(ctx: CanvasRenderingContext2D, pts: Pt[], w: number) {
  if (pts.length === 0) return;
  if (pts.length === 1) {
    ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, w / 2, 0, Math.PI * 2); ctx.fill(); return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) ctx.lineTo(pts[1].x, pts[1].y);
  else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l.x, l.y);
  }
  ctx.stroke();
}

function norm(x: number, y: number): Pt { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }

function head(ctx: CanvasRenderingContext2D, tip: Pt, dir: Pt, len: number) {
  const hw = len * 0.42;
  const bx = tip.x - dir.x * len, by = tip.y - dir.y * len;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(bx - dir.y * hw, by + dir.x * hw);
  ctx.lineTo(bx + dir.y * hw, by - dir.x * hw);
  ctx.closePath();
  ctx.fill();
}

function drawArrow(ctx: CanvasRenderingContext2D, o: ArrowObj) {
  const { a, b, cp } = o, w = o.s.width, style = o.s.arrowStyle;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 0.5) return;
  const curved = style === "curved";
  const hl = Math.min(Math.max(10, w * 3.6 + 6), len * (style === "double" ? 0.45 : 0.9));
  const dEnd = curved ? norm(b.x - cp.x, b.y - cp.y) : norm(b.x - a.x, b.y - a.y);
  const dStart = curved ? norm(a.x - cp.x, a.y - cp.y) : norm(a.x - b.x, a.y - b.y);
  const k = 0.7;
  const se = { x: b.x - dEnd.x * hl * k, y: b.y - dEnd.y * hl * k };
  const ss = style === "double" ? { x: a.x - dStart.x * hl * k, y: a.y - dStart.y * hl * k } : a;
  if (style === "tapered") {
    const n = { x: -dEnd.y, y: dEnd.x };
    const t0 = w * 0.12, t1 = w * 0.75;
    ctx.beginPath();
    ctx.moveTo(a.x + n.x * t0, a.y + n.y * t0);
    ctx.lineTo(se.x + n.x * t1, se.y + n.y * t1);
    ctx.lineTo(se.x - n.x * t1, se.y - n.y * t1);
    ctx.lineTo(a.x - n.x * t0, a.y - n.y * t0);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(ss.x, ss.y);
    if (curved) ctx.quadraticCurveTo(cp.x, cp.y, se.x, se.y); else ctx.lineTo(se.x, se.y);
    ctx.stroke();
  }
  head(ctx, b, dEnd, hl);
  if (style === "double") head(ctx, a, dStart, hl);
}

/** Ruler (ticks) or dimension arrow (double-headed) with a pixel-length label. */
function drawMeasure(ctx: CanvasRenderingContext2D, o: LineObj, rc: RC) {
  const s = o.s, w = Math.max(1, s.width);
  const m = measureInfo(o);
  if (m.len < 1) return;
  setShadow(ctx, s.shadow, rc, w * 1.5);
  const d = norm(o.b.x - o.a.x, o.b.y - o.a.y), n = { x: -d.y, y: d.x };
  if (s.measureStyle === "dimension") {
    const hl = Math.min(Math.max(10, w * 3.6 + 6), m.len * 0.4);
    ctx.beginPath();
    ctx.moveTo(o.a.x + d.x * hl * 0.7, o.a.y + d.y * hl * 0.7); ctx.lineTo(o.b.x - d.x * hl * 0.7, o.b.y - d.y * hl * 0.7);
    ctx.stroke();
    head(ctx, o.b, d, hl);
    head(ctx, o.a, { x: -d.x, y: -d.y }, hl);
  } else {
    const t = Math.max(8, w * 3.5);
    ctx.beginPath();
    ctx.moveTo(o.a.x, o.a.y); ctx.lineTo(o.b.x, o.b.y);
    ctx.moveTo(o.a.x - n.x * t, o.a.y - n.y * t); ctx.lineTo(o.a.x + n.x * t, o.a.y + n.y * t);
    ctx.moveTo(o.b.x - n.x * t, o.b.y - n.y * t); ctx.lineTo(o.b.x + n.x * t, o.b.y + n.y * t);
    ctx.stroke();
  }
  ctx.shadowColor = "transparent";
  const fs = s.fontSize;
  ctx.font = `600 ${fs}px ${FONT_FAMILY}`;
  const tw = ctx.measureText(m.text).width, pad = fs * 0.35;
  ctx.save();
  ctx.translate(m.mid.x, m.mid.y); ctx.rotate(m.angle);
  ctx.fillStyle = s.color;
  pathRoundRect(ctx, -tw / 2 - pad, -fs * 0.7, tw + pad * 2, fs * 1.4, fs * 0.3);
  ctx.fill();
  ctx.fillStyle = contrastColor(s.color);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(m.text, 0, fs * 0.04);
  ctx.restore();
}

/** Underline / strike-through / squiggle across the bottom or middle of the box. */
function drawMark(ctx: CanvasRenderingContext2D, o: BoxObj) {
  const w = Math.max(1, o.s.width);
  const y = o.s.markStyle === "strike" ? o.y + o.h / 2 : o.y + o.h;
  ctx.beginPath();
  if (o.s.markStyle === "squiggle") {
    const amp = w * 0.9, wl = w * 3.2;
    ctx.moveTo(o.x, y);
    for (let x = 0; x <= o.w; x += 1.5) ctx.lineTo(o.x + x, y + Math.sin((x / wl) * Math.PI * 2) * amp);
  } else { ctx.moveTo(o.x, y); ctx.lineTo(o.x + o.w, y); }
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, o: TextObj, rc: RC) {
  const s = o.s;
  const l = textLayout(o);
  ctx.font = fontString(s);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  if (s.textBg) {
    setShadow(ctx, s.shadow, rc, s.fontSize * 0.4);
    pathRoundRect(ctx, o.x, o.y, l.w, l.h, s.fontSize * 0.3);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = contrastColor(s.color);
  } else setShadow(ctx, s.shadow, rc, s.fontSize * 0.3);
  l.lines.forEach((line, i) => ctx.fillText(line, o.x + l.pad, o.y + l.pad + l.lh * (i + 0.5)));
}

function drawCallout(ctx: CanvasRenderingContext2D, o: CalloutObj, rc: RC) {
  const s = o.s;
  const l = textLayout(o);
  const r = { x: o.x, y: o.y, w: l.w, h: l.h };
  setShadow(ctx, s.shadow, rc, s.fontSize * 0.5);
  // one path (bubble ∪ tail, same winding) so the shadow does not double up
  pathRoundRect(ctx, r.x, r.y, r.w, r.h, s.radius);
  const tail = calloutTail(o);
  if (tail) {
    let { b1, b2 } = tail;
    const area = (b1.x - tail.tip.x) * (b2.y - tail.tip.y) - (b2.x - tail.tip.x) * (b1.y - tail.tip.y);
    if (area > 0) [b1, b2] = [b2, b1];
    ctx.moveTo(b1.x, b1.y); ctx.lineTo(tail.tip.x, tail.tip.y); ctx.lineTo(b2.x, b2.y); ctx.closePath();
  }
  ctx.fill("nonzero");
  if (rc.noTextId === o.id) return;
  ctx.shadowColor = "transparent";
  ctx.fillStyle = contrastColor(s.color);
  ctx.font = fontString(s);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  l.lines.forEach((line, i) => ctx.fillText(line, o.x + l.pad, o.y + l.pad + l.lh * (i + 0.5)));
}

function drawImageObj(ctx: CanvasRenderingContext2D, o: ImageObj, rc: RC) {
  const img = getImage(o.key);
  if (!img) return;
  setShadow(ctx, o.s.shadow, rc, Math.min(o.w, o.h) * 0.06);
  ctx.imageSmoothingQuality = "high";
  if (o.s.radius > 0) {
    // shadow needs a filled shape; clip afterwards
    if (o.s.shadow) { pathRoundRect(ctx, o.x, o.y, o.w, o.h, o.s.radius); ctx.fillStyle = "#000"; ctx.fill(); ctx.shadowColor = "transparent"; }
    pathRoundRect(ctx, o.x, o.y, o.w, o.h, o.s.radius); ctx.clip();
  }
  ctx.drawImage(img, o.x, o.y, o.w, o.h);
}

const GLYPHS = (n: number): string | null => (n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : null);
function drawStep(ctx: CanvasRenderingContext2D, o: StepObj, rc: RC) {
  const s = o.s, r = stepRadius(o);
  setShadow(ctx, s.shadow, rc, r * 0.5);
  const label = String(o.n);
  if (s.stepStyle === "glyph" && GLYPHS(o.n)) {
    ctx.font = `${r * 2.1}px ${FONT_FAMILY}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(GLYPHS(o.n)!, o.x, o.y);
    return;
  }
  ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
  let txt = contrastColor(s.color);
  if (s.stepStyle === "circled") {
    ctx.fillStyle = "#ffffff"; ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = s.color; ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.stroke(); txt = s.color === "#ffffff" ? "#111" : s.color;
  } else ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = txt;
  const fs = r * (label.length > 2 ? 0.85 : label.length > 1 ? 1.05 : 1.25);
  ctx.font = `700 ${fs}px ${FONT_FAMILY}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, o.x, o.y + fs * 0.04);
}

/* ---------- blur / pixelate / spotlight / magnify ---------- */
/** Cheap very-soft blur: shrink (box-filter chain) then enlarge with smoothing. Used for big areas. */
function downBlur(src: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const f = Math.max(2, radius * 0.6);
  let cur = src, owned = false;
  let w = src.width, h = src.height;
  const tw = Math.max(1, Math.round(w / f)), th = Math.max(1, Math.round(h / f));
  while (w > tw * 2 || h > th * 2) {
    w = Math.max(tw, Math.ceil(w / 2)); h = Math.max(th, Math.ceil(h / 2));
    const n = mk(w, h); const c = n.getContext("2d")!; c.imageSmoothingQuality = "high"; c.drawImage(cur, 0, 0, w, h);
    if (owned) release(cur);
    cur = n; owned = true;
  }
  const small = mk(tw, th); small.getContext("2d")!.drawImage(cur, 0, 0, tw, th);
  if (owned) release(cur);
  const out = mk(src.width, src.height); const oc = out.getContext("2d")!;
  oc.imageSmoothingQuality = "high"; oc.drawImage(small, 0, 0, out.width, out.height);
  release(small);
  return out;
}

/** Extend the edge pixels of the valid area (`v`, canvas coords) to fill the whole canvas. */
function clampFill(cv: HTMLCanvasElement, v: Rect) {
  const c = cv.getContext("2d")!;
  if (v.w < 1 || v.h < 1) return;
  if (v.x > 0) c.drawImage(cv, v.x, v.y, 1, v.h, 0, v.y, v.x, v.h);
  if (v.x + v.w < cv.width) c.drawImage(cv, v.x + v.w - 1, v.y, 1, v.h, v.x + v.w, v.y, cv.width - v.x - v.w, v.h);
  if (v.y > 0) c.drawImage(cv, 0, v.y, cv.width, 1, 0, 0, cv.width, v.y);
  if (v.y + v.h < cv.height) c.drawImage(cv, 0, v.y + v.h - 1, cv.width, 1, 0, v.y + v.h, cv.width, cv.height - v.y - v.h);
}

function drawFx(ctx: CanvasRenderingContext2D, doc: Doc, o: BoxObj, idx: number, rc: RC) {
  const full = { x: 0, y: 0, w: doc.base.width, h: doc.base.height };
  const r0 = rectIntersect({ x: o.x, y: o.y, w: o.w, h: o.h }, full);
  if (!r0) return;
  const r = intRect(r0);
  const m = o.type === "blur" ? Math.ceil(o.s.strength * 2.5) : 0;
  const sig = hash(JSON.stringify(o) + belowSig(doc, idx, inflate(r, m), rc));
  const key = o.id + ":fx";
  let fx = fxGet(key, sig);
  if (!fx) {
    let out: HTMLCanvasElement;
    if (o.type === "blur") {
      const src = { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
      const below = renderBelow(doc, idx, src, rc);
      const v = rectIntersect(src, full)!;
      clampFill(below, { x: v.x - src.x, y: v.y - src.y, w: v.w, h: v.h });
      let blurred: HTMLCanvasElement;
      if (FILTER_OK && src.w * src.h <= 2_000_000) {
        blurred = mk(src.w, src.h);
        const c = blurred.getContext("2d")!;
        c.filter = `blur(${o.s.strength}px)`;
        c.drawImage(below, 0, 0);
        release(below);
      } else { blurred = downBlur(below, o.s.strength); release(below); }
      out = mk(r.w, r.h);
      out.getContext("2d")!.drawImage(blurred, r.x - src.x, r.y - src.y, r.w, r.h, 0, 0, r.w, r.h);
      release(blurred);
    } else {
      out = renderBelow(doc, idx, r, rc, true);
      const c = out.getContext("2d")!;
      const size = Math.max(2, Math.round(o.s.strength));
      const id = c.getImageData(0, 0, r.w, r.h);
      pixelateInPlace(id.data, r.w, r.h, size);
      c.putImageData(id, 0, 0);
    }
    fx = { sig, cv: out, ox: r.x, oy: r.y };
    fxPut(key, fx);
  }
  ctx.drawImage(fx.cv, fx.ox, fx.oy);
}

function pixelateInPlace(d: Uint8ClampedArray, w: number, h: number, size: number) {
  for (let by = 0; by < h; by += size) {
    const bh = Math.min(size, h - by);
    for (let bx = 0; bx < w; bx += size) {
      const bw = Math.min(size, w - bx);
      let R = 0, G = 0, B = 0, A = 0;
      for (let y = by; y < by + bh; y++) {
        let i = (y * w + bx) * 4;
        for (let x = 0; x < bw; x++, i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; A += d[i + 3]; }
      }
      const n = bw * bh; R = Math.round(R / n); G = Math.round(G / n); B = Math.round(B / n); A = Math.round(A / n);
      for (let y = by; y < by + bh; y++) {
        let i = (y * w + bx) * 4;
        for (let x = 0; x < bw; x++, i += 4) { d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = A; }
      }
    }
  }
}

/** Spotlight: dim everything outside the rect, or (blur mode) blur everything outside it. */
function drawSpotlight(ctx: CanvasRenderingContext2D, doc: Doc, o: BoxObj, idx: number, rc: RC) {
  const W = doc.base.width, H = doc.base.height;
  ctx.globalAlpha = 1;
  if (o.s.spotMode === "blur") {
    // the blurred layer does not depend on the rect, so moving / resizing the hole is free
    const sig = hash(`${o.s.strength}|` + belowSig(doc, idx, { x: 0, y: 0, w: W, h: H }, rc));
    const key = o.id + ":focus";
    let fx = fxGet(key, sig);
    if (!fx) {
      const below = renderBelow(doc, idx, { x: 0, y: 0, w: W, h: H }, rc);
      const cv = downBlur(below, Math.max(6, o.s.strength));
      release(below);
      fx = { sig, cv, ox: 0, oy: 0 };
      fxPut(key, fx);
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); pathSub(ctx, o.x, o.y, o.w, o.h, o.s.radius);
    ctx.clip("evenodd");
    ctx.drawImage(fx.cv, 0, 0);
    ctx.restore();
  }
  if (o.s.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${o.s.dim})`;
    ctx.beginPath(); ctx.rect(0, 0, W, H); pathSub(ctx, o.x, o.y, o.w, o.h, o.s.radius);
    ctx.fill("evenodd");
  }
}

/** External tangent lines between two circles. */
function tangents(c1: Pt, r1: number, c2: Pt, r2: number): [Pt, Pt][] {
  const dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy);
  if (d < Math.abs(r1 - r2) + 1) return [];
  const u = { x: dx / d, y: dy / d }, k = (r1 - r2) / d, q = Math.sqrt(Math.max(0, 1 - k * k));
  return [1, -1].map((sg) => {
    const nx = k * u.x + sg * q * -u.y, ny = k * u.y + sg * q * u.x;
    return [{ x: c1.x + r1 * nx, y: c1.y + r1 * ny }, { x: c2.x + r2 * nx, y: c2.y + r2 * ny }] as [Pt, Pt];
  });
}

function drawMagnify(ctx: CanvasRenderingContext2D, doc: Doc, o: BoxObj, idx: number, rc: RC) {
  const z = Math.max(1, o.s.zoom);
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const sc = o.sc ?? { x: cx, y: cy };
  const sw = o.w / z, sh = o.h / z;
  const src = { x: sc.x - sw / 2, y: sc.y - sh / 2, w: sw, h: sh };
  const clip = rectIntersect(src, { x: 0, y: 0, w: doc.base.width, h: doc.base.height });
  const ellipse = (x: number, y: number, w: number, h: number) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, w / 2), Math.max(0.1, h / 2), 0, 0, Math.PI * 2); };

  if (o.sc) {
    // leader: source outline + two tangent lines up to the lens
    ctx.save();
    ctx.strokeStyle = o.s.color; ctx.lineWidth = Math.max(1, o.s.width * 0.6);
    ctx.globalAlpha = 0.9;
    const r1 = Math.max(2, (sw + sh) / 4), r2 = (o.w + o.h) / 4;
    ctx.beginPath();
    for (const [p1, p2] of tangents(sc, r1, { x: cx, y: cy }, r2)) { ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); }
    ctx.stroke();
    ellipse(sc.x, sc.y, sw, sh); ctx.stroke();
    ctx.restore();
  }

  setShadow(ctx, o.s.shadow, rc, Math.min(o.w, o.h) * 0.08);
  ellipse(cx, cy, o.w, o.h);
  ctx.fillStyle = "#000"; ctx.fill();
  ctx.shadowColor = "transparent";
  if (clip) {
    const ir = intRect(clip);
    const sig = hash(`${ir.x},${ir.y},${ir.w},${ir.h}|` + belowSig(doc, idx, ir, rc));
    const key = o.id + ":mag";
    let fx = fxGet(key, sig);
    if (!fx) { fx = { sig, cv: renderBelow(doc, idx, ir, rc), ox: ir.x, oy: ir.y }; fxPut(key, fx); }
    ctx.save();
    ellipse(cx, cy, o.w, o.h); ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(fx.cv, 0, 0, ir.w, ir.h, cx + (ir.x - sc.x) * z, cy + (ir.y - sc.y) * z, ir.w * z, ir.h * z);
    ctx.restore();
  }
  ellipse(cx, cy, o.w, o.h);
  ctx.strokeStyle = o.s.color; ctx.lineWidth = o.s.width; ctx.stroke();
}

/* ---------- document framing (crop + background) ---------- */
export function drawFramed(ctx: CanvasRenderingContext2D, doc: Doc, content: Rect, bg: Bg | null, rc: RC) {
  if (bg && bg.enabled) {
    const p = bg.padding;
    const fr = { x: content.x - p, y: content.y - p, w: content.w + 2 * p, h: content.h + 2 * p };
    ctx.save();
    if (bg.mode === "solid") ctx.fillStyle = bg.color;
    else {
      const [c1, c2] = GRADIENTS[bg.gradient % GRADIENTS.length];
      const g = ctx.createLinearGradient(fr.x, fr.y, fr.x + fr.w, fr.y + fr.h);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g;
    }
    ctx.fillRect(fr.x, fr.y, fr.w, fr.h);
    if (bg.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = Math.max(10, p * 0.6) * rc.px;
      ctx.shadowOffsetY = Math.max(4, p * 0.18) * rc.px;
      ctx.fillStyle = "#000";
      pathRoundRect(ctx, content.x, content.y, content.w, content.h, bg.radius);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.save();
  pathRoundRect(ctx, content.x, content.y, content.w, content.h, bg && bg.enabled ? bg.radius : 0);
  ctx.clip();
  drawScene(ctx, doc, rc);
  if (rc.wm) drawWatermark(ctx, content, rc.wm);
  ctx.restore();
}

export interface ExportOpts { scale?: number; wm?: Watermark | null }
/** Flattened output. At scale 1 every pixel maps 1:1 onto the original image. */
export function exportCanvas(doc: Doc, content: Rect, bg: Bg | null, rev: number, opts: ExportOpts = {}): HTMLCanvasElement {
  const sc = opts.scale ?? 1;
  const useBg = !!bg && bg.enabled;
  const p = useBg ? bg!.padding : 0;
  const cv = mk((content.w + 2 * p) * sc, (content.h + 2 * p) * sc);
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(sc, sc);
  ctx.translate(p - content.x, p - content.y);
  drawFramed(ctx, doc, content, bg, { px: sc, rev, wm: opts.wm });
  return cv;
}

/** Colour of the composited image at an image pixel (null if outside). */
export function pickColor(doc: Doc, x: number, y: number, rev: number): string | null {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= doc.base.width || y >= doc.base.height) return null;
  const cv = mk(1, 1);
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.translate(-x, -y);
  drawScene(ctx, doc, { px: 1, rev }, doc.objects.length, { x, y, w: 1, h: 1 });
  const d = ctx.getImageData(0, 0, 1, 1).data;
  release(cv);
  return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export { LINE_H, bodyRect };
