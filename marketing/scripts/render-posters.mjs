// Renders the 4 poster deliverables into out/:  poster-a3.png, poster-a3.pdf, poster-square.png, poster-wide.png
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");
mkdirSync(out, { recursive: true });
const run = (args) => execFileSync("npx", ["remotion", ...args], { cwd: root, stdio: "inherit" });

execFileSync("node", ["scripts/gen-qr.mjs"], { cwd: root, stdio: "inherit" });

// --- PNGs (Remotion stills) -----------------------------------------------------------------
run(["still", "src/index.ts", "Poster", "out/poster-a3.png", "--scale=2"]); //       1754x2480 -> 3508x4960 (A3 @ 300 dpi)
run(["still", "src/index.ts", "PosterSquare", "out/poster-square.png", "--scale=2"]); // 1080 -> 2160x2160
run(["still", "src/index.ts", "PosterWide", "out/poster-wide.png", "--scale=2"]); //    1920x1080 -> 3840x2160

// --- Vector PDF (static HTML printed by the headless Chrome that Remotion downloaded) ---------
const tmp = join(root, "out", ".pdf-build");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
await build({
  entryPoints: [join(root, "src/poster/static.tsx")], bundle: true, outdir: tmp, format: "iife", platform: "browser",
  jsx: "automatic", loader: { ".woff2": "dataurl" }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error",
});
// the bundle assigns globalThis.__POSTER_HTML__ – evaluate it in node to get the markup
const js = readFileSync(join(tmp, "static.js"), "utf8");
const g = { process: { env: { NODE_ENV: "production" } } };
const html = new Function("globalThis", "window", "self", `${js}; return globalThis.__POSTER_HTML__;`)(g, g, g);
if (!html) throw new Error("static poster markup is empty");
const css = readFileSync(join(tmp, "static.css"), "utf8");
writeFileSync(join(tmp, "poster.html"), `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 297mm 420mm; margin: 0 }
html,body { margin:0; padding:0; background:#f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact }
${css}</style></head><body>${html}<div style="position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0">${[400,500,600,700].map((w) => `<span style="font-family:'IBM Plex Sans Thai';font-weight:${w}">กขค ทดสอบ Aa 123</span>`).join("")}</div></body></html>`);

const chromeRoot = join(root, "node_modules/.remotion/chrome-headless-shell");
const find = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? find(join(d, e.name)) : e.name === "chrome-headless-shell" ? [join(d, e.name)] : []));
const chrome = find(chromeRoot)[0];
if (!chrome) throw new Error("chrome-headless-shell not found – run: npx remotion browser ensure");
execFileSync(chrome, ["--no-sandbox", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=8000", "--run-all-compositor-stages-before-draw", "--print-to-pdf=" + join(out, "poster-a3.pdf"), pathToFileURL(join(tmp, "poster.html")).href], { stdio: "inherit" });
rmSync(tmp, { recursive: true, force: true });

for (const f of ["poster-a3.png", "poster-a3.pdf", "poster-square.png", "poster-wide.png"]) {
  console.log(f.padEnd(20), (statSync(join(out, f)).size / 1024 / 1024).toFixed(2) + " MB");
}
