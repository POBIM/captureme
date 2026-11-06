// Renders the sample "screens" (real Chrome rendering of authored HTML) to ../work/scene-*.png at 2x.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import QRCode from "qrcode";
const here = dirname(fileURLToPath(import.meta.url));
const work = resolve(here, "..", "work");
mkdirSync(work, { recursive: true });
const chrome = resolve(here, "..", "..", "node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell");
const qr = await QRCode.toDataURL("https://github.com/POBIM/captureme/releases/latest", { margin: 0, width: 400, errorCorrectionLevel: "M" });
for (const s of ["dashboard", "doc", "qr", "pal", "boxes"]) {
  const out = join(work, `scene-${s}.png`);
  const url = `file://${join(here, "scenes.html")}?scene=${s}` + (s === "qr" ? `&qr=${encodeURIComponent(qr)}` : "");
  execFileSync(chrome, ["--headless", "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=2", "--window-size=1440,900", "--virtual-time-budget=3000", `--screenshot=${out}`, url], { stdio: "ignore" });
  console.log("scene", s, existsSync(out));
}
