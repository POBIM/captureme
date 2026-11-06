// Reads the REAL default shortcuts from ../src-tauri/src/types.rs and the app version from tauri.conf.json,
// writes src/generated/app.json. Run `npm run sync` after the app's defaults change, before rendering.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const rs = readFileSync(new URL("src-tauri/src/types.rs", root), "utf8");
const conf = JSON.parse(readFileSync(new URL("src-tauri/tauri.conf.json", root), "utf8"));
const block = rs.match(/DEFAULT_HOTKEYS\s*:\s*&\[\(&str,\s*&str\)\]\s*=\s*&\[([\s\S]*?)\];/) ?? rs.match(/let hotkeys = \[([\s\S]*?)\]\s*\.into_iter/);
if (!block) throw new Error("could not find the default hotkeys block in types.rs");
const hotkeys = {};
for (const m of block[1].matchAll(/\(\s*"(\w+)"\s*,\s*"([^"]+)"\s*\)/g)) hotkeys[m[1]] = m[2];
const SYM = { cmdorctrl: "⌘", cmd: "⌘", command: "⌘", shift: "⇧", alt: "⌥", option: "⌥", ctrl: "⌃", control: "⌃" };
const ORDER = ["⌃", "⌥", "⇧", "⌘"]; // macOS display order
const toKeys = (acc) => {
  const parts = acc.split("+").map((p) => SYM[p.toLowerCase()] ?? p.toUpperCase());
  const mods = parts.filter((p) => ORDER.includes(p)).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return [...mods, ...parts.filter((p) => !ORDER.includes(p))];
};
const shortcuts = Object.fromEntries(Object.entries(hotkeys).map(([k, v]) => [k, toKeys(v)]));
mkdirSync(new URL("../src/generated/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/generated/app.json", import.meta.url), JSON.stringify({
  version: conf.version, minMacOS: conf.bundle?.macOS?.minimumSystemVersion ?? "14.0", hotkeys, shortcuts,
}, null, 2));
console.log("shortcuts:", Object.entries(shortcuts).map(([k, v]) => `${k}=${v.join("")}`).join("  "), " version", conf.version);
