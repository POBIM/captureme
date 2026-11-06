import { st, touch, setSelection, kscale } from "../state";
import { commit } from "../history";
import { addObject, newObj, stepObj } from "../ops";
import { defaultCp, dist, rectFrom, clone } from "../geom";
import { Manipulator, hitHandle, HANDLE_CURSOR } from "./manip";
import type { Obj, PEvt, Pt, Tool, ToolId, ArrowObj, LineObj, BoxObj, PenObj, TextObj, StepObj, StampObj } from "../types";
import { beginEdit } from "../textedit";
import { topHit } from "./select";

function snap45(from: Pt, p: Pt): Pt {
  const dx = p.x - from.x, dy = p.y - from.y, l = Math.hypot(dx, dy);
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: from.x + Math.cos(ang) * l, y: from.y + Math.sin(ang) * l };
}

abstract class BaseTool {
  protected m = new Manipulator();
  cursor = "crosshair";
  hover(e: PEvt) {
    const h = hitHandle(e.sx, e.sy);
    return h ? HANDLE_CURSOR[h.id] : "crosshair";
  }
}

type ShapeType = "arrow" | "line" | "rect" | "ellipse" | "blur" | "pixelate" | "spotlight" | "magnify";

export class ShapeTool extends BaseTool implements Tool {
  private cur: Obj | null = null;
  private start: Pt = { x: 0, y: 0 };
  private sx = 0; private sy = 0;
  constructor(public id: ToolId) { super(); }

  down(e: PEvt) {
    if (this.m.beginHandle(e)) return;
    this.start = e.p; this.sx = e.sx; this.sy = e.sy; this.cur = null;
  }
  private create() {
    const t = this.id as ShapeType;
    const p = this.start;
    let o: Obj;
    if (t === "arrow") o = newObj("arrow", { a: { ...p }, b: { ...p }, cp: { ...p } });
    else if (t === "line") o = newObj("line", { a: { ...p }, b: { ...p } });
    else o = newObj(t, { x: p.x, y: p.y, w: 0, h: 0 });
    this.cur = o;
    addObject(o);
  }
  move(e: PEvt) {
    if (this.m.active) { this.m.move(e); return; }
    if (!this.cur) {
      if (Math.hypot(e.sx - this.sx, e.sy - this.sy) < 3) return;
      this.create();
    }
    const o = this.cur!;
    if (o.type === "arrow" || o.type === "line") {
      const b = e.shift ? snap45(this.start, e.p) : e.p;
      (o as ArrowObj | LineObj).b = { ...b };
      if (o.type === "arrow") o.cp = defaultCp(o.a, o.b, o.s.arrowStyle === "curved");
    } else {
      const b = o as BoxObj;
      let dx = e.p.x - this.start.x, dy = e.p.y - this.start.y;
      if (e.shift || b.type === "magnify") {
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m;
      }
      const a = e.alt ? { x: this.start.x - dx, y: this.start.y - dy } : this.start;
      const r = rectFrom(a, { x: this.start.x + dx, y: this.start.y + dy });
      b.x = r.x; b.y = r.y; b.w = r.w; b.h = r.h;
    }
    touch();
  }
  up(e: PEvt) {
    if (this.m.active) { this.m.end(); return; }
    if (this.cur) { this.cur = null; commit(); return; }
    if (this.id === "magnify" && Math.hypot(e.sx - this.sx, e.sy - this.sy) < 3) {
      const o = newObj("magnify", { x: e.p.x - 90, y: e.p.y - 90, w: 180, h: 180 });
      addObject(o); commit();
    }
  }
}

function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  let max = 0, idx = 0;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
  for (let i = 1; i < pts.length - 1; i++) {
    const d = l === 0 ? dist(pts[i], a) : Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / l;
    if (d > max) { max = d; idx = i; }
  }
  if (max > eps) {
    const L = rdp(pts.slice(0, idx + 1), eps), R = rdp(pts.slice(idx), eps);
    return [...L.slice(0, -1), ...R];
  }
  return [a, b];
}

export class PenTool extends BaseTool implements Tool {
  private cur: PenObj | null = null;
  private raw: Pt[] = [];
  constructor(public id: "pen" | "highlighter") { super(); }
  down(e: PEvt) {
    if (this.m.beginHandle(e)) return;
    this.raw = [e.p];
    this.cur = newObj(this.id, { pts: [{ ...e.p }] }) as PenObj;
    addObject(this.cur);
  }
  move(e: PEvt) {
    if (this.m.active) { this.m.move(e); return; }
    const o = this.cur; if (!o) return;
    if (e.shift) {
      const a = this.raw[0];
      o.pts = [{ ...a }, { ...snap45(a, e.p) }];
    } else {
      const last = this.raw[this.raw.length - 1];
      if (dist(last, e.p) < 1.5 / kscale()) return;
      this.raw.push(e.p);
      o.pts = this.raw.map((p) => ({ ...p }));
    }
    touch();
  }
  up() {
    if (this.m.active) { this.m.end(); return; }
    const o = this.cur; this.cur = null;
    if (!o) return;
    if (o.pts.length > 2) o.pts = rdp(o.pts, 0.6 / kscale() > 3 ? 3 : 0.6 / kscale());
    touch(); commit();
  }
}

/** Step counter + emoji stamp: click to place, drag to reposition before release. */
export class PlaceTool extends BaseTool implements Tool {
  private cur: StepObj | StampObj | null = null;
  constructor(public id: "step" | "stamp") { super(); }
  down(e: PEvt) {
    if (this.m.beginHandle(e)) return;
    const o = this.id === "step"
      ? (stepObj(e.p) as StepObj)
      : (newObj("stamp", { x: e.p.x, y: e.p.y, size: 0 }) as StampObj);
    if (o.type === "stamp") o.size = o.s.fontSize * 1.5;
    this.cur = o;
    addObject(o);
  }
  move(e: PEvt) {
    if (this.m.active) { this.m.move(e); return; }
    if (!this.cur) return;
    this.cur.x = e.p.x; this.cur.y = e.p.y; touch();
  }
  up() {
    if (this.m.active) { this.m.end(); return; }
    if (this.cur) { this.cur = null; commit(); }
  }
}

export class TextTool extends BaseTool implements Tool {
  id = "text" as const;
  cursor = "text";
  hover(e: PEvt) {
    const h = hitHandle(e.sx, e.sy);
    if (h) return HANDLE_CURSOR[h.id];
    const hit = topHit(e.p);
    return hit && hit.type === "text" ? "text" : "crosshair";
  }
  down(e: PEvt) {
    if (this.m.beginHandle(e)) return;
    const hit = topHit(e.p);
    if (hit && hit.type === "text") { beginEdit(hit); return; }
    const o = newObj("text", { x: e.p.x, y: e.p.y, text: "" }) as TextObj;
    o.y = e.p.y - o.s.fontSize * 0.7;
    st.objects.push(o);
    setSelection([o.id]);
    beginEdit(o);
  }
  move(e: PEvt) { this.m.move(e); }
  up() { this.m.end(); }
}
void clone;
