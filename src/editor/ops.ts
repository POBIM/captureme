import { st, selected, setSelection, touch, nextStep } from "./state";
import { commit } from "./history";
import { clone, uid, moveObj, defaultCp } from "./geom";
import { PROP_KEYS, toolProps, saveToolProps } from "./props";
import type { Obj, ObjType, PropKey, Props, Pt } from "./types";

export function newObj(type: ObjType, geo: Record<string, unknown>): Obj {
  return { id: uid(), type, s: { ...toolProps[type] }, ...geo } as unknown as Obj;
}
export function addObject(o: Obj, select = true) {
  st.objects.push(o);
  if (select) setSelection([o.id]);
  touch();
}
export function stepObj(p: Pt): Obj { return newObj("step", { x: p.x, y: p.y, n: nextStep() }); }

export function deleteSelected() {
  if (!st.selection.length) return;
  const ids = new Set(st.selection);
  st.objects = st.objects.filter((o) => !ids.has(o.id));
  setSelection([]);
  touch(); commit();
}
export function duplicateSelected(offset = 20): string[] {
  const sel = selected();
  if (!sel.length) return [];
  const copies = sel.map((o) => { const c = clone(o); c.id = uid(); moveObj(c, offset, offset); return c; });
  st.objects.push(...copies);
  setSelection(copies.map((c) => c.id));
  touch(); commit();
  return copies.map((c) => c.id);
}
export function bringToFront() {
  const ids = new Set(st.selection); if (!ids.size) return;
  st.objects = [...st.objects.filter((o) => !ids.has(o.id)), ...st.objects.filter((o) => ids.has(o.id))];
  touch(); commit();
}
export function sendToBack() {
  const ids = new Set(st.selection); if (!ids.size) return;
  st.objects = [...st.objects.filter((o) => ids.has(o.id)), ...st.objects.filter((o) => !ids.has(o.id))];
  touch(); commit();
}
export function selectAll() { setSelection(st.objects.map((o) => o.id)); }
export function nudge(dx: number, dy: number, final: boolean) {
  selected().forEach((o) => moveObj(o, dx, dy));
  touch(); if (final) commit();
}

export function setProp<K extends PropKey>(key: K, value: Props[K], final: boolean) {
  selected().filter((o) => PROP_KEYS[o.type].includes(key)).forEach((o) => {
    (o.s as Props)[key] = value;
    if (o.type === "arrow" && key === "arrowStyle") o.cp = defaultCp(o.a, o.b, value === "curved");
  });
  const t = st.tool as ObjType;
  if (PROP_KEYS[t]?.includes(key)) toolProps[t][key] = value;
  saveToolProps();
  touch();
  if (final) commit();
}

/** Eyedropper: set colour for the selection and all tools that have a colour. */
export function setColorEverywhere(hex: string) {
  for (const t of Object.keys(toolProps) as ObjType[]) if (PROP_KEYS[t].includes("color")) toolProps[t].color = hex;
  saveToolProps();
  selected().filter((o) => PROP_KEYS[o.type].includes("color")).forEach((o) => (o.s.color = hex));
  touch(); commit();
}
