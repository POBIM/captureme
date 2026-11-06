// "Recent colors" panel: the colours picked with the screen colour picker; click to copy in the chosen format.
import "./colors.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api, type Settings } from "../shared/api";
import { applyI18n, setLang, t } from "../shared/i18n";
import { FORMATS, formatColor, toHex, toHslText, toRgbText, type ColorFormat } from "../shared/color";

interface Entry { hex: string; r: number; g: number; b: number; at: string }
let fmt: ColorFormat = "hex";
let items: Entry[] = [];

const app = document.getElementById("app")!;
app.innerHTML = `
  <div class="top">
    <span class="title" data-i18n="more.colors.title"></span>
    <div class="seg" role="group" data-i18n-aria="more.colors.format">${FORMATS.map((f) => `<button data-f="${f}" aria-pressed="false">${f.toUpperCase()}</button>`).join("")}</div>
  </div>
  <div id="list"></div>
  <div class="foot"><span data-i18n="more.colors.hint"></span><button class="btn" id="clear" data-i18n="more.colors.clear"></button></div>
  <div id="toast" role="status" aria-live="polite"></div>`;
const list = document.getElementById("list")!;
const toastEl = document.getElementById("toast")!;
let tt: number | undefined;
function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(tt);
  tt = window.setTimeout(() => toastEl.classList.remove("show"), 1300);
}

function render() {
  app.querySelectorAll<HTMLButtonElement>(".seg button").forEach((b) => {
    const on = b.dataset.f === fmt;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  if (!items.length) {
    list.innerHTML = `<div class="empty">${t("more.colors.empty")}</div>`;
    return;
  }
  list.innerHTML = items
    .map((c, i) => `<button class="swatch" data-i="${i}" title="${t("more.colors.copy")}">
        <span class="chip" style="background:${toHex(c.r, c.g, c.b)}"></span>
        <span><span class="val">${formatColor(c.r, c.g, c.b, fmt)}</span><br><span class="sub">${[toHex(c.r, c.g, c.b), toRgbText(c.r, c.g, c.b), toHslText(c.r, c.g, c.b)].filter((_, k) => FORMATS[k] !== fmt).join("  ·  ")}</span></span>
      </button>`)
    .join("");
}

list.addEventListener("click", async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>(".swatch");
  if (!el) return;
  const c = items[Number(el.dataset.i)];
  try {
    const text = await invoke<string>("colors_copy", { r: c.r, g: c.g, b: c.b, format: fmt });
    toast(`${t("more.colors.copied")} ${text}`);
  } catch (err) { toast(String(err)); }
});
app.querySelectorAll<HTMLButtonElement>(".seg button").forEach((b) => (b.onclick = () => {
  fmt = b.dataset.f as ColorFormat;
  invoke("color_set_format", { format: fmt }).catch(() => {});
  render();
}));
document.getElementById("clear")!.onclick = () => invoke("colors_clear").catch(() => {});
window.addEventListener("keydown", (e) => { if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w")) getCurrentWindow().close(); });

async function load() {
  items = await invoke<Entry[]>("colors_list").catch(() => []);
  render();
}
async function init() {
  const s = await api.getSettings();
  setLang(s.language);
  fmt = s.color_format;
  applyI18n();
  await load();
  listen("colors-changed", load);
  listen<Settings>("settings-changed", (ev) => {
    setLang(ev.payload.language);
    fmt = ev.payload.color_format;
    applyI18n();
    render();
  });
}
void init();
