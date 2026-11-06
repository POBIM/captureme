// QR / barcode result window. Links are never opened automatically: "Open" asks first.
import "./qr.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, queryParam, type Settings } from "../shared/api";
import { applyI18n, setLang, t } from "../shared/i18n";

interface QrResult { payloads: string[]; path: string }
const label = queryParam("label") ?? "";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const isWeb = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

document.getElementById("app")!.innerHTML = `
  <div id="card">
    <div class="head" data-tauri-drag-region>
      <span class="title" data-i18n="more.qr.title" data-tauri-drag-region></span>
      <span class="status" id="status" role="status"></span>
      <button class="x" id="close" data-i18n-title="common.close">✕</button>
    </div>
    <div id="items"></div>
    <div class="foot" data-i18n="more.qr.foot"></div>
  </div>`;
const items = document.getElementById("items")!;
const status = document.getElementById("status")!;
const close = () => invoke("qr_result_close", { label });
document.getElementById("close")!.onclick = close;
window.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

let payloads: string[] = [];
function render() {
  if (!payloads.length) {
    items.innerHTML = `<div class="none">${t("more.qr.none")}</div>`;
    return;
  }
  items.innerHTML = payloads
    .map((p, i) => `<div class="item"><div class="payload">${esc(p)}</div><div class="acts">
        ${isWeb(p) ? `<button class="btn primary" data-act="open" data-i="${i}">${t("more.qr.open")}</button>` : ""}
        <button class="btn" data-act="copy" data-i="${i}">${t("more.qr.copy")}</button></div></div>`)
    .join("");
}
items.addEventListener("click", async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
  if (!b) return;
  const p = payloads[Number(b.dataset.i)];
  if (b.dataset.act === "copy") {
    await invoke("qr_copy", { text: p }).catch(() => {});
    status.textContent = t("more.qr.copied");
  } else if (b.dataset.act === "open") {
    // Always confirm – a QR code can point anywhere.
    const ok = await ask(`${t("more.qr.confirm")}\n\n${p}`, { title: "CaptureME", kind: "warning", okLabel: t("more.qr.open"), cancelLabel: t("common.cancel") });
    if (ok) await openUrl(p.trim()).catch((err) => (status.textContent = String(err)));
  }
});

async function init() {
  const s = await api.getSettings();
  setLang(s.language);
  applyI18n();
  const res = await invoke<QrResult | null>("qr_result_get", { label });
  payloads = res?.payloads ?? [];
  status.textContent = payloads.length ? t("more.qr.copied") : "";
  render();
  listen<Settings>("settings-changed", (ev) => { setLang(ev.payload.language); applyI18n(); render(); });
}
void init();
