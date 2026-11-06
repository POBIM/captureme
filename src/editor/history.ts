import { st, emit, touch, setSelection } from "./state";
import { fit } from "./viewport";
import { pruneImages } from "./images";
import type { Rect, Bg } from "./types";

interface Snap { id: number; objs: string; crop: Rect | null; bg: string; base: HTMLCanvasElement }
let stack: Snap[] = [];
let idx = -1;
let counter = 0;
let cleanId = -1;

/** Each distinct base bitmap in the stack can be tens of MB for Retina captures: bound the total. */
const MAX_STEPS = 200;
const MAX_BASE_PIXELS = 160_000_000; // ≈ 640 MB of bitmaps kept for undo

function take(): Snap {
  return { id: ++counter, objs: JSON.stringify(st.objects), crop: st.crop ? { ...st.crop } : null, bg: JSON.stringify(st.bg), base: st.base };
}
const same = (a: Snap, b: Snap) =>
  a.objs === b.objs && a.bg === b.bg && a.base === b.base && JSON.stringify(a.crop) === JSON.stringify(b.crop);

function trim() {
  // never drop the current or later steps
  const over = () => {
    if (stack.length > MAX_STEPS) return true;
    const seen = new Set<HTMLCanvasElement>(); let px = 0;
    for (const s of stack) if (!seen.has(s.base)) { seen.add(s.base); px += s.base.width * s.base.height; }
    return px > MAX_BASE_PIXELS && seen.size > 1;
  };
  let dropped = false;
  while (stack.length > 1 && idx > 0 && over()) { stack.shift(); idx--; dropped = true; }
  if (dropped) pruneImages(stack.map((s) => s.objs).join("\n"));
}

export function resetHistory() {
  stack = []; idx = -1;
  const s = take(); stack.push(s); idx = 0; cleanId = s.id;
  emit("doc");
}
/** Record the current state as a new undo step (no-op if nothing changed). */
export function commit() {
  const s = take();
  if (idx >= 0 && same(stack[idx], s)) return;
  stack = stack.slice(0, idx + 1);
  stack.push(s);
  idx = stack.length - 1;
  trim();
  emit("doc");
}
function restore(s: Snap) {
  const baseChanged = st.base !== s.base && (st.base.width !== s.base.width || st.base.height !== s.base.height);
  st.objects = JSON.parse(s.objs);
  st.crop = s.crop ? { ...s.crop } : null;
  st.bg = JSON.parse(s.bg) as Bg;
  st.base = s.base;
  setSelection(st.selection.filter((id) => st.objects.some((o) => o.id === id)));
  touch();
  if (baseChanged || st.view.autoFit) fit();
  emit("doc");
}
export function undo() { if (idx > 0) { idx--; restore(stack[idx]); } }
export function redo() { if (idx < stack.length - 1) { idx++; restore(stack[idx]); } }
export const canUndo = () => idx > 0;
export const canRedo = () => idx < stack.length - 1;
export const isDirty = () => stack[idx]?.id !== cleanId;
export function markClean() { cleanId = stack[idx]?.id ?? -1; emit("doc"); }
