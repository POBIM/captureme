// Shared selection-manipulation logic (handles: resize, line endpoints, arrow bend, group move).
import { st, selected, touch, kscale } from "../state";
import { bounds, moveObj, mapObj, rectUnion, clone, bendHandle, mid, dist } from "../geom";
import { toScreen } from "../viewport";
import { commit } from "../history";
import type { Obj, PEvt, Pt, Rect } from "../types";

export interface Handle { id: string; x: number; y: number }

const UNIFORM = new Set(["text", "step", "stamp"]);

export function selectionBounds(sel: Obj[]): Rect | null {
  if (!sel.length) return null;
  return sel.map(bounds).reduce(rectUnion);
}

/** Handles in stage css coordinates. */
export function handles(): Handle[] {
  if (st.editingId) return [];
  const sel = selected();
  if (!sel.length) return [];
  if (sel.length === 1 && (sel[0].type === "arrow" || sel[0].type === "line")) {
    const o = sel[0];
    const a = toScreen(o.a), b = toScreen(o.b);
    const hs: Handle[] = [{ id: "a", ...a }, { id: "b", ...b }];
    if (o.type === "arrow" && o.s.arrowStyle === "curved") hs.push({ id: "bend", ...toScreen(bendHandle(o)) });
    return hs;
  }
  const r = selectionBounds(sel)!;
  const tl = toScreen({ x: r.x, y: r.y }), br = toScreen({ x: r.x + r.w, y: r.y + r.h });
  const cx = (tl.x + br.x) / 2, cy = (tl.y + br.y) / 2;
  const hs: Handle[] = [
    { id: "nw", x: tl.x, y: tl.y }, { id: "ne", x: br.x, y: tl.y },
    { id: "se", x: br.x, y: br.y }, { id: "sw", x: tl.x, y: br.y },
  ];
  if (!sel.every((o) => UNIFORM.has(o.type))) {
    hs.push({ id: "n", x: cx, y: tl.y }, { id: "e", x: br.x, y: cy }, { id: "s", x: cx, y: br.y }, { id: "w", x: tl.x, y: cy });
  }
  return hs;
}

export function hitHandle(sx: number, sy: number): Handle | null {
  const hs = handles();
  for (let i = hs.length - 1; i >= 0; i--) if (Math.hypot(hs[i].x - sx, hs[i].y - sy) <= 8) return hs[i];
  return null;
}

export const HANDLE_CURSOR: Record<string, string> = {
  nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", a: "crosshair", b: "crosshair", bend: "move",
};

function snap45(from: Pt, p: Pt): Pt {
  const dx = p.x - from.x, dy = p.y - from.y, l = Math.hypot(dx, dy);
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: from.x + Math.cos(ang) * l, y: from.y + Math.sin(ang) * l };
}

export class Manipulator {
  private mode: "none" | "move" | "resize" | "end" = "none";
  private origs: Obj[] = [];
  private ids: string[] = [];
  private start: Pt = { x: 0, y: 0 };
  private hid = "";
  private from: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private moved = false;

  get active() { return this.mode !== "none"; }

  beginMove(e: PEvt) {
    const sel = selected();
    this.mode = "move"; this.snapshot(sel); this.start = e.p; this.moved = false;
  }
  /** Try to start a handle drag. */
  beginHandle(e: PEvt): boolean {
    const h = hitHandle(e.sx, e.sy);
    if (!h) return false;
    const sel = selected();
    this.snapshot(sel);
    this.hid = h.id; this.start = e.p; this.moved = false;
    if (h.id === "a" || h.id === "b" || h.id === "bend") this.mode = "end";
    else { this.mode = "resize"; this.from = selectionBounds(this.origs)!; }
    return true;
  }
  private snapshot(sel: Obj[]) {
    this.origs = sel.map(clone); this.ids = sel.map((o) => o.id);
  }
  private live(): Obj[] { return this.ids.map((id) => st.objects.find((o) => o.id === id)!).filter(Boolean); }

  move(e: PEvt) {
    if (this.mode === "none") return;
    this.moved = true;
    const objs = this.live();
    if (this.mode === "move") {
      let dx = e.p.x - this.start.x, dy = e.p.y - this.start.y;
      if (e.shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      objs.forEach((o, i) => {
        const orig = clone(this.origs[i]);
        Object.assign(o, orig);
        moveObj(o, dx, dy);
      });
    } else if (this.mode === "end") {
      const o = objs[0] as Obj & { a: Pt; b: Pt; cp?: Pt };
      const orig = this.origs[0] as typeof o;
      if (this.hid === "bend") {
        const m = mid(o.a, o.b);
        o.cp = { x: 2 * e.p.x - m.x, y: 2 * e.p.y - m.y };
      } else {
        const other = this.hid === "a" ? orig.b : orig.a;
        const p = e.shift ? snap45(other, e.p) : e.p;
        const wasCurved = o.type === "arrow" && o.s.arrowStyle === "curved";
        const oldMid = mid(orig.a, orig.b);
        const off = orig.cp ? { x: orig.cp.x - oldMid.x, y: orig.cp.y - oldMid.y } : { x: 0, y: 0 };
        if (this.hid === "a") o.a = { ...p }; else o.b = { ...p };
        if (o.type === "arrow") {
          const nm = mid(o.a, o.b);
          // keep bend proportional
          const ol = dist(orig.a, orig.b) || 1, nl = dist(o.a, o.b) || 1;
          o.cp = wasCurved ? { x: nm.x + off.x * (nl / ol), y: nm.y + off.y * (nl / ol) } : nm;
        }
      }
    } else if (this.mode === "resize") {
      const r = this.from;
      let x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h;
      const id = this.hid;
      if (id.includes("w")) x1 = e.p.x;
      if (id.includes("e")) x2 = e.p.x;
      if (id.includes("n")) y1 = e.p.y;
      if (id.includes("s")) y2 = e.p.y;
      const lock = e.shift || this.origs.every((o) => UNIFORM.has(o.type));
      if (lock && r.w > 0 && r.h > 0) {
        const corner = id.length === 2;
        if (corner) {
          const s = Math.max(Math.abs(x2 - x1) / r.w, Math.abs(y2 - y1) / r.h, 0.05);
          const ax = id.includes("w") ? r.x + r.w : r.x, ay = id.includes("n") ? r.y + r.h : r.y;
          const nw = r.w * s, nh = r.h * s;
          x1 = id.includes("w") ? ax - nw : ax; x2 = id.includes("w") ? ax : ax + nw;
          y1 = id.includes("n") ? ay - nh : ay; y2 = id.includes("n") ? ay : ay + nh;
        } else if (id === "n" || id === "s") {
          const nh = Math.abs(y2 - y1), nw = r.w * (nh / r.h), cx = r.x + r.w / 2;
          x1 = cx - nw / 2; x2 = cx + nw / 2;
        } else {
          const nw = Math.abs(x2 - x1), nh = r.h * (nw / r.w), cy = r.y + r.h / 2;
          y1 = cy - nh / 2; y2 = cy + nh / 2;
        }
      }
      const to = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(2, Math.abs(x2 - x1)), h: Math.max(2, Math.abs(y2 - y1)) };
      objs.forEach((o, i) => {
        Object.assign(o, clone(this.origs[i]));
        mapObj(o, this.from, to);
      });
    }
    touch();
  }

  end() {
    if (this.mode === "none") return;
    const m = this.moved;
    this.mode = "none";
    if (m) commit();
  }
}

export function minDragPx() { return 3 / kscale(); }
