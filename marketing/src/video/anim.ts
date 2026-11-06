import { Easing, interpolate } from "remotion";

export const FPS = 30;
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** 0→1 progress of t between a and b (seconds), eased. */
export const seg = (t: number, a: number, b: number, e: (x: number) => number = easeInOut) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

/** 1 between a..b with fades of `f` seconds on both ends. */
export const window01 = (t: number, a: number, b: number, f = 0.35) => Math.min(seg(t, a, a + f), 1 - seg(t, b - f, b));

export type CursorPt = { t: number; x: number; y: number; click?: boolean; hold?: number };

/** Cursor position along a list of waypoints (arrival times in seconds); also click press / ripple values. */
export const cursorAt = (t: number, pts: CursorPt[]) => {
  let x = pts[0].x, y = pts[0].y;
  let press = 0, ripple = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const hold = p.hold ?? (p.click ? 0.3 : 0.05);
    if (i > 0) {
      const prev = pts[i - 1];
      const start = prev.t + (prev.hold ?? (prev.click ? 0.3 : 0.05));
      if (t >= start && t <= p.t) {
        const k = easeInOut((t - start) / Math.max(0.001, p.t - start));
        x = lerp(prev.x, p.x, k); y = lerp(prev.y, p.y, k);
      }
      if (t > p.t) { x = p.x; y = p.y; }
    }
    if (p.click) {
      const dt = t - p.t;
      if (dt >= 0 && dt < 0.12) press = dt / 0.12;
      else if (dt >= 0.12 && dt < 0.3) press = 1 - (dt - 0.12) / 0.18;
      if (dt >= 0 && dt < 0.7) ripple = Math.max(ripple, dt / 0.7);
    }
    void hold;
  }
  return { x, y, press, ripple };
};

export const typed = (text: string, t: number, start: number, cps = 9) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((t - start) * cps)));
  return Array.from(text).slice(0, n).join("");
};

/** Typed text split by grapheme-ish (Thai combining marks stay attached to the previous char). */
export const typedThai = (text: string, t: number, start: number, cps = 9) => {
  const chars: string[] = [];
  for (const ch of Array.from(text)) {
    if (/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(ch) && chars.length) chars[chars.length - 1] += ch;
    else chars.push(ch);
  }
  const n = Math.max(0, Math.min(chars.length, Math.floor((t - start) * cps)));
  return chars.slice(0, n).join("");
};
