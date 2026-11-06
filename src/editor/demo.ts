/// <reference types="vite/client" />
// Demo helpers for the marketing captures (see marketing/README.md). Loaded ONLY by `vite dev`
// (`import.meta.env.DEV`) AND only when the page URL has `?demo` – the production bundle never contains it.
// Everything goes through the editor's real tools / object model, e.g. `drag("arrow", [x1,y1], [x2,y2])`
// dispatches the same pointer events a mouse would (inside this page only – nothing is sent to macOS).
import { st, touch, emit } from "./state";
import { toScreen } from "./viewport";
import { setTool } from "./tools";
import { addObject, newObj } from "./ops";
import { commit } from "./history";
import { toolProps } from "./props";
import { addImageFromBlob } from "./insert";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { fit } from "./viewport";
import type { ObjType, Pt, Props, ToolId } from "./types";

const BTN_ORDER = ["undo", "redo", "resize", "pad", "tf", "bg", "wm", "export", "copy", "save", "saveas", "pin", "ocr", "help", "done"];

export function installDemo(canvas: HTMLCanvasElement) {
  canvas.setPointerCapture = () => {}; // synthetic pointer ids cannot be captured
  const client = (p: Pt) => {
    const r = canvas.getBoundingClientRect(), s = toScreen(p);
    return { x: r.left + s.x, y: r.top + s.y };
  };
  const fire = (type: string, p: Pt, shift = false) => {
    const c = client(p);
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: c.x, clientY: c.y, button: 0, buttons: type === "pointerup" ? 0 : 1,
      pointerId: 1, pointerType: "mouse", shiftKey: shift,
    }));
  };
  const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const P = (a: number[]): Pt => ({ x: a[0], y: a[1] });

  const api = {
    /** Pick the tool exactly like pressing its button. */
    tool: (id: ToolId) => setTool(id),
    /** Preset style for the next object(s) of this tool (same store the property bar edits). */
    props: (type: ObjType, patch: Partial<Props>) => { Object.assign(toolProps[type], patch); emit("tool"); },
    /** Drag with the current tool from a to b (image pixels). */
    drag(tool: ToolId, a: number[], b: number[], shift = false) {
      setTool(tool);
      fire("pointerdown", P(a), shift);
      for (let i = 1; i <= 8; i++) fire("pointermove", lerp(P(a), P(b), i / 8), shift);
      fire("pointerup", P(b), shift);
    },
    /** Freehand path with pen / highlighter. */
    path(tool: "pen" | "highlighter", pts: number[][]) {
      setTool(tool);
      fire("pointerdown", P(pts[0]));
      for (const p of pts.slice(1)) fire("pointermove", P(p));
      fire("pointerup", P(pts[pts.length - 1]));
    },
    /** Click with a placing tool (step, stamp). */
    click(tool: ToolId, a: number[]) {
      setTool(tool);
      fire("pointerdown", P(a)); fire("pointerup", P(a));
    },
    /** Objects that the real text / callout tools would create after typing. */
    text(x: number, y: number, text: string, style: Partial<Props> = {}) {
      addObject(newObj("text", { x, y, text }));
      Object.assign(st.objects[st.objects.length - 1].s, style); touch(); commit();
    },
    callout(x: number, y: number, text: string, tail: number[], style: Partial<Props> = {}) {
      addObject(newObj("callout", { x, y, text, tail: P(tail) }));
      Object.assign(st.objects[st.objects.length - 1].s, style); touch(); commit();
    },
    /** Click a toolbar button by role (bg, wm, export, help, tf, pad, resize, …). */
    btn(name: string) {
      const bs = [...document.querySelectorAll<HTMLButtonElement>(".toolbar button.ib:not(.tool)")];
      bs[BTN_ORDER.indexOf(name)]?.click();
    },
    select(ids: number[]) { st.selection = ids.map((i) => st.objects[i].id); emit("selection"); touch(); },
    deselect() { st.selection = []; emit("selection"); touch(); },
    bg(patch: Partial<typeof st.bg>) { Object.assign(st.bg, patch); touch(); fit(); commit(); },
    /** Insert an image file like paste / drop does. */
    async image(path: string, at?: number[]) {
      await invoke("allow_image_file", { path });
      return addImageFromBlob(await (await fetch(convertFileSrc(path))).blob(), at ? P(at) : undefined);
    },
    /** Patch an object (by index) – e.g. the magnifier's source point. */
    edit(i: number, patch: Record<string, unknown>) { Object.assign(st.objects[i], patch); touch(); commit(); },
    clear() { st.objects.length = 0; st.selection = []; emit("selection"); touch(); commit(); },
    /** Bounding box (css px) of the first element matching a selector – used to place callouts. */
    rect(sel: string) { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; },
    btnRects() { return [...document.querySelectorAll<HTMLButtonElement>(".toolbar button.ib")].map((b) => { const r = b.getBoundingClientRect(); return { cls: b.className, x: r.x, y: r.y, w: r.width, h: r.height }; }); },
    objects: () => st.objects,
    commit,
  };
  (window as unknown as { __demo: typeof api }).__demo = api;
}
