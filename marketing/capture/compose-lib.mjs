// Tiny compositor: real window screenshots on a clean wallpaper + decorative callouts, rendered by headless Chrome.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, "..", "..");
export const RAW = join(here, "raw");
export const WORK = join(here, "work");
const CHROME = resolve(here, "..", "node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell");
const FONTS = resolve(here, "..", "src/fonts");

export const WALL = "radial-gradient(1200px 800px at 15% 10%,#e9eef7 0,transparent 60%),radial-gradient(1000px 700px at 90% 95%,#e8e4f2 0,transparent 55%),linear-gradient(160deg,#dfe6f1,#d4dbe8)";
export const RED = "#dc2626";

const css = `
@font-face{font-family:"Plex";font-weight:400;src:url(file://${FONTS}/ibm-plex-sans-thai-thai-400-normal.woff2)}
@font-face{font-family:"Plex";font-weight:600;src:url(file://${FONTS}/ibm-plex-sans-thai-thai-600-normal.woff2)}
@font-face{font-family:"Plex";font-weight:700;src:url(file://${FONTS}/ibm-plex-sans-thai-thai-700-normal.woff2)}
@font-face{font-family:"Plex";font-weight:400;unicode-range:U+0000-00FF,U+2000-206F,U+20A0-20CF,U+2190-21FF;src:url(file://${FONTS}/ibm-plex-sans-thai-latin-400-normal.woff2)}
@font-face{font-family:"Plex";font-weight:600;unicode-range:U+0000-00FF,U+2000-206F,U+20A0-20CF,U+2190-21FF;src:url(file://${FONTS}/ibm-plex-sans-thai-latin-600-normal.woff2)}
@font-face{font-family:"Plex";font-weight:700;unicode-range:U+0000-00FF,U+2000-206F,U+20A0-20CF,U+2190-21FF;src:url(file://${FONTS}/ibm-plex-sans-thai-latin-700-normal.woff2)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Plex","Thonburi",sans-serif;overflow:hidden}
.abs{position:absolute}
.badge{position:absolute;width:44px;height:44px;border-radius:50%;background:${RED};color:#fff;font-weight:700;font-size:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px #fff,0 4px 14px rgba(0,0,0,.35)}
.box{position:absolute;border:4px solid ${RED};border-radius:10px;box-shadow:0 0 0 2px rgba(255,255,255,.85)}
.label{position:absolute;background:#111827;color:#fff;font-weight:600;font-size:26px;line-height:1.25;padding:9px 16px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.35);white-space:nowrap}
.label.red{background:${RED}}
.label.light{background:#fff;color:#111827}
svg.arrow{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
`;

/** Placement helper: returns {f, map}. */
export function fit(srcW, srcH, w) {
  const f = w / srcW;
  return { f, w, h: srcH * f, map: (x, y) => [x * f, y * f] };
}

export function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

/** items: array of html strings; canvas [w,h]; bg css background (or null for transparent). */
export async function render({ out, size, bg = WALL, items, dsf = 1 }) {
  const [W, H] = size;
  const html = `<!doctype html><meta charset=utf-8><style>${css}html,body{width:${W}px;height:${H}px}</style><body style="background:${bg ?? "transparent"};position:relative">${items.join("")}</body>`;
  const f = join("/tmp", "cm-compose-" + process.pid + ".html");
  writeFileSync(f, html);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync(CHROME, ["--headless", "--no-sandbox", "--hide-scrollbars", "--allow-file-access-from-files", `--force-device-scale-factor=${dsf}`, `--window-size=${W},${H}`, "--virtual-time-budget=4000", `--screenshot=${out}`, "file://" + f], { stdio: "ignore" });
}

export const img = (src, x, y, w, { shadow = true, radius = 0, h } = {}) =>
  `<img class="abs" src="file://${src}" style="left:${x}px;top:${y}px;width:${w}px;${h ? `height:${h}px;` : ""}${radius ? `border-radius:${radius}px;` : ""}${shadow ? "filter:drop-shadow(0 22px 38px rgba(30,41,59,.38)) drop-shadow(0 4px 10px rgba(30,41,59,.25));" : ""}">`;
export const badge = (n, x, y) => `<div class="badge" style="left:${x - 22}px;top:${y - 22}px">${n}</div>`;
export const box = (x, y, w, h, c = RED) => `<div class="box" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-color:${c}"></div>`;
export const label = (text, x, y, cls = "", size = 26) => `<div class="label ${cls}" style="left:${x}px;top:${y}px;font-size:${size}px">${esc(text).replace(/\n/g, "<br>")}</div>`;
export const arrow = (x1, y1, x2, y2, c = RED, wdt = 6) => {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 22;
  const p = (ang) => `${x2 - L * Math.cos(a + ang)},${y2 - L * Math.sin(a + ang)}`;
  return `<svg class="arrow" width="1" height="1"><line x1="${x1}" y1="${y1}" x2="${x2 - 10 * Math.cos(a)}" y2="${y2 - 10 * Math.sin(a)}" stroke="#fff" stroke-width="${wdt + 5}" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2 - 10 * Math.cos(a)}" y2="${y2 - 10 * Math.sin(a)}" stroke="${c}" stroke-width="${wdt}" stroke-linecap="round"/><polygon points="${x2},${y2} ${p(0.45)} ${p(-0.45)}" fill="${c}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>`;
};
export const text = (t, x, y, size, color = "#111827", weight = 700, extra = "") => `<div class="abs" style="left:${x}px;top:${y}px;font-size:${size}px;font-weight:${weight};color:${color};${extra}">${esc(t).replace(/\n/g, "<br>")}</div>`;

export function rawInfo(lang, name) {
  const f = join(RAW, lang, name + ".json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}
export const rawPath = (lang, name) => join(RAW, lang, name + ".png");
