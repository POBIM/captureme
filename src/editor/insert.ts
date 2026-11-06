// Image overlays: paste from the clipboard (⌘V) or drop an image file onto the canvas.
import { convertFileSrc } from "@tauri-apps/api/core";
import { docRect } from "./state";
import { toImage } from "./viewport";
import { commit } from "./history";
import { addObject, newObj } from "./ops";
import { registerImage } from "./images";
import { setTool } from "./tools";
import { isTyping } from "./input";
import { isModalOpen } from "./dialogs";
import { toast } from "./toast";
import { t } from "../shared/i18n";
import type { ImageObj, Pt } from "./types";

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|tiff?|heic|heif|avif)$/i;

export async function addImageFromBlob(blob: Blob, at?: Pt): Promise<boolean> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(blob); } catch { toast(t("editor.insert.failed"), "error"); return false; }
  const d = docRect();
  // fit into 60 % of the visible image, never enlarge
  const k = Math.min(1, (d.w * 0.6) / bmp.width, (d.h * 0.6) / bmp.height);
  const w = Math.max(8, bmp.width * k), h = Math.max(8, bmp.height * k);
  const c = at ?? { x: d.x + d.w / 2, y: d.y + d.h / 2 };
  const key = registerImage(bmp);
  setTool("select");
  addObject(newObj("image", { x: c.x - w / 2, y: c.y - h / 2, w, h, key }) as ImageObj);
  commit();
  toast(t("editor.insert.done"), "ok");
  return true;
}

async function readClipboardImage(): Promise<boolean> {
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find((x) => x.startsWith("image/"));
      if (type) return addImageFromBlob(await it.getType(type));
    }
  } catch { /* no permission / nothing readable */ }
  return false;
}

async function addFromPath(path: string, at?: Pt) {
  if (!IMG_EXT.test(path)) { toast(t("editor.insert.notImage"), "error"); return; }
  try { addImageFromBlob(await (await fetch(convertFileSrc(path))).blob(), at); }
  catch { toast(t("editor.insert.failed"), "error"); }
}

export function attachInsert(stage: HTMLElement) {
  // ---- paste ----
  let handled = false;
  window.addEventListener("paste", (e) => {
    if (isModalOpen() || isTyping(e.target)) return;
    const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
    if (!f) return;
    handled = true; e.preventDefault();
    addImageFromBlob(f);
  });
  // The app has no Edit menu, so WKWebView may not fire `paste` for ⌘V: fall back to the async clipboard API.
  window.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.code !== "KeyV") return;
    if (isModalOpen() || isTyping(e.target) || e.target instanceof HTMLTextAreaElement) return;
    handled = false;
    setTimeout(async () => { if (!handled && !(await readClipboardImage())) toast(t("editor.insert.none"), "info"); }, 80);
  });

  // ---- drag & drop (browser events) ----
  const at = (e: DragEvent) => { const r = stage.getBoundingClientRect(); return toImage(e.clientX - r.left, e.clientY - r.top); };
  stage.addEventListener("dragover", (e) => { e.preventDefault(); stage.classList.add("dropping"); });
  stage.addEventListener("dragleave", () => stage.classList.remove("dropping"));
  stage.addEventListener("drop", async (e) => {
    e.preventDefault(); stage.classList.remove("dropping");
    const p = at(e);
    const files = [...(e.dataTransfer?.files ?? [])];
    const imgs = files.filter((f) => f.type.startsWith("image/") || IMG_EXT.test(f.name));
    if (!imgs.length) { toast(t("editor.insert.notImage"), "error"); return; }
    for (const f of imgs) await addImageFromBlob(f, p);
  });

  // ---- drag & drop (Tauri intercepts file drops and reports paths instead) ----
  if ("__TAURI_INTERNALS__" in window) {
    import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
      getCurrentWebview().onDragDropEvent((ev) => {
        const p = ev.payload;
        if (p.type === "enter" || p.type === "over") { stage.classList.add("dropping"); return; }
        stage.classList.remove("dropping");
        if (p.type !== "drop") return;
        const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
        const pos = toImage(p.position.x / dpr - r.left, p.position.y / dpr - r.top);
        p.paths.forEach((path) => addFromPath(path, pos));
      }),
    ).catch(() => {});
  }
}
