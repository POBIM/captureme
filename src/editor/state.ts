import type { Bg, Obj, Rect, ToolId } from "./types";

type Evt = "render" | "selection" | "tool" | "doc" | "view";
const listeners: Record<Evt, Set<() => void>> = {
  render: new Set(), selection: new Set(), tool: new Set(), doc: new Set(), view: new Set(),
};
export function on(e: Evt, fn: () => void) { listeners[e].add(fn); }
export function emit(e: Evt) { listeners[e].forEach((f) => f()); }

const BG_LS = "captureme.editor.bg.v1";
function loadBg(): Bg {
  const d: Bg = { enabled: false, padding: 64, mode: "gradient", gradient: 0, color: "#ffffff", radius: 16, shadow: true };
  try { return { ...d, ...JSON.parse(localStorage.getItem(BG_LS) || "{}"), enabled: false }; } catch { return d; }
}
export function saveBg() { try { localStorage.setItem(BG_LS, JSON.stringify(st.bg)); } catch { /* ignore */ } }

export const st = {
  base: document.createElement("canvas"),
  objects: [] as Obj[],
  selection: [] as string[],
  crop: null as Rect | null,
  cropDraft: null as Rect | null,
  cropAspect: 0, // 0 = free, otherwise w/h
  bg: loadBg(),
  tool: "select" as ToolId,
  prevTool: "select" as ToolId,
  /** zoom = device pixels per image pixel */
  view: { zoom: 1, panX: 0, panY: 0, autoFit: true },
  rev: 0,
  editingId: null as string | null,
  imageId: null as string | null,
  path: "",
  savedPath: null as string | null,
  dpr: window.devicePixelRatio || 1,
  stageW: 800,
  stageH: 600,
  hoverPick: null as { x: number; y: number; color: string } | null,
};

export const baseRect = (): Rect => ({ x: 0, y: 0, w: st.base.width, h: st.base.height });
/** The visible document rect (image coordinates). While cropping the whole image is shown. */
export function docRect(): Rect {
  if (st.tool === "crop") return baseRect();
  return st.crop ?? baseRect();
}
/** Css pixels per image pixel. */
export const kscale = () => st.view.zoom / st.dpr;

let raf = 0;
export function requestRender() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; emit("render"); });
}
/** Call after any mutation of document content. */
export function touch() { st.rev++; requestRender(); }

export const selected = (): Obj[] => st.objects.filter((o) => st.selection.includes(o.id));
export function setSelection(ids: string[]) {
  if (ids.length === st.selection.length && ids.every((v, i) => v === st.selection[i])) return;
  st.selection = ids;
  emit("selection");
  requestRender();
}
export const getObj = (id: string) => st.objects.find((o) => o.id === id);

export function nextStep(): number {
  let m = 0;
  for (const o of st.objects) if (o.type === "step") m = Math.max(m, o.n);
  return m + 1;
}
