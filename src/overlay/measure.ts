// Pixel ruler: auto edge detection (Rust scans the frozen screenshot in 4 directions) + free drag measuring.
import { invoke } from "@tauri-apps/api/core";
import { t } from "../shared/i18n";
import type { ToolCtx } from "./color";

interface Edges { left: number; top: number; right: number; bottom: number; w_px: number; h_px: number }
interface Box { x: number; y: number; w: number; h: number; wpx: number; hpx: number; extra?: string }

const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

export async function runMeasure(c: ToolCtx) {
  const { app, img, info } = c;
  const W = info.width, H = info.height;
  document.body.classList.add("tool-measure");
  img.id = "shot";
  app.innerHTML = `
    <div id="mdim"></div>
    <div id="vline" class="cross"></div><div id="hline" class="cross"></div>
    <div id="mbox" class="mbox"></div><div id="pinned" class="mbox pinned"></div>
    <div id="mlabel" class="chip"></div><div id="plabel" class="chip"></div>
    <div id="hint"></div><div id="flash" role="status" aria-live="polite"></div>`;
  app.prepend(img);
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const box = $("mbox"), pinned = $("pinned"), label = $("mlabel"), plabel = $("plabel"), hint = $("hint"), flash = $("flash");
  const vline = $("vline"), hline = $("hline");

  let tol = 12, mx = -1, my = -1, done = false, busy = false, queued = false;
  let drag: { sx: number; sy: number; moved: boolean } | null = null;
  let auto: Box | null = null;
  let pinBox: Box | null = null;

  const setHint = () => {
    hint.innerHTML = `${t("more.measure.hint")}<small>${t("more.measure.keys")} · ${t("more.measure.tol")} <b>${tol}</b></small>`;
  };
  setHint();

  const place = (el: HTMLElement, b: { x: number; y: number; w: number; h: number } | null) => {
    if (!b) { el.style.display = "none"; return; }
    el.style.display = "block";
    el.style.left = b.x + "px"; el.style.top = b.y + "px"; el.style.width = b.w + "px"; el.style.height = b.h + "px";
  };
  const text = (b: Box) => `${fmt(b.w)} × ${fmt(b.h)} pt  ·  ${b.wpx} × ${b.hpx} px${b.extra ?? ""}`;
  const putLabel = (el: HTMLElement, b: Box, below = false) => {
    el.textContent = text(b);
    el.style.display = "block";
    const lw = el.offsetWidth || 220;
    el.style.left = Math.min(Math.max(4, b.x + b.w / 2 - lw / 2), W - lw - 4) + "px";
    const top = below ? b.y + b.h + 8 : b.y - 30;
    el.style.top = (top < 4 || top > H - 30 ? Math.min(H - 30, Math.max(4, below ? b.y - 30 : b.y + b.h + 8)) : top) + "px";
  };

  const render = () => {
    vline.style.display = hline.style.display = mx >= 0 && !drag ? "block" : "none";
    if (mx >= 0) { vline.style.left = mx + "px"; hline.style.top = my + "px"; }
    if (drag?.moved) {
      const b = freeBox(drag.sx, drag.sy, mx, my);
      place(box, b); putLabel(label, b, true);
    } else if (auto && !drag) {
      place(box, auto); putLabel(label, auto, true);
    } else { place(box, null); label.style.display = "none"; }
    place(pinned, pinBox);
    if (pinBox) putLabel(plabel, pinBox); else plabel.style.display = "none";
  };

  const freeBox = (x0: number, y0: number, x1: number, y1: number): Box => {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
    return {
      x: Math.min(x0, x1), y: Math.min(y0, y1), w, h, wpx: Math.round(w * info.scale), hpx: Math.round(h * info.scale),
      extra: `  ·  ${t("more.measure.dist")} ${fmt(Math.hypot(w, h))} pt`,
    };
  };

  async function detect() {
    if (busy) { queued = true; return; }
    busy = true;
    try {
      do {
        queued = false;
        const x = mx, y = my;
        if (x < 0 || done) break;
        const e = await invoke<Edges>("overlay_measure", { monitor: c.monitor, x, y, tol });
        auto = { x: e.left, y: e.top, w: e.right - e.left, h: e.bottom - e.top, wpx: e.w_px, hpx: e.h_px };
        render();
      } while (queued);
    } catch (e) { console.error(e); }
    busy = false;
  }

  let flashTimer: number | undefined;
  const say = (msg: string) => {
    flash.textContent = msg;
    flash.classList.add("show");
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => flash.classList.remove("show"), 1400);
  };

  const cancel = () => {
    if (done) return;
    done = true;
    invoke("overlay_cancel").catch(() => {});
  };

  const pin = (b: Box) => {
    pinBox = b;
    const s = `${fmt(b.w)} × ${fmt(b.h)}`;
    invoke("copy_text", { text: s }).then(() => say(`${t("more.measure.copied")} ${s}`)).catch(() => {});
    render();
  };

  window.addEventListener("mousemove", (e) => {
    if (done) return;
    if (!document.hasFocus()) c.win.setFocus().catch(() => {});
    mx = Math.min(W - 1, Math.max(0, e.clientX)); my = Math.min(H - 1, Math.max(0, e.clientY));
    if (drag && Math.hypot(mx - drag.sx, my - drag.sy) > 3) drag.moved = true;
    if (!drag) void detect();
    render();
  });
  window.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { sx: e.clientX, sy: e.clientY, moved: false };
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button !== 0 || !drag) return;
    const d = drag;
    drag = null;
    if (d.moved) pin(freeBox(d.sx, d.sy, mx, my));
    else if (auto) pin(auto);
    render();
  });
  window.addEventListener("contextmenu", (e) => { e.preventDefault(); if (pinBox) { pinBox = null; render(); } else cancel(); });
  window.addEventListener("keydown", (e) => {
    if (done) return;
    if (e.key === "Escape") { e.preventDefault(); cancel(); return; }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      tol = Math.min(120, Math.max(0, tol + (e.key === "ArrowUp" ? 4 : -4)));
      setHint();
      void detect();
    }
  });
  document.body.tabIndex = -1;
  document.body.focus();
  await invoke("overlay_ready").catch((e) => console.error(e));
  c.win.setFocus().catch(() => {});
}
