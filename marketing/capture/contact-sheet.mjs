// Contact sheet for proof-reading: node contact-sheet.mjs out.png cols cellW cellH img1.png img2.png ...
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
const [out, cols, cw, ch, ...imgs] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const rows = Math.ceil(imgs.length / +cols);
const html = `<body style="margin:0;background:#777;font:12px sans-serif;color:#fff"><div style="display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:6px;padding:6px">${imgs.map((i) => `<div style="width:${cw}px;height:${ch}px;position:relative;display:flex;align-items:center;justify-content:center;background:#555"><img src="file://${resolve(i)}" style="max-width:100%;max-height:100%"><span style="position:absolute;left:4px;top:2px;background:#000a;padding:1px 4px">${basename(i)}</span></div>`).join("")}</div></body>`;
const f = "/tmp/cm-sheet.html";
writeFileSync(f, html);
const chrome = resolve(here, "..", "node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell");
execFileSync(chrome, ["--headless", "--no-sandbox", "--hide-scrollbars", `--window-size=${+cols * (+cw + 6) + 6},${rows * (+ch + 6) + 6}`, "--virtual-time-budget=4000", `--screenshot=${resolve(out)}`, "file://" + f], { stdio: "ignore" });
