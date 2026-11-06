import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { save, ask } from "@tauri-apps/plugin-dialog";
import { st, baseRect } from "./state";
import { exportCanvas } from "./render";
import { markClean, isDirty } from "./history";
import { toast } from "./toast";
import { t } from "../shared/i18n";
import { showOcr } from "./dialogs";

export function flatten(withBg = true): HTMLCanvasElement {
  return exportCanvas(st, st.crop ?? baseRect(), withBg ? st.bg : null, st.rev);
}
export function pngBase64(cv: HTMLCanvasElement): string {
  return cv.toDataURL("image/png").split(",")[1];
}
const errMsg = (e: unknown) => (typeof e === "string" ? e : e instanceof Error ? e.message : JSON.stringify(e));

async function syncHistory(b64: string) {
  if (!st.imageId) return;
  try { await invoke("update_history_image", { id: st.imageId, pngBase64: b64 }); } catch { /* history is best-effort */ }
}
/** Returns null on failure (after toasting), otherwise a box with the (possibly void) result. */
async function run<T>(fn: () => Promise<T>): Promise<{ v: T } | null> {
  try { return { v: await fn() }; } catch (e) { toast(`${t("editor.toast.error")}: ${errMsg(e)}`, "error", 5000); return null; }
}
function render(): string | null {
  try { return pngBase64(flatten()); } catch (e) {
    toast(`${t("editor.toast.error")}: ${errMsg(e)}`, "error", 5000); return null;
  }
}

export async function doCopy(): Promise<boolean> {
  const b64 = render(); if (!b64) return false;
  const r = await run(() => invoke("copy_image_png", { pngBase64: b64 }));
  if (r === null) return false;
  await syncHistory(b64);
  toast(t("editor.toast.copied"), "ok");
  return true;
}

export async function doSave(): Promise<boolean> {
  const b64 = render(); if (!b64) return false;
  const res = await run(() => invoke<string>("save_image_png", { pngBase64: b64, path: st.savedPath ?? undefined }));
  if (res === null) return false;
  const path = res.v;
  st.savedPath = path;
  await syncHistory(b64);
  markClean();
  toast(`${t("editor.toast.saved")}: ${path}`, "ok", 3500);
  return true;
}

export async function doSaveAs(): Promise<boolean> {
  const dir = st.path.includes("/") ? st.path.slice(0, st.path.lastIndexOf("/") + 1) : "";
  const base = (st.path.split("/").pop() || "CaptureME.png").replace(/\.[^.]+$/, "");
  const pickedRes = await run(() => save({
    defaultPath: `${dir}${base}-edited.png`,
    filters: [{ name: "PNG", extensions: ["png"] }, { name: "JPEG", extensions: ["jpg", "jpeg"] }, { name: "WebP", extensions: ["webp"] }],
  }));
  const picked = pickedRes?.v;
  if (!picked) return false;
  const path = /\.(png|jpe?g|webp)$/i.test(picked) ? picked : picked + ".png";
  const b64 = render(); if (!b64) return false;
  const res = await run(() => invoke<string>("save_image_png", { pngBase64: b64, path }));
  if (res === null) return false;
  const out = res.v;
  st.savedPath = out;
  await syncHistory(b64);
  markClean();
  toast(`${t("editor.toast.saved")}: ${out}`, "ok", 3500);
  return true;
}

export async function doPin(): Promise<boolean> {
  const b64 = render(); if (!b64) return false;
  const r = await run(() => invoke("pin_image_png", { pngBase64: b64 }));
  if (r === null) return false;
  toast(t("editor.toast.pinned"), "ok");
  return true;
}

export async function doOcr() {
  let b64: string;
  try { b64 = pngBase64(flatten(false)); } catch (e) { toast(errMsg(e), "error"); return; }
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
