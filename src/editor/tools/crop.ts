import { st, baseRect, touch, kscale, emit } from "../state";
import { commit } from "../history";
import { toScreen } from "../viewport";
import { clamp } from "../geom";
import { ACCENT } from "../overlay";
import type { PEvt, Pt, Rect, Tool } from "../types";

type HId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const HS: HId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function hpos(r: Rect, id: HId): Pt {
  const x = id.includes("w") ? r.x : id.includes("e") ? r.x + r.w : r.x + r.w / 2;
  const y = id.includes("n") ? r.y : id.includes("s") ? r.y + r.h : r.y + r.h / 2;
  return { x, y };
}
const CUR: Record<HId, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };

/** Rect spanned from fixed anchor towards p with optional aspect lock, clamped to the image. */
function fromAnchor(anchor: Pt, p: Pt, aspect: number, B: Rect): Rect {
  const px = clamp(p.x, B.x, B.x + B.w), py = clamp(p.y, B.y, B.y + B.h);
  let w = Math.abs(px - anchor.x), h = Math.abs(py - anchor.y);
  const sx = px >= anchor.x ? 1 : -1, sy = py >= anchor.y ? 1 : -1;
  if (aspect > 0) {
    if (w / Math.max(h, 1e-6) > aspect) w = h * aspect; else h = w / aspect;
    const maxW = sx > 0 ? B.x + B.w - anchor.x : anchor.x - B.x;
    const maxH = sy > 0 ? B.y + B.h - anchor.y : anchor.y - B.y;
    const k = Math.min(1, maxW / Math.max(w, 1e-6), maxH / Math.max(h, 1e-6));
    w *= k; h *= k;
  }
  return { x: sx > 0 ? anchor.x : anchor.x - w, y: sy > 0 ? anchor.y : anchor.y - h, w, h };
}

export function setCropAspect(a: number) {
  st.cropAspect = a;
  const d = st.cropDraft; if (!d) return;
  if (a > 0) {
    const B = baseRect();
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    let w = d.w, h = w / a;
    if (h > d.h) { h = d.h; w = h * a; }
    w = Math.min(w, B.w); h = Math.min(h, B.h);
    if (w / h > a) w = h * a; else h = w / a;
    st.cropDraft = { x: clamp(cx - w / 2, 0, B.w - w), y: clamp(cy - h / 2, 0, B.h - h), w, h };
  }
  emit("tool"); touch();
}

export class CropTool implements Tool {
  id = "crop" as const;
  cursor = "crosshair";
  private mode: "none" | "new" | "move" | "handle" = "none";
  private hid: HId = "nw";
  private start: Pt = { x: 0, y: 0 };
  private orig: Rect = { x: 0, y: 0, w: 0, h: 0 };

  activate() {
    st.cropDraft = st.crop ? { ...st.crop } : baseRect();
    st.cropAspect = 0;
  }
  deactivate() { st.cropDraft = null; }

  private hit(e: PEvt): HId | null {
    const d = st.cropDraft; if (!d) return null;
    const tl = toScreen({ x: d.x, y: d.y }), br = toScreen({ x: d.x + d.w, y: d.y + d.h });
    const sr = { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
    for (const id of HS) {
      const p = hpos(sr, id);
      if (Math.hypot(p.x - e.sx, p.y - e.sy) <= 10) return id;
    }
    return null;
  }
  private inside(p: Pt) {
    const d = st.cropDraft!;
    return p.x >= d.x && p.x <= d.x + d.w && p.y >= d.y && p.y <= d.y + d.h;
  }
  hover(e: PEvt) {
    const h = this.hit(e);
    if (h) return CUR[h];
    const d = st.cropDraft;
    return d && this.inside(e.p) && !(d.w >= st.base.width - 0.5 && d.h >= st.base.height - 0.5) ? "move" : "crosshair";
  }
  down(e: PEvt) {
    const d = st.cropDraft!;
    const h = this.hit(e);
    this.start = e.p; this.orig = { ...d };
    if (h) { this.mode = "handle"; this.hid = h; }
    else if (this.inside(e.p) && !(d.w >= st.base.width - 0.5 && d.h >= st.base.height - 0.5)) this.mode = "move";
    else { this.mode = "new"; }
  }
  move(e: PEvt) {
    const B = baseRect(), o = this.orig, a = st.cropAspect;
    if (this.mode === "move") {
      const dx = e.p.x - this.start.x, dy = e.p.y - this.start.y;
      st.cropDraft = { x: clamp(o.x + dx, 0, B.w - o.w), y: clamp(o.y + dy, 0, B.h - o.h), w: o.w, h: o.h };
    } else if (this.mode === "new") {
      if (Math.hypot(e.p.x - this.start.x, e.p.y - this.start.y) * kscale() < 3) return;
      st.cropDraft = fromAnchor({ x: clamp(this.start.x, 0, B.w), y: clamp(this.start.y, 0, B.h) }, e.p, a, B);
    } else if (this.mode === "handle") {
      const id = this.hid;
      const x2 = o.x + o.w, y2 = o.y + o.h;
      if (id.length === 2) {
        const anchor = { x: id.includes("w") ? x2 : o.x, y: id.includes("n") ? y2 : o.y };
        st.cropDraft = fromAnchor(anchor, e.p, a, B);
      } else if (a > 0) {
        // edge with aspect lock: resize about the opposite edge, centred on the other axis
        let w = o.w, h = o.h, x = o.x, y = o.y;
        if (id === "e" || id === "w") {
          const nx = clamp(e.p.x, B.x, B.x + B.w);
          w = id === "e" ? nx - o.x : x2 - nx; h = w / a;
          const maxH = 2 * Math.min(o.y + o.h / 2, B.h - (o.y + o.h / 2));
          if (h > maxH) { h = maxH; w = h * a; }
          x = id === "e" ? o.x : x2 - w; y = o.y + o.h / 2 - h / 2;
        } else {
          const ny = clamp(e.p.y, B.y, B.y + B.h);
          h = id === "s" ? ny - o.y : y2 - ny; w = h * a;
          const maxW = 2 * Math.min(o.x + o.w / 2, B.w - (o.x + o.w / 2));
          if (w > maxW) { w = maxW; h = w / a; }
          y = id === "s" ? o.y : y2 - h; x = o.x + o.w / 2 - w / 2;
        }
        st.cropDraft = { x, y, w: Math.max(w, 1), h: Math.max(h, 1) };
      } else {
        let x1 = o.x, y1 = o.y, xx = x2, yy = y2;
        const px = clamp(e.p.x, 0, B.w), py = clamp(e.p.y, 0, B.h);
        if (id === "w") x1 = px; if (id === "e") xx = px;
        if (id === "n") y1 = py; if (id === "s") yy = py;
        st.cropDraft = { x: Math.min(x1, xx), y: Math.min(y1, yy), w: Math.abs(xx - x1), h: Math.abs(yy - y1) };
      }
    }
    touch();
  }
  up() {
    this.mode = "none";
    const d = st.cropDraft;
    if (d && (d.w < 8 || d.h < 8)) st.cropDraft = { ...this.orig };
    emit("tool"); touch();
  }
  overlay(ctx: CanvasRenderingContext2D) {
    const d = st.cropDraft; if (!d) return;
    const tl = toScreen({ x: d.x, y: d.y }), br = toScreen({ x: d.x + d.w, y: d.y + d.h });
    const W = st.stageW, H = st.stageH;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.beginPath();
    ctx.rect(0, 0, W, H); ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.fill("evenodd");
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      const x = tl.x + ((br.x - tl.x) * i) / 3, y = tl.y + ((br.y - tl.y) * i) / 3;
      ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y);
    }
    ctx.stroke();
    const sr = { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
    for (const id of HS) {
      const p = hpos(sr, id);
      ctx.fillStyle = "#fff"; ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(p.x - 4.5, p.y - 4.5, 9, 9); ctx.fill(); ctx.stroke();
    }
    const label = `${Math.round(d.w)} × ${Math.round(d.h)}`;
    ctx.font = "600 12px -apple-system, sans-serif";
    const tw = ctx.measureText(label).width + 12;
    const lx = Math.max(4, tl.x), ly = Math.max(4, tl.y - 26);
    ctx.fillStyle = "rgba(20,20,22,0.85)";
    ctx.fillRect(lx, ly, tw, 20);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(label, lx + 6, ly + 10);
    ctx.restore();
  }
}

export function currentCropDraft(): Rect | null {
  const d = st.cropDraft; if (!d) return null;
  const x = Math.round(d.x), y = Math.round(d.y);
  return { x, y, w: Math.max(1, Math.round(d.x + d.w) - x), h: Math.max(1, Math.round(d.y + d.h) - y) };
}
export function applyCrop(): boolean {
  const r = currentCropDraft(); if (!r) return false;
  const B = baseRect();
  st.crop = r.x === 0 && r.y === 0 && r.w === B.w && r.h === B.h ? null : r;
  commit();
  return true;
}
