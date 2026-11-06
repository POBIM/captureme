import "./pin.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { api, queryParam, type Settings } from "../shared/api";
import { applyI18n, setLang, t } from "../shared/i18n";

const win = getCurrentWindow();
const path = queryParam("path") ?? "";
const pxW = Number(queryParam("pw")) || 0;
const MIN = 48;

document.getElementById("app")!.innerHTML = `
  <div id="pin">
    <img id="img" alt="">
    <div id="bar">
      <button data-act="copy" data-i18n-title="tools.pin.copy">⧉</button>
      <button data-act="save" data-i18n-title="tools.pin.save">⤓</button>
      <button data-act="edit" data-i18n-title="tools.pin.edit">✎</button>
      <input type="range" id="opacity" min="10" max="100" value="100" data-i18n-title="tools.pin.opacity">
      <button data-act="close" class="close" data-i18n-title="tools.pin.close">✕</button>
    </div>
    <div id="grip"></div>
    <div id="hud"></div>
  </div>`;
const img = document.getElementById("img") as HTMLImageElement;
img.src = api.fileSrc(path);
const bar = document.getElementById("bar")!;
const hud = document.getElementById("hud")!;
const opacity = document.getElementById("opacity") as HTMLInputElement;

let hudTimer: number | undefined;
function say(msg: string, ms = 900) {
  hud.textContent = msg;
  hud.classList.add("show");
  clearTimeout(hudTimer);
  hudTimer = window.setTimeout(() => hud.classList.remove("show"), ms);
}

function setOpacity(v: number) {
  v = Math.min(1, Math.max(0.1, v));
  document.body.style.opacity = String(v);
  opacity.value = String(Math.round(v * 100));
}
opacity.oninput = () => setOpacity(Number(opacity.value) / 100);

// ---- actions ------------------------------------------------------------------------------
const closeWin = () => win.close();
async function act(name: string) {
  try {
    if (name === "copy") {
      await invoke("copy_image_file", { path });
      say(t("tools.pin.copied"));
    } else if (name === "save") {
      const p = await invoke<string>("save_image_file", { path });
      say(`${t("tools.pin.saved")}: ${p.split("/").pop()}`, 1800);
    } else if (name === "edit") {
      await invoke("pin_edit", { label: win.label, path });
    } else if (name === "close") {
      await closeWin();
    }
  } catch (e) {
    say(String(e), 2500);
  }
}
bar.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((b) => (b.onclick = () => act(b.dataset.act!)));

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeWin();
  else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
    e.preventDefault();
    act("copy");
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w") closeWin();
});
window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  document.body.classList.toggle("menu");
});
window.addEventListener("dblclick", (e) => {
  if (!(e.target as HTMLElement).closest("#bar, #grip")) act("edit");
});

// ---- move (drag after a few px so double-click still works) -------------------------------
let down: { x: number; y: number } | null = null;
window.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || (e.target as HTMLElement).closest("#bar, #grip")) return;
  down = { x: e.clientX, y: e.clientY };
});
window.addEventListener("mousemove", (e) => {
  if (down && (e.buttons & 1) && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 3) {
    down = null;
    win.startDragging();
  }
});
window.addEventListener("mouseup", () => (down = null));

// ---- zoom (resize the window, keep aspect) ------------------------------------------------
let pend = 1;
let fx = 0.5;
let fy = 0.5;
let busy = false;
async function applyZoom() {
  if (busy) return;
  busy = true;
  try {
    while (Math.abs(pend - 1) > 1e-4) {
      const f = pend;
      pend = 1;
      const sf = await win.scaleFactor();
      const pos = (await win.outerPosition()).toLogical(sf);
      const size = (await win.innerSize()).toLogical(sf);
      const min = Math.max(MIN / size.width, MIN / size.height);
      const k = Math.min(Math.max(f, min), 12000 / size.width);
      const nw = Math.round(size.width * k);
      const nh = Math.round(size.height * k);
      await win.setSize(new LogicalSize(nw, nh));
      await win.setPosition(new LogicalPosition(Math.round(pos.x + fx * (size.width - nw)), Math.round(pos.y + fy * (size.height - nh))));
      if (pxW) say(`${Math.round(((nw * sf) / pxW) * 100)}%`);
    }
  } finally {
    busy = false;
  }
}
function zoomBy(f: number, e?: { clientX: number; clientY: number }) {
  pend *= f;
  fx = e ? e.clientX / window.innerWidth : 0.5;
  fy = e ? e.clientY / window.innerHeight : 0.5;
  applyZoom();
}

let sawGesture = false;
window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const d = e.deltaY || e.deltaX;
    if (e.altKey) {
      setOpacity(Number(opacity.value) / 100 - d * 0.004);
      say(`${t("tools.pin.opacityHud")} ${opacity.value}%`);
    } else if (e.ctrlKey) {
      if (!sawGesture) zoomBy(Math.exp(-d * 0.01), e); // trackpad pinch delivered as ctrl+wheel
    } else {
      zoomBy(Math.exp(-d * 0.0025), e);
    }
  },
  { passive: false },
);
// WebKit pinch gestures
let lastScale = 1;
window.addEventListener("gesturestart", (e: any) => {
  e.preventDefault();
  sawGesture = true;
  lastScale = 1;
});
window.addEventListener("gesturechange", (e: any) => {
  e.preventDefault();
  zoomBy(e.scale / lastScale, e);
  lastScale = e.scale;
});
window.addEventListener("gestureend", (e: any) => e.preventDefault());

// ---- resize grip --------------------------------------------------------------------------
const grip = document.getElementById("grip")!;
grip.addEventListener("pointerdown", async (e) => {
  e.preventDefault();
  grip.setPointerCapture(e.pointerId);
  const sx = e.screenX;
  const w0 = window.innerWidth;
  const h0 = window.innerHeight;
  let target = w0;
  let running = false;
  const move = (ev: PointerEvent) => {
    target = Math.max(MIN, w0 + (ev.screenX - sx));
    if (running) return;
    running = true;
    requestAnimationFrame(async () => {
      await win.setSize(new LogicalSize(Math.round(target), Math.round((target * h0) / w0)));
      running = false;
    });
  };
  const up = (ev: PointerEvent) => {
    grip.releasePointerCapture(ev.pointerId);
    grip.removeEventListener("pointermove", move);
    grip.removeEventListener("pointerup", up);
  };
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", up);
});

// ---- i18n ---------------------------------------------------------------------------------
api.getSettings().then((s) => {
  setLang(s.language);
  applyI18n();
});
applyI18n();
listen<Settings>("settings-changed", (ev) => {
  setLang(ev.payload.language);
  applyI18n();
});
