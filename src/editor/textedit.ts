import { st, touch, setSelection, kscale } from "./state";
import { commit } from "./history";
import { textLayout, FONT_FAMILY, LINE_H } from "./geom";
import { toScreen } from "./viewport";
import { contrastColor } from "./props";
import type { TextObj } from "./types";

let host: HTMLElement;
let ta: HTMLTextAreaElement | null = null;
let cur: TextObj | null = null;

export function initTextEdit(container: HTMLElement) { host = container; }
export const isEditing = () => !!ta;

function layout() {
  if (!ta || !cur) return;
  const k = kscale(), s = cur.s;
  const l = textLayout(cur, ta.value);
  const p = toScreen({ x: cur.x, y: cur.y });
  const st_ = ta.style;
  st_.left = `${p.x}px`; st_.top = `${p.y}px`;
  st_.font = `${s.bold ? 700 : 400} ${s.fontSize * k}px ${FONT_FAMILY}`;
  st_.lineHeight = `${s.fontSize * LINE_H * k}px`;
  st_.padding = `${l.pad * k}px`;
  st_.width = `${l.w * k + 8}px`;
  st_.height = `${l.h * k}px`;
  st_.color = s.textBg ? contrastColor(s.color) : s.color;
  st_.background = s.textBg ? s.color : "transparent";
  st_.borderRadius = s.textBg ? `${s.fontSize * 0.3 * k}px` : "2px";
  st_.caretColor = s.textBg ? contrastColor(s.color) : s.color;
}
export function repositionEdit() { layout(); }

export function beginEdit(o: TextObj) {
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
  ta.addEventListener("input", () => { if (cur && ta) { cur.text = ta.value; layout(); } });
  ta.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.isComposing) return;
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
