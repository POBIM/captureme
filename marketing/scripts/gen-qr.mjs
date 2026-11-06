// Generates src/generated/qr.json (QR modules for site.json "url") fully offline.
import QRCode from "qrcode";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const site = JSON.parse(readFileSync(new URL("../site.json", import.meta.url), "utf8"));
const qr = QRCode.create(site.url, { errorCorrectionLevel: "M" });
const n = qr.modules.size;
const rows = [];
for (let y = 0; y < n; y++) {
  let r = "";
  for (let x = 0; x < n; x++) r += qr.modules.get(x, y) ? "1" : "0";
  rows.push(r);
}
mkdirSync(new URL("../src/generated/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/generated/qr.json", import.meta.url), JSON.stringify({ url: site.url, size: n, rows }, null, 1));
console.log(`QR for ${site.url}: ${n}x${n} modules`);
