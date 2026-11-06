// Floating post-capture thumbnail: edit / copy / save / pin / close, auto-dismiss, drag the image out into other apps.
import "./thumb.css";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { api, queryParam, type Settings } from "../shared/api";
import { applyI18n, setLang, t } from "../shared/i18n";

const win = getCurrentWindow();
const path = queryParam("path") ?? "";
const id = queryParam("id") ?? "";
const secs = Math.max(0, parseInt(queryParam("secs") ?? "6", 10) || 0);

const ico = {
  edit: `<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M14 6l4 4"/></svg>`,
  copy: `<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`,
  save: `<svg viewBox="0 0 24 24"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>`,
  pin: `<svg viewBox="0 0 24 24"><path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z"/></svg>`,
  x: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
};
const b = (act: string, key: string, svg: string, cls = "") => `<button data-act="${act}" class="${cls}" data-i18n-title="${key}">${svg}</button>`;

document.getElementById("app")!.innerHTML = `
  <div id="card">
    <div id="imgwrap"><img alt="" id="img"></div>
    <div id="timer"></div>
    <div id="bar">
      ${b("edit", "more.thumb.edit", ico.edit)}${b("copy", "more.thumb.copy", ico.copy)}${b("save", "more.thumb.save", ico.save)}${b("pin", "more.thumb.pin", ico.pin)}
      <span class="sp"></span>${b("close", "more.thumb.close", ico.x, "close")}
    </div>
    <div id="msg" role="status" aria-live="polite"></div>
  </div>`;
const img = document.getElementById("img") as HTMLImageElement;
img.src = api.fileSrc(path);
const msg = document.getElementById("msg")!;
const timer = document.getElementById("timer")!;

let msgTimer: number | undefined;
function say(text: string) {
  msg.textContent = text;
  msg.classList.add("show");
  clearTimeout(msgTimer);
  msgTimer = window.setTimeout(() => msg.classList.remove("show"), 1600);
}

// ---- auto dismiss (paused while the pointer is over the thumbnail) ---------------------------
let dismiss: number | undefined;
function startTimer() {
  clearTimeout(dismiss);
  timer.style.transition = "none";
  timer.style.transform = "scaleX(1)";
  if (!secs) { timer.style.display = "none"; return; }
  void timer.offsetWidth;
  timer.style.transition = `transform ${secs}s linear`;
  timer.style.transform = "scaleX(0)";
  dismiss = window.setTimeout(close, secs * 1000);
}
function stopTimer() {
  clearTimeout(dismiss);
  timer.style.transition = "none";
  timer.style.transform = "scaleX(1)";
}
const close = () => { invoke("thumb_close").catch(() => win.close()); };
document.addEventListener("mouseenter", stopTimer);
document.addEventListener("mouseleave", startTimer);
startTimer();

// ---- actions -----------------------------------------------------------------------------------
async function act(name: string) {
  try {
    if (name === "edit") { await invoke("history_open", { id }); close(); }
    else if (name === "copy") { await invoke("copy_image_file", { path }); say(t("more.thumb.copied")); }
    else if (name === "save") { const p = await invoke<string>("save_image_file", { path }); say(`${t("more.thumb.saved")}: ${p.split("/").pop()}`); }
    else if (name === "pin") { await invoke("pin_file", { path }); close(); }
    else if (name === "close") close();
  } catch (e) { say(String(e)); }
}
document.querySelectorAll<HTMLButtonElement>("#bar button[data-act]").forEach((el) => (el.onclick = () => act(el.dataset.act!)));
window.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

// ---- drag the capture out into Finder / other apps ----------------------------------------------
const wrap = document.getElementById("imgwrap")!;
let down: { x: number; y: number } | null = null;
wrap.addEventListener("mousedown", (e) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY }; });
window.addEventListener("mouseup", () => (down = null));
window.addEventListener("mousemove", (e) => {
  if (down && (e.buttons & 1) && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) {
    down = null;
    stopTimer();
    invoke("thumb_drag", { path }).catch((err) => say(String(err)));
  }
});
wrap.addEventListener("dblclick", () => act("edit"));

// ---- i18n ---------------------------------------------------------------------------------------
api.getSettings().then((s) => { setLang(s.language); applyI18n(); });
applyI18n();
listen<Settings>("settings-changed", (ev) => { setLang(ev.payload.language); applyI18n(); });
