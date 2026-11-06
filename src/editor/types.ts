export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export type ObjType =
  | "arrow" | "line" | "rect" | "ellipse" | "pen" | "highlighter" | "text"
  | "step" | "blur" | "pixelate" | "spotlight" | "magnify" | "stamp";
export type ToolId = "select" | "crop" | "eyedropper" | ObjType;

export type ArrowStyle = "straight" | "curved" | "double" | "tapered";
export type StepStyle = "filled" | "circled" | "glyph";

/** Style properties. Each object carries a full copy (`s`); only the relevant keys are used. */
export interface Props {
  color: string;
  width: number;
  opacity: number;
  fill: "none" | "solid";
  radius: number;
  arrowStyle: ArrowStyle;
  fontSize: number;
  bold: boolean;
  textBg: boolean;
  shadow: boolean;
  stepStyle: StepStyle;
  strength: number;
  dim: number;
  zoom: number;
  emoji: string;
}
export type PropKey = keyof Props;

interface Base { id: string; s: Props }
export interface ArrowObj extends Base { type: "arrow"; a: Pt; b: Pt; cp: Pt }
export interface LineObj extends Base { type: "line"; a: Pt; b: Pt }
export interface BoxObj extends Base {
  type: "rect" | "ellipse" | "blur" | "pixelate" | "spotlight" | "magnify";
  x: number; y: number; w: number; h: number;
}
export interface PenObj extends Base { type: "pen" | "highlighter"; pts: Pt[] }
export interface TextObj extends Base { type: "text"; x: number; y: number; text: string }
export interface StepObj extends Base { type: "step"; x: number; y: number; n: number }
export interface StampObj extends Base { type: "stamp"; x: number; y: number; size: number }
export type Obj = ArrowObj | LineObj | BoxObj | PenObj | TextObj | StepObj | StampObj;

export interface Bg {
  enabled: boolean;
  padding: number;
  mode: "gradient" | "solid";
  gradient: number;
  color: string;
  radius: number;
  shadow: boolean;
}

/** Pointer event in editor space. */
export interface PEvt {
  p: Pt; // image coordinates
  sx: number; sy: number; // stage css coordinates
  shift: boolean; alt: boolean; meta: boolean;
  detail: number;
  button: number;
}

export interface Tool {
  id: ToolId;
  cursor?: string;
  activate?(): void;
  deactivate?(): void;
  down(e: PEvt): void;
  move(e: PEvt): void;
  up(e: PEvt): void;
  hover?(e: PEvt): string | void;
  dblclick?(e: PEvt): void;
  overlay?(ctx: CanvasRenderingContext2D, dpr: number): void;
}
