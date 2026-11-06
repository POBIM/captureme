import { st, selected, on } from "./state";
import { t } from "../shared/i18n";
import { icon } from "./icons";
import { PROP_KEYS, toolProps, PALETTE, EMOJIS } from "./props";
import { setProp, deleteSelected, duplicateSelected, bringToFront, sendToBack } from "./ops";
import { setTool, confirmCrop, cancelCrop, resetCrop } from "./tools";
import { setCropAspect } from "./tools/crop";
import { undo, redo, canUndo, canRedo } from "./history";
import { zoomStep, fit, zoomActual } from "./viewport";
import { doCopy, doSave, doSaveAs, doPin, doOcr, copyAndClose } from "./export";
import { showResizeDialog, toggleBgPanel } from "./dialogs";
import { docRect } from "./state";
import type { ObjType, PropKey, Props, ToolId } from "./types";

export interface ToolDef { id: ToolId; code: string; cap: string }
export const TOOL_GROUPS: ToolDef[][] = [
  [{ id: "select", code: "KeyV", cap: "V" }, { id: "crop", code: "KeyC", cap: "C" }],
  [
    { id: "arrow", code: "KeyA", cap: "A" }, { id: "line", code: "KeyL", cap: "L" }, { id: "rect", code: "KeyR", cap: "R" },
    { id: "ellipse", code: "KeyO", cap: "O" }, { id: "pen", code: "KeyP", cap: "P" }, { id: "highlighter", code: "KeyH", cap: "H" },
    { id: "text", code: "KeyT", cap: "T" }, { id: "step", code: "KeyN", cap: "N" },
  ],
  [
    { id: "blur", code: "KeyB", cap: "B" }, { id: "pixelate", code: "KeyX", cap: "X" }, { id: "spotlight", code: "KeyS", cap: "S" },
    { id: "magnify", code: "KeyM", cap: "M" }, { id: "stamp", code: "KeyE", cap: "E" }, { id: "eyedropper", code: "KeyI", cap: "I" },
  ],
];
export const TOOL_BY_CODE = new Map<string, ToolId>(TOOL_GROUPS.flat().map((d) => [d.code, d.id]));

interface Titled { el: HTMLElement; key: string; cap?: string; label?: boolean }
const titled: Titled[] = [];
const toolBtns = new Map<ToolId, HTMLButtonElement>();
let propsLeft: HTMLElement, propsRight: HTMLElement, statusSize: HTMLElement, statusZoom: HTMLElement, statusSel: HTMLElement;
let undoBtn: HTMLButtonElement, redoBtn: HTMLButtonElement;

function btn(iconName: string, key: string, cap: string | undefined, onClick: (b: HTMLButtonElement) => void, cls = "", reg = true): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "ib " + cls;
  b.innerHTML = icon(iconName);
  b.addEventListener("mousedown", (e) => e.preventDefault()); // keep text editing focus semantics predictable
  b.onclick = () => onClick(b);
  if (reg) titled.push({ el: b, key, cap });
  else b.title = t(key) + (cap ? `  (${cap})` : "");
  return b;
}
const sep = () => { const s = document.createElement("div"); s.className = "sep"; return s; };

export function buildUI(root: HTMLElement) {
  root.innerHTML = "";
  const top = document.createElement("div"); top.className = "toolbar";
  for (const g of TOOL_GROUPS) {
    for (const d of g) {
      const b = btn(d.id, `editor.tool.${d.id}`, d.cap, () => setTool(d.id), "tool");
      toolBtns.set(d.id, b); top.appendChild(b);
    }
    top.appendChild(sep());
  }
  undoBtn = btn("undo", "editor.undo", "⌘Z", () => undo());
  redoBtn = btn("redo", "editor.redo", "⇧⌘Z", () => redo());
  top.append(undoBtn, redoBtn, sep(),
    btn("resize", "editor.resize.title", undefined, () => showResizeDialog()),
    btn("bg", "editor.bg.title", undefined, (b) => toggleBgPanel(b)));
  const sp = document.createElement("div"); sp.className = "spacer"; top.appendChild(sp);
  top.append(
    btn("copy", "editor.copy", "⌘C", () => doCopy()),
    btn("save", "editor.save", "⌘S", () => doSave()),
    btn("saveas", "editor.saveAs", "⇧⌘S", () => doSaveAs()),
    btn("pin", "editor.pin", undefined, () => doPin()),
    btn("ocr", "editor.ocr", undefined, () => doOcr()),
  );
  const cc = btn("done", "editor.copyClose", "⌘↩", () => copyAndClose(), "primary wide");
  cc.insertAdjacentHTML("beforeend", `<span class="lbl"></span>`);
  titled[titled.length - 1].label = true;
  top.appendChild(cc);

  const props = document.createElement("div"); props.className = "props";
  propsLeft = document.createElement("div"); propsLeft.className = "pleft";
  propsRight = document.createElement("div"); propsRight.className = "pright";
  props.append(propsLeft, propsRight);

  const stage = document.createElement("div"); stage.className = "stage";
  const canvas = document.createElement("canvas"); stage.appendChild(canvas);

  const status = document.createElement("div"); status.className = "status";
  statusSize = document.createElement("span"); statusSize.className = "s-size";
  statusSel = document.createElement("span"); statusSel.className = "s-sel";
  const zoomBox = document.createElement("div"); zoomBox.className = "s-zoom";
  statusZoom = document.createElement("span"); statusZoom.className = "zval";
  const zb = (name: string, key: string, fn: () => void) => { const b = btn(name, key, undefined, fn, "mini"); return b; };
  zoomBox.append(zb("minus", "editor.zoomOut", () => zoomStep(1 / 1.25)), statusZoom, zb("plus", "editor.zoomIn", () => zoomStep(1.25)), zb("fit", "editor.zoomFit", () => fit()));
  statusZoom.onclick = () => zoomActual();
  statusZoom.title = "100%";
  const hint = document.createElement("span"); hint.className = "s-hint";
  hint.dataset.i18n = "editor.hint";
  status.append(statusSize, statusSel, hint, zoomBox);

  root.append(top, props, stage, status);

  on("tool", () => { syncTools(); rebuildProps(); updateStatus(); });
  on("selection", () => { rebuildProps(); updateStatus(); });
  on("doc", () => { syncTools(); rebuildProps(); updateStatus(); });
  on("view", updateStatus);
  applyTitles();
  syncTools(); rebuildProps(); updateStatus();
  return { stage, canvas };
}

export function applyTitles() {
  for (const x of titled) {
    x.el.title = t(x.key) + (x.cap ? `  (${x.cap})` : "");
    if (x.label) x.el.querySelector(".lbl")!.textContent = t(x.key);
  }
  const h = statusSize.parentElement?.querySelector<HTMLElement>(".s-hint");
  if (h) h.textContent = t("editor.hint");
  rebuildProps(); updateStatus();
}

function syncTools() {
  toolBtns.forEach((b, id) => b.classList.toggle("active", st.tool === id));
  undoBtn.disabled = !canUndo(); redoBtn.disabled = !canRedo();
}

export function updateStatus() {
  if (!statusSize) return;
  const d = docRect();
  const pad = st.bg.enabled && st.tool !== "crop" ? st.bg.padding * 2 : 0;
  let s = `${Math.round(d.w + pad)} × ${Math.round(d.h + pad)} px`;
  if (st.crop && st.tool !== "crop") s += `  · ${t("editor.status.cropped")} (${st.base.width} × ${st.base.height})`;
  statusSize.textContent = s;
  statusZoom.textContent = `${Math.round(st.view.zoom * 100)}%`;
  const n = st.selection.length;
  statusSel.textContent = n ? `${n} ${t("editor.status.selected")}` : "";
}

/* ---------- properties bar ---------- */
function group(labelKey: string | null, ...els: HTMLElement[]): HTMLElement {
  const g = document.createElement("div"); g.className = "pg";
  if (labelKey) { const l = document.createElement("span"); l.className = "pl"; l.textContent = t(labelKey); g.appendChild(l); }
  g.append(...els);
  return g;
}
function propSource(): { keys: PropKey[]; get: <K extends PropKey>(k: K) => Props[K] | undefined; type: ObjType | null } | null {
  const tool = st.tool;
  if (tool in toolProps) {
    const tp = toolProps[tool as ObjType];
    return { keys: PROP_KEYS[tool as ObjType], get: (k) => tp[k], type: tool as ObjType };
  }
  if (tool === "select") {
    const sel = selected();
    if (!sel.length) return null;
    const keys: PropKey[] = [];
    for (const o of sel) for (const k of PROP_KEYS[o.type]) if (!keys.includes(k)) keys.push(k);
    const order: PropKey[] = ["color", "emoji", "arrowStyle", "stepStyle", "fill", "width", "fontSize", "bold", "textBg", "radius", "strength", "zoom", "dim", "opacity", "shadow"];
    keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return {
      keys,
      get: (k) => sel.find((o) => PROP_KEYS[o.type].includes(k))?.s[k],
      type: sel.length === 1 ? sel[0].type : null,
    };
  }
  return null;
}

function seg<T extends string>(key: PropKey, opts: [T, string][], cur: T | undefined): HTMLElement {
  const d = document.createElement("div"); d.className = "seg";
  for (const [v, label] of opts) {
    const b = document.createElement("button");
    b.textContent = label; b.classList.toggle("on", v === cur);
    b.onclick = () => setProp(key, v as never, true);
    d.appendChild(b);
  }
  return d;
}
function range(key: PropKey, min: number, max: number, step: number, cur: number, fmt: (v: number) => string = String): HTMLElement {
  const w = document.createElement("div"); w.className = "rng";
  const r = document.createElement("input"); r.type = "range";
  r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(cur);
  const out = document.createElement("span"); out.className = "val"; out.textContent = fmt(cur);
  r.oninput = () => { out.textContent = fmt(+r.value); setProp(key, +r.value as never, false); };
  r.onchange = () => { setProp(key, +r.value as never, true); r.blur(); };
  w.append(r, out);
  return w;
}
function toggle(key: PropKey, label: string, cur: boolean | undefined, cls = ""): HTMLElement {
  const b = document.createElement("button");
  b.className = "tg " + cls; b.textContent = label; b.classList.toggle("on", !!cur);
  b.onclick = () => setProp(key, !cur as never, true);
  return b;
}
function colorCtl(cur: string | undefined): HTMLElement {
  const w = document.createElement("div"); w.className = "colors";
  for (const c of PALETTE) {
    const b = document.createElement("button");
    b.className = "sw"; b.style.background = c; b.classList.toggle("on", cur?.toLowerCase() === c);
    b.onclick = () => setProp("color", c, true);
    w.appendChild(b);
  }
  const inp = document.createElement("input"); inp.type = "color"; inp.className = "custom";
  inp.value = /^#[0-9a-f]{6}$/i.test(cur ?? "") ? cur! : "#ff0000";
  inp.title = t("editor.prop.customColor");
  inp.oninput = () => setProp("color", inp.value, false);
  inp.onchange = () => { setProp("color", inp.value, true); inp.blur(); };
  w.appendChild(inp);
  return w;
}
function emojiCtl(cur: string | undefined): HTMLElement {
  const w = document.createElement("div"); w.className = "emojis";
  for (const e of EMOJIS) {
    const b = document.createElement("button"); b.textContent = e; b.classList.toggle("on", e === cur);
    b.onclick = () => setProp("emoji", e, true);
    w.appendChild(b);
  }
  return w;
}

export function rebuildProps() {
  if (!propsLeft) return;
  propsLeft.innerHTML = ""; propsRight.innerHTML = "";
  if (st.tool === "crop") { buildCropProps(); return; }
  if (st.tool === "eyedropper") { propsLeft.appendChild(hintEl("editor.hint.eyedropper")); return; }
  const src = propSource();
  if (!src) { propsLeft.appendChild(hintEl("editor.hint.select")); return; }
  const g = src.get;
  const strengthLabel = src.type === "pixelate" ? "editor.prop.pixelSize" : src.type === "blur" ? "editor.prop.blurAmount" : "editor.prop.strength";
  for (const k of src.keys) {
    switch (k) {
      case "color": propsLeft.appendChild(group(null, colorCtl(g("color")))); break;
      case "emoji": propsLeft.appendChild(group(null, emojiCtl(g("emoji")))); break;
      case "arrowStyle":
        propsLeft.appendChild(group("editor.prop.style", seg("arrowStyle", [
          ["straight", t("editor.arrow.straight")], ["curved", t("editor.arrow.curved")],
          ["double", t("editor.arrow.double")], ["tapered", t("editor.arrow.tapered")]], g("arrowStyle")))); break;
      case "stepStyle":
        propsLeft.appendChild(group("editor.prop.style", seg("stepStyle", [["filled", "●1"], ["circled", "◯1"], ["glyph", "①"]], g("stepStyle")))); break;
      case "fill":
        propsLeft.appendChild(group(null, seg("fill", [["none", t("editor.prop.outline")], ["solid", t("editor.prop.filled")]], g("fill")))); break;
      case "width": propsLeft.appendChild(group("editor.prop.width", range("width", 1, src.type === "highlighter" ? 80 : 40, 1, g("width") ?? 6, (v) => `${v}`))); break;
      case "fontSize": propsLeft.appendChild(group("editor.prop.size", range("fontSize", 10, 200, 1, g("fontSize") ?? 36))); break;
      case "bold": propsLeft.appendChild(group(null, toggle("bold", "B", g("bold"), "bold"))); break;
      case "textBg": propsLeft.appendChild(group(null, toggle("textBg", t("editor.prop.textBg"), g("textBg")))); break;
      case "radius": propsLeft.appendChild(group("editor.prop.radius", range("radius", 0, 80, 1, g("radius") ?? 0))); break;
      case "strength": propsLeft.appendChild(group(strengthLabel, range("strength", 2, 60, 1, g("strength") ?? 12))); break;
      case "zoom": propsLeft.appendChild(group("editor.prop.magnify", range("zoom", 1.5, 6, 0.5, g("zoom") ?? 2, (v) => `${v}×`))); break;
      case "dim": propsLeft.appendChild(group("editor.prop.dim", range("dim", 0.1, 0.95, 0.05, g("dim") ?? 0.6, (v) => `${Math.round(v * 100)}%`))); break;
      case "opacity": propsLeft.appendChild(group("editor.prop.opacity", range("opacity", 0.1, 1, 0.05, g("opacity") ?? 1, (v) => `${Math.round(v * 100)}%`))); break;
      case "shadow": propsLeft.appendChild(group(null, toggle("shadow", t("editor.prop.shadow"), g("shadow")))); break;
    }
  }
  if (st.selection.length) {
    propsRight.append(
      btn("dup", "editor.dup", "⌘D", () => duplicateSelected(), "mini", false),
      btn("front", "editor.front", "⌘]", () => bringToFront(), "mini", false),
      btn("back", "editor.back", "⌘[", () => sendToBack(), "mini", false),
      btn("trash", "editor.delete", "⌫", () => deleteSelected(), "mini danger", false),
    );
  }
}

function hintEl(key: string): HTMLElement {
  const s = document.createElement("span"); s.className = "phint"; s.textContent = t(key); return s;
}

function buildCropProps() {
  const opts: [number, string][] = [[0, t("editor.crop.free")], [1, "1:1"], [4 / 3, "4:3"], [3 / 2, "3:2"], [16 / 9, "16:9"], [9 / 16, "9:16"]];
  const d = document.createElement("div"); d.className = "seg";
  for (const [v, label] of opts) {
    const b = document.createElement("button"); b.textContent = label;
    b.classList.toggle("on", Math.abs(st.cropAspect - v) < 1e-6);
    b.onclick = () => setCropAspect(v);
    d.appendChild(b);
  }
  propsLeft.appendChild(group("editor.crop.aspect", d));
  propsLeft.appendChild(hintEl("editor.crop.hint"));
  const mk = (label: string, cls: string, fn: () => void) => {
    const b = document.createElement("button"); b.className = "btn " + cls; b.textContent = label; b.onclick = fn; return b;
  };
  propsRight.append(mk(t("editor.crop.reset"), "", resetCrop), mk(t("editor.cancel") + " ⎋", "", cancelCrop), mk(t("editor.apply") + " ↩", "primary", confirmCrop));
}
