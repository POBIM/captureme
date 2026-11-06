// Renders the marketing material from the REAL captures in ../docs/images:
//   node scripts/render-all.mjs [posters] [cards] [video] [short]      (default: everything)
// posters → out/poster-a3.png + .pdf, poster-square.png, poster-wide.png
// cards   → out/cards/NN-<tool>.png (1080x1350) + install-steps + download card
// video   → out/captureme-tutorial.mp4 (1080p30)   short → out/captureme-short-9x16.mp4
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, renameSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { bundle } from "@remotion/bundler";
import { renderStill, renderMedia, selectComposition } from "@remotion/renderer";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");
const docsImages = resolve(root, "..", "docs", "images");
mkdirSync(join(out, "cards"), { recursive: true });
const want = process.argv.slice(2);
const on = (n) => want.length === 0 || want.includes(n);
const have = (cmd) => { try { execFileSync("which", [cmd], { stdio: "ignore" }); return true; } catch { return false; } };
const mb = (f) => (statSync(f).size / 1024 / 1024).toFixed(2) + " MB";

execFileSync("node", ["scripts/gen-qr.mjs"], { cwd: root, stdio: "inherit" });
const serveUrl = await bundle({ entryPoint: join(root, "src/index.ts"), publicDir: docsImages, webpackOverride: (c) => c });
const still = async (id, file, { scale = 1, props, quant = false } = {}) => {
  const comp = await selectComposition({ serveUrl, id, inputProps: props ?? {} });
  await renderStill({ composition: comp, serveUrl, output: file, inputProps: props ?? {}, scale, imageFormat: "png" });
  // social images: 256-colour palette (pngquant, if installed) is visually identical and ~3x smaller
  if (quant && have("pngquant")) { try { execFileSync("pngquant", ["--quality=85-98", "--speed", "1", "--strip", "--force", "--output", file, file]); } catch { /* keep the original */ } }
  console.log(file.replace(root + "/", "").padEnd(44), mb(file));
};

if (on("posters")) {
  await still("PosterA3", join(out, "poster-a3.png"), { scale: 2 }); //  1754x2480 -> 3508x4960 (A3 @ 300 dpi)
  await still("PosterSquare", join(out, "poster-square.png"), { scale: 2, quant: true });
  await still("PosterWide", join(out, "poster-wide.png"), { scale: 2, quant: true });
  // vector PDF: static HTML printed by the headless Chrome that Remotion downloaded
  const tmp = join(out, ".pdf-build");
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  await build({ entryPoints: [join(root, "src/poster-static.tsx")], bundle: true, outdir: tmp, format: "iife", platform: "browser", jsx: "automatic", loader: { ".woff2": "dataurl" }, define: { "process.env.NODE_ENV": '"production"', DOCS_IMAGES: JSON.stringify(docsImages) }, logLevel: "error" });
  const js = readFileSync(join(tmp, "poster-static.js"), "utf8");
  const g = { process: { env: { NODE_ENV: "production" } } };
  const html = new Function("globalThis", "window", "self", `${js}; return globalThis.__POSTER_HTML__;`)(g, g, g);
  if (!html) throw new Error("static poster markup is empty");
  const css = readFileSync(join(tmp, "poster-static.css"), "utf8");
  writeFileSync(join(tmp, "poster.html"), `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 297mm 420mm; margin: 0 }
html,body { margin:0; padding:0; background:#e6ecf6; -webkit-print-color-adjust: exact; print-color-adjust: exact }
${css}</style></head><body>${html}</body></html>`);
  const find = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? find(join(d, e.name)) : e.name === "chrome-headless-shell" ? [join(d, e.name)] : []));
  const chrome = find(join(root, "node_modules/.remotion/chrome-headless-shell"))[0];
  execFileSync(chrome, ["--no-sandbox", "--disable-gpu", "--allow-file-access-from-files", "--no-pdf-header-footer", "--virtual-time-budget=8000", "--run-all-compositor-stages-before-draw", "--print-to-pdf=" + join(out, "poster-a3.pdf"), pathToFileURL(join(tmp, "poster.html")).href], { stdio: "ignore" });
  rmSync(tmp, { recursive: true, force: true });
  console.log("out/poster-a3.pdf".padEnd(44), mb(join(out, "poster-a3.pdf")));
}

if (on("cards")) {
  const ids = ["capture-region", "capture-window", "capture-presets", "thumbnail", "editor", "arrow", "steps", "redact", "spotlight", "magnify", "background", "ocr", "qr", "color", "ruler", "pin", "scroll", "record", "video", "history", "privacy"];
  for (const f of readdirSync(join(out, "cards"))) rmSync(join(out, "cards", f));
  for (let i = 0; i < ids.length; i++) await still("Card", join(out, "cards", `${String(i + 1).padStart(2, "0")}-${ids[i]}.png`), { props: { i }, quant: true });
  await still("InstallCard", join(out, "cards", `${String(ids.length + 1).padStart(2, "0")}-install-steps.png`), { quant: true });
  await still("DownloadCard", join(out, "cards", `${String(ids.length + 2).padStart(2, "0")}-download.png`), { quant: true });
}

const video = async (id, file, crf) => {
  const comp = await selectComposition({ serveUrl, id });
  const raw = file.replace(/\.mp4$/, ".raw.mp4");
  await renderMedia({ composition: comp, serveUrl, codec: "h264", crf: 20, outputLocation: raw, imageFormat: "jpeg", jpegQuality: 92, pixelFormat: "yuv420p", muted: true, concurrency: 4, onProgress: ({ progress }) => process.stdout.write(`\r${id} ${(progress * 100).toFixed(0)}%   `) });
  // the pictures are static, so a slower / smaller second pass keeps the files repo-friendly (tutorial ≈ 20 MB)
  if (have("ffmpeg")) { execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", raw, "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-tune", "stillimage", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", file]); rmSync(raw); }
  else renameSync(raw, file);
  console.log("\n" + file.replace(root + "/", "").padEnd(44), mb(file));
};
if (on("video")) await video("Tutorial", join(out, "captureme-tutorial.mp4"), 28);
if (on("short")) await video("Short", join(out, "captureme-short-9x16.mp4"), 28);
