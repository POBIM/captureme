import { st, touch, emit } from "./state";
import { commit } from "./history";
import { t } from "../shared/i18n";
import { toast } from "./toast";
import { resizeImage, resizeCanvas } from "./resize";
import { saveBg } from "./state";
import { GRADIENTS } from "./render";
import { fit } from "./viewport";
import { invoke } from "@tauri-apps/api/core";

let openCount = 0;
export const isModalOpen = () => openCount > 0 || !!document.querySelector(".popover");

interface Btn { label: string; primary?: boolean; onClick?: () => boolean | void }

export function modal(title: string, body: HTMLElement, buttons: Btn[]): { close: () => void } {
  const back = document.createElement("div");
  back.className = "modal-back";
  const box = document.createElement("div");
  box.className = "modal";
  const h = document.createElement("h3"); h.textContent = title;
  const foot = document.createElement("div"); foot.className = "modal-foot";
  box.append(h, body, foot);
  back.appendChild(box);
  document.body.appendChild(back);
  openCount++;
  const close = () => {
    if (!back.isConnected) return;
    back.remove(); openCount--;
    window.removeEventListener("keydown", onKey, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      const primary = buttons.find((b) => b.primary);
      if (primary) { e.preventDefault(); e.stopPropagation(); if (primary.onClick?.() !== false) close(); }
    }
  };
  window.addEventListener("keydown", onKey, true);
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  for (const b of buttons) {
    const el = document.createElement("button");
    el.className = "btn" + (b.primary ? " primary" : "");
    el.textContent = b.label;
    el.onclick = () => { if (b.onClick?.() !== false) close(); };
    foot.appendChild(el);
  }
  return { close };
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return; } catch { /* fall through */ }
  try { await invoke("copy_text", { text }); } catch {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
}

export function showOcr(text: string) {
  const ta = document.createElement("textarea");
  ta.className = "ocr-text"; ta.value = text || ""; ta.readOnly = true;
  ta.placeholder = t("editor.ocr.empty");
  const m = modal(t("editor.ocr.title"), ta, [
    { label: t("editor.ocr.copy"), primary: true, onClick: () => { copyText(ta.value).then(() => toast(t("editor.toast.copiedText"), "ok")); return false; } },
    { label: t("editor.close"), onClick: () => {} },
  ]);
  void m;
  ta.focus(); ta.select();
}

function numInput(v: number, min = 1, max = 30000): HTMLInputElement {
  const i = document.createElement("input");
  i.type = "number"; i.min = String(min); i.max = String(max); i.value = String(Math.round(v)); i.className = "num";
  return i;
}
function row(label: string, ...els: Node[]): HTMLElement {
  const r = document.createElement("div"); r.className = "row";
  const l = document.createElement("label"); l.textContent = label;
  r.append(l, ...els);
  return r;
}

export function showResizeDialog() {
  const body = document.createElement("div");
  body.className = "resize-dlg";
  const W = st.base.width, H = st.base.height;
  let mode: "image" | "canvas" = "image";

  const tabs = document.createElement("div"); tabs.className = "seg";
  const tImg = document.createElement("button"); tImg.textContent = t("editor.resize.image");
  const tCan = document.createElement("button"); tCan.textContent = t("editor.resize.canvas");
  tabs.append(tImg, tCan);

  const wI = numInput(W), hI = numInput(H);
  const pct = numInput(100, 1, 1000);
  const lock = document.createElement("input"); lock.type = "checkbox"; lock.checked = true;
  const lockL = document.createElement("label"); lockL.className = "chk"; lockL.append(lock, document.createTextNode(" " + t("editor.resize.lock")));
  const ratio = W / H;
  wI.oninput = () => { if (lock.checked) hI.value = String(Math.max(1, Math.round(+wI.value / ratio))); if (mode === "image") pct.value = String(Math.round(+wI.value / W * 100)); };
  hI.oninput = () => { if (lock.checked) wI.value = String(Math.max(1, Math.round(+hI.value * ratio))); if (mode === "image") pct.value = String(Math.round(+hI.value / H * 100)); };
  pct.oninput = () => { wI.value = String(Math.max(1, Math.round(W * +pct.value / 100))); hI.value = String(Math.max(1, Math.round(H * +pct.value / 100))); };

  // canvas-only options
  let ax = 0.5, ay = 0.5;
  const grid = document.createElement("div"); grid.className = "anchor";
  const cells: HTMLButtonElement[] = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const c = document.createElement("button");
    c.onclick = () => { ax = i / 2; ay = j / 2; cells.forEach((x, n) => x.classList.toggle("on", n === j * 3 + i)); };
    if (i === 1 && j === 1) c.classList.add("on");
    cells.push(c); grid.appendChild(c);
  }
  const fillC = document.createElement("input"); fillC.type = "color"; fillC.value = "#ffffff";
  const transp = document.createElement("input"); transp.type = "checkbox";
  const transL = document.createElement("label"); transL.className = "chk"; transL.append(transp, document.createTextNode(" " + t("editor.resize.transparent")));

  const imgRows = [row(t("editor.resize.percent"), pct)];
  const canRows = [row(t("editor.resize.anchor"), grid), row(t("editor.resize.fill"), fillC, transL)];
  const common = [row(t("editor.resize.width"), wI, document.createTextNode("px")), row(t("editor.resize.height"), hI, document.createTextNode("px")), row("", lockL)];
  body.append(tabs, ...common, ...imgRows, ...canRows);

  const setMode = (m: "image" | "canvas") => {
    mode = m;
    tImg.classList.toggle("on", m === "image"); tCan.classList.toggle("on", m === "canvas");
    imgRows.forEach((r) => (r.style.display = m === "image" ? "" : "none"));
    canRows.forEach((r) => (r.style.display = m === "canvas" ? "" : "none"));
  };
  tImg.onclick = () => setMode("image"); tCan.onclick = () => setMode("canvas");
  setMode("image");

  modal(t("editor.resize.title"), body, [
    { label: t("editor.cancel") },
    {
      label: t("editor.apply"), primary: true,
      onClick: () => {
        const w = +wI.value, h = +hI.value;
        if (!(w >= 1 && h >= 1 && w <= 16000 && h <= 16000)) { toast(t("editor.resize.invalid"), "error"); return false; }
        if (mode === "image") resizeImage(w, h); else resizeCanvas(w, h, ax, ay, transp.checked ? null : fillC.value);
      },
    },
  ]);
}

/* ---------- background beautifier popover ---------- */
export function toggleBgPanel(anchor: HTMLElement) {
  const existing = document.querySelector(".popover.bg-panel");
  if (existing) { existing.remove(); return; }
  const pop = document.createElement("div");
  pop.className = "popover bg-panel";
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${r.bottom + 6}px`;
  pop.style.right = `${Math.max(8, window.innerWidth - r.right - 60)}px`;

  const apply = (final: boolean, refit = false) => {
    saveBg();
    touch();
    if (refit) fit();
    if (final) commit(); else emit("view");
  };

  const mkRange = (label: string, min: number, max: number, val: number, set: (v: number) => void, refit = false) => {
    const rg = document.createElement("input"); rg.type = "range"; rg.min = String(min); rg.max = String(max); rg.value = String(val);
    const out = document.createElement("span"); out.className = "val"; out.textContent = String(val);
    rg.oninput = () => { set(+rg.value); out.textContent = rg.value; apply(false, refit && false); };
    rg.onchange = () => { apply(true, refit); rg.blur(); };
    return row(label, rg, out);
  };
  const en = document.createElement("input"); en.type = "checkbox"; en.checked = st.bg.enabled;
  const enL = document.createElement("label"); enL.className = "chk"; enL.append(en, document.createTextNode(" " + t("editor.bg.enable")));
  en.onchange = () => { st.bg.enabled = en.checked; apply(true, true); };

  const grads = document.createElement("div"); grads.className = "grads";
  const sw: HTMLElement[] = [];
  GRADIENTS.forEach(([a, b], i) => {
    const g = document.createElement("button");
    g.style.background = `linear-gradient(135deg, ${a}, ${b})`;
    g.onclick = () => { st.bg.mode = "gradient"; st.bg.gradient = i; if (!st.bg.enabled) { st.bg.enabled = true; en.checked = true; } sync(); apply(true, true); };
    sw.push(g); grads.appendChild(g);
  });
  const solid = document.createElement("input"); solid.type = "color"; solid.value = st.bg.color;
  solid.oninput = () => { st.bg.mode = "solid"; st.bg.color = solid.value; if (!st.bg.enabled) { st.bg.enabled = true; en.checked = true; } sync(); apply(false); };
  solid.onchange = () => apply(true, true);
  grads.appendChild(solid);
  const sync = () => sw.forEach((g, i) => g.classList.toggle("on", st.bg.mode === "gradient" && st.bg.gradient === i));
  sync();

  const sh = document.createElement("input"); sh.type = "checkbox"; sh.checked = st.bg.shadow;
  const shL = document.createElement("label"); shL.className = "chk"; shL.append(sh, document.createTextNode(" " + t("editor.bg.shadow")));
  sh.onchange = () => { st.bg.shadow = sh.checked; apply(true); };

  pop.append(
    row("", enL),
    mkRange(t("editor.bg.padding"), 0, 240, st.bg.padding, (v) => (st.bg.padding = v), true),
    row(t("editor.bg.background"), grads),
    mkRange(t("editor.bg.radius"), 0, 80, st.bg.radius, (v) => (st.bg.radius = v)),
    row("", shL),
  );
  document.body.appendChild(pop);
  const close = (e: MouseEvent) => {
    if (!pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) { pop.remove(); window.removeEventListener("mousedown", close, true); }
  };
  setTimeout(() => window.addEventListener("mousedown", close, true), 0);
  const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { pop.remove(); window.removeEventListener("keydown", esc, true); } };
  window.addEventListener("keydown", esc, true);
}
