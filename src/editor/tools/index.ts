import { st, emit, kscale, docRect, requestRender, setSelection } from "../state";
import { fit } from "../viewport";
import { endEdit } from "../textedit";
import { SelectTool } from "./select";
import { ShapeTool, PenTool, PlaceTool, TextTool, CalloutTool } from "./draw";
import { CropTool, applyCrop } from "./crop";
import { EyedropperTool } from "./eyedropper";
import type { Tool, ToolId } from "../types";

const eyedropper = new EyedropperTool();
export const tools: Record<ToolId, Tool> = {
  select: new SelectTool(),
  crop: new CropTool(),
  eyedropper,
  arrow: new ShapeTool("arrow"),
  line: new ShapeTool("line"),
  rect: new ShapeTool("rect"),
  ellipse: new ShapeTool("ellipse"),
  blur: new ShapeTool("blur"),
  pixelate: new ShapeTool("pixelate"),
  spotlight: new ShapeTool("spotlight"),
  magnify: new ShapeTool("magnify"),
  pen: new PenTool("pen"),
  highlighter: new PenTool("highlighter"),
  step: new PlaceTool("step"),
  stamp: new PlaceTool("stamp"),
  text: new TextTool(),
  callout: new CalloutTool(),
  redact: new ShapeTool("redact"),
  marker: new ShapeTool("marker"),
  underline: new ShapeTool("underline"),
  measure: new ShapeTool("measure"),
};
eyedropper.onDone = () => setTool(st.prevTool === "eyedropper" ? "select" : st.prevTool);

export const currentTool = () => tools[st.tool];

export function setTool(id: ToolId) {
  if (id === st.tool) return;
  endEdit();
  const prev = st.tool;
  tools[prev].deactivate?.();
  const k = kscale();
  const o0 = docRect();
  if (id === "eyedropper" || id === "crop") st.prevTool = prev;
  st.tool = id;
  const o1 = docRect();
  st.view.panX += (o0.x - o1.x) * k;
  st.view.panY += (o0.y - o1.y) * k;
  if (id !== "select" && id !== "eyedropper") setSelection([]);
  tools[id].activate?.();
  if (prev === "crop") fit();
  emit("tool");
  emit("view");
  requestRender();
}

export function confirmCrop() {
  if (st.tool !== "crop") return;
  applyCrop();
  setTool("select");
}
export function cancelCrop() {
  if (st.tool !== "crop") return;
  setTool(st.prevTool === "crop" ? "select" : st.prevTool);
}
export function resetCrop() {
  if (st.tool !== "crop") return;
  st.crop = null;
  st.cropDraft = { x: 0, y: 0, w: st.base.width, h: st.base.height };
  emit("tool"); requestRender();
}
