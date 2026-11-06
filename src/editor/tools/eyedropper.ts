import { st, requestRender } from "../state";
import { pickColor } from "../render";
import { setColorEverywhere } from "../ops";
import { toScreen } from "../viewport";
import type { PEvt, Tool } from "../types";

export class EyedropperTool implements Tool {
  id = "eyedropper" as const;
  cursor = "crosshair";
  onDone: () => void = () => {};
  deactivate() { st.hoverPick = null; }
  hover(e: PEvt) {
    const c = pickColor(st, e.p.x, e.p.y, st.rev);
    st.hoverPick = c ? { x: e.p.x, y: e.p.y, color: c } : null;
    requestRender();
    return "crosshair";
  }
  down(e: PEvt) {
    const c = pickColor(st, e.p.x, e.p.y, st.rev);
    if (!c) return;
    setColorEverywhere(c);
    this.onDone();
  }
  move(e: PEvt) { this.hover(e); }
  up() {}
  overlay(ctx: CanvasRenderingContext2D) {
    const h = st.hoverPick; if (!h) return;
    const p = toScreen(h);
    ctx.save();
    ctx.fillStyle = h.color; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(p.x + 22, p.y + 22, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.font = "600 11px ui-monospace, monospace"; ctx.fillStyle = "#fff"; ctx.textBaseline = "middle";
    const w = ctx.measureText(h.color).width + 10;
    ctx.fillStyle = "rgba(20,20,22,0.85)"; ctx.fillRect(p.x + 40, p.y + 14, w, 18);
    ctx.fillStyle = "#fff"; ctx.fillText(h.color, p.x + 45, p.y + 23);
    ctx.restore();
  }
}
