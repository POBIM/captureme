import { st, selected, setSelection, touch, nextStep, docRect } from "./state";
import { commit } from "./history";
import { clone, uid, moveObj, defaultCp, bounds, rectUnion } from "./geom";
import { PROP_KEYS, toolProps, saveToolProps } from "./props";
import type { BoxObj, Obj, ObjType, PropKey, Props, Pt, Rect } from "./types";

export function newObj(type: ObjType, geo: Record<string, unknown>): Obj {
  return { id: uid(), type, s: { ...toolProps[type] }, ...geo } as unknown as Obj;
}
export function addObject(o: Obj, select = true) {
  st.objects.push(o);
  if (select) setSelection([o.id]);
  touch();
}
export function stepObj(p: Pt): Obj { return newObj("step", { x: p.x, y: p.y, n: nextStep() }); }

/** Locked objects can be selected but not moved, edited or deleted. */
export const unlocked = (list: Obj[]) => list.filter((o) => !o.locked);

export function deleteSelected() {
  const del = unlocked(selected());
  if (!del.length) return;
  const ids = new Set(del.map((o) => o.id));
  st.objects = st.objects.filter((o) => !ids.has(o.id));
  setSelection(st.selection.filter((i) => !ids.has(i)));
  touch(); commit();
}
export function duplicateSelected(offset = 20): string[] {
  const sel = selected();
  if (!sel.length) return [];
  const gmap = new Map<string, string>();
  const copies = sel.map((o) => {
    const c = clone(o); c.id = uid(); delete c.locked;
    if (c.gid) { if (!gmap.has(c.gid)) gmap.set(c.gid, uid()); c.gid = gmap.get(c.gid); }
    moveObj(c, offset, offset); return c;
  });
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
  unlocked(selected()).forEach((o) => moveObj(o, dx, dy));
  touch(); if (final) commit();
}

/* ---------- groups & locking ---------- */
/** Add every member of any group that is partly in `ids`. */
export function expandGroups(ids: string[]): string[] {
  const gids = new Set(st.objects.filter((o) => o.gid && ids.includes(o.id)).map((o) => o.gid!));
  if (!gids.size) return ids;
  const out = new Set(ids);
  for (const o of st.objects) if (o.gid && gids.has(o.gid)) out.add(o.id);
  return st.objects.filter((o) => out.has(o.id)).map((o) => o.id);
}
export function groupSelected() {
  const sel = unlocked(selected());
  if (sel.length < 2) return;
  const g = uid();
  sel.forEach((o) => (o.gid = g));
  touch(); commit();
}
export function ungroupSelected() {
  const sel = selected().filter((o) => o.gid);
  if (!sel.length) return;
  sel.forEach((o) => delete o.gid);
  touch(); commit();
}
export const hasGroup = () => selected().some((o) => o.gid);
export function toggleLock() {
  const sel = selected();
  if (!sel.length) return;
  const lock = sel.some((o) => !o.locked);
  sel.forEach((o) => { if (lock) o.locked = true; else delete o.locked; });
  touch(); commit();
}

/* ---------- align & distribute ---------- */
export type AlignKind = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
/** One object aligns to the visible image; several align to their common bounds. */
export function alignSelected(kind: AlignKind) {
  const sel = unlocked(selected());
  if (!sel.length) return;
  const ref: Rect = sel.length === 1 && selected().length === 1 ? docRect() : selected().map(bounds).reduce(rectUnion);
  for (const o of sel) {
    const b = bounds(o);
    let dx = 0, dy = 0;
    if (kind === "left") dx = ref.x - b.x;
    else if (kind === "right") dx = ref.x + ref.w - (b.x + b.w);
    else if (kind === "hcenter") dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
    else if (kind === "top") dy = ref.y - b.y;
    else if (kind === "bottom") dy = ref.y + ref.h - (b.y + b.h);
    else dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
    moveObj(o, dx, dy);
  }
  touch(); commit();
}
/** Equal gaps between ≥3 objects along one axis (outermost stay put). */
export function distributeSelected(axis: "h" | "v") {
  const sel = unlocked(selected());
  if (sel.length < 3) return;
  const bs = sel.map((o) => ({ o, b: bounds(o) }));
  const pos = (b: Rect) => (axis === "h" ? b.x : b.y), len = (b: Rect) => (axis === "h" ? b.w : b.h);
  bs.sort((p, q) => pos(p.b) - pos(q.b));
  const first = bs[0].b, last = bs[bs.length - 1].b;
  const total = pos(last) + len(last) - pos(first);
  const gap = (total - bs.reduce((a, x) => a + len(x.b), 0)) / (bs.length - 1);
  let cur = pos(first) + len(first) + gap;
  for (let i = 1; i < bs.length - 1; i++) {
    const d = cur - pos(bs[i].b);
    if (axis === "h") moveObj(bs[i].o, d, 0); else moveObj(bs[i].o, 0, d);
    cur += len(bs[i].b) + gap;
  }
  touch(); commit();
}

/** Replace blur / pixelate with an opaque redaction box of the same area. */
export function convertToRedact() {
  const sel = unlocked(selected()).filter((o) => o.type === "blur" || o.type === "pixelate");
  if (!sel.length) return;
  for (const o of sel) {
    const b = o as BoxObj;
    (b as { type: string }).type = "redact";
    b.s = { ...toolProps.redact };
  }
  touch(); commit();
}

export function setProp<K extends PropKey>(key: K, value: Props[K], final: boolean) {
  unlocked(selected()).filter((o) => PROP_KEYS[o.type].includes(key)).forEach((o) => {
    (o.s as Props)[key] = value;
    if (o.type === "arrow" && key === "arrowStyle") o.cp = defaultCp(o.a, o.b, value === "curved");
    if (o.type === "magnify" && key === "leader") {
      if (value && !o.sc) o.sc = { x: o.x + o.w / 2 - o.w * 1.15, y: o.y + o.h / 2 };
      if (!value) delete o.sc;
    }
  });
  const t = st.tool as ObjType;
  if (PROP_KEYS[t]?.includes(key)) toolProps[t][key] = value;
  saveToolProps();
  touch();
  if (final) commit();
}

/** Eyedropper: set colour for the selection and all tools that have a colour. */
export function setColorEverywhere(hex: string) {
  for (const t of Object.keys(toolProps) as ObjType[]) if (t !== "redact" && PROP_KEYS[t].includes("color")) toolProps[t].color = hex;
  saveToolProps();
  unlocked(selected()).filter((o) => o.type !== "redact" && PROP_KEYS[o.type].includes("color")).forEach((o) => (o.s.color = hex));
  touch(); commit();
}
