import type { Bg, Obj, Pt, Rect, BoxObj, ArrowObj, TextObj, StepObj } from "./types";
import { fontString, textLayout, stepRadius, intRect, rectIntersect, clamp, LINE_H, FONT_FAMILY } from "./geom";
import { contrastColor } from "./props";

export interface Doc { base: HTMLCanvasElement; objects: Obj[] }
export interface RC {
  px: number; // device pixels per image pixel (for shadow scaling)
  rev: number;
  skipId?: string | null;
}

export const GRADIENTS: [string, string][] = [
  ["#667eea", "#764ba2"], ["#f093fb", "#f5576c"], ["#4facfe", "#00f2fe"], ["#43e97b", "#38f9d7"],
  ["#fa709a", "#fee140"], ["#30cfd0", "#330867"], ["#2b2b30", "#55555f"], ["#ffecd2", "#fcb69f"],
];

const FILTER_OK = (() => { try { return "filter" in document.createElement("canvas").getContext("2d")!; } catch { return false; } })();
const cache = new Map<string, { rev: number; cv: HTMLCanvasElement }>();

function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

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

/** Render base + objects[0..upTo) into a fresh canvas covering `rect` (image coords, 1:1). */
function renderBelow(doc: Doc, upTo: number, rect: Rect, rc: RC): HTMLCanvasElement {
  const cv = mk(rect.w, rect.h);
  const ctx = cv.getContext("2d")!;
  ctx.translate(-rect.x, -rect.y);
  drawScene(ctx, doc, { px: 1, rev: rc.rev, skipId: rc.skipId }, upTo);
  return cv;
}

export function drawScene(ctx: CanvasRenderingContext2D, doc: Doc, rc: RC, upTo = doc.objects.length) {
  ctx.drawImage(doc.base, 0, 0);
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
  switch (o.type) {
    case "arrow": setShadow(ctx, s.shadow, rc, s.width * 1.5); drawArrow(ctx, o); break;
    case "line":
      setShadow(ctx, s.shadow, rc, s.width * 1.5);
      ctx.beginPath(); ctx.moveTo(o.a.x, o.a.y); ctx.lineTo(o.b.x, o.b.y); ctx.stroke(); break;
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
    case "pen": case "highlighter":
      if (o.type === "highlighter") ctx.globalCompositeOperation = "multiply";
      else setShadow(ctx, s.shadow, rc, s.width * 1.5);
      drawStroke(ctx, o.pts, s.width);
      break;
    case "text": drawText(ctx, o, rc); break;
    case "step": drawStep(ctx, o, rc); break;
    case "stamp":
      setShadow(ctx, s.shadow, rc, o.size * 0.15);
      ctx.font = `${o.size * 0.82}px ${FONT_FAMILY}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(s.emoji, o.x, o.y + o.size * 0.04);
      break;
    case "spotlight": {
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${s.dim})`;
      ctx.beginPath();
      ctx.rect(0, 0, doc.base.width, doc.base.height);
      pathSub(ctx, o.x, o.y, o.w, o.h, s.radius);
      ctx.fill("evenodd");
      break;
    }
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

/* ---------- blur / pixelate / magnify ---------- */
function downBlur(src: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const f = Math.max(2, radius * 0.6);
  let cur = src;
  let w = src.width, h = src.height;
  const tw = Math.max(1, Math.round(w / f)), th = Math.max(1, Math.round(h / f));
  while (w > tw * 2 || h > th * 2) {
    w = Math.max(tw, Math.ceil(w / 2)); h = Math.max(th, Math.ceil(h / 2));
    const n = mk(w, h); const c = n.getContext("2d")!; c.imageSmoothingQuality = "high"; c.drawImage(cur, 0, 0, w, h); cur = n;
  }
  const small = mk(tw, th); small.getContext("2d")!.drawImage(cur, 0, 0, tw, th);
  const out = mk(src.width, src.height); const oc = out.getContext("2d")!;
  oc.imageSmoothingQuality = "high"; oc.drawImage(small, 0, 0, out.width, out.height);
  return out;
}

function drawFx(ctx: CanvasRenderingContext2D, doc: Doc, o: BoxObj, idx: number, rc: RC) {
  const r0 = rectIntersect({ x: o.x, y: o.y, w: o.w, h: o.h }, { x: 0, y: 0, w: doc.base.width, h: doc.base.height });
  if (!r0) return;
  const r = intRect(r0);
  const key = o.id;
  const hit = cache.get(key);
  let cv: HTMLCanvasElement;
  let org: Pt = { x: r.x, y: r.y };
  if (hit && hit.rev === rc.rev) { cv = hit.cv; }
  else if (o.type === "blur") {
    const m = Math.ceil(o.s.strength * 2.5);
    const src = intRect(rectIntersect({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m }, { x: 0, y: 0, w: doc.base.width, h: doc.base.height })!);
    const below = renderBelow(doc, idx, src, rc);
    if (FILTER_OK) {
      cv = mk(src.w, src.h);
      const c = cv.getContext("2d")!;
      c.filter = `blur(${o.s.strength}px)`;
      c.drawImage(below, 0, 0);
    } else cv = downBlur(below, o.s.strength);
    org = { x: src.x, y: src.y };
    cache.set(key, { rev: rc.rev, cv });
    (cv as HTMLCanvasElement & { _o?: Pt })._o = org;
  } else {
    const below = renderBelow(doc, idx, r, rc);
    const size = Math.max(2, Math.round(o.s.strength));
    const id = below.getContext("2d")!.getImageData(0, 0, r.w, r.h);
    const d = id.data;
    for (let by = 0; by < r.h; by += size) {
      for (let bx = 0; bx < r.w; bx += size) {
        const bw = Math.min(size, r.w - bx), bh = Math.min(size, r.h - by);
        let R = 0, G = 0, B = 0, A = 0;
        for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
          const i = (y * r.w + x) * 4; R += d[i]; G += d[i + 1]; B += d[i + 2]; A += d[i + 3];
        }
        const n = bw * bh; R = R / n; G = G / n; B = B / n; A = A / n;
        for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
          const i = (y * r.w + x) * 4; d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = A;
        }
      }
    }
    below.getContext("2d")!.putImageData(id, 0, 0);
    cv = below;
    cache.set(key, { rev: rc.rev, cv });
    (cv as HTMLCanvasElement & { _o?: Pt })._o = org;
  }
  org = (cv as HTMLCanvasElement & { _o?: Pt })._o ?? org;
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.drawImage(cv, org.x, org.y);
}

function drawMagnify(ctx: CanvasRenderingContext2D, doc: Doc, o: BoxObj, idx: number, rc: RC) {
  const z = Math.max(1, o.s.zoom);
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const sw = o.w / z, sh = o.h / z;
  const src = { x: cx - sw / 2, y: cy - sh / 2, w: sw, h: sh };
  const clip = rectIntersect(src, { x: 0, y: 0, w: doc.base.width, h: doc.base.height });
  setShadow(ctx, o.s.shadow, rc, Math.min(o.w, o.h) * 0.08);
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.1, o.w / 2), Math.max(0.1, o.h / 2), 0, 0, Math.PI * 2);
  ctx.fillStyle = "#000"; ctx.fill();
  ctx.shadowColor = "transparent";
  if (clip) {
    const ir = intRect(clip);
    const below = renderBelow(doc, idx, ir, rc);
    ctx.save();
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(below, 0, 0, ir.w, ir.h, cx + (ir.x - cx) * z, cy + (ir.y - cy) * z, ir.w * z, ir.h * z);
    ctx.restore();
  }
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.1, o.w / 2), Math.max(0.1, o.h / 2), 0, 0, Math.PI * 2);
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
  ctx.restore();
}

export function exportCanvas(doc: Doc, content: Rect, bg: Bg | null, rev: number): HTMLCanvasElement {
  const useBg = !!bg && bg.enabled;
  const p = useBg ? bg!.padding : 0;
  const cv = mk(content.w + 2 * p, content.h + 2 * p);
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(p - content.x, p - content.y);
  drawFramed(ctx, doc, content, bg, { px: 1, rev });
  return cv;
}

/** Colour of the composited image at an image pixel (null if outside). */
export function pickColor(doc: Doc, x: number, y: number, rev: number): string | null {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= doc.base.width || y >= doc.base.height) return null;
  const cv = mk(1, 1);
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.translate(-x, -y);
  drawScene(ctx, doc, { px: 1, rev });
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export { LINE_H };
