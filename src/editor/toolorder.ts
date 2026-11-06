// Tool catalogue + user-customisable toolbar order. The first nine slots are also the 1–9 number-key favourites.
import type { ToolId } from "./types";

export interface ToolDef { id: ToolId; code: string; cap: string; group: number }
export const TOOL_DEFS: ToolDef[] = [
  { id: "select", code: "KeyV", cap: "V", group: 0 }, { id: "crop", code: "KeyC", cap: "C", group: 0 },
  { id: "arrow", code: "KeyA", cap: "A", group: 1 }, { id: "line", code: "KeyL", cap: "L", group: 1 },
  { id: "rect", code: "KeyR", cap: "R", group: 1 }, { id: "ellipse", code: "KeyO", cap: "O", group: 1 },
  { id: "pen", code: "KeyP", cap: "P", group: 1 }, { id: "highlighter", code: "KeyH", cap: "H", group: 1 },
  { id: "text", code: "KeyT", cap: "T", group: 1 }, { id: "step", code: "KeyN", cap: "N", group: 1 },
  { id: "callout", code: "KeyQ", cap: "Q", group: 1 }, { id: "marker", code: "KeyY", cap: "Y", group: 1 },
  { id: "underline", code: "KeyU", cap: "U", group: 1 }, { id: "measure", code: "KeyZ", cap: "Z", group: 1 },
  { id: "redact", code: "KeyD", cap: "D", group: 2 }, { id: "blur", code: "KeyB", cap: "B", group: 2 },
  { id: "pixelate", code: "KeyX", cap: "X", group: 2 }, { id: "spotlight", code: "KeyS", cap: "S", group: 2 },
  { id: "magnify", code: "KeyM", cap: "M", group: 2 }, { id: "stamp", code: "KeyE", cap: "E", group: 2 },
  { id: "eyedropper", code: "KeyI", cap: "I", group: 2 },
];
export const TOOL_BY_CODE = new Map<string, ToolId>(TOOL_DEFS.map((d) => [d.code, d.id]));
export const DEF_BY_ID = new Map<ToolId, ToolDef>(TOOL_DEFS.map((d) => [d.id, d]));

const LS = "captureme.editor.toolbar.v1";
let order: ToolId[] = load();
const subs = new Set<() => void>();

function load(): ToolId[] {
  const all = TOOL_DEFS.map((d) => d.id);
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || "[]") as ToolId[];
    const ok = saved.filter((id, i) => all.includes(id) && saved.indexOf(id) === i);
    return [...ok, ...all.filter((id) => !ok.includes(id))]; // tools added in later versions land at the end
  } catch { return all; }
}
export const getOrder = () => order;
export function setOrder(ids: ToolId[]) {
  order = ids;
  try { localStorage.setItem(LS, JSON.stringify(order)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
export function resetOrder() { setOrder(TOOL_DEFS.map((d) => d.id)); }
export function onOrderChange(f: () => void) { subs.add(f); }
/** Tool bound to number key 1–9 (position in the toolbar). */
export const favourite = (n: number): ToolId | undefined => order[n - 1];
