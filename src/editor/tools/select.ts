import { st, selected, setSelection, touch, kscale } from "../state";
import { hitTest, rectFrom, bounds } from "../geom";
import { toScreen } from "../viewport";
import { duplicateSelected } from "../ops";
import { beginEdit } from "../textedit";
import { Manipulator, hitHandle, HANDLE_CURSOR } from "./manip";
import { ACCENT } from "../overlay";
import type { Obj, PEvt, Pt, Rect, Tool } from "../types";

export function topHit(p: Pt): Obj | null {
  const tol = 6 / kscale();
  for (let i = st.objects.length - 1; i >= 0; i--) if (hitTest(st.objects[i], p, tol)) return st.objects[i];
  return null;
}

export class SelectTool implements Tool {
  id = "select" as const;
  private m = new Manipulator();
  private marquee: { a: Pt; b: Pt; base: string[] } | null = null;

  deactivate() { this.marquee = null; }

  down(e: PEvt) {
    if (this.m.beginHandle(e)) return;
    const hit = topHit(e.p);
    if (hit) {
      const inSel = st.selection.includes(hit.id);
      if (e.shift) {
        if (inSel) { setSelection(st.selection.filter((i) => i !== hit.id)); return; }
        setSelection([...st.selection, hit.id]);
      } else if (!inSel) setSelection([hit.id]);
      if (e.alt) duplicateSelected(0);
      this.m.beginMove(e);
      return;
    }
    this.marquee = { a: e.p, b: e.p, base: e.shift ? [...st.selection] : [] };
    if (!e.shift) setSelection([]);
  }
  move(e: PEvt) {
    if (this.m.active) { this.m.move(e); return; }
    if (this.marquee) {
      this.marquee.b = e.p;
      const r = rectFrom(this.marquee.a, this.marquee.b);
      const ids = st.objects.filter((o) => {
        const b = bounds(o);
        return b.x <= r.x + r.w && b.x + b.w >= r.x && b.y <= r.y + r.h && b.y + b.h >= r.y;
      }).map((o) => o.id);
      setSelection([...new Set([...this.marquee.base, ...ids])]);
      touch();
    }
  }
  up(e: PEvt) {
    this.m.end();
    if (this.marquee) { this.marquee = null; touch(); }
  }
  hover(e: PEvt) {
    const h = hitHandle(e.sx, e.sy);
    if (h) return HANDLE_CURSOR[h.id];
    const hit = topHit(e.p);
    return hit ? (st.selection.includes(hit.id) ? "move" : "pointer") : "default";
  }
  dblclick(e: PEvt) {
    const hit = topHit(e.p);
    if (hit && hit.type === "text") beginEdit(hit);
  }
  overlay(ctx: CanvasRenderingContext2D) {
    if (!this.marquee) return;
    const a = toScreen(this.marquee.a), b = toScreen(this.marquee.b);
    ctx.save();
    ctx.fillStyle = "rgba(77,163,255,0.12)"; ctx.strokeStyle = ACCENT; ctx.lineWidth = 1;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeRect(a.x + 0.5, a.y + 0.5, b.x - a.x, b.y - a.y);
    ctx.restore();
  }
}
export type { Rect };
void selected;
