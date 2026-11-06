import { st, touch, setSelection, kscale } from "./state";
import { commit } from "./history";
import { textLayout, FONT_FAMILY, LINE_H } from "./geom";
import { toScreen } from "./viewport";
import { contrastColor } from "./props";
import type { TextObj, CalloutObj } from "./types";

let host: HTMLElement;
let ta: HTMLTextAreaElement | null = null;
let cur: TextObj | CalloutObj | null = null;

export function initTextEdit(container: HTMLElement) { host = container; }
export const isEditing = () => !!ta;

function layout() {
  if (!ta || !cur) return;
  const k = kscale(), s = cur.s;
  const callout = cur.type === "callout";
  const l = textLayout(cur, ta.value);
  const p = toScreen({ x: cur.x, y: cur.y });
  const st_ = ta.style;
  st_.left = `${p.x}px`; st_.top = `${p.y}px`;
  st_.font = `${s.bold ? 700 : 400} ${s.fontSize * k}px ${FONT_FAMILY}`;
  st_.lineHeight = `${s.fontSize * LINE_H * k}px`;
  st_.padding = `${l.pad * k}px`;
  st_.width = `${l.w * k + 8}px`;
  st_.height = `${l.h * k}px`;
  const fg = callout ? contrastColor(s.color) : s.textBg ? contrastColor(s.color) : s.color;
  st_.color = fg;
  st_.background = !callout && s.textBg ? s.color : "transparent";
  st_.borderRadius = !callout && s.textBg ? `${s.fontSize * 0.3 * k}px` : "2px";
  st_.caretColor = fg;
  // rotated objects: rotate the editor about the centre of the text body
  const rot = cur.rot ?? 0;
  st_.transformOrigin = `${(l.w * k) / 2}px ${(l.h * k) / 2}px`;
  st_.transform = rot ? `rotate(${rot}rad)` : "none";
}
export function repositionEdit() { layout(); }

export function beginEdit(o: TextObj | CalloutObj) {
  if (ta) endEdit();
  cur = o;
  st.editingId = o.id;
  setSelection([o.id]);
  ta = document.createElement("textarea");
  ta.className = "text-edit";
  ta.value = o.text;
  ta.spellcheck = false;
  ta.wrap = "off";
  host.appendChild(ta);
  layout();
  const sync = () => { if (cur && ta) { cur.text = ta.value; layout(); if (cur.type === "callout") touch(); } };
  ta.addEventListener("input", sync);
  ta.addEventListener("compositionupdate", sync); // Thai / CJK IME: keep the box in step while composing
  ta.addEventListener("compositionend", sync);
  ta.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.isComposing || e.keyCode === 229) return; // never treat IME keystrokes as shortcuts
    if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); endEdit(); }
  });
  ta.addEventListener("blur", () => endEdit());
  touch();
  ta.focus(); ta.select();
  requestAnimationFrame(() => { if (ta && document.activeElement !== ta) { ta.focus(); ta.select(); } });
}

export function endEdit() {
  if (!ta || !cur) return;
  const o = cur, t = ta;
  ta = null; cur = null;
  const value = t.value;
  t.remove();
  st.editingId = null;
  if (value.trim() === "") {
    st.objects = st.objects.filter((x) => x.id !== o.id);
    setSelection([]);
  } else {
    o.text = value;
    setSelection([o.id]);
  }
  touch();
  commit();
}
