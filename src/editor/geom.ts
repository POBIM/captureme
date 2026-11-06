import type { Obj, Pt, Rect, TextObj, CalloutObj, Props, LineObj } from "./types";

export const FONT_FAMILY = `-apple-system, "SF Pro Text", "Sukhumvit Set", "Thonburi", "Helvetica Neue", sans-serif`;
export const LINE_H = 1.35;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

export function rectFrom(a: Pt, b: Pt): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}
export function rectUnion(a: Rect, b: Rect): Rect {
  const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.w, b.x + b.w), y2 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
export function rectIntersect(a: Rect, b: Rect): Rect | null {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  return x2 > x1 && y2 > y1 ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null;
}
export function inflate(r: Rect, d: number): Rect {
  return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d };
}
export function intRect(r: Rect): Rect {
  const x = Math.floor(r.x), y = Math.floor(r.y);
  return { x, y, w: Math.ceil(r.x + r.w) - x, h: Math.ceil(r.y + r.h) - y };
}
export function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/* ---------- text metrics ---------- */
let mctx: CanvasRenderingContext2D | null = null;
export function fontString(s: Props): string {
  return `${s.bold ? 700 : 400} ${s.fontSize}px ${FONT_FAMILY}`;
}
export interface TextLayout { lines: string[]; lh: number; pad: number; w: number; h: number }
type TextLike = TextObj | CalloutObj;
/** Layout of a text / callout object (optionally with different text or style, used while editing). */
export function textLayout(o: TextLike, textOverride?: string, sOverride?: Props): TextLayout {
  const s = sOverride ?? o.s;
  mctx ??= document.createElement("canvas").getContext("2d")!;
  mctx.font = fontString(s);
  const lines = (textOverride ?? o.text).split("\n");
  const lh = s.fontSize * LINE_H;
  const pad = o.type === "callout" ? s.fontSize * 0.6 : s.textBg ? s.fontSize * 0.3 : 0;
  let w = 0;
  for (const l of lines) w = Math.max(w, mctx.measureText(l).width);
  w = Math.max(w, s.fontSize * 0.5);
  return { lines, lh, pad, w: w + pad * 2, h: lh * lines.length + pad * 2 };
}
export const stepRadius = (o: { s: Props }) => o.s.fontSize * 0.8;

/* ---------- arrow helpers ---------- */
export function bezierPt(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}
export function bendHandle(o: { a: Pt; b: Pt; cp: Pt }): Pt {
  return bezierPt(o.a, o.cp, o.b, 0.5);
}
export function defaultCp(a: Pt, b: Pt, curved: boolean): Pt {
  const m = mid(a, b);
  if (!curved) return m;
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  return { x: m.x - (dy / l) * l * 0.28, y: m.y + (dx / l) * l * 0.28 };
}

/* ---------- rotation helpers ---------- */
export const ROTATABLE = new Set(["rect", "ellipse", "text", "stamp", "callout", "redact", "marker", "underline", "image"]);
export const rotatable = (o: Obj) => ROTATABLE.has(o.type);
export function rotPt(p: Pt, c: Pt, a: number): Pt {
  if (!a) return { x: p.x, y: p.y };
  const cs = Math.cos(a), sn = Math.sin(a), dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * cs - dy * sn, y: c.y + dx * sn + dy * cs };
}
export const normAngle = (a: number) => { a = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return Math.abs(a) < 1e-9 ? 0 : a; };

/* ---------- callout / measure geometry ---------- */
export interface Tail { b1: Pt; b2: Pt; tip: Pt }
/** Tail triangle of a callout in its local frame (null if the tip lies inside the bubble). */
export function calloutTail(o: CalloutObj): Tail | null {
  const r = bodyRect(o), t = o.tail;
  if (t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h) return null;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const dx = (t.x - cx) / (r.w / 2), dy = (t.y - cy) / (r.h / 2);
  const rad = Math.min(o.s.radius, r.w / 2, r.h / 2);
  let b1: Pt, b2: Pt;
  if (Math.abs(dx) > Math.abs(dy)) {
    const bw = Math.min(o.s.fontSize * 0.9, r.h * 0.5), x = dx > 0 ? r.x + r.w : r.x;
    const lo = r.y + rad + bw / 2, hi = r.y + r.h - rad - bw / 2;
    const y = hi > lo ? clamp(t.y, lo, hi) : cy;
    b1 = { x, y: y - bw / 2 }; b2 = { x, y: y + bw / 2 };
  } else {
    const bw = Math.min(o.s.fontSize * 0.9, r.w * 0.5), y = dy > 0 ? r.y + r.h : r.y;
    const lo = r.x + rad + bw / 2, hi = r.x + r.w - rad - bw / 2;
    const x = hi > lo ? clamp(t.x, lo, hi) : cx;
    b1 = { x: x - bw / 2, y }; b2 = { x: x + bw / 2, y };
  }
  return { b1, b2, tip: t };
}
export interface MeasureInfo { len: number; mid: Pt; angle: number; text: string }
export function measureInfo(o: LineObj): MeasureInfo {
  const len = dist(o.a, o.b);
  let ang = Math.atan2(o.b.y - o.a.y, o.b.x - o.a.x);
  if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI; // keep the label upright
  return { len, mid: mid(o.a, o.b), angle: normAngle(ang), text: `${Math.round(len)} px` };
}
/** Circle-ish source ellipse of a leader-line magnifier. */
export function magnifySource(o: { x: number; y: number; w: number; h: number; sc?: Pt; s: Props }): Rect | null {
  if (!o.sc) return null;
  const z = Math.max(1, o.s.zoom), w = o.w / z, h = o.h / z;
  return { x: o.sc.x - w / 2, y: o.sc.y - h / 2, w, h };
}

/* ---------- bounds / move / map / hit ---------- */
/** The un-rotated body of an object (what `rot` rotates about its centre). */
export function bodyRect(o: Obj): Rect {
  switch (o.type) {
    case "text": case "callout": { const l = textLayout(o); return { x: o.x, y: o.y, w: l.w, h: l.h }; }
    case "step": { const r = stepRadius(o); return { x: o.x - r, y: o.y - r, w: 2 * r, h: 2 * r }; }
    case "stamp": return { x: o.x - o.size / 2, y: o.y - o.size / 2, w: o.size, h: o.size };
    case "arrow": case "line": case "measure": case "pen": case "highlighter": return localBounds(o);
    default: return { x: o.x, y: o.y, w: o.w, h: o.h };
  }
}
export function rotCenter(o: Obj): Pt {
  const r = bodyRect(o);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Axis-aligned bounds in the object's own (un-rotated) frame, including tails / sources. */
export function localBounds(o: Obj): Rect {
  switch (o.type) {
    case "arrow": {
      let r = rectFrom(o.a, o.b);
      if (o.s.arrowStyle === "curved") {
        const pts = [bezierPt(o.a, o.cp, o.b, 0.25), bezierPt(o.a, o.cp, o.b, 0.5), bezierPt(o.a, o.cp, o.b, 0.75)];
        for (const p of pts) r = rectUnion(r, { x: p.x, y: p.y, w: 0, h: 0 });
      }
      return r;
    }
    case "line": case "measure": return rectFrom(o.a, o.b);
    case "pen": case "highlighter": {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const p of o.pts) { x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); }
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
    case "callout": return rectUnion(bodyRect(o), { x: o.tail.x, y: o.tail.y, w: 0, h: 0 });
    case "magnify": {
      const src = magnifySource(o);
      return src ? rectUnion({ x: o.x, y: o.y, w: o.w, h: o.h }, src) : { x: o.x, y: o.y, w: o.w, h: o.h };
    }
    default: return bodyRect(o);
  }
}

/** Axis-aligned bounds in image space (rotation applied). */
export function bounds(o: Obj): Rect {
  const lb = localBounds(o);
  if (!o.rot) return lb;
  const c = rotCenter(o);
  const pts = [
    { x: lb.x, y: lb.y }, { x: lb.x + lb.w, y: lb.y }, { x: lb.x + lb.w, y: lb.y + lb.h }, { x: lb.x, y: lb.y + lb.h },
  ].map((p) => rotPt(p, c, o.rot!));
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of pts) { x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function moveObj(o: Obj, dx: number, dy: number) {
  const mp = (p: Pt) => { p.x += dx; p.y += dy; };
  switch (o.type) {
    case "arrow": mp(o.a); mp(o.b); mp(o.cp); break;
    case "line": case "measure": mp(o.a); mp(o.b); break;
    case "pen": case "highlighter": o.pts.forEach(mp); break;
    case "callout": o.x += dx; o.y += dy; mp(o.tail); break;
    case "magnify": o.x += dx; o.y += dy; if (o.sc) mp(o.sc); break;
    default: (o as { x: number }).x += dx; (o as { y: number }).y += dy;
  }
}

/** Map object geometry from rect `from` (object's original state) onto rect `to`. Mutates `o`. */
export function mapObj(o: Obj, from: Rect, to: Rect) {
  const sx = from.w > 1e-6 ? to.w / from.w : 1;
  const sy = from.h > 1e-6 ? to.h / from.h : 1;
  const ox = to.x, oy = to.y;
  const mx = (v: number) => ox + (v - from.x) * sx;
  const my = (v: number) => oy + (v - from.y) * sy;
  const mp = (p: Pt) => { p.x = mx(p.x); p.y = my(p.y); };
  const sc = (Math.abs(sx) + Math.abs(sy)) / 2;
  switch (o.type) {
    case "arrow": mp(o.a); mp(o.b); mp(o.cp); break;
    case "line": case "measure": mp(o.a); mp(o.b); break;
    case "pen": case "highlighter": o.pts.forEach(mp); break;
    case "text": o.x = mx(o.x); o.y = my(o.y); o.s.fontSize = Math.max(6, o.s.fontSize * sc); break;
    case "callout": o.x = mx(o.x); o.y = my(o.y); mp(o.tail); o.s.fontSize = Math.max(6, o.s.fontSize * sc); break;
    case "step": o.x = mx(o.x); o.y = my(o.y); o.s.fontSize = Math.max(6, o.s.fontSize * sc); break;
    case "stamp": o.x = mx(o.x); o.y = my(o.y); o.size = Math.max(8, o.size * sc); break;
    default: {
      const x1 = mx(o.x), x2 = mx(o.x + o.w), y1 = my(o.y), y2 = my(o.y + o.h);
      o.x = Math.min(x1, x2); o.y = Math.min(y1, y2); o.w = Math.abs(x2 - x1); o.h = Math.abs(y2 - y1);
      if (o.type === "magnify" && o.sc) mp(o.sc);
    }
  }
}

export function hitTest(o: Obj, p0: Pt, tol: number): boolean {
  const p = o.rot ? rotPt(p0, rotCenter(o), -o.rot) : p0;
  const inRect = (r: Rect, t: number) => p.x >= r.x - t && p.x <= r.x + r.w + t && p.y >= r.y - t && p.y <= r.y + r.h + t;
  switch (o.type) {
    case "line": return distToSeg(p, o.a, o.b) <= tol + o.s.width / 2;
    case "measure": {
      if (distToSeg(p, o.a, o.b) <= tol + Math.max(o.s.width, 2) / 2) return true;
      return dist(p, mid(o.a, o.b)) <= o.s.fontSize * 1.8;
    }
    case "arrow": {
      const t = tol + Math.max(o.s.width / 2, o.s.arrowStyle === "tapered" ? o.s.width / 2 : 0);
      if (o.s.arrowStyle === "curved") {
        let prev = o.a;
        for (let i = 1; i <= 24; i++) {
          const q = bezierPt(o.a, o.cp, o.b, i / 24);
          if (distToSeg(p, prev, q) <= t) return true;
          prev = q;
        }
        return false;
      }
      return distToSeg(p, o.a, o.b) <= t;
    }
    case "pen": case "highlighter": {
      const t = tol + o.s.width / 2;
      if (o.pts.length === 1) return dist(p, o.pts[0]) <= t;
      for (let i = 1; i < o.pts.length; i++) if (distToSeg(p, o.pts[i - 1], o.pts[i]) <= t) return true;
      return false;
    }
    case "rect": {
      const r = { x: o.x, y: o.y, w: o.w, h: o.h };
      if (o.s.fill === "solid") return inRect(r, tol);
      if (!inRect(r, tol + o.s.width / 2)) return false;
      const t = tol + o.s.width / 2;
      return !(p.x > r.x + t && p.x < r.x + r.w - t && p.y > r.y + t && p.y < r.y + r.h - t);
    }
    case "ellipse": {
      const rx = o.w / 2, ry = o.h / 2, cx = o.x + rx, cy = o.y + ry;
      if (rx < 1 || ry < 1) return inRect(o, tol);
      const nx = (p.x - cx) / rx, ny = (p.y - cy) / ry;
      const d = Math.hypot(nx, ny);
      if (o.s.fill === "solid") return d <= 1 + tol / Math.min(rx, ry);
      const t = (tol + o.s.width / 2) / Math.min(rx, ry);
      return Math.abs(d - 1) <= t;
    }
    case "callout": {
      if (inRect(bodyRect(o), tol)) return true;
      const r = bodyRect(o);
      return !!calloutTail(o) && distToSeg(p, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, o.tail) <= tol + o.s.fontSize * 0.4;
    }
    default: return inRect(localBounds(o), tol);
  }
}
