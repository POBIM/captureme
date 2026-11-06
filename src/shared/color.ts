// Colour formatting shared by the colour picker overlay and the recent-colours panel.
// Mirrors src-tauri/src/colors.rs.
export type ColorFormat = "hex" | "rgb" | "hsl";

export function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function toRgbText(r: number, g: number, b: number): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function toHslText(r0: number, g0: number, b0: number): string {
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d > 1e-9) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = (((g - b) / d) % 6 + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `hsl(${Math.round(h) % 360}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

export function formatColor(r: number, g: number, b: number, fmt: ColorFormat): string {
  return fmt === "rgb" ? toRgbText(r, g, b) : fmt === "hsl" ? toHslText(r, g, b) : toHex(r, g, b);
}

export const FORMATS: ColorFormat[] = ["hex", "rgb", "hsl"];
