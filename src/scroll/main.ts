// Scrolling capture windows: ?mode=control (preview + Done) and ?mode=border (region frame).
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { applyI18n, setLang, t } from "../shared/i18n";
import { api, queryParam } from "../shared/api";
import "./style.css";

interface Preview { jpeg: string; rows: number; width: number; frames: number; limit: boolean }
interface Status { active: boolean; width: number; height: number; auto: boolean; accessibility: boolean }

const mode = queryParam("mode") ?? "control";
const app = document.getElementById("app")!;

async function init() {
  try {
    setLang((await api.getSettings()).language);
  } catch {}
  if (mode === "border") {
    document.body.classList.add("border", "scroll");
    const style = document.createElement("style");
    style.textContent = `body.border .frame{position:fixed;inset:1px;border:2px dashed #3b82f6;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.35)}html,body{background:transparent!important}`;
    document.head.append(style);
    app.innerHTML = '<div class="frame"></div>';
    return;
  }
  const st = await invoke<Status>("scroll_status");
  app.innerHTML = `
    <div class="panel" data-tauri-drag-region>
      <div class="row" data-tauri-drag-region>
        <div class="title" data-tauri-drag-region data-i18n="extras.scroll.title"></div>
      </div>
      <div class="hint" data-i18n="extras.scroll.hint"></div>
      <div class="preview"><img id="img" class="hidden" alt=""><div class="empty" id="empty" data-i18n="extras.scroll.waiting"></div></div>
      <div class="stats" id="stats">&nbsp;</div>
      <label class="switch"><input type="checkbox" id="auto"><span data-i18n="extras.scroll.auto"></span></label>
      <div class="hint warn hidden" id="axhint" data-i18n="extras.scroll.autoNeedsAx"></div>
      <div class="row">
        <button class="btn primary" id="done" data-i18n="extras.scroll.done"></button>
        <button class="btn" id="cancel" data-i18n="extras.scroll.cancel"></button>
      </div>
    </div>`;
  applyI18n();
  const img = document.getElementById("img") as HTMLImageElement;
  const empty = document.getElementById("empty")!;
  const stats = document.getElementById("stats")!;
  const auto = document.getElementById("auto") as HTMLInputElement;
  const axhint = document.getElementById("axhint")!;
  auto.checked = st.auto;

  document.getElementById("done")!.onclick = () => invoke("scroll_done");
  document.getElementById("cancel")!.onclick = () => invoke("scroll_cancel");
  auto.onchange = async () => {
    try {
      await invoke("scroll_set_auto", { on: auto.checked });
      axhint.classList.add("hidden");
    } catch {
      auto.checked = false;
      axhint.classList.remove("hidden");
    }
  };
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Enter") invoke("scroll_done");
  });
  await listen<Preview>("scroll-preview", (ev) => {
    const p = ev.payload;
    img.src = p.jpeg;
    img.classList.remove("hidden");
    empty.classList.add("hidden");
    stats.textContent = `${t("extras.scroll.height")} ${p.rows.toLocaleString()} px · ${p.frames} ${t("extras.scroll.frames")}${p.limit ? " · " + t("extras.scroll.limit") : ""}`;
  });
  await listen("settings-changed", async () => {
    try {
      setLang((await api.getSettings()).language);
      applyI18n();
    } catch {}
  });
}

init();
