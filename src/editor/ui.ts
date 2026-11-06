import { st, selected, on, docRect } from "./state";
import { t } from "../shared/i18n";
import { icon } from "./icons";
import { PROP_KEYS, toolProps, PALETTE, EMOJIS } from "./props";
import { setProp, deleteSelected, duplicateSelected, bringToFront, sendToBack, groupSelected, ungroupSelected, hasGroup, toggleLock, convertToRedact } from "./ops";
import { setTool, confirmCrop, cancelCrop, resetCrop } from "./tools";
import { setCropAspect } from "./tools/crop";
import { undo, redo, canUndo, canRedo } from "./history";
import { zoomStep, fit, zoomActual } from "./viewport";
import { doCopy, doSave, doSaveAs, doPin, doOcr, copyAndClose, exportPrefs } from "./export";
import { showResizeDialog, toggleBgPanel, showPaddingDialog } from "./dialogs";
import { toggleTransformPanel, toggleArrangePanel, toggleExportPanel, toggleWatermarkPanel, showHelp } from "./panels";
import { TOOL_DEFS, DEF_BY_ID, getOrder, setOrder, onOrderChange } from "./toolorder";
import { activeWm } from "./watermark";
import type { ObjType, PropKey, Props, ToolId } from "./types";

interface Titled { el: HTMLElement; key: string; cap?: string; label?: boolean; tip?: string; tool?: ToolId }
const titled: Titled[] = [];
const toolBtns = new Map<ToolId, HTMLButtonElement>();
let toolsBox: HTMLElement;
let propsLeft: HTMLElement, propsRight: HTMLElement, statusSize: HTMLElement, statusZoom: HTMLElement, statusSel: HTMLElement, statusExp: HTMLElement;
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

/* ---------- tool buttons: order, number badges, drag to reorder ---------- */
let suppressClick = false;
function makeToolButton(id: ToolId): HTMLButtonElement {
  const d = DEF_BY_ID.get(id)!;
  const b = btn(id, `editor.tool.${id}`, d.cap, () => { if (!suppressClick) setTool(id); }, "tool");
  const rec = titled[titled.length - 1];
  rec.tool = id;
  if (id === "blur" || id === "pixelate") rec.tip = "editor.warn.reversible";
  if (id === "redact") rec.tip = "editor.tip.redact";
  b.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const sx = e.clientX;
    let dragging = false, target: ToolId | null = null, after = false;
    const clear = () => toolBtns.forEach((x) => x.classList.remove("drop-l", "drop-r"));
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - sx) > 6) { dragging = true; b.classList.add("dragging"); toolsBox.classList.add("reordering"); }
      if (!dragging) return;
      clear(); target = null;
      for (const [tid, el] of toolBtns) {
        const r = el.getBoundingClientRect();
        if (tid !== id && ev.clientX >= r.left && ev.clientX <= r.right) {
          after = ev.clientX > r.left + r.width / 2; target = tid;
          el.classList.add(after ? "drop-r" : "drop-l");
        }
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointercancel", up);
      b.classList.remove("dragging"); toolsBox.classList.remove("reordering"); clear();
      if (!dragging) return;
      suppressClick = true; setTimeout(() => (suppressClick = false), 0);
      if (!target) return;
      const o = getOrder().filter((x) => x !== id);
      const i = o.indexOf(target) + (after ? 1 : 0);
      o.splice(i, 0, id);
      setOrder(o);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
  });
  return b;
}
function layoutTools() {
  toolsBox.innerHTML = "";
  let prev: number | null = null;
  getOrder().forEach((id, i) => {
    const b = toolBtns.get(id)!;
    const g = DEF_BY_ID.get(id)!.group;
    if (prev !== null && g !== prev) toolsBox.appendChild(sep());
    prev = g;
    if (i < 9) b.dataset.n = String(i + 1); else delete b.dataset.n;
    toolsBox.appendChild(b);
  });
  applyTitles();
}

export function buildUI(root: HTMLElement) {
  root.innerHTML = "";
  const top = document.createElement("div"); top.className = "toolbar";
  toolsBox = document.createElement("div"); toolsBox.className = "tools";
  for (const d of TOOL_DEFS) toolBtns.set(d.id, makeToolButton(d.id));
  undoBtn = btn("undo", "editor.undo", "⌘Z", () => undo());
  redoBtn = btn("redo", "editor.redo", "⇧⌘Z", () => redo());
  const grp = document.createElement("div"); grp.className = "tgrp";
  grp.append(undoBtn, redoBtn, sep(),
    btn("resize", "editor.resize.title", undefined, () => showResizeDialog()),
    btn("pad", "editor.pad.title", undefined, () => showPaddingDialog()),
    btn("rotr", "editor.tf.title", undefined, (b) => toggleTransformPanel(b)),
    btn("bg", "editor.bg.title", undefined, (b) => toggleBgPanel(b)));
  top.append(toolsBox, sep(), grp);
  const acts = document.createElement("div"); acts.className = "tgrp acts";
  acts.append(
    btn("wm", "editor.wm.title", undefined, (b) => toggleWatermarkPanel(b, updateStatus)),
    btn("export", "editor.exp.title", undefined, (b) => toggleExportPanel(b, updateStatus)),
    sep(),
    btn("copy", "editor.copy", "⌘C", () => doCopy()),
    btn("save", "editor.save", "⌘S", () => doSave()),
    btn("saveas", "editor.saveAs", "⇧⌘S", () => doSaveAs()),
    btn("pin", "editor.pin", undefined, () => doPin()),
    btn("ocr", "editor.ocr", undefined, () => doOcr()),
    btn("help", "editor.help.title", "?", () => showHelp()),
  );
  const cc = btn("done", "editor.copyClose", "⌘↩", () => copyAndClose(), "primary wide");
  cc.insertAdjacentHTML("beforeend", `<span class="lbl"></span>`);
  titled[titled.length - 1].label = true;
  acts.appendChild(cc);
  top.appendChild(acts);

  const props = document.createElement("div"); props.className = "props";
  propsLeft = document.createElement("div"); propsLeft.className = "pleft";
  propsRight = document.createElement("div"); propsRight.className = "pright";
  props.append(propsLeft, propsRight);

  const stage = document.createElement("div"); stage.className = "stage";
  const canvas = document.createElement("canvas"); stage.appendChild(canvas);
  const drop = document.createElement("div"); drop.className = "drop-hint"; drop.dataset.i18n = "editor.insert.dropHint"; stage.appendChild(drop);

  const status = document.createElement("div"); status.className = "status";
  statusSize = document.createElement("span"); statusSize.className = "s-size";
  statusSel = document.createElement("span"); statusSel.className = "s-sel";
  statusExp = document.createElement("span"); statusExp.className = "s-exp";
  const zoomBox = document.createElement("div"); zoomBox.className = "s-zoom";
  statusZoom = document.createElement("span"); statusZoom.className = "zval";
  const zb = (name: string, key: string, fn: () => void) => { const b = btn(name, key, undefined, fn, "mini"); return b; };
  zoomBox.append(zb("minus", "editor.zoomOut", () => zoomStep(1 / 1.25)), statusZoom, zb("plus", "editor.zoomIn", () => zoomStep(1.25)), zb("fit", "editor.zoomFit", () => fit()));
  statusZoom.onclick = () => zoomActual();
  statusZoom.title = "100%";
  const hint = document.createElement("span"); hint.className = "s-hint";
  hint.dataset.i18n = "editor.hint";
  status.append(statusSize, statusSel, statusExp, hint, zoomBox);

  root.append(top, props, stage, status);
  layoutTools();
  onOrderChange(() => { layoutTools(); });

  on("tool", () => { syncTools(); rebuildProps(); updateStatus(); });
  on("selection", () => { rebuildProps(); updateStatus(); });
  on("doc", () => { syncTools(); rebuildProps(); updateStatus(); });
  on("view", updateStatus);
  applyTitles();
  syncTools(); rebuildProps(); updateStatus();
  return { stage, canvas };
}

export function applyTitles() {
  const order = getOrder();
  for (const x of titled) {
    let s = t(x.key) + (x.cap ? `  (${x.cap})` : "");
    if (x.tool) { const n = order.indexOf(x.tool) + 1; if (n >= 1 && n <= 9) s += `  ·  ${n}`; }
    if (x.tip) s += `\n⚠ ${t(x.tip)}`;
    x.el.title = s;
    if (x.label) x.el.querySelector(".lbl")!.textContent = t(x.key);
  }
  const h = statusSize?.parentElement?.querySelector<HTMLElement>(".s-hint");
  if (h) h.textContent = t("editor.hint");
  const dh = document.querySelector<HTMLElement>(".drop-hint");
  if (dh) dh.textContent = t("editor.insert.dropHint");
  if (propsLeft) { rebuildProps(); updateStatus(); }
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
  const bits: string[] = [];
  if (exportPrefs.scale !== 1) bits.push(`${t("editor.exp.scale")} ${exportPrefs.scale * 100}%`);
  if (activeWm()) bits.push(t("editor.wm.badge"));
  statusExp.textContent = bits.join(" · ");
  statusExp.style.display = bits.length ? "" : "none";
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
    const order: PropKey[] = ["color", "emoji", "markStyle", "measureStyle", "spotMode", "arrowStyle", "stepStyle", "fill", "width", "fontSize", "bold", "textBg", "radius", "strength", "zoom", "leader", "dim", "opacity", "shadow"];
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
      case "markStyle":
        propsLeft.appendChild(group("editor.prop.style", seg("markStyle", [
          ["underline", t("editor.mark.underline")], ["strike", t("editor.mark.strike")], ["squiggle", t("editor.mark.squiggle")]], g("markStyle")))); break;
      case "measureStyle":
        propsLeft.appendChild(group("editor.prop.style", seg("measureStyle", [
          ["ruler", t("editor.measure.ruler")], ["dimension", t("editor.measure.dimension")]], g("measureStyle")))); break;
      case "spotMode":
        propsLeft.appendChild(group("editor.prop.style", seg("spotMode", [["dim", t("editor.spot.dim")], ["blur", t("editor.spot.blur")]], g("spotMode")))); break;
      case "fill":
        propsLeft.appendChild(group(null, seg("fill", [["none", t("editor.prop.outline")], ["solid", t("editor.prop.filled")]], g("fill")))); break;
      case "width": propsLeft.appendChild(group("editor.prop.width", range("width", 1, src.type === "highlighter" ? 80 : 40, 1, g("width") ?? 6, (v) => `${v}`))); break;
      case "fontSize": propsLeft.appendChild(group("editor.prop.size", range("fontSize", 10, 200, 1, g("fontSize") ?? 36))); break;
      case "bold": propsLeft.appendChild(group(null, toggle("bold", "B", g("bold"), "bold"))); break;
      case "textBg": propsLeft.appendChild(group(null, toggle("textBg", t("editor.prop.textBg"), g("textBg")))); break;
      case "radius": propsLeft.appendChild(group("editor.prop.radius", range("radius", 0, 80, 1, g("radius") ?? 0))); break;
      case "strength":
        if (src.type === "spotlight" && g("spotMode") !== "blur") break; // only used by the blur variant
        propsLeft.appendChild(group(strengthLabel, range("strength", 2, 60, 1, g("strength") ?? 12))); break;
      case "zoom": propsLeft.appendChild(group("editor.prop.magnify", range("zoom", 1.5, 6, 0.5, g("zoom") ?? 2, (v) => `${v}×`))); break;
      case "leader": propsLeft.appendChild(group(null, toggle("leader", t("editor.prop.leader"), g("leader")))); break;
      case "dim": propsLeft.appendChild(group("editor.prop.dim", range("dim", src.type === "spotlight" ? 0 : 0.1, 0.95, 0.05, g("dim") ?? 0.6, (v) => `${Math.round(v * 100)}%`))); break;
      case "opacity": propsLeft.appendChild(group("editor.prop.opacity", range("opacity", 0.1, 1, 0.05, g("opacity") ?? 1, (v) => `${Math.round(v * 100)}%`))); break;
      case "shadow": propsLeft.appendChild(group(null, toggle("shadow", t("editor.prop.shadow"), g("shadow")))); break;
    }
  }
  privacyHint(src.type);
  if (st.selection.length) {
    const sel = selected();
    const lockedAll = sel.every((o) => o.locked);
    propsRight.append(
      btn("dup", "editor.dup", "⌘D", () => duplicateSelected(), "mini", false),
      btn("front", "editor.front", "⌘]", () => bringToFront(), "mini", false),
      btn("back", "editor.back", "⌘[", () => sendToBack(), "mini", false),
      hasGroup()
        ? btn("ungroup", "editor.ungroup", "⇧⌘G", () => ungroupSelected(), "mini", false)
        : btn("group", "editor.group", "⌘G", () => groupSelected(), "mini" + (sel.length < 2 ? " off" : ""), false),
      btn(lockedAll ? "unlock" : "lock", lockedAll ? "editor.unlock" : "editor.lock", "⇧⌘L", () => toggleLock(), "mini" + (lockedAll ? " on" : ""), false),
      btn("arrange", "editor.align.title", undefined, (b) => toggleArrangePanel(b), "mini", false),
      btn("trash", "editor.delete", "⌫", () => deleteSelected(), "mini danger", false),
    );
  }
}

/** Blur / pixelate of small text can sometimes be reversed: steer people towards solid redaction. */
function privacyHint(type: ObjType | null) {
  const fx = (o: { type: string }) => o.type === "blur" || o.type === "pixelate";
  const toolMode = st.tool === "blur" || st.tool === "pixelate";
  const selMode = st.tool === "select" && selected().some(fx);
  if (st.tool === "redact" || (st.tool === "select" && type === "redact")) {
    propsLeft.appendChild(group(null, noteEl("editor.tip.redact", "ok")));
    return;
  }
  if (!toolMode && !selMode) return;
  const w = document.createElement("div"); w.className = "pg warn";
  const ic = document.createElement("span"); ic.className = "warn-ic"; ic.innerHTML = icon("warn", 15);
  const tx = document.createElement("span"); tx.className = "pl"; tx.textContent = t("editor.warn.reversible");
  const b = document.createElement("button"); b.className = "btn warnbtn";
  if (toolMode) { b.textContent = t("editor.warn.useRedact"); b.onclick = () => setTool("redact"); }
  else { b.textContent = t("editor.warn.convert"); b.onclick = () => convertToRedact(); }
  w.append(ic, tx, b);
  propsLeft.appendChild(w);
}
function noteEl(key: string, cls = ""): HTMLElement {
  const s = document.createElement("span"); s.className = "phint " + cls; s.textContent = t(key); return s;
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
