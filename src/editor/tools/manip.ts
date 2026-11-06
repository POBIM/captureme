// Shared selection-manipulation logic (handles: resize, rotate, line endpoints, arrow bend,
// callout tail, magnifier source, group move).
import { st, selected, touch, kscale } from "../state";
import { bounds, moveObj, mapObj, rectUnion, clone, bendHandle, mid, dist, bodyRect, rotCenter, rotPt, rotatable, normAngle } from "../geom";
import { toScreen } from "../viewport";
import { commit } from "../history";
import type { Obj, PEvt, Pt, Rect } from "../types";

export interface Handle { id: string; x: number; y: number }

/** Only scaled uniformly (corner handles, aspect locked). */
const UNIFORM = new Set(["text", "step", "stamp", "callout", "image"]);
const LINE_LIKE = new Set(["arrow", "line", "measure"]);

export function selectionBounds(sel: Obj[]): Rect | null {
  if (!sel.length) return null;
  return sel.map(bounds).reduce(rectUnion);
}

/** The one selected object whose frame can be rotated (not locked), if any. */
export function rotSingle(): Obj | null {
  const sel = selected();
  return sel.length === 1 && rotatable(sel[0]) && !sel[0].locked ? sel[0] : null;
}

/** Handles in stage css coordinates. */
export function handles(): Handle[] {
  if (st.editingId) return [];
  const sel = selected();
  if (!sel.length || sel.some((o) => o.locked)) return [];
  if (sel.length === 1 && LINE_LIKE.has(sel[0].type)) {
    const o = sel[0] as Obj & { a: Pt; b: Pt };
    const a = toScreen(o.a), b = toScreen(o.b);
    const hs: Handle[] = [{ id: "a", ...a }, { id: "b", ...b }];
    if (o.type === "arrow" && o.s.arrowStyle === "curved") hs.push({ id: "bend", ...toScreen(bendHandle(o)) });
    return hs;
  }
  const rs = rotSingle();
  const uniform = sel.every((o) => UNIFORM.has(o.type));
  const hs: Handle[] = [];
  if (rs) {
    const r = bodyRect(rs), c = rotCenter(rs), rot = rs.rot ?? 0;
    const pts: [string, Pt][] = [
      ["nw", { x: r.x, y: r.y }], ["ne", { x: r.x + r.w, y: r.y }], ["se", { x: r.x + r.w, y: r.y + r.h }], ["sw", { x: r.x, y: r.y + r.h }],
    ];
    if (!uniform) pts.push(["n", { x: c.x, y: r.y }], ["e", { x: r.x + r.w, y: c.y }], ["s", { x: c.x, y: r.y + r.h }], ["w", { x: r.x, y: c.y }]);
    for (const [id, p] of pts) hs.push({ id, ...toScreen(rotPt(p, c, rot)) });
    hs.push({ id: "rot", ...toScreen(rotPt({ x: c.x, y: r.y - 26 / kscale() }, c, rot)) });
    if (rs.type === "callout") hs.push({ id: "tail", ...toScreen(rotPt(rs.tail, c, rot)) });
  } else {
    const r = selectionBounds(sel)!;
    const tl = toScreen({ x: r.x, y: r.y }), br = toScreen({ x: r.x + r.w, y: r.y + r.h });
    const cx = (tl.x + br.x) / 2, cy = (tl.y + br.y) / 2;
    hs.push(
      { id: "nw", x: tl.x, y: tl.y }, { id: "ne", x: br.x, y: tl.y },
      { id: "se", x: br.x, y: br.y }, { id: "sw", x: tl.x, y: br.y },
    );
    if (!uniform) hs.push({ id: "n", x: cx, y: tl.y }, { id: "e", x: br.x, y: cy }, { id: "s", x: cx, y: br.y }, { id: "w", x: tl.x, y: cy });
  }
  if (sel.length === 1 && sel[0].type === "magnify" && sel[0].sc) hs.push({ id: "src", ...toScreen(sel[0].sc) });
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
  rot: "crosshair", tail: "move", src: "move",
};

function snap45(from: Pt, p: Pt): Pt {
  const dx = p.x - from.x, dy = p.y - from.y, l = Math.hypot(dx, dy);
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: from.x + Math.cos(ang) * l, y: from.y + Math.sin(ang) * l };
}

export class Manipulator {
  private mode: "none" | "move" | "resize" | "end" | "rotate" | "point" = "none";
  private origs: Obj[] = [];
  private ids: string[] = [];
  private start: Pt = { x: 0, y: 0 };
  private hid = "";
  private from: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private c0: Pt = { x: 0, y: 0 };
  private a0 = 0;
  private moved = false;

  get active() { return this.mode !== "none"; }

  beginMove(e: PEvt) {
    const sel = selected().filter((o) => !o.locked);
    if (!sel.length) return;
    this.mode = "move"; this.snapshot(sel); this.start = e.p; this.moved = false;
  }
  /** Try to start a handle drag. */
  beginHandle(e: PEvt): boolean {
    const h = hitHandle(e.sx, e.sy);
    if (!h) return false;
    const sel = selected();
    this.snapshot(sel);
    this.hid = h.id; this.start = e.p; this.moved = false;
    const o0 = this.origs[0];
    if (h.id === "a" || h.id === "b" || h.id === "bend") this.mode = "end";
    else if (h.id === "rot") {
      this.mode = "rotate"; this.c0 = rotCenter(o0);
      this.a0 = Math.atan2(e.p.y - this.c0.y, e.p.x - this.c0.x);
    } else if (h.id === "tail" || h.id === "src") { this.mode = "point"; this.c0 = rotCenter(o0); }
    else {
      this.mode = "resize";
      if (rotSingle()) { this.from = bodyRect(o0); this.c0 = rotCenter(o0); }
      else this.from = selectionBounds(this.origs)!;
    }
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
    } else if (this.mode === "rotate") {
      const o = objs[0], orig = this.origs[0];
      const ang = Math.atan2(e.p.y - this.c0.y, e.p.x - this.c0.x);
      let rot = (orig.rot ?? 0) + (ang - this.a0);
      const step = Math.PI / 12;
      if (e.shift) rot = Math.round(rot / step) * step;
      else {
        const q = Math.round(rot / (Math.PI / 4)) * (Math.PI / 4);
        if (Math.abs(rot - q) < (3 * Math.PI) / 180) rot = q; // magnetic 45° steps
      }
      rot = normAngle(rot);
      if (rot) o.rot = rot; else delete o.rot;
    } else if (this.mode === "point") {
      const o = objs[0];
      if (this.hid === "tail" && o.type === "callout") o.tail = rotPt(e.p, this.c0, -(o.rot ?? 0));
      else if (this.hid === "src" && o.type === "magnify") o.sc = { x: e.p.x, y: e.p.y };
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
      const single = rotSingleOrig(this.origs);
      const rot = single ? this.origs[0].rot ?? 0 : 0;
      const p = single && rot ? rotPt(e.p, this.c0, -rot) : e.p; // pointer in the object's own frame
      let x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h;
      const id = this.hid;
      if (id.includes("w")) x1 = p.x;
      if (id.includes("e")) x2 = p.x;
      if (id.includes("n")) y1 = p.y;
      if (id.includes("s")) y2 = p.y;
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
      if (single && rot) {
        // keep the opposite corner fixed on screen: the new centre, rotated about the old one, is the true centre
        const nc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
        const wc = rotPt(nc, this.c0, rot);
        to.x += wc.x - nc.x; to.y += wc.y - nc.y;
      }
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

function rotSingleOrig(origs: Obj[]): boolean {
  return origs.length === 1 && rotatable(origs[0]);
}

export function minDragPx() { return 3 / kscale(); }
