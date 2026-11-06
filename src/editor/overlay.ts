import { st, selected, kscale } from "./state";
import { handles, selectionBounds } from "./tools/manip";
import { toScreen } from "./viewport";
import { bodyRect, rotCenter, rotPt, rotatable } from "./geom";
import type { Pt } from "./types";

export const ACCENT = "#4da3ff";

function lockBadge(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = "rgba(20,20,22,0.88)"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(x - 9, y - 9, 18, 18, 5); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x - 4.5, y - 1, 9, 6.5, 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y - 1, 3, Math.PI, 0); ctx.stroke();
  ctx.restore();
}

export function drawSelection(ctx: CanvasRenderingContext2D) {
  const sel = selected();
  if (!sel.length || st.editingId) return;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = ACCENT;
  const lineLike = sel.length === 1 && (sel[0].type === "arrow" || sel[0].type === "line" || sel[0].type === "measure");
  const rs = sel.length === 1 && rotatable(sel[0]) ? sel[0] : null;
  if (rs) {
    // rotated frame around the object's own body
    const r = bodyRect(rs), c = rotCenter(rs), rot = rs.rot ?? 0;
    const pts: Pt[] = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }]
      .map((p) => toScreen(rotPt(p, c, rot)));
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
    if (!rs.locked) {
      const top = toScreen(rotPt({ x: c.x, y: r.y }, c, rot)), rh = toScreen(rotPt({ x: c.x, y: r.y - 26 / kscale() }, c, rot));
      ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rh.x, rh.y); ctx.stroke();
    }
    if (rs.type === "callout" && !rs.locked) {
      const a = toScreen(rotPt(rs.tail, c, rot));
      ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(a.x, a.y); const m = toScreen(c); ctx.lineTo(m.x, m.y); ctx.stroke(); ctx.setLineDash([]);
    }
  } else if (!lineLike) {
    ctx.setLineDash([5, 4]);
    for (const o of sel) {
      if (sel.length === 1) break;
      const r = selectionBounds([o])!;
      const a = toScreen({ x: r.x, y: r.y }), b = toScreen({ x: r.x + r.w, y: r.y + r.h });
      ctx.strokeRect(a.x - 2, a.y - 2, b.x - a.x + 4, b.y - a.y + 4);
    }
    const r = selectionBounds(sel)!;
    const a = toScreen({ x: r.x, y: r.y }), b = toScreen({ x: r.x + r.w, y: r.y + r.h });
    ctx.strokeRect(a.x - 0.5, a.y - 0.5, b.x - a.x + 1, b.y - a.y + 1);
    ctx.setLineDash([]);
  }
  for (const h of handles()) {
    ctx.beginPath();
    if (h.id.length > 2 || h.id === "a" || h.id === "b") ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
    else ctx.rect(h.x - 4, h.y - 4, 8, 8);
    ctx.fillStyle = h.id === "bend" || h.id === "rot" ? ACCENT : h.id === "tail" || h.id === "src" ? "#fbbf24" : "#fff";
    ctx.fill();
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.stroke();
  }
  for (const o of sel) {
    if (!o.locked) continue;
    const r = selectionBounds([o])!;
    const b = toScreen({ x: r.x + r.w, y: r.y });
    lockBadge(ctx, b.x + 4, b.y - 4);
  }
  ctx.restore();
}
