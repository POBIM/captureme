// Screen colour picker overlay: loupe, click copies the colour (HEX / RGB / HSL), Shift+click keeps picking.
import { invoke } from "@tauri-apps/api/core";
import type { Window } from "@tauri-apps/api/window";
import { t } from "../shared/i18n";
import { FORMATS, formatColor, type ColorFormat } from "../shared/color";

export interface ToolCtx {
  app: HTMLElement;
  img: HTMLImageElement;
  info: { width: number; height: number; scale: number; monitor_id: number };
  readable: boolean;
  natScaleX: number;
  natScaleY: number;
  win: Window;
  monitor: number;
  format: string;
}

const N = 15; // source pixels across the loupe
const CELL = 11; // screen px per source pixel

export async function runColor(c: ToolCtx) {
  const { app, img, info } = c;
  const W = info.width, H = info.height;
  document.body.classList.add("tool-color");
  img.id = "shot";
  app.innerHTML = `
    <div id="vline" class="cross"></div><div id="hline" class="cross"></div>
    <div id="cloupe"><canvas width="${N * CELL}" height="${N * CELL}"></canvas>
      <div class="meta"><div class="hex"><span class="sw"></span><span class="txt"></span></div><div class="xy"></div></div></div>
    <div id="hint"></div><div id="flash" role="status" aria-live="polite"></div>`;
  app.prepend(img);
  const $ = <T extends HTMLElement>(sel: string) => app.querySelector(sel) as T;
  const loupe = $("#cloupe"), canvas = $("#cloupe canvas") as HTMLCanvasElement, ctx = canvas.getContext("2d")!;
  const sw = $(".sw"), txt = $(".txt"), xy = $(".xy"), hint = $("#hint"), flash = $("#flash");
  const vline = $("#vline"), hline = $("#hline");
  const px = document.createElement("canvas"); px.width = px.height = 1;
  const pctx = px.getContext("2d", { willReadFrequently: true })!;

  let fmt: ColorFormat = (FORMATS as string[]).includes(c.format) ? (c.format as ColorFormat) : "hex";
  let mx = -1, my = -1, picks = 0, done = false, seq = 0;
  let rgb: [number, number, number] | null = null;

  const setHint = () => {
    hint.innerHTML = `${t("more.color.hint")}<small>${t("more.color.keys")} · <b>${fmt.toUpperCase()}</b></small>`;
  };
  setHint();

  async function sample(x: number, y: number): Promise<[number, number, number] | null> {
    const sx = Math.floor(x * c.natScaleX), sy = Math.floor(y * c.natScaleY);
    if (c.readable) {
      try {
        pctx.clearRect(0, 0, 1, 1);
        pctx.drawImage(img, sx, sy, 1, 1, 0, 0, 1, 1);
        const d = pctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
      } catch { /* tainted → ask Rust */ }
    }
    try { return await invoke<[number, number, number]>("overlay_pixel", { monitor: c.monitor, x, y }); } catch { return null; }
  }

  async function draw() {
    if (mx < 0 || done) return;
    const my0 = seq = seq + 1;
    const sx = Math.floor(mx * c.natScaleX), sy = Math.floor(my * c.natScaleY);
    const half = (N - 1) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, N * CELL, N * CELL);
    ctx.drawImage(img, sx - half, sy - half, N, N, 0, 0, N * CELL, N * CELL);
    ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 2; ctx.strokeRect(half * CELL, half * CELL, CELL, CELL);
    ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.lineWidth = 1; ctx.strokeRect(half * CELL - 1.5, half * CELL - 1.5, CELL + 3, CELL + 3);
    const lw = N * CELL, lh = N * CELL + 46;
    let lx = mx + 24, ly = my + 24;
    if (lx + lw > W - 6) lx = mx - 24 - lw;
    if (ly + lh > H - 6) ly = my - 24 - lh;
    loupe.style.display = "block";
    loupe.style.left = Math.max(4, lx) + "px"; loupe.style.top = Math.max(4, ly) + "px";
    vline.style.left = mx + "px"; hline.style.top = my + "px";
    xy.textContent = `${Math.round(mx)}, ${Math.round(my)}`;
    const v = await sample(mx, my);
    if (my0 !== seq) return; // a newer move superseded this one
    rgb = v;
    if (v) {
      sw.style.background = `rgb(${v[0]},${v[1]},${v[2]})`;
      txt.textContent = formatColor(v[0], v[1], v[2], fmt);
    }
  }

  const cancel = () => {
    if (done) return;
    done = true;
    invoke("overlay_cancel").catch(() => {});
    if (picks > 0) invoke("colors_show").catch(() => {});
  };

  let flashTimer: number | undefined;
  const say = (msg: string) => {
    flash.textContent = msg;
    flash.classList.add("show");
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => flash.classList.remove("show"), 1400);
  };

  async function pick(keep: boolean) {
    if (done || mx < 0) return;
    if (!keep) done = true;
    try {
      const r = await invoke<{ text: string }>("overlay_color_pick", { monitor: c.monitor, x: mx, y: my, keep });
      picks++;
      if (keep) say(`${t("more.color.copied")} ${r.text}`);
    } catch (e) {
      done = false;
      say(String(e));
    }
  }

  window.addEventListener("mousemove", (e) => {
    if (done) return;
    if (!document.hasFocus()) c.win.setFocus().catch(() => {});
    mx = Math.min(W - 1, Math.max(0, e.clientX)); my = Math.min(H - 1, Math.max(0, e.clientY));
    void draw();
  });
  window.addEventListener("mousedown", (e) => { if (e.button === 0) { e.preventDefault(); void pick(e.shiftKey); } });
  window.addEventListener("contextmenu", (e) => { e.preventDefault(); cancel(); });
  window.addEventListener("keydown", (e) => {
    if (done) return;
    if (e.key === "Escape") { e.preventDefault(); cancel(); return; }
    if (e.key === "Enter") { e.preventDefault(); void pick(e.shiftKey); return; }
    if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      fmt = FORMATS[(FORMATS.indexOf(fmt) + 1) % FORMATS.length];
      invoke("color_set_format", { format: fmt }).catch(() => {});
      setHint();
      if (rgb) txt.textContent = formatColor(rgb[0], rgb[1], rgb[2], fmt);
      return;
    }
    const dir = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
    if (dir) {
      e.preventDefault();
      if (mx < 0) { mx = W / 2; my = H / 2; }
      const step = (e.shiftKey ? 10 : 1) / c.info.scale;
      mx = Math.min(W - 1, Math.max(0, mx + dir[0] * step)); my = Math.min(H - 1, Math.max(0, my + dir[1] * step));
      void draw();
    }
  });
  document.body.tabIndex = -1;
  document.body.focus();
  await invoke("overlay_ready").catch((e) => console.error(e));
  c.win.setFocus().catch(() => {});
}
