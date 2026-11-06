import "./ocr.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { api, queryParam, type Settings } from "../shared/api";
import { applyI18n, setLang, t } from "../shared/i18n";

interface OcrResult {
  text: string;
  path: string;
}
const label = queryParam("label") ?? "";
const AUTO_CLOSE_MS = 9000;

document.getElementById("app")!.innerHTML = `
  <div id="card">
    <div class="bar" id="bar"></div>
    <div class="head" data-tauri-drag-region>
      <span class="title" data-i18n="tools.ocr.title"></span>
      <span class="status" id="status"></span>
      <button class="x" id="close">✕</button>
    </div>
    <textarea id="text" spellcheck="false"></textarea>
    <div class="foot">
      <button class="btn primary" id="copy" data-i18n="tools.ocr.copy"></button>
    </div>
  </div>`;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ta = $("text") as HTMLTextAreaElement;
const close = () => invoke("ocr_result_close", { label });

let timer: number | undefined;
function startAutoClose() {
  const bar = $("bar");
  bar.style.transition = "none";
  bar.style.transform = "scaleX(1)";
  void bar.offsetWidth;
  bar.style.transition = `transform ${AUTO_CLOSE_MS}ms linear`;
  bar.style.transform = "scaleX(0)";
  timer = window.setTimeout(close, AUTO_CLOSE_MS);
}
function cancelAutoClose() {
  clearTimeout(timer);
  const bar = $("bar");
  bar.style.transition = "none";
  bar.style.transform = "scaleX(0)";
}
["mousedown", "keydown", "input"].forEach((ev) => window.addEventListener(ev, cancelAutoClose, { once: true }));
document.addEventListener("mouseenter", cancelAutoClose);

$("close").onclick = close;
$("copy").onclick = async () => {
  try {
    await invoke("copy_text", { text: ta.value });
    $("status").textContent = t("tools.ocr.copied");
  } catch (e) {
    $("status").textContent = String(e);
  }
};
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") close();
});

async function init() {
  const s = await api.getSettings();
  setLang(s.language);
  applyI18n();
  const res = await invoke<OcrResult | null>("ocr_result_get", { label });
  const text = res?.text ?? "";
  ta.value = text;
  if (text) {
    $("status").textContent = t("tools.ocr.copied");
    startAutoClose();
  } else {
    ta.placeholder = t("tools.ocr.none");
    $("copy").setAttribute("disabled", "true");
    window.setTimeout(close, 4000);
  }
  listen<Settings>("settings-changed", (ev) => {
    setLang(ev.payload.language);
    applyI18n();
  });
}
init();
