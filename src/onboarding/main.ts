// First-run onboarding: welcome, screen-recording permission, shortcut cheat-sheet, language toggle.
import "./onboarding.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { api, Settings } from "../shared/api";
import { getLang, setLang, t } from "../shared/i18n";

const app = document.getElementById("app")!;
let settings: Settings | null = null;
let granted = false;

const ACTIONS = ["region", "window", "fullscreen", "delayed", "scroll", "record", "ocr", "history"];

/** "CmdOrCtrl+Shift+2" → ⌘ ⇧ 2 */
function keycaps(accel: string): string {
  const map: Record<string, string> = {
    cmdorctrl: "⌘", cmd: "⌘", command: "⌘", super: "⌘", meta: "⌘",
    ctrl: "⌃", control: "⌃", alt: "⌥", option: "⌥", shift: "⇧",
    space: "Space", enter: "↩", return: "↩", escape: "Esc", esc: "Esc",
    arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", up: "↑", down: "↓", left: "←", right: "→",
  };
  return accel
    .split("+")
    .filter(Boolean)
    .map((k) => `<kbd>${map[k.toLowerCase()] ?? (k.length === 1 ? k.toUpperCase() : k)}</kbd>`)
    .join("");
}

function render() {
  const lang = getLang();
  const hk = settings?.hotkeys ?? {};
  app.innerHTML = `
    <div class="top">
      <div class="logo"><svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/></svg></div>
      <div class="seg" role="group" aria-label="${t("common.language")}">
        <button data-lang="th" class="${lang === "th" ? "on" : ""}">ไทย</button>
        <button data-lang="en" class="${lang === "en" ? "on" : ""}">EN</button>
      </div>
    </div>
    <div><h1>${t("ob.title")}</h1><p class="sub">${t("ob.subtitle")}</p></div>

    <section class="card">
      <h2><span>${t("ob.perm.title")}</span><span id="status" class="status ${granted ? "ok" : "no"}">${t(granted ? "ob.perm.granted" : "ob.perm.missing")}</span></h2>
      <p>${t("ob.perm.desc")}</p>
      <div id="permActions" class="row" ${granted ? "hidden" : ""}>
        <button class="ob-btn primary" id="reqBtn">${t("ob.perm.request")}</button>
        <button class="ob-btn" id="openBtn">${t("ob.perm.open")}</button>
        <button class="ob-btn" id="restartBtn">${t("ob.perm.restart")}</button>
      </div>
      <p class="hintline" id="permHint" ${granted ? "hidden" : ""}>${t("ob.perm.restart_hint")}</p>
    </section>

    <section class="card">
      <h2><span>${t("ob.keys.title")}</span></h2>
      <div class="keys">
        ${ACTIONS.filter((a) => hk[a]).map((a) => `<span>${t(`cap.act.${a}`)}</span><span>${keycaps(hk[a])}</span>`).join("")}
      </div>
      <p class="hintline">${t("ob.keys.hint")}</p>
    </section>

    <p class="hintline">${t("ob.tip")}</p>
    <div class="footer"><button class="ob-btn primary big" id="startBtn">${t("ob.start")}</button></div>`;

  app.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((b) =>
    b.addEventListener("click", async () => {
      const l = b.dataset.lang as "th" | "en";
      setLang(l);
      render();
      if (settings) {
        settings = { ...settings, language: l };
        api.saveSettings(settings).catch(() => {}); // also rebuilds the tray menu
      }
    }),
  );
  $("reqBtn").addEventListener("click", async () => {
    granted = await invoke<boolean>("request_screen_permission");
    if (!granted) await invoke("open_screen_permission_settings");
    updateStatus();
  });
  $("openBtn").addEventListener("click", () => invoke("open_screen_permission_settings"));
  $("restartBtn").addEventListener("click", () => invoke("relaunch_app"));
  $("startBtn").addEventListener("click", () => invoke("onboarding_complete"));
}

function $(id: string) { return document.getElementById(id)!; }

function updateStatus() {
  const s = document.getElementById("status");
  if (!s) return;
  s.className = `status ${granted ? "ok" : "no"}`;
  s.textContent = t(granted ? "ob.perm.granted" : "ob.perm.missing");
  document.getElementById("permActions")!.hidden = granted;
  document.getElementById("permHint")!.hidden = granted;
}

async function poll() {
  try {
    const g = await invoke<boolean>("check_screen_permission");
    if (g !== granted) { granted = g; updateStatus(); }
  } catch { /* ignore */ }
}

async function init() {
  try {
    settings = await api.getSettings();
    setLang(settings.language);
  } catch { /* keep stored language */ }
  granted = await invoke<boolean>("check_screen_permission").catch(() => false);
  render();
  setInterval(poll, 1500);
  window.addEventListener("focus", poll);
  listen<Settings>("settings-changed", (e) => {
    settings = e.payload;
    if (e.payload.language !== getLang()) setLang(e.payload.language);
    render();
  });
}
void init();
