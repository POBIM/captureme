import React from "react";
import { C, FONT } from "../theme";
import { MacWindow } from "./MacWindow";
import { FakePage } from "./FakePage";
import {
  MousePointer2, Crop, MoveUpRight, Minus, Square, Circle, Pencil, Highlighter, Type, ListOrdered, EyeOff, Grid3x3,
  Lightbulb, ZoomIn, Smile, Pipette, Copy, Save, Pin, ScanText, Undo2, Redo2, Sparkles,
} from "lucide-react";

export const TOOLS = [
  { id: "select", Icon: MousePointer2 }, { id: "crop", Icon: Crop }, { sep: true },
  { id: "arrow", Icon: MoveUpRight }, { id: "line", Icon: Minus }, { id: "rect", Icon: Square }, { id: "ellipse", Icon: Circle },
  { id: "pen", Icon: Pencil }, { id: "highlighter", Icon: Highlighter }, { id: "text", Icon: Type }, { id: "step", Icon: ListOrdered }, { sep: true },
  { id: "blur", Icon: EyeOff }, { id: "pixelate", Icon: Grid3x3 }, { id: "spotlight", Icon: Lightbulb }, { id: "magnify", Icon: ZoomIn },
  { id: "stamp", Icon: Smile }, { id: "eyedropper", Icon: Pipette },
] as const;

export const EDITOR_W = 1200;
export const EDITOR_H = 720;
export const CANVAS_SCALE = 0.98;
/** Offset of the FakePage's top-left inside the editor window (for overlay placement). */
export const CANVAS_ORIGIN = { x: (EDITOR_W - 960 * CANVAS_SCALE) / 2, y: 44 + 58 + 14 };

export const EditorMock: React.FC<{
  active?: string; children?: React.ReactNode; blur?: number; x?: number; y?: number; bgStyle?: React.CSSProperties; pageStyle?: React.CSSProperties; title?: string; style?: React.CSSProperties; hideBar?: boolean; canvasOverlay?: React.ReactNode; toolbarOverlay?: React.ReactNode;
}> = ({ active = "select", children, blur = 0, x, y, bgStyle, pageStyle, title = "CaptureME – ตัวแก้ไข", style, hideBar, canvasOverlay, toolbarOverlay }) => (
  <MacWindow width={EDITOR_W} height={EDITOR_H} title={title} x={x} y={y} style={style}>
    {/* toolbar */}
    <div style={{ height: 58, display: "flex", alignItems: "center", gap: 4, padding: "0 14px", background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
      {TOOLS.map((t, i) =>
        "sep" in t ? <div key={i} style={{ width: 1, height: 28, background: "#e5e7eb", margin: "0 8px" }} /> : (
          <div key={t.id} style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: active === t.id ? C.red : "transparent", color: active === t.id ? "#fff" : "#475569", boxShadow: active === t.id ? "0 4px 10px rgba(220,38,38,.35)" : "none" }}>
            <t.Icon size={21} strokeWidth={2} />
          </div>
        ),
      )}
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", color: "#475569" }}>
        <Undo2 size={20} /><Redo2 size={20} />
        <div style={{ width: 1, height: 28, background: "#e5e7eb", margin: "0 8px" }} />
        <Sparkles size={20} /><ScanText size={20} /><Pin size={20} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, padding: "9px 14px", borderRadius: 10, background: "#f1f5f9", fontSize: 15, fontWeight: 600, fontFamily: FONT }}><Copy size={16} /> คัดลอก</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, background: C.ink, color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: FONT }}><Save size={16} /> บันทึก</div>
      </div>
    </div>
    {/* canvas */}
    <div style={{ position: "absolute", top: 58, left: 0, right: 0, bottom: 0, background: "#e5e7eb", backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "18px 18px", ...bgStyle }}>
      <div style={{ position: "absolute", left: (EDITOR_W - 960 * CANVAS_SCALE) / 2, top: 14, width: 960, height: 600, transform: `scale(${CANVAS_SCALE})`, transformOrigin: "0 0", boxShadow: "0 10px 30px rgba(15,23,42,.25)", ...pageStyle }}>
        <FakePage blur={blur} />
        {/* overlay coordinate system = FakePage space */}
        <div style={{ position: "absolute", inset: 0 }}>{children}</div>
      </div>
      {canvasOverlay}
    </div>
    {toolbarOverlay}
  </MacWindow>
);
