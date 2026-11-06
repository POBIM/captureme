// Whole-image transforms (rotate / flip) and padding+border. All of them replace `st.base` with a new
// canvas (so undo keeps the old one) and carry every annotation along.
import { st, setSelection, touch } from "./state";
import { commit } from "./history";
import { fit } from "./viewport";
import { bodyRect, moveObj, normAngle, rotatable } from "./geom";
import { release } from "./render";
import type { Obj, Pt, Rect } from "./types";

export type TransformKind = "cw" | "ccw" | "flipH" | "flipV";

function newCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}
function done() {
  setSelection(st.selection.filter((id) => st.objects.some((o) => o.id === id)));
  touch(); commit(); fit();
}

function transformObj(o: Obj, P: (p: Pt) => Pt, kind: TransformKind) {
  const quarter = kind === "cw" || kind === "ccw";
  const dphi = kind === "cw" ? Math.PI / 2 : kind === "ccw" ? -Math.PI / 2 : 0;
  const mp = (p: Pt) => { const q = P(p); p.x = q.x; p.y = q.y; };
  switch (o.type) {
    case "arrow": mp(o.a); mp(o.b); mp(o.cp); return;
    case "line": case "measure": mp(o.a); mp(o.b); return;
    case "pen": case "highlighter": o.pts.forEach(mp); return;
    case "step": mp(o); return;
  }
  const b = bodyRect(o);
  const c0 = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const c1 = P(c0);
  if (!rotatable(o)) {
    // axis-aligned effect boxes: swap width/height on quarter turns
    const bx = o as { x: number; y: number; w: number; h: number; sc?: Pt };
    if (quarter) { const w = bx.w; bx.w = bx.h; bx.h = w; }
    bx.x = c1.x - bx.w / 2; bx.y = c1.y - bx.h / 2;
    if (bx.sc) mp(bx.sc);
    return;
  }
  if (o.type === "callout") {
    let ox = o.tail.x - c0.x, oy = o.tail.y - c0.y;
    if (kind === "flipH") ox = -ox;
    if (kind === "flipV") oy = -oy;
    o.tail = { x: c1.x + ox, y: c1.y + oy };
  }
  const rot = quarter ? (o.rot ?? 0) + dphi : -(o.rot ?? 0);
  o.rot = normAngle(rot) || undefined;
  if (o.type === "stamp") { o.x = c1.x; o.y = c1.y; }
  else { (o as { x: number }).x = c1.x - b.w / 2; (o as { y: number }).y = c1.y - b.h / 2; }
}

export function transformImage(kind: TransformKind) {
  const W = st.base.width, H = st.base.height;
  const quarter = kind === "cw" || kind === "ccw";
  const nc = quarter ? newCanvas(H, W) : newCanvas(W, H);
  const ctx = nc.getContext("2d")!;
  let P: (p: Pt) => Pt;
  switch (kind) {
    case "cw": ctx.translate(H, 0); ctx.rotate(Math.PI / 2); P = (p) => ({ x: H - p.y, y: p.x }); break;
    case "ccw": ctx.translate(0, W); ctx.rotate(-Math.PI / 2); P = (p) => ({ x: p.y, y: W - p.x }); break;
    case "flipH": ctx.translate(W, 0); ctx.scale(-1, 1); P = (p) => ({ x: W - p.x, y: p.y }); break;
    default: ctx.translate(0, H); ctx.scale(1, -1); P = (p) => ({ x: p.x, y: H - p.y });
  }
  ctx.imageSmoothingEnabled = false; // exact pixel moves only
  ctx.drawImage(st.base, 0, 0);
  for (const o of st.objects) transformObj(o, P, kind);
  if (st.crop) {
    const a = P({ x: st.crop.x, y: st.crop.y }), b = P({ x: st.crop.x + st.crop.w, y: st.crop.y + st.crop.h });
    st.crop = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  }
  st.base = nc;
  done();
}

/** Bake the crop into the pixels (used before padding so the border wraps the visible image). */
function bakeCrop() {
  const c = st.crop; if (!c) return;
  const nc = newCanvas(c.w, c.h);
  nc.getContext("2d")!.drawImage(st.base, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
  for (const o of st.objects) moveObj(o, -c.x, -c.y);
  st.base = nc; st.crop = null;
}

/** Plain padding + border around the picture – no gradient / shadow (that is the Background tool). */
export function addPadding(pad: number, padColor: string | null, border: number, borderColor: string) {
  pad = Math.max(0, Math.round(pad)); border = Math.max(0, Math.round(border));
  if (!pad && !border) return;
  bakeCrop();
  const W = st.base.width, H = st.base.height, t = pad + border;
  const nc = newCanvas(W + 2 * t, H + 2 * t);
  const ctx = nc.getContext("2d")!;
  if (border) { ctx.fillStyle = borderColor; ctx.fillRect(0, 0, nc.width, nc.height); ctx.clearRect(border, border, W + 2 * pad, H + 2 * pad); }
  if (pad && padColor) { ctx.fillStyle = padColor; ctx.fillRect(border, border, W + 2 * pad, H + 2 * pad); }
  ctx.drawImage(st.base, t, t);
  for (const o of st.objects) moveObj(o, t, t);
  st.base = nc;
  done();
}
export type { Rect };
void release;
