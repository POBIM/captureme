import { on } from "./state";
import { endEdit } from "./textedit";
import { toImage, panBy } from "./viewport";
import { currentTool } from "./tools";
import type { PEvt } from "./types";

export const input = { space: false };

export function attachInput(canvas: HTMLCanvasElement) {
  let panning = false, lx = 0, ly = 0, down = false;

  const mk = (e: PointerEvent | MouseEvent): PEvt => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    return { p: toImage(sx, sy), sx, sy, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, detail: (e as MouseEvent).detail, button: (e as MouseEvent).button };
  };
  const setCursor = (c: string) => { if (canvas.style.cursor !== c) canvas.style.cursor = c; };
  const idleCursor = () => (input.space ? "grab" : currentTool().cursor ?? "default");

  canvas.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus on text editor / avoid text selection
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    endEdit();
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
    if (e.button === 1 || (e.button === 0 && input.space)) {
      panning = true; lx = e.clientX; ly = e.clientY; setCursor("grabbing"); e.preventDefault(); return;
    }
    if (e.button !== 0) return;
    down = true;
    currentTool().down(mk(e));
  });
  canvas.addEventListener("pointermove", (e) => {
    if (panning) { panBy(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; return; }
    const ev = mk(e);
    if (down) { currentTool().move(ev); return; }
    const c = currentTool().hover?.(ev);
    setCursor(input.space ? "grab" : c || idleCursor());
  });
  const end = (e: PointerEvent) => {
    if (panning) { panning = false; setCursor(idleCursor()); return; }
    if (!down) return;
    down = false;
    currentTool().up(mk(e));
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("dblclick", (e) => currentTool().dblclick?.(mk(e)));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !isTyping(e.target)) { input.space = true; setCursor("grab"); e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") { input.space = false; setCursor(idleCursor()); }
  });
  window.addEventListener("blur", () => { input.space = false; });
  const refresh = () => setCursor(idleCursor());
  on("tool", refresh);
}

export function isTyping(t: EventTarget | null): boolean {
  return t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type !== "range" && t.type !== "color" && t.type !== "checkbox");
}
