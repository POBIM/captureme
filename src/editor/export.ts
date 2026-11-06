import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { save, ask } from "@tauri-apps/plugin-dialog";
import { st, baseRect } from "./state";
import { exportCanvas, release } from "./render";
import { markClean, isDirty } from "./history";
import { toast } from "./toast";
import { t } from "../shared/i18n";
import { showOcr } from "./dialogs";
import { activeWm } from "./watermark";

/* ---------- remembered export preset ---------- */
const LS = "captureme.editor.export.v1";
export const exportPrefs: { scale: 0.5 | 1 | 2 } = (() => {
  try { const j = JSON.parse(localStorage.getItem(LS) || "{}"); return { scale: [0.5, 1, 2].includes(j.scale) ? j.scale : 1 }; } catch { return { scale: 1 }; }
})();
export function setExportScale(s: 0.5 | 1 | 2) {
  exportPrefs.scale = s;
  try { localStorage.setItem(LS, JSON.stringify(exportPrefs)); } catch { /* ignore */ }
}

const MAX_SIDE = 16384, MAX_PIXELS = 200_000_000;

interface Opts { scale?: number; wm?: boolean; bg?: boolean }
/** Flattened picture. `scale`/`wm` default to the user's export preset. */
export function flatten(o: Opts = {}): HTMLCanvasElement {
  const scale = o.scale ?? exportPrefs.scale;
  const c = st.crop ?? baseRect();
  const withBg = o.bg ?? true;
  const pad = withBg && st.bg.enabled ? st.bg.padding : 0;
  const w = (c.w + 2 * pad) * scale, h = (c.h + 2 * pad) * scale;
  if (w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS) throw new Error(t("editor.err.tooBig"));
  return exportCanvas(st, c, withBg ? st.bg : null, st.rev, { scale, wm: o.wm === false ? null : activeWm() });
}

/** PNG → base64 without blocking the UI thread (toBlob encodes asynchronously). Frees the canvas. */
export function pngBase64(cv: HTMLCanvasElement): Promise<string> {
  return new Promise((res, rej) => {
    const done = (b64: string) => { release(cv); res(b64); };
    cv.toBlob((blob) => {
      if (!blob) { try { done(cv.toDataURL("image/png").split(",")[1]); } catch (e) { rej(e); } return; }
      const fr = new FileReader();
      fr.onload = () => done(String(fr.result).split(",")[1] ?? "");
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    }, "image/png");
  });
}
const errMsg = (e: unknown) => (typeof e === "string" ? e : e instanceof Error ? e.message : JSON.stringify(e));

async function syncHistory(b64Plain: string | null) {
  if (!st.imageId) return;
  const b64 = b64Plain ?? await render({ scale: 1, wm: false }).catch(() => null);
  if (!b64) return;
  // Privacy: if anything is hidden (redact/blur/pixelate), the un-hidden original must not survive in history.
  const redacted = st.objects.some((o) => o.type === "redact" || o.type === "blur" || o.type === "pixelate");
  try { await invoke("update_history_image", { id: st.imageId, pngBase64: b64, redacted }); } catch { /* history is best-effort */ }
}
/** Returns null on failure (after toasting), otherwise a box with the (possibly void) result. */
async function run<T>(fn: () => Promise<T>): Promise<{ v: T } | null> {
  try { return { v: await fn() }; } catch (e) { toast(`${t("editor.toast.error")}: ${errMsg(e)}`, "error", 5000); return null; }
}
async function render(o: Opts = {}): Promise<string> { return pngBase64(flatten(o)); }
async function renderOrToast(o: Opts = {}): Promise<string | null> {
  try { return await render(o); } catch (e) { toast(`${t("editor.toast.error")}: ${errMsg(e)}`, "error", 5000); return null; }
}
/** The history keeps the plain 1× picture; only re-render it when the export differs. */
const isPlain = () => exportPrefs.scale === 1 && !activeWm();

export async function doCopy(): Promise<boolean> {
  const b64 = await renderOrToast(); if (!b64) return false;
  const r = await run(() => invoke("copy_image_png", { pngBase64: b64 }));
  if (r === null) return false;
  await syncHistory(isPlain() ? b64 : null);
  toast(t("editor.toast.copied"), "ok");
  return true;
}

export async function doSave(): Promise<boolean> {
  const b64 = await renderOrToast(); if (!b64) return false;
  const res = await run(() => invoke<string>("save_image_png", { pngBase64: b64, path: st.savedPath ?? undefined }));
  if (res === null) return false;
  st.savedPath = res.v;
  await syncHistory(isPlain() ? b64 : null);
  markClean();
  toast(`${t("editor.toast.saved")}: ${res.v}`, "ok", 3500);
  return true;
}

export async function doSaveAs(ext: "png" | "jpg" = "png"): Promise<boolean> {
  const dir = st.path.includes("/") ? st.path.slice(0, st.path.lastIndexOf("/") + 1) : "";
  const base = (st.path.split("/").pop() || "CaptureME.png").replace(/\.[^.]+$/, "");
  const filters = [{ name: "PNG", extensions: ["png"] }, { name: "JPEG", extensions: ["jpg", "jpeg"] }, { name: "WebP", extensions: ["webp"] }];
  if (ext === "jpg") filters.unshift(filters.splice(1, 1)[0]);
  const pickedRes = await run(() => save({ defaultPath: `${dir}${base}-edited.${ext}`, filters }));
  const picked = pickedRes?.v;
  if (!picked) return false;
  const path = /\.(png|jpe?g|webp)$/i.test(picked) ? picked : `${picked}.${ext}`;
  const b64 = await renderOrToast(); if (!b64) return false;
  const res = await run(() => invoke<string>("save_image_png", { pngBase64: b64, path }));
  if (res === null) return false;
  st.savedPath = res.v;
  await syncHistory(isPlain() ? b64 : null);
  markClean();
  toast(`${t("editor.toast.saved")}: ${res.v}`, "ok", 3500);
  return true;
}

/** Save (if there is nothing saved yet or edits are pending) and return the file's path. */
async function ensureSaved(): Promise<string | null> {
  if (!st.savedPath || isDirty()) { if (!(await doSave())) return null; }
  return st.savedPath;
}
export async function doCopyPath() {
  const p = await ensureSaved(); if (!p) return;
  const r = await run(() => invoke("copy_text", { text: p }));
  if (r) toast(`${t("editor.toast.pathCopied")}: ${p}`, "ok", 3500);
}
export async function doReveal() {
  const p = await ensureSaved(); if (!p) return;
  await run(() => invoke("reveal_in_finder", { path: p }));
}

export async function doPin(): Promise<boolean> {
  const b64 = await renderOrToast({ scale: 1 }); if (!b64) return false;
  const r = await run(() => invoke("pin_image_png", { pngBase64: b64 }));
  if (r === null) return false;
  toast(t("editor.toast.pinned"), "ok");
  return true;
}

export async function doOcr() {
  let b64: string;
  try { b64 = await pngBase64(flatten({ bg: false, scale: 1, wm: false })); } catch (e) { toast(errMsg(e), "error"); return; }
  toast(t("editor.toast.ocrRunning"), "info", 1500);
  const res = await run(() => invoke<string>("ocr_image_png", { pngBase64: b64 }));
  if (res === null) return;
  showOcr(res.v);
}

let forceClose = false;
export async function closeWindow(force = false) {
  forceClose = force;
  try { await getCurrentWindow().close(); } catch { window.close(); }
}
export async function copyAndClose() {
  if (await doCopy()) closeWindow(true);
}
export function installCloseGuard() {
  try {
    getCurrentWindow().onCloseRequested(async (ev) => {
      if (forceClose || !isDirty()) return;
      ev.preventDefault();
      const ok = await ask(t("editor.unsaved.msg"), {
        title: t("editor.unsaved.title"), kind: "warning",
        okLabel: t("editor.unsaved.discard"), cancelLabel: t("editor.unsaved.cancel"),
      }).catch(() => true);
      if (ok) closeWindow(true);
    });
  } catch { /* not running in Tauri */ }
}
