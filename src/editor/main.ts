import "./editor.css";
import { listen } from "@tauri-apps/api/event";
import { applyI18n, setLang, t } from "../shared/i18n";
import { api, queryParam } from "../shared/api";
import { st, docRect, on, requestRender, setSelection, selected } from "./state";
import { buildUI, applyTitles, TOOL_BY_CODE } from "./ui";
import { drawFramed } from "./render";
import { drawSelection } from "./overlay";
import { attachViewportInput, fit, zoomStep, zoomActual } from "./viewport";
import { attachInput, isTyping } from "./input";
import { currentTool, setTool, confirmCrop, cancelCrop } from "./tools";
import { initTextEdit, repositionEdit } from "./textedit";
import { resetHistory, undo, redo, commit } from "./history";
import { deleteSelected, duplicateSelected, selectAll, bringToFront, sendToBack, nudge } from "./ops";
import { doCopy, doSave, doSaveAs, closeWindow, copyAndClose, installCloseGuard } from "./export";
import { isModalOpen } from "./dialogs";
import { toast } from "./toast";

const root = document.getElementById("app")!;
const { stage, canvas } = buildUI(root);
initTextEdit(stage);
attachInput(canvas);
attachViewportInput(canvas);
const ctx = canvas.getContext("2d")!;

/* ---------- layout & render ---------- */
function layout() {
  const r = stage.getBoundingClientRect();
  st.stageW = Math.max(1, r.width); st.stageH = Math.max(1, r.height);
  st.dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(st.stageW * st.dpr);
  canvas.height = Math.round(st.stageH * st.dpr);
  canvas.style.width = `${st.stageW}px`;
  canvas.style.height = `${st.stageH}px`;
  if (st.view.autoFit && st.base.width > 1) fit(); else requestRender();
}
new ResizeObserver(layout).observe(stage);
window.addEventListener("resize", layout);

on("render", () => {
  const dpr = st.dpr, z = st.view.zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const d = docRect();
  const bg = st.tool === "crop" ? null : st.bg;
  ctx.save();
  ctx.setTransform(z, 0, 0, z, st.view.panX * dpr, st.view.panY * dpr);
  ctx.translate(-d.x, -d.y);
  if (!bg?.enabled) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 24 * dpr; ctx.shadowOffsetY = 6 * dpr;
    ctx.fillStyle = "#000"; ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = z < 2;
  ctx.imageSmoothingQuality = "high";
  drawFramed(ctx, st, d, bg, { px: z, rev: st.rev, skipId: st.editingId });
  ctx.restore();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSelection(ctx);
  currentTool().overlay?.(ctx, dpr);
  repositionEdit();
});
on("view", repositionEdit);

/* ---------- keyboard ---------- */
let nudgeTimer = 0;
window.addEventListener("keydown", (e) => {
  if (isModalOpen()) return;
  if (e.target instanceof HTMLTextAreaElement) return;
  const meta = e.metaKey || e.ctrlKey;
  const typing = isTyping(e.target);
  if (meta) {
    let handled = true;
    switch (e.code) {
      case "KeyZ": if (typing) return; e.shiftKey ? redo() : undo(); break;
      case "KeyY": if (typing) return; redo(); break;
      case "KeyD": duplicateSelected(); break;
      case "KeyC": if (typing) return; doCopy(); break;
      case "KeyS": e.shiftKey ? doSaveAs() : doSave(); break;
      case "KeyW": closeWindow(false); break;
      case "Enter": copyAndClose(); break;
      case "Equal": case "NumpadAdd": zoomStep(1.25); break;
      case "Minus": case "NumpadSubtract": zoomStep(1 / 1.25); break;
      case "Digit0": fit(); break;
      case "Digit1": zoomActual(); break;
      case "KeyA": if (typing) return; selectAll(); break;
      case "BracketRight": bringToFront(); break;
      case "BracketLeft": sendToBack(); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
    return;
  }
  if (typing) return;
  if (e.altKey) return;
  const tid = TOOL_BY_CODE.get(e.code);
  if (tid) { e.preventDefault(); setTool(tid); return; }
  switch (e.code) {
    case "Delete": case "Backspace": e.preventDefault(); deleteSelected(); break;
    case "Escape":
      if (st.tool === "crop") cancelCrop();
      else if (st.selection.length) setSelection([]);
      else if (st.tool !== "select") setTool("select");
      break;
    case "Enter": case "NumpadEnter": if (st.tool === "crop") { e.preventDefault(); confirmCrop(); } break;
    case "ArrowLeft": case "ArrowRight": case "ArrowUp": case "ArrowDown": {
      if (!selected().length) return;
      e.preventDefault();
      const s = e.shiftKey ? 10 : 1;
      nudge(e.code === "ArrowLeft" ? -s : e.code === "ArrowRight" ? s : 0, e.code === "ArrowUp" ? -s : e.code === "ArrowDown" ? s : 0, false);
      clearTimeout(nudgeTimer);
      nudgeTimer = window.setTimeout(commit, 350);
      break;
    }
  }
});
// Disable the webview's own pinch/page zoom and text-selection drags.
document.addEventListener("dragstart", (e) => e.preventDefault());

/* ---------- language ---------- */
function langChanged() { applyI18n(); applyTitles(); document.title = t("editor.title"); }
const hasTauri = "__TAURI_INTERNALS__" in window;
if (hasTauri) {
  api.getSettings().then((s) => { setLang(s.language); langChanged(); }).catch(() => {});
  listen<{ language: "th" | "en" }>("settings-changed", (e) => {
    if (e.payload?.language) { setLang(e.payload.language); langChanged(); }
  }).catch(() => {});
  installCloseGuard();
}
langChanged();

/* ---------- load image ---------- */
function loadImage(url: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("load failed"));
    img.src = url;
  });
}

async function init() {
  const path = queryParam("path");
  st.imageId = queryParam("id");
  if (!path) { toast(t("editor.err.nopath"), "error", 6000); return; }
  st.path = path;
  const url = hasTauri ? api.fileSrc(path) : path;
  let img: HTMLImageElement;
  try { img = await loadImage(url, true); }
  catch {
    try { img = await loadImage(url, false); toast(t("editor.err.tainted"), "info", 5000); }
    catch { toast(`${t("editor.err.load")}: ${path}`, "error", 8000); return; }
  }
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  st.base = c;
  resetHistory();
  layout();
  fit();
}
init();
void requestRender;
