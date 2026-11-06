// Floating panels: image transform, arrange (align / distribute), export & watermark settings, shortcut cheat-sheet.
import { st, selected } from "./state";
import { t } from "../shared/i18n";
import { icon } from "./icons";
import { openPopover, closePopover, modal, row } from "./dialogs";
import { transformImage, type TransformKind } from "./transform";
import { alignSelected, distributeSelected, type AlignKind } from "./ops";
import { exportPrefs, setExportScale, doCopy, doSave, doSaveAs, doCopyPath, doReveal } from "./export";
import { getWm, setWm, getPresets, savePreset, deletePreset, applyPreset } from "./watermark";
import { TOOL_DEFS, getOrder, resetOrder } from "./toolorder";
import { cancelCrop } from "./tools";

function iconBtn(name: string, titleKey: string, cap: string | undefined, fn: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "ib"; b.innerHTML = icon(name);
  b.title = t(titleKey) + (cap ? `  (${cap})` : "");
  b.addEventListener("mousedown", (e) => e.preventDefault());
  b.onclick = fn;
  return b;
}
function labelBtn(text: string, cap: string | undefined, fn: () => void, cls = ""): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "btn wide " + cls; b.textContent = text + (cap ? `  ${cap}` : "");
  b.onclick = fn;
  return b;
}
function seg<T extends string | number>(opts: [T, string][], cur: T, on: (v: T) => void): HTMLElement {
  const d = document.createElement("div"); d.className = "seg";
  const bs = opts.map(([v, label]) => {
    const b = document.createElement("button"); b.textContent = label; b.classList.toggle("on", v === cur);
    b.onclick = () => { cur = v; bs.forEach((x, i) => x.classList.toggle("on", opts[i][0] === v)); on(v); };
    d.appendChild(b); return b;
  });
  return d;
}
function range(min: number, max: number, step: number, val: number, fmt: (v: number) => string, on: (v: number) => void): HTMLElement {
  const r = document.createElement("input"); r.type = "range"; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(val);
  const out = document.createElement("span"); out.className = "val"; out.textContent = fmt(val);
  r.oninput = () => { out.textContent = fmt(+r.value); on(+r.value); };
  r.onchange = () => r.blur();
  const w = document.createElement("div"); w.className = "rng"; w.append(r, out);
  return w;
}

/* ---------- transform ---------- */
export function doTransform(kind: TransformKind) {
  if (st.tool === "crop") cancelCrop();
  transformImage(kind);
}
export function toggleTransformPanel(anchor: HTMLElement) {
  openPopover(anchor, "tf-panel", (pop, close) => {
    const g = document.createElement("div"); g.className = "pgrid";
    const mk = (name: string, key: string, cap: string, k: TransformKind) => {
      const b = labelBtn(t(key), cap, () => { doTransform(k); close(); });
      b.insertAdjacentHTML("afterbegin", icon(name, 16));
      return b;
    };
    g.append(
      mk("rotl", "editor.tf.rotl", "⌘L", "ccw"), mk("rotr", "editor.tf.rotr", "⌘R", "cw"),
      mk("fliph", "editor.tf.fliph", "⇧⌘H", "flipH"), mk("flipv", "editor.tf.flipv", "⇧⌘V", "flipV"),
    );
    const n = document.createElement("div"); n.className = "phint"; n.textContent = t("editor.tf.note");
    pop.append(g, n);
  });
}

/* ---------- arrange ---------- */
export function toggleArrangePanel(anchor: HTMLElement) {
  openPopover(anchor, "arr-panel", (pop) => {
    const n = selected().length;
    const mkA = (name: string, key: string, k: AlignKind) => iconBtn(name, key, undefined, () => alignSelected(k));
    const a = document.createElement("div"); a.className = "pgrid six";
    a.append(
      mkA("al-left", "editor.align.left", "left"), mkA("al-hc", "editor.align.hcenter", "hcenter"), mkA("al-right", "editor.align.right", "right"),
      mkA("al-top", "editor.align.top", "top"), mkA("al-vc", "editor.align.vcenter", "vcenter"), mkA("al-bottom", "editor.align.bottom", "bottom"),
    );
    const d = document.createElement("div"); d.className = "pgrid six";
    const dh = iconBtn("dist-h", "editor.dist.h", undefined, () => distributeSelected("h"));
    const dv = iconBtn("dist-v", "editor.dist.v", undefined, () => distributeSelected("v"));
    dh.disabled = dv.disabled = n < 3;
    d.append(dh, dv);
    const h = document.createElement("div"); h.className = "phint";
    h.textContent = n < 2 ? t("editor.align.docNote") : t("editor.align.note");
    pop.append(row(t("editor.align.title"), a), row(t("editor.dist.title"), d), h);
  });
}

/* ---------- export ---------- */
export function toggleExportPanel(anchor: HTMLElement, onChange: () => void) {
  openPopover(anchor, "exp-panel", (pop, close) => {
    const sc = seg<number>([[0.5, "50%"], [1, "100%"], [2, "200%"]], exportPrefs.scale, (v) => { setExportScale(v as 0.5 | 1 | 2); onChange(); });
    const act = (fn: () => unknown) => () => { close(); fn(); };
    const grid = document.createElement("div"); grid.className = "pgrid col";
    grid.append(
      labelBtn(t("editor.copy"), "⌘C", act(doCopy)),
      labelBtn(t("editor.save"), "⌘S", act(doSave)),
      labelBtn(t("editor.saveAs"), "⇧⌘S", act(() => doSaveAs("png"))),
      labelBtn(t("editor.exp.jpeg"), undefined, act(() => doSaveAs("jpg"))),
      labelBtn(t("editor.exp.copyPath"), undefined, act(doCopyPath)),
      labelBtn(t("editor.exp.reveal"), undefined, act(doReveal)),
    );
    const n = document.createElement("div"); n.className = "phint"; n.textContent = t("editor.exp.note");
    pop.append(row(t("editor.exp.scale"), sc), grid, n);
  });
}

/* ---------- watermark ---------- */
export function toggleWatermarkPanel(anchor: HTMLElement, onChange: () => void) {
  openPopover(anchor, "wm-panel", (pop) => {
    const wm = getWm();
    const upd = (p: Partial<typeof wm>) => { setWm(p); onChange(); };
    const en = document.createElement("input"); en.type = "checkbox"; en.checked = wm.enabled;
    const enL = document.createElement("label"); enL.className = "chk"; enL.append(en, document.createTextNode(" " + t("editor.wm.enable")));
    en.onchange = () => upd({ enabled: en.checked });
    const txt = document.createElement("input"); txt.type = "text"; txt.className = "txt"; txt.value = wm.text; txt.placeholder = "© CaptureME";
    txt.oninput = () => upd({ text: txt.value });
    const mode = seg<"corner" | "tiled">([["corner", t("editor.wm.corner")], ["tiled", t("editor.wm.tiled")]], wm.mode, (v) => { upd({ mode: v }); syncMode(); });
    const corner = seg<string>([["tl", "↖"], ["tr", "↗"], ["c", "•"], ["bl", "↙"], ["br", "↘"]], wm.corner, (v) => upd({ corner: v as typeof wm.corner }));
    const op = range(5, 100, 5, Math.round(wm.opacity * 100), (v) => `${v}%`, (v) => upd({ opacity: v / 100 }));
    const sz = range(1, 20, 0.5, wm.size, (v) => `${v}%`, (v) => upd({ size: v }));
    const col = document.createElement("input"); col.type = "color"; col.value = wm.color; col.oninput = () => upd({ color: col.value });
    const ang = range(-90, 90, 5, wm.angle, (v) => `${v}°`, (v) => upd({ angle: v }));
    const rCorner = row(t("editor.wm.position"), corner), rAngle = row(t("editor.wm.angle"), ang);
    const syncMode = () => { const tiled = getWm().mode === "tiled"; rCorner.style.display = tiled ? "none" : ""; rAngle.style.display = tiled ? "" : "none"; };
    syncMode();

    // presets
    const sel = document.createElement("select"); sel.className = "sel";
    const fill = () => {
      sel.innerHTML = "";
      const o0 = document.createElement("option"); o0.value = ""; o0.textContent = t("editor.wm.presets"); sel.appendChild(o0);
      for (const p of getPresets()) { const o = document.createElement("option"); o.value = p.name; o.textContent = p.name; sel.appendChild(o); }
    };
    fill();
    sel.onchange = () => {
      if (!sel.value) return;
      applyPreset(sel.value); onChange();
      closePopover(); setTimeout(() => anchor.click(), 0); // reopen with the preset's values

    };
    const saveB = labelBtn(t("editor.wm.savePreset"), undefined, () => {
      const name = (txt.value.trim() || "Watermark").slice(0, 24);
      savePreset(name); fill(); sel.value = name;
    });
    const delB = labelBtn(t("editor.delete"), undefined, () => { if (sel.value) { deletePreset(sel.value); fill(); } });
    const pr = document.createElement("div"); pr.className = "prow"; pr.append(sel, saveB, delB);
    pop.append(row("", enL), row(t("editor.wm.text"), txt), row(t("editor.wm.mode"), mode), rCorner, rAngle,
      row(t("editor.prop.opacity"), op), row(t("editor.prop.size"), sz), row(t("editor.wm.color"), col), pr);
    const n = document.createElement("div"); n.className = "phint"; n.textContent = t("editor.wm.note"); pop.appendChild(n);
  });
}

/* ---------- keyboard cheat-sheet ---------- */
export function showHelp() {
  const body = document.createElement("div"); body.className = "help";
  const sec = (titleKey: string, items: [string, string][]) => {
    const s = document.createElement("section");
    const h = document.createElement("h4"); h.textContent = t(titleKey); s.appendChild(h);
    for (const [k, label] of items) {
      const r = document.createElement("div"); r.className = "hrow";
      const kb = document.createElement("kbd"); kb.textContent = k;
      const l = document.createElement("span"); l.textContent = label;
      r.append(kb, l); s.appendChild(r);
    }
    return s;
  };
  const order = getOrder();
  const tools = TOOL_DEFS.map((d) => [d.cap, t(`editor.tool.${d.id}`)] as [string, string]);
  const fav = order.slice(0, 9).map((id, i) => [String(i + 1), t(`editor.tool.${id}`)] as [string, string]);
  const cols = document.createElement("div"); cols.className = "hcols";
  const c1 = document.createElement("div"), c2 = document.createElement("div"), c3 = document.createElement("div");
  c1.append(sec("editor.help.tools", tools));
  c2.append(
    sec("editor.help.favs", fav),
    sec("editor.help.canvas", [
      ["Space", t("editor.help.pan")], ["⌘ + / − / 0 / 1", t("editor.help.zoom")], ["⇧", t("editor.help.shift")],
      ["⌥ drag", t("editor.help.altDrag")], ["Esc", t("editor.help.esc")], ["?", t("editor.help.toggle")],
    ]),
  );
  c3.append(
    sec("editor.help.edit", [
      ["⌘Z / ⇧⌘Z", `${t("editor.undo")} / ${t("editor.redo")}`], ["⌘D", t("editor.dup")], ["⌘A", t("editor.help.selectAll")],
      ["⌫", t("editor.delete")], ["← ↑ ↓ →", t("editor.help.nudge")], ["⌘]  /  ⌘[", `${t("editor.front")} / ${t("editor.back")}`],
      ["⌘G / ⇧⌘G", `${t("editor.group")} / ${t("editor.ungroup")}`], ["⇧⌘L", t("editor.lock")], ["⌘V", t("editor.help.paste")],
    ]),
    sec("editor.help.image", [
      ["⌘L / ⌘R", t("editor.help.rotate")], ["⇧⌘H / ⇧⌘V", t("editor.help.flip")], ["⌘C", t("editor.copy")],
      ["⌘S / ⇧⌘S", `${t("editor.save")} / ${t("editor.saveAs")}`], ["⌘↩", t("editor.copyClose")], ["⌘W", t("editor.close")],
    ]),
  );
  cols.append(c1, c2, c3);
  body.appendChild(cols);
  const tip = document.createElement("div"); tip.className = "phint"; tip.textContent = t("editor.help.dragTip");
  body.appendChild(tip);
  closePopover();
  modal(t("editor.help.title"), body, [
    { label: t("editor.help.resetToolbar"), onClick: () => { resetOrder(); } },
    { label: t("editor.close"), primary: true },
  ]);
}
