import React from "react";

/** Renders ⌃⌥⇧⌘ glyphs in a font that has proper-size symbols (IBM Plex Sans Thai has none). */
export const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/([⌃⌥⇧⌘]+[A-Za-z0-9]?)/).map((part, i) =>
      /^[⌃⌥⇧⌘]/.test(part) ? <span key={i} style={{ fontFamily: "'Helvetica Neue', 'Lucida Grande', sans-serif", fontWeight: 500 }}>{part}</span> : <React.Fragment key={i}>{part}</React.Fragment>,
    )}
  </>
);

export const KeyCap: React.FC<{ k: string; size?: number; dark?: boolean; style?: React.CSSProperties }> = ({ k, size = 28, dark, style }) => (
  <span
    style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: size * 1.35, height: size * 1.35, padding: `0 ${size * 0.3}px`,
      borderRadius: size * 0.32, fontFamily: "'Helvetica Neue', 'Lucida Grande', sans-serif", fontWeight: 500, fontSize: size, lineHeight: 1,
      color: dark ? "#fff" : "#0f172a",
      background: dark ? "linear-gradient(#475569,#334155)" : "linear-gradient(#ffffff,#eef2f7)",
      boxShadow: dark
        ? `0 ${size * 0.1}px 0 #0f172a, inset 0 1px 0 rgba(255,255,255,.25)`
        : `0 ${size * 0.1}px 0 #b6c0cf, inset 0 1px 0 #fff, 0 ${size * 0.15}px ${size * 0.3}px rgba(15,23,42,.18)`,
      ...style,
    }}
  >
    {k}
  </span>
);

export const KeyCombo: React.FC<{ keys: string[]; size?: number; dark?: boolean; gap?: number }> = ({ keys, size = 28, dark, gap }) => (
  <span style={{ display: "inline-flex", gap: gap ?? size * 0.28, alignItems: "center" }}>
    {keys.map((k, i) => <KeyCap key={i} k={k} size={size} dark={dark} />)}
  </span>
);
