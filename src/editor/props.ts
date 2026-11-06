import type { ObjType, Props, PropKey } from "./types";

const base: Props = {
  color: "#ef4444", width: 6, opacity: 1, fill: "none", radius: 0, arrowStyle: "straight",
  fontSize: 36, bold: true, textBg: false, shadow: false, stepStyle: "filled",
  strength: 14, dim: 0.55, zoom: 2, emoji: "👍",
  markStyle: "underline", measureStyle: "ruler", spotMode: "dim", leader: false,
};

export const DEFAULTS: Record<ObjType, Props> = {
  arrow: { ...base },
  line: { ...base },
  rect: { ...base },
  ellipse: { ...base },
  pen: { ...base },
  highlighter: { ...base, color: "#facc15", width: 28, opacity: 0.75 },
  text: { ...base, fontSize: 40 },
  step: { ...base, fontSize: 32 },
  blur: { ...base, strength: 16 },
  pixelate: { ...base, strength: 12 },
  spotlight: { ...base, dim: 0.6 },
  magnify: { ...base, color: "#ffffff", width: 5, shadow: true },
  stamp: { ...base, fontSize: 48 },
  callout: { ...base, color: "#facc15", fontSize: 30, bold: false, radius: 16 },
  /** Solid, irreversible redaction. */
  redact: { ...base, color: "#000000", radius: 0 },
  marker: { ...base, color: "#facc15", opacity: 0.6, radius: 4 },
  underline: { ...base, width: 5, markStyle: "underline" },
  measure: { ...base, color: "#f97316", width: 3, fontSize: 22, measureStyle: "ruler" },
  image: { ...base, opacity: 1, radius: 0 },
};

export const PROP_KEYS: Record<ObjType, PropKey[]> = {
  arrow: ["color", "width", "opacity", "arrowStyle", "shadow"],
  line: ["color", "width", "opacity", "shadow"],
  rect: ["color", "width", "opacity", "fill", "radius", "shadow"],
  ellipse: ["color", "width", "opacity", "fill", "shadow"],
  pen: ["color", "width", "opacity", "shadow"],
  highlighter: ["color", "width", "opacity"],
  text: ["color", "fontSize", "bold", "textBg", "opacity", "shadow"],
  step: ["color", "fontSize", "stepStyle", "opacity", "shadow"],
  blur: ["strength"],
  pixelate: ["strength"],
  spotlight: ["spotMode", "dim", "strength", "radius"],
  magnify: ["color", "width", "zoom", "leader", "shadow"],
  stamp: ["emoji", "fontSize", "opacity", "shadow"],
  callout: ["color", "fontSize", "bold", "radius", "opacity", "shadow"],
  redact: ["color", "radius"],
  marker: ["color", "opacity", "radius"],
  underline: ["color", "markStyle", "width", "opacity"],
  measure: ["color", "measureStyle", "width", "fontSize", "opacity"],
  image: ["opacity", "radius", "shadow"],
};

const LS = "captureme.editor.props.v2";
export const toolProps = {} as Record<ObjType, Props>;
(Object.keys(DEFAULTS) as ObjType[]).forEach((t) => (toolProps[t] = { ...DEFAULTS[t] }));
try {
  const saved = JSON.parse(localStorage.getItem(LS) || localStorage.getItem("captureme.editor.props.v1") || "{}");
  for (const t of Object.keys(DEFAULTS) as ObjType[]) if (saved[t]) toolProps[t] = { ...DEFAULTS[t], ...saved[t] };
} catch { /* ignore */ }

export function saveToolProps() {
  try { localStorage.setItem(LS, JSON.stringify(toolProps)); } catch { /* ignore */ }
}

export const PALETTE = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff", "#111111"];
export const EMOJIS = ["👍", "👎", "✅", "❌", "⚠️", "❓", "❗", "⭐", "❤️", "🔥", "💡", "👀", "🎉", "📌", "🚫", "➡️"];

export function contrastColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111111" : "#ffffff";
}
