// Builds docs/images/<lang>/*.webp: REAL window captures (raw/<lang>/*.png) on a clean wallpaper + numbered callouts.
// usage: node docs-images.mjs th|en [filter]
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, img, badge, box, label, arrow, text, fit, rawInfo, rawPath, ROOT, WORK, WALL, RED } from "./compose-lib.mjs";

const lang = process.argv[2] || "th";
const only = process.argv[3];
const OUT = join(ROOT, "docs", "images", lang);
const TMP = join(WORK, "out", lang);
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
const L = (th, en) => (lang === "th" ? th : en);
const EXT = join(ROOT, "marketing", "capture", "ext"); // committed: public GitHub pages, the DMG window, privacy-cropped System Settings
const imgSize = (p) => { const o = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", p]).toString(); return [+/pixelWidth: (\d+)/.exec(o)[1], +/pixelHeight: (\d+)/.exec(o)[1]]; };

async function done(name, size, items, bg = WALL) {
  const png = join(TMP, name + ".png");
  await render({ out: png, size, bg, items });
  execFileSync("cwebp", ["-quiet", "-q", "90", "-m", "6", "-sharp_yuv", "-alpha_q", "100", png, "-o", join(OUT, name + ".webp")]);
  console.log(name, Math.round(statSync(join(OUT, name + ".webp")).size / 1024) + " KB");
}
const want = (n) => !only || n.includes(only);

/** A window screenshot on the wallpaper. build(ctx) returns extra items (callouts). */
async function win(name, src, { w = 1400, m = 80, raw = true, build = () => [], bgwall = true, shadow = true, srcPath, pb = 0, pt = 0 } = {}) {
  if (!want(name)) return;
  const p = srcPath ?? rawPath(lang, src);
  if (!existsSync(p)) { console.log("MISSING", p); return; }
  const info = raw ? rawInfo(lang, src) : null;
  const [sw, sh] = imgSize(p);
  const f = fit(sw, sh, w);
  const W = w + 2 * m, H = Math.round(f.h) + 2 * m + pb + pt;
  const ctx = {
    info, f: f.f, W, H, m,
    pos: (x, y) => [m + x * f.f, m + pt + y * f.f],
    rect: (r) => [m + r[0] * f.f, m + pt + r[1] * f.f, r[2] * f.f, r[3] * f.f],
    el: (pred) => info?.els?.find((e) => (typeof pred === "string" ? (e.a === pred || e.t.includes(pred)) : pred(e)))?.r,
    rr: (k) => info?.rects?.[k],
  };
  const items = [img(p, m, m + pt, w, { shadow })].concat(build(ctx));
  await done(name, [W, H], items, bgwall ? WALL : "transparent");
}

/** A full-screen overlay screenshot (16:10). */
async function full(name, src, { build = () => [] } = {}) {
  if (!want(name)) return;
  const p = rawPath(lang, src);
  if (!existsSync(p)) { console.log("MISSING", p); return; }
  const info = rawInfo(lang, src);
  const f = 1600 / 2880;
  const ctx = { info, f, pos: (x, y) => [x * f, y * f], rect: (r) => r.map((v) => v * f), rr: (k) => info?.rects?.[k] };
  await done(name, [1600, 1000], [img(p, 0, 0, 1600, { shadow: false })].concat(build(ctx)), "#222");
}

const rc = (ctx, r, c) => box(...ctx.rect(r), c);
const B = (ctx, n, r, dx = 0, dy = 0) => { const [x, y, w, h] = ctx.rect(r); return badge(n, x + dx, y + dy); };
const Bc = (ctx, n, r, dx = 0, dy = 0) => { const [x, y, w, h] = ctx.rect(r); return badge(n, x + w / 2 + dx, y + h / 2 + dy); };

// ============================================================================ INSTALL (real GitHub / Finder / System Settings)
await win("i01-github-repo", "x", { raw: false, w: 1300, m: 70, pb: 90, srcPath: join(EXT, "gh-repo.png"), build: (c) => {
  const f = c.f; const P = (x, y) => c.pos(x, y);
  return [box(...P(1046, 584), 292 * f, 80 * f), badge(1, ...P(1046, 584)),
    label(L("กด “Releases” ที่แถบขวา  (หรือเปิดลิงก์ …/releases/latest)", "Click “Releases” on the right  (or open …/releases/latest)"), ...P(560, 1010), "red", 26)];
} });
await win("i02-github-release", "x", { raw: false, w: 1300, m: 70, pb: 40, srcPath: join(EXT, "gh-release-crop.png"), build: (c) => {
  const f = c.f; const P = (x, y) => c.pos(x, y);
  return [box(...P(128, 1007), 1182 * f, 42 * f), badge(1, ...P(112, 1028)),
    label(L("คลิกไฟล์ .dmg เพื่อดาวน์โหลด\n(7.95 MB · Apple Silicon + Intel)", "Click the .dmg file to download\n(7.95 MB · Apple Silicon + Intel)"), ...P(520, 1062), "red", 26)];
} });
await win("i03-dmg-window", "x", { raw: false, w: 1100, m: 100, pb: 40, srcPath: join(EXT, "install-dmg.png"), build: (c) => {
  const f = c.f; const P = (x, y) => c.pos(x, y);
  return [badge(1, ...P(180, 190)), badge(2, ...P(478, 190)),
    label(L("① ลาก CaptureME  →  ② ไปวางที่ Applications", "① Drag CaptureME  →  ② drop it on Applications"), ...P(20, 410), "red", 28)];
} });
await win("i04-open-anyway", "x", { raw: false, w: 1080, m: 90, pb: 150, srcPath: join(EXT, "sys-security.png"), build: (c) => {
  const f = c.f; const P = (x, y) => c.pos(x, y);
  return [box(...P(8, 62), 524 * f, 30 * f, "#f59e0b"),
    label(L("ตั้งค่าระบบ › ความเป็นส่วนตัวและความปลอดภัย › ความปลอดภัย (ภาพจริงจากเครื่อง)\nหลังเปิดแอปครั้งแรกไม่ผ่าน จะมีแถว “CaptureME ถูกบล็อก” + ปุ่ม “ให้เปิดต่อไป” (Open Anyway) โผล่ตรงนี้", "System Settings › Privacy & Security › Security (real screenshot of this Mac)\nAfter the first blocked launch, a row “CaptureME was blocked” + an Open Anyway button appears here"), ...P(0, 125), "", 22)];
} });
await win("i05-screen-recording", "x", { raw: false, w: 1080, m: 90, pb: 90, srcPath: join(EXT, "sys-screen-recording.png"), build: (c) => {
  const f = c.f; const P = (x, y) => c.pos(x, y);
  return [box(...P(10, 112), 520 * f, 42 * f), badge(1, ...P(500, 133)),
    label(L("เปิดสวิตช์ CaptureME แล้วปิด-เปิดแอปใหม่\n(รายการแอปอื่นถูกซ่อนไว้เพื่อความเป็นส่วนตัว)", "Turn CaptureME on, then quit and reopen the app\n(other apps in the list are hidden for privacy)"), ...P(0, 180), "red", 22)];
} });
await win("i06-onboarding", "onboarding", { w: 760, m: 80, build: (c) => {
  const b = c.el("ob.perm.request") || c.el((e) => e.a === "reqBtn") || c.el("ขออนุญาต") || c.el("Request");
  const open = c.el((e) => e.a === "openBtn");
  const out = [];
  if (b) out.push(rc(c, b), B(c, 1, b, -26, 0));
  if (open) out.push(B(c, 2, open, -20, 0));
  return out;
} });
await win("i07-menu-bar-menu", "tray-menu", { w: 460, m: 60, pt: 110, shadow: false, build: (c) => [
  label(L("คลิกไอคอน CaptureME บนแถบเมนูด้านบนของจอ\nแล้วเลือกคำสั่ง (ภาพจริงของเมนูแอป)", "Click the CaptureME icon in the menu bar\nand pick a command (the app's real menu)"), 20, 24, "", 24)] });

// ============================================================================ CAPTURE
await full("u01-capture-region", "capture-region", { build: (c) => {
  const t = c.rr("toolbar"), s = c.rr("size"), p = c.rr("presets");
  const out = [];
  if (s) out.push(B(c, 1, s, -26, 8));
  const sel = c.rr("sel");
  if (sel) out.push(B(c, 2, sel, 70, 70));
  if (t) out.push(rc(c, t), B(c, 3, t, -20, 0));
  if (p) out.push(B(c, 4, p, -26, 0));
  return out;
} });
await full("u02-capture-loupe", "capture-drag", { build: (c) => {
  const l = c.rr("loupe"), s = c.rr("size");
  const out = [];
  if (l) out.push(rc(c, l), B(c, 1, l, -4, -4));
  if (s) out.push(B(c, 2, s, -26, 8));
  return out;
} });
await full("u03-capture-presets", "capture-preset", { build: (c) => { const p = c.rr("presets"); return p ? [rc(c, p), B(c, 1, p, -26, 0)] : []; } });
await full("u04-capture-window", "capture-window", { build: (c) => { const h = c.rr("hl"), hint = c.rr("hint"); return [h && B(c, 1, h, 30, 30), hint && B(c, 2, hint, -26, 14)].filter(Boolean); } });
await win("u05-delay-countdown", "countdown", { w: 400, m: 140, shadow: false });
await win("u06-thumbnail", "thumbnail", { w: 760, m: 100, build: (c) => {
  const out = []; const names = [["edit", 1], ["copy", 2], ["save", 3], ["pin", 4], ["close", 5]];
  for (const [a, n] of names) { const r = c.el(a); if (r) out.push(Bc(c, n, r, 0, 56 * c.f * 0.5 + 24)); }
  return out;
} });
await full("u07-overlay-scroll", "overlay-scroll", { build: (c) => { const t = c.rr("toolbar"); return t ? [rc(c, t), B(c, 1, t, -20, 0)] : []; } });
await full("u08-overlay-record", "overlay-record", { build: (c) => { const t = c.rr("toolbar"); return t ? [rc(c, t), B(c, 1, t, -20, 0)] : []; } });
await full("u09-overlay-ocr", "overlay-ocr", { build: (c) => { const t = c.rr("toolbar"); return t ? [rc(c, t), B(c, 1, t, -20, 0)] : []; } });
await full("u10-overlay-pin", "overlay-pin", { build: (c) => { const t = c.rr("toolbar"); return t ? [rc(c, t), B(c, 1, t, -20, 0)] : []; } });
await full("u11-overlay-qr", "overlay-qr", { build: (c) => { const t = c.rr("toolbar"); return t ? [rc(c, t), B(c, 1, t, -20, 0)] : []; } });
await full("u12-overlay-color", "overlay-color", { build: (c) => { const l = c.rr("loupe"); return l ? [rc(c, l), B(c, 1, l, -4, -4)] : []; } });
await full("u13-overlay-measure", "overlay-measure");

// ============================================================================ RESULT WINDOWS
await win("t01-pin", "pin-window", { w: 900, m: 90 });
await win("t02-ocr-result", "ocr-result", { w: 780, m: 90, build: (c) => { const b = c.el("copy") || c.el("คัดลอกข้อความ"); return b ? [rc(c, b), B(c, 1, b, -26, 0)] : []; } });
await win("t03-qr-result", "qr-result", { w: 780, m: 90 });
await win("t04-colors-panel", "colors-panel", { w: 460, m: 90 });
await win("t05-scroll-control", "scroll-control", { w: 480, m: 90 });
await win("t06-record-setup", "record-setup", { w: 1100, m: 80 });
await win("t07-record-bar", "record-bar", { w: 700, m: 90 });
await win("t08-video-window", "video-window", { w: 1400, m: 80 });
await win("t09-history", "history", { w: 1400, m: 80 });
for (const tab of ["general", "save", "recording", "hotkeys", "history", "about"]) await win(`s-${tab}`, `settings-${tab}`, { w: 900, m: 70 });

// ============================================================================ EDITOR
const TOOLS = ["select", "crop", "arrow", "line", "rect", "ellipse", "pen", "highlighter", "text", "step", "callout", "marker", "underline", "measure", "redact", "blur", "pixelate", "spotlight", "magnify", "stamp", "eyedropper"];
const edit = (name, src, { tool, act, labels = [], extra, w = 1500 } = {}) => win(name, src, { w, m: 70, build: (c) => {
  const out = [];
  if (tool) { const r = c.rr("tool_" + tool); if (r) out.push(rc(c, r), B(c, 1, r, -4, 52 * c.f)); }
  if (act) { const r = c.rr("act_" + act); if (r) out.push(rc(c, r), B(c, 1, r, -4, 52 * c.f)); }
  if (tool && c.rr("props")) { const [x, y, w2, h] = c.rect(c.rr("props")); out.push(badge(2, x + 14, y + h + 30)); }
  if (extra) out.push(...extra(c));
  return out;
} });
await win("e00-editor-overview", "editor-hero", { w: 1500, m: 70, build: (c) => {
  const t = c.rr("tool_arrow"), acts = c.rr("act_done"), pr = c.rr("props"), st = c.rr("stage");
  const out = [];
  if (t) out.push(B(c, 1, [c.rr("tool_select")[0], c.rr("tool_select")[1], 20, 20], 0, 74));
  if (pr) out.push(B(c, 2, pr, 12, 38));
  if (st) out.push(B(c, 3, st, 40, 70));
  if (acts) out.push(rc(c, acts), B(c, 4, acts, 0, 86));
  return out;
} });
await edit("e01-arrow", "editor-arrow", { tool: "arrow" });
await edit("e02-shapes", "editor-shapes", { tool: "rect" });
await edit("e03-pen", "editor-pen", { tool: "pen" });
await edit("e04-text", "editor-text", { tool: "text" });
await edit("e05-step", "editor-step", { tool: "step" });
await edit("e06-callout", "editor-callout", { tool: "callout" });
await edit("e07-redact", "editor-redact", { tool: "redact" });
await edit("e08-spotlight", "editor-spotlight", { tool: "spotlight" });
await edit("e09-magnify", "editor-magnify", { tool: "magnify" });
await edit("e10-measure", "editor-measure", { tool: "measure" });
await edit("e11-crop", "editor-crop", { tool: "crop" });
await edit("e12-background", "editor-background", { act: "bg" });
await edit("e13-watermark", "editor-watermark", { act: "wm" });
await edit("e14-padding", "editor-padding", { act: "pad" });
await edit("e15-resize", "editor-resize", { act: "resize" });
await edit("e16-transform", "editor-transform", { act: "tf" });
await edit("e17-arrange", "editor-arrange", {});
await edit("e18-export", "editor-export", { act: "export" });
await edit("e19-paste-image", "editor-paste", {});
await edit("e20-shortcuts", "editor-help", { act: "help" });

// ============================================================================ HERO (README / posters): several real windows on an empty desktop
async function hero(name, layers, size = [1800, 1000]) {
  if (!want(name)) return;
  const items = layers.map(([src, x, y, w]) => img(rawPath(lang, src), x, y, w));
  await done(name, size, items);
}
await hero("hero", [["editor-hero", 40, 60, 1230], ["ocr-result", 1160, 36, 560], ["colors-panel", 1480, 520, 250], ["thumbnail", 1130, 640, 360]]);
