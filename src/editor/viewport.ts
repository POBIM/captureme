import { st, docRect, kscale, emit, requestRender } from "./state";
import type { Pt } from "./types";

export function toImage(sx: number, sy: number): Pt {
  const d = docRect(), k = kscale();
  return { x: d.x + (sx - st.view.panX) / k, y: d.y + (sy - st.view.panY) / k };
}
export function toScreen(p: Pt): Pt {
  const d = docRect(), k = kscale();
  return { x: st.view.panX + (p.x - d.x) * k, y: st.view.panY + (p.y - d.y) * k };
}

export const MIN_ZOOM = 0.02, MAX_ZOOM = 32;

export function fit() {
  const d = docRect();
  const pad = st.bg.enabled && st.tool !== "crop" ? st.bg.padding : 0;
  const fw = d.w + 2 * pad, fh = d.h + 2 * pad;
  const m = 36;
  const kf = Math.min((st.stageW - 2 * m) / fw, (st.stageH - 2 * m) / fh);
  const zoom = Math.max(MIN_ZOOM, Math.min(kf * st.dpr, 1));
  st.view.zoom = zoom;
  const k = zoom / st.dpr;
  st.view.panX = (st.stageW - fw * k) / 2 + pad * k;
  st.view.panY = (st.stageH - fh * k) / 2 + pad * k;
  st.view.autoFit = true;
  emit("view");
  requestRender();
}

/** Zoom keeping stage point (cx,cy) fixed. */
export function zoomAt(newZoom: number, cx: number, cy: number) {
  newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
  const kOld = kscale();
  const ix = (cx - st.view.panX) / kOld, iy = (cy - st.view.panY) / kOld;
  st.view.zoom = newZoom;
  const k = kscale();
  st.view.panX = cx - ix * k;
  st.view.panY = cy - iy * k;
  st.view.autoFit = false;
  emit("view");
  requestRender();
}
export function zoomStep(factor: number) {
  zoomAt(st.view.zoom * factor, st.stageW / 2, st.stageH / 2);
}
export function zoomActual() { zoomAt(1, st.stageW / 2, st.stageH / 2); }
export function panBy(dx: number, dy: number) {
  st.view.panX += dx; st.view.panY += dy; st.view.autoFit = false;
  emit("view"); requestRender();
}

export function attachViewportInput(el: HTMLElement) {
  el.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    if (e.ctrlKey || e.metaKey) {
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.004));
      zoomAt(st.view.zoom * f, cx, cy);
    } else panBy(-e.deltaX, -e.deltaY);
  }, { passive: false });

  // Safari / WKWebView trackpad pinch
  let startZoom = 1;
  const g = (e: Event) => e as Event & { scale: number; clientX: number; clientY: number };
  el.addEventListener("gesturestart", (e) => { e.preventDefault(); startZoom = st.view.zoom; });
  el.addEventListener("gesturechange", (e) => {
    e.preventDefault();
    const ev = g(e), r = el.getBoundingClientRect();
    zoomAt(startZoom * ev.scale, ev.clientX - r.left, ev.clientY - r.top);
  });
  el.addEventListener("gestureend", (e) => e.preventDefault());
}
