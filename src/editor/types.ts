export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export type ObjType =
  | "arrow" | "line" | "rect" | "ellipse" | "pen" | "highlighter" | "text"
  | "step" | "blur" | "pixelate" | "spotlight" | "magnify" | "stamp"
  | "callout" | "redact" | "marker" | "underline" | "measure" | "image";
/** Object types that have a drawing tool (everything except pasted images). */
export type ToolObjType = Exclude<ObjType, "image">;
export type ToolId = "select" | "crop" | "eyedropper" | ToolObjType;

export type ArrowStyle = "straight" | "curved" | "double" | "tapered";
export type StepStyle = "filled" | "circled" | "glyph";
export type MarkStyle = "underline" | "strike" | "squiggle";
export type MeasureStyle = "ruler" | "dimension";
export type SpotMode = "dim" | "blur";

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
  markStyle: MarkStyle;
  measureStyle: MeasureStyle;
  spotMode: SpotMode;
  /** Magnifier: show the source area + leader lines to the lens. */
  leader: boolean;
}
export type PropKey = keyof Props;

/** `rot` (radians, about the body centre), `locked` and `gid` (group id) apply to every object. */
interface Base { id: string; s: Props; rot?: number; locked?: boolean; gid?: string }
export interface ArrowObj extends Base { type: "arrow"; a: Pt; b: Pt; cp: Pt }
export interface LineObj extends Base { type: "line" | "measure"; a: Pt; b: Pt }
export interface BoxObj extends Base {
  type: "rect" | "ellipse" | "blur" | "pixelate" | "spotlight" | "magnify" | "redact" | "marker" | "underline";
  x: number; y: number; w: number; h: number;
  /** magnify only: centre of the magnified source area (enables leader lines). */
  sc?: Pt;
}
/** Speech bubble. `tail` is the pointer tip in the object's local (unrotated) frame. */
export interface CalloutObj extends Base { type: "callout"; x: number; y: number; text: string; tail: Pt }
/** Pasted / dropped bitmap. `key` indexes the image registry (images.ts). */
export interface ImageObj extends Base { type: "image"; x: number; y: number; w: number; h: number; key: string }
export interface PenObj extends Base { type: "pen" | "highlighter"; pts: Pt[] }
export interface TextObj extends Base { type: "text"; x: number; y: number; text: string }
export interface StepObj extends Base { type: "step"; x: number; y: number; n: number }
export interface StampObj extends Base { type: "stamp"; x: number; y: number; size: number }
export type Obj = ArrowObj | LineObj | BoxObj | PenObj | TextObj | StepObj | StampObj | CalloutObj | ImageObj;

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
