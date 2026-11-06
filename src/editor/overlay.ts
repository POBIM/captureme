import { st, selected } from "./state";
import { handles, selectionBounds } from "./tools/manip";
import { toScreen } from "./viewport";

export const ACCENT = "#4da3ff";

export function drawSelection(ctx: CanvasRenderingContext2D) {
  const sel = selected();
  if (!sel.length || st.editingId) return;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = ACCENT;
  const single = sel.length === 1 && (sel[0].type === "arrow" || sel[0].type === "line");
  if (!single) {
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
    ctx.fillStyle = h.id === "bend" ? ACCENT : "#fff";
    ctx.fill();
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
}
