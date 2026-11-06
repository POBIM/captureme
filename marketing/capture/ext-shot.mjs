// Screenshots public web pages (GitHub) with the headless Chrome that Remotion downloads: 1440 px wide, light mode.
// usage: node ext-shot.mjs <url> <out.png> [height=1000] [dsf=1]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const [url, out, height = "1000", dsf = "1"] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const chrome = resolve(here, "..", "node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell");
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, ["--headless", "--no-sandbox", "--hide-scrollbars", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/cm-chrome-" + port, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list;
for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (list.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const waits = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d.result ?? d); waits.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: +height, deviceScaleFactor: +dsf, mobile: false });
await send("Page.navigate", { url });
await sleep(6000);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.data, "base64"));
ws.close(); proc.kill();
console.log("saved", out);
