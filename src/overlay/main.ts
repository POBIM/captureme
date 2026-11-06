// Frozen-screen selection overlay. One instance per monitor; Rust (capture.rs) drives the session.
import "./overlay.css";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api, queryParam } from "../shared/api";
import { setLang, t } from "../shared/i18n";

interface OverlayWindow { id: number; app: string; title: string; x: number; y: number; width: number; height: number }
interface OverlayInfo {
  mode: string; monitor_id: number; monitor_x: number; monitor_y: number;
  width: number; height: number; scale: number; windows: OverlayWindow[];
}
interface Rect { x: number; y: number; w: number; h: number }
type Drag =
  | { kind: "new"; sx: number; sy: number; moved: boolean }
  | { kind: "move"; ox: number; oy: number; orig: Rect }
  | { kind: "resize"; handle: string; ox: number; oy: number; orig: Rect };

const params = { mode: queryParam("mode") ?? "capture" };
const app = document.getElementById("app")!;

if (params.mode === "countdown") {
  runCountdown();
} else {
  void runOverlay();
}

// ------------------------------------------------------------------------------------------
function runCountdown() {
  document.body.classList.add("countdown");
  let n = Math.max(1, parseInt(queryParam("secs") ?? "3", 10) || 3);
  app.innerHTML = `<div class="cd"><b></b><small></small></div>`;
  const num = app.querySelector("b")!;
  const small = app.querySelector("small")!;
  small.textContent = t("cap.countdown");
  api.getSettings().then((s) => { setLang(s.language); small.textContent = t("cap.countdown"); }).catch(() => {});
  num.textContent = String(n);
  const iv = setInterval(() => {
    n -= 1;
    if (n <= 0) clearInterval(iv);
    else num.textContent = String(n);
  }, 1000);
}

// ------------------------------------------------------------------------------------------
async function runOverlay() {
  const imgPath = queryParam("img") ?? "";
  const monitor = Number(queryParam("monitor") ?? 0);
  const win = getCurrentWindow();
  const windowMode = params.mode === "window";
  if (windowMode) document.body.classList.add("window-mode");

  // ---- load settings (language), session info and the frozen screenshot in parallel
  const loadImage = async () => {
    const load = (cors: boolean) =>
      new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image();
        if (cors) im.crossOrigin = "anonymous";
        im.onload = () => res(im);
        im.onerror = () => rej(new Error("image load failed"));
        im.src = api.fileSrc(imgPath);
      });
    try { return { im: await load(true), readable: true }; } catch { return { im: await load(false), readable: false }; }
  };
  const [settings, info, { im: img, readable }] = await Promise.all([
    api.getSettings().catch(() => null),
    invoke<OverlayInfo>("overlay_info", { monitor }),
    loadImage(),
  ]);
  if (settings) setLang(settings.language);
  try { await img.decode(); } catch { /* ignore */ }

  const W = info.width, H = info.height;
  const natScaleX = img.naturalWidth / W, natScaleY = img.naturalHeight / H;

  // ---- DOM
  img.id = "shot";
  app.innerHTML = `
    <div id="dim"></div>
    <div id="vline" class="cross"></div><div id="hline" class="cross"></div>
    <div id="hl"><div class="tag"></div></div>
    <div id="sel">${["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => `<i class="h" data-h="${h}"></i>`).join("")}</div>
    <div id="size" class="chip"></div>
    <div id="toolbar"></div>
    <div id="loupe"><canvas width="124" height="124"></canvas><div class="meta"><div class="hex"><span class="sw"></span><span class="hextxt"></span></div><div class="xy"></div></div></div>
    <div id="hint"></div>`;
  app.prepend(img);
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dim = $("dim"), vline = $("vline"), hline = $("hline"), hl = $("hl"), hlTag = hl.querySelector(".tag") as HTMLElement;
  const selEl = $("sel"), sizeEl = $("size"), toolbar = $("toolbar"), loupe = $("loupe"), hint = $("hint");
  const loupeCanvas = loupe.querySelector("canvas") as HTMLCanvasElement;
  const lctx = loupeCanvas.getContext("2d")!;
  const swEl = loupe.querySelector(".sw") as HTMLElement, hexEl = loupe.querySelector(".hextxt") as HTMLElement, xyEl = loupe.querySelector(".xy") as HTMLElement;
  const px = document.createElement("canvas"); px.width = px.height = 1;
  const pctx = px.getContext("2d", { willReadFrequently: true })!;

  // ---- hint pill + toolbar
  const m = params.mode;
  const hintKey = windowMode ? "cap.hint.window" : `cap.hint.${m}`;
  const badge = m === "scroll" || m === "record" ? `<span class="badge">${t(`cap.badge.${m}`)}</span>` : "";
  hint.innerHTML = `${badge}${t(hintKey)}${windowMode ? "" : `<small>${t("cap.hint.keys")}</small>`}`;

  const ico = {
    check: `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`,
    pin: `<svg viewBox="0 0 24 24"><path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z"/></svg>`,
    ocr: `<svg viewBox="0 0 24 24"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M9 9h6M12 9v7"/></svg>`,
    x: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  };
  const btn = (id: string, title: string, svg: string, cls = "") => `<button data-act="${id}" class="${cls}" title="${title}">${svg}</button>`;
  const rich = m === "capture" || m === "ocr" || m === "pin";
  if (rich) {
    toolbar.innerHTML =
      btn("confirm", t("cap.tb.confirm"), ico.check, "primary") + `<span class="sep"></span>` +
      btn("copy", t("cap.tb.copy"), ico.copy) + btn("pin", t("cap.tb.pin"), ico.pin) + btn("ocr", t("cap.tb.ocr"), ico.ocr) +
      `<span class="sep"></span>` + btn("cancel", t("cap.tb.cancel"), ico.x);
  } else {
    const label = t(m === "scroll" ? "cap.tb.start_scroll" : "cap.tb.start_record");
    toolbar.innerHTML =
      `<button data-act="confirm" class="primary wide" title="${t("cap.tb.confirm")}">${label}</button><span class="sep"></span>` +
      btn("cancel", t("cap.tb.cancel"), ico.x);
  }

  // ---- state
  let sel: Rect | null = null;
  let drag: Drag | null = null;
  let hover: OverlayWindow | null = null;
  let space = false;
  let done = false;
  let mx = -1, my = -1;
  let lastX = 0, lastY = 0;

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const cx = (v: number) => clamp(v, 0, W);
  const cy = (v: number) => clamp(v, 0, H);

  const finish = (mode: string, snapped?: OverlayWindow | null) => {
    if (done) return;
    let r = sel;
    if (!r && snapped) r = { x: snapped.x, y: snapped.y, w: snapped.width, h: snapped.height };
    if (!r || r.w < 1 || r.h < 1) return;
    done = true;
    const rect = {
      monitor_id: info.monitor_id, monitor_x: info.monitor_x, monitor_y: info.monitor_y, scale: info.scale,
      x: r.x, y: r.y, width: r.w, height: r.h,
    };
    invoke("overlay_finish", { mode, rect, windowId: snapped ? snapped.id : null }).catch((e) => { console.error(e); done = false; });
  };
  const cancel = () => {
    if (done) return;
    done = true;
    invoke("overlay_cancel").catch(() => {});
  };
  const confirm = () => finish(m === "window" ? "capture" : m, hover && !sel ? hover : null);

  const windowAt = (x: number, y: number) => info.windows.find((w) => x >= w.x && x < w.x + w.width && y >= w.y && y < w.y + w.height) ?? null;

  const rectFromDrag = (d: { sx: number; sy: number }, x: number, y: number, square: boolean): Rect => {
    let dx = x - d.sx, dy = y - d.sy;
    if (square) {
      const kx = dx >= 0 ? 1 : -1, ky = dy >= 0 ? 1 : -1;
      const maxX = kx > 0 ? W - d.sx : d.sx, maxY = ky > 0 ? H - d.sy : d.sy;
      const side = Math.min(Math.max(Math.abs(dx), Math.abs(dy)), maxX, maxY);
      dx = kx * side; dy = ky * side;
    }
    const x1 = d.sx + dx, y1 = d.sy + dy;
    return { x: Math.min(d.sx, x1), y: Math.min(d.sy, y1), w: Math.abs(dx), h: Math.abs(dy) };
  };

  const normalise = (r: Rect): Rect => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });

  // ---- rendering
  const place = (el: HTMLElement, r: Rect) => {
    el.style.display = "block";
    el.style.left = r.x + "px"; el.style.top = r.y + "px"; el.style.width = r.w + "px"; el.style.height = r.h + "px";
  };

  const drawLoupe = () => {
    if (mx < 0 || done) { loupe.style.display = "none"; return; }
    const N = 15, S = 124 / N; // 15x15 source px zoomed
    const sxp = Math.floor(mx * natScaleX), syp = Math.floor(my * natScaleY);
    lctx.imageSmoothingEnabled = false;
    lctx.fillStyle = "#111"; lctx.fillRect(0, 0, 124, 124);
    lctx.drawImage(img, sxp - 7, syp - 7, N, N, 0, 0, 124, 124);
    lctx.strokeStyle = "rgba(255,255,255,.9)"; lctx.lineWidth = 1.5; lctx.strokeRect(7 * S, 7 * S, S, S);
    lctx.strokeStyle = "rgba(0,0,0,.8)"; lctx.lineWidth = 1; lctx.strokeRect(7 * S - 1, 7 * S - 1, S + 2, S + 2);
    let hex = "";
    if (readable) {
      try {
        pctx.clearRect(0, 0, 1, 1);
        pctx.drawImage(img, sxp, syp, 1, 1, 0, 0, 1, 1);
        const d = pctx.getImageData(0, 0, 1, 1).data;
        hex = "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
      } catch { /* tainted */ }
    }
    swEl.style.display = hex ? "inline-block" : "none";
    swEl.style.background = hex || "transparent";
    hexEl.textContent = hex;
    (loupe.querySelector(".hex") as HTMLElement).style.display = hex ? "flex" : "none";
    xyEl.textContent = `${Math.round(mx)}, ${Math.round(my)}`;
    // position: bottom-right of cursor, flip near edges
    const lw = 124, lh = 124 + 42;
    let lx = mx + 22, ly = my + 22;
    if (lx + lw > W - 6) lx = mx - 22 - lw;
    if (ly + lh > H - 6) ly = my - 22 - lh;
    loupe.style.display = "block";
    loupe.style.left = Math.max(4, lx) + "px"; loupe.style.top = Math.max(4, ly) + "px";
  };

  const render = () => {
    const picking = !sel || (drag?.kind === "new");
    // crosshair
    const showCross = picking && mx >= 0 && !windowMode;
    vline.style.display = hline.style.display = showCross ? "block" : "none";
    if (showCross) { vline.style.left = mx + "px"; hline.style.top = my + "px"; }
    // window highlight
    const showHl = !sel && !drag && hover;
    if (showHl && hover) {
      place(hl, { x: hover.x, y: hover.y, w: hover.width, h: hover.height });
      hlTag.textContent = [hover.app, hover.title].filter(Boolean).join(" — ") + `  ${Math.round(hover.width)}×${Math.round(hover.height)}`;
      hlTag.style.top = hover.y < 30 ? "6px" : "-26px";
    } else hl.style.display = "none";
    // selection
    if (sel) {
      place(selEl, sel);
      selEl.classList.toggle("dragging", drag?.kind === "new");
      selEl.style.cursor = space ? "grabbing" : "move";
    } else selEl.style.display = "none";
    dim.style.display = sel || showHl ? "none" : "block";
    // size chip
    const sz = sel ?? (showHl && hover ? { x: hover.x, y: hover.y, w: hover.width, h: hover.height } : null);
    if (sel && sz) {
      sizeEl.textContent = `${Math.round(sel.w * info.scale)} × ${Math.round(sel.h * info.scale)}`;
      sizeEl.style.display = "block";
      sizeEl.style.left = clamp(sel.x, 4, W - 110) + "px";
      sizeEl.style.top = (sel.y > 34 ? sel.y - 30 : sel.y + 6) + "px";
    } else sizeEl.style.display = "none";
    // toolbar (only when a selection is settled)
    if (sel && !drag) {
      toolbar.style.display = "flex";
      const tw = toolbar.offsetWidth || 220, th = toolbar.offsetHeight || 40;
      let tx = sel.x + sel.w - tw, ty = sel.y + sel.h + 10;
      if (ty + th > H - 4) ty = sel.y - th - 10 - (sel.y > 34 ? 0 : -(th + 20));
      if (ty < 4) ty = clamp(sel.y + sel.h - th - 10, 4, H - th - 4);
      toolbar.style.left = clamp(tx, 4, W - tw - 4) + "px";
      toolbar.style.top = clamp(ty, 4, H - th - 4) + "px";
    } else toolbar.style.display = "none";
    // loupe: while picking or dragging
    if (picking || drag) drawLoupe(); else loupe.style.display = "none";
    hint.classList.toggle("faded", !!drag || (!!sel && !drag));
  };

  // ---- pointer input
  const pt = (e: MouseEvent) => ({ x: cx(e.clientX), y: cy(e.clientY) });

  window.addEventListener("mousemove", (e) => {
    if (done) return;
    if (!document.hasFocus()) win.setFocus().catch(() => {});
    const p = pt(e);
    mx = p.x; my = p.y;
    if (drag?.kind === "new") {
      if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 3) drag.moved = true;
      if (space) { drag.sx = cx(drag.sx + (p.x - lastX)); drag.sy = cy(drag.sy + (p.y - lastY)); }
      if (drag.moved && !windowMode) sel = normalise(rectFromDrag(drag, p.x, p.y, e.shiftKey));
    } else if (drag?.kind === "move") {
      const o = drag.orig;
      sel = { x: Math.round(clamp(o.x + p.x - drag.ox, 0, W - o.w)), y: Math.round(clamp(o.y + p.y - drag.oy, 0, H - o.h)), w: o.w, h: o.h };
    } else if (drag?.kind === "resize") {
      sel = resize(drag.orig, drag.handle, p.x - drag.ox, p.y - drag.oy);
    } else if (!sel) {
      hover = windowAt(p.x, p.y);
    }
    lastX = p.x; lastY = p.y;
    render();
  });

  const resize = (o: Rect, h: string, dx: number, dy: number): Rect => {
    let l = o.x, r = o.x + o.w, t0 = o.y, b = o.y + o.h;
    if (h.includes("w")) l = cx(l + dx);
    if (h.includes("e")) r = cx(r + dx);
    if (h.includes("n")) t0 = cy(t0 + dy);
    if (h.includes("s")) b = cy(b + dy);
    return normalise({ x: Math.min(l, r), y: Math.min(t0, b), w: Math.abs(r - l), h: Math.abs(b - t0) });
  };

  window.addEventListener("mousedown", (e) => {
    if (done || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (toolbar.contains(target)) return;
    const p = pt(e);
    lastX = p.x; lastY = p.y;
    if (sel && !windowMode) {
      const handle = target.dataset?.h;
      if (handle) { drag = { kind: "resize", handle, ox: p.x, oy: p.y, orig: { ...sel } }; render(); return; }
      if (target === selEl) { drag = { kind: "move", ox: p.x, oy: p.y, orig: { ...sel } }; render(); return; }
    }
    drag = { kind: "new", sx: p.x, sy: p.y, moved: false };
    if (!windowMode) { /* keep old selection until the drag really starts */ }
    render();
  });

  window.addEventListener("mouseup", (e) => {
    if (done || e.button !== 0 || !drag) return;
    const d = drag;
    drag = null;
    if (d.kind === "new") {
      if (!d.moved) {
        // plain click
        if (sel && !windowMode) { sel = null; hover = windowAt(d.sx, d.sy); } // clicked outside → reset
        else if (hover || windowMode) {
          const w = windowAt(d.sx, d.sy);
          if (w) { sel = null; hover = w; finish(m === "window" ? "capture" : m, w); return; }
        }
      } else if (sel && (sel.w < 3 || sel.h < 3)) {
        sel = null;
      }
    }
    render();
  });

  window.addEventListener("dblclick", () => { if (sel && !done) confirm(); });
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (sel) { sel = null; drag = null; hover = windowAt(mx, my); render(); } else cancel();
  });

  toolbar.addEventListener("mousedown", (e) => e.stopPropagation());
  toolbar.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "cancel") cancel();
    else if (act === "confirm") finish(m === "window" ? "capture" : m);
    else if (act === "copy") finish("copy");
    else if (act === "pin") finish("pin");
    else if (act === "ocr") finish("ocr");
  });

  // ---- keyboard
  window.addEventListener("keydown", (e) => {
    if (done) return;
    switch (e.key) {
      case "Escape": e.preventDefault(); cancel(); return;
      case "Enter": e.preventDefault(); if (sel || hover) confirm(); return;
      case " ": e.preventDefault(); space = true; render(); return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && sel) { e.preventDefault(); finish("copy"); return; }
    const dir = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
    if (dir && sel) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      if (e.altKey) {
        // resize from the bottom-right corner
        sel = normalise({ x: sel.x, y: sel.y, w: clamp(sel.w + dir[0] * step, 1, W - sel.x), h: clamp(sel.h + dir[1] * step, 1, H - sel.y) });
      } else {
        sel = normalise({ ...sel, x: clamp(sel.x + dir[0] * step, 0, W - sel.w), y: clamp(sel.y + dir[1] * step, 0, H - sel.h) });
      }
      render();
    }
  });
  window.addEventListener("keyup", (e) => { if (e.key === " ") { space = false; render(); } });
  window.addEventListener("blur", () => { space = false; });

  document.body.tabIndex = -1;
  document.body.focus();
  render();

  // ---- reveal now that the frozen frame is decoded
  await invoke("overlay_ready").catch((e) => console.error(e));
  win.setFocus().catch(() => {});
}
