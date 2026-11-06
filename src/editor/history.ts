import { st, emit, touch, setSelection } from "./state";
import type { Rect, Bg } from "./types";

interface Snap { id: number; objs: string; crop: Rect | null; bg: string; base: HTMLCanvasElement }
let stack: Snap[] = [];
let idx = -1;
let counter = 0;
let cleanId = -1;

function take(): Snap {
  return { id: ++counter, objs: JSON.stringify(st.objects), crop: st.crop ? { ...st.crop } : null, bg: JSON.stringify(st.bg), base: st.base };
}
const same = (a: Snap, b: Snap) =>
  a.objs === b.objs && a.bg === b.bg && a.base === b.base && JSON.stringify(a.crop) === JSON.stringify(b.crop);

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
  if (stack.length > 200) { stack.shift(); }
  idx = stack.length - 1;
  emit("doc");
}
function restore(s: Snap) {
  st.objects = JSON.parse(s.objs);
  st.crop = s.crop ? { ...s.crop } : null;
  st.bg = JSON.parse(s.bg) as Bg;
  st.base = s.base;
  setSelection(st.selection.filter((id) => st.objects.some((o) => o.id === id)));
  touch();
  emit("doc");
}
export function undo() { if (idx > 0) { idx--; restore(stack[idx]); } }
export function redo() { if (idx < stack.length - 1) { idx++; restore(stack[idx]); } }
export const canUndo = () => idx > 0;
export const canRedo = () => idx < stack.length - 1;
export const isDirty = () => stack[idx]?.id !== cleanId;
export function markClean() { cleanId = stack[idx]?.id ?? -1; emit("doc"); }
