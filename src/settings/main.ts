import "./settings.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { open as openDialog, ask } from "@tauri-apps/plugin-dialog";
import { unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { api, type Settings } from "../shared/api";
import { applyI18n, setLang, t } from "../shared/i18n";

const HK_ACTIONS = ["region", "window", "fullscreen", "delayed", "scroll", "record", "ocr", "history"];
const DEFAULT_HOTKEYS: Record<string, string> = {
  region: "CmdOrCtrl+Shift+2",
  window: "CmdOrCtrl+Shift+3",
  fullscreen: "CmdOrCtrl+Shift+1",
  delayed: "CmdOrCtrl+Shift+6",
  scroll: "CmdOrCtrl+Shift+7",
  record: "CmdOrCtrl+Shift+8",
  ocr: "CmdOrCtrl+Shift+9",
  history: "CmdOrCtrl+Shift+0",
};
const TABS = ["general", "save", "hotkeys", "history", "about"] as const;

let cur: Settings;
let activeTab: (typeof TABS)[number] = "general";
let recording: string | null = null;

const app = document.getElementById("app")!;

function switchHtml(id: string) {
  return `<label class="switch"><input type="checkbox" id="${id}"><span></span></label>`;
}
function row(labelKey: string, ctl: string, hintKey?: string) {
  return `<div class="row"><div class="label"><span data-i18n="${labelKey}"></span>${hintKey ? `<small data-i18n="${hintKey}"></small>` : ""}</div><div class="ctl">${ctl}</div></div>`;
}

function build() {
  app.innerHTML = `
  <div class="tabs">${TABS.map((k) => `<button class="tab" data-tab="${k}" data-i18n="tools.settings.tab.${k}"></button>`).join("")}</div>

  <section class="pane" data-pane="general">
    <h2 data-i18n="tools.settings.language"></h2>
    ${row("tools.settings.language", `<select id="language"><option value="th">ไทย</option><option value="en">English</option></select>`)}
    <h2 data-i18n="tools.settings.afterCapture"></h2>
    ${row("tools.settings.copyAfter", switchHtml("copy_after_capture"), "tools.settings.copyAfter.hint")}
    ${row("tools.settings.openEditor", switchHtml("open_editor_after_capture"), "tools.settings.openEditor.hint")}
    <h2 data-i18n="tools.settings.system"></h2>
    ${row("tools.settings.sound", switchHtml("play_sound"))}
    ${row("tools.settings.autostart", switchHtml("launch_at_login"))}
  </section>

  <section class="pane" data-pane="save">
    <h2 data-i18n="tools.settings.location"></h2>
    ${row("tools.settings.saveDir", `<span class="path" id="save_dir_label"></span><button class="btn" id="choose_dir" data-i18n="tools.settings.choose"></button><button class="btn" id="open_dir" data-i18n="tools.settings.openFolder"></button>`)}
    <h2 data-i18n="tools.settings.fileName"></h2>
    ${row("tools.settings.pattern", `<input type="text" id="filename_pattern" spellcheck="false">`, "tools.settings.pattern.hint")}
    ${row("tools.settings.preview", `<span class="preview" id="pattern_preview"></span>`)}
    <h2 data-i18n="tools.settings.formatTitle"></h2>
    ${row("tools.settings.format", `<select id="image_format"><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option></select>`)}
    <div id="quality_row">${row("tools.settings.quality", `<input type="range" id="jpg_quality" min="10" max="100" step="1"><span id="jpg_quality_val" style="width:34px;text-align:right"></span>`)}</div>
  </section>

  <section class="pane" data-pane="hotkeys">
    ${HK_ACTIONS.map((a) => row(`tools.hk.${a}`, `<button class="btn hk" data-hk="${a}"></button>`)).join("")}
    <div class="hint" data-i18n="tools.settings.hk.hint"></div>
    <div style="margin-top:14px"><button class="btn" id="reset_hotkeys" data-i18n="tools.settings.hk.reset"></button></div>
  </section>

  <section class="pane" data-pane="history">
    ${row("tools.settings.historyLimit", `<input type="number" id="history_limit" min="1" max="10000" step="10">`, "tools.settings.historyLimit.hint")}
    ${row("tools.settings.clearHistory", `<button class="btn danger" id="clear_history" data-i18n="tools.settings.clearBtn"></button>`)}
    ${row("tools.settings.openHistory", `<button class="btn" id="open_history" data-i18n="tools.settings.openBtn"></button>`)}
  </section>

  <section class="pane" data-pane="about">
    <div class="about">
      <div class="logo">C</div>
      <div class="name">CaptureME</div>
      <div class="ver"><span data-i18n="tools.settings.version"></span> <span id="version"></span></div>
      <p data-i18n="tools.settings.aboutText"></p>
    </div>
  </section>
  <div id="toast"></div>`;

  app.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => (b.onclick = () => showTab(b.dataset.tab as (typeof TABS)[number])));
  bindControls();
  showTab(activeTab);
}

function showTab(tab: (typeof TABS)[number]) {
  activeTab = tab;
  app.querySelectorAll<HTMLElement>(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  app.querySelectorAll<HTMLElement>(".pane").forEach((p) => p.classList.toggle("active", p.dataset.pane === tab));
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let toastTimer: number | undefined;
function toast(msg: string, err = false) {
  const el = $("toast");
  el.textContent = msg;
  el.className = "show" + (err ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.className = ""), err ? 4000 : 1400);
}

// ---- filename preview ---------------------------------------------------------------------
function previewName(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const time = `${p2(d.getHours())}.${p2(d.getMinutes())}.${p2(d.getSeconds())}`;
  const name = (cur.filename_pattern || "CaptureME")
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)
    .replace(/\{n\}/g, "1")
    .replace(/[\/\\:*?"<>|]/g, "-");
  return `${name}.${cur.image_format}`;
}

// ---- state -> controls --------------------------------------------------------------------
function syncControls() {
  ($("language") as HTMLSelectElement).value = cur.language;
  for (const k of ["copy_after_capture", "open_editor_after_capture", "play_sound", "launch_at_login"] as const) {
    ($(k) as HTMLInputElement).checked = cur[k];
  }
  $("save_dir_label").textContent = cur.save_dir;
  $("save_dir_label").title = cur.save_dir;
  const pat = $("filename_pattern") as HTMLInputElement;
  if (document.activeElement !== pat) pat.value = cur.filename_pattern;
  $("pattern_preview").textContent = previewName();
  ($("image_format") as HTMLSelectElement).value = cur.image_format;
  $("quality_row").style.display = cur.image_format === "jpg" ? "" : "none";
  ($("jpg_quality") as HTMLInputElement).value = String(cur.jpg_quality);
  $("jpg_quality_val").textContent = String(cur.jpg_quality);
  const lim = $("history_limit") as HTMLInputElement;
  if (document.activeElement !== lim) lim.value = String(cur.history_limit);
  renderHotkeys();
}

function prettyAccel(acc: string): string {
  return acc
    .split("+")
    .map((p) => {
      switch (p) {
        case "CmdOrCtrl":
        case "Cmd":
        case "Command":
        case "Super":
          return "⌘";
        case "Ctrl":
        case "Control":
          return "⌃";
        case "Alt":
        case "Option":
          return "⌥";
        case "Shift":
          return "⇧";
        case "Up":
          return "↑";
        case "Down":
          return "↓";
        case "Left":
          return "←";
        case "Right":
          return "→";
        default:
          return p;
      }
    })
    .join(" ");
}

function renderHotkeys() {
  app.querySelectorAll<HTMLButtonElement>("button[data-hk]").forEach((b) => {
    const a = b.dataset.hk!;
    const isRec = recording === a;
    b.classList.toggle("recording", isRec);
    b.textContent = isRec ? t("tools.settings.hk.press") : prettyAccel(cur.hotkeys[a] ?? "");
  });
}

// ---- persistence --------------------------------------------------------------------------
async function commit(mutate: (s: Settings) => void, quiet = false): Promise<boolean> {
  const next: Settings = JSON.parse(JSON.stringify(cur));
  mutate(next);
  let ok = true;
  try {
    await api.saveSettings(next);
    if (!quiet) toast(t("tools.settings.saved"));
  } catch (e) {
    ok = false;
    toast(String(e), true);
  }
  // Re-read: the backend validates/normalises what we sent (and restores the old value on error).
  cur = await api.getSettings();
  syncControls();
  return ok;
}

function bindControls() {
  $("language").onchange = async (e) => {
    const lang = (e.target as HTMLSelectElement).value as Settings["language"];
    setLang(lang);
    await commit((s) => (s.language = lang));
    applyI18n();
    renderHotkeys();
  };
  for (const k of ["copy_after_capture", "open_editor_after_capture", "play_sound", "launch_at_login"] as const) {
    $(k).onchange = (e) => commit((s) => (s[k] = (e.target as HTMLInputElement).checked));
  }
  $("choose_dir").onclick = async () => {
    const dir = await openDialog({ directory: true, multiple: false, defaultPath: cur.save_dir || undefined });
    if (typeof dir === "string" && dir) commit((s) => (s.save_dir = dir));
  };
  $("open_dir").onclick = () => invoke("reveal_in_finder", { path: cur.save_dir }).catch((e) => toast(String(e), true));
  const pat = $("filename_pattern") as HTMLInputElement;
  pat.oninput = () => {
    cur.filename_pattern = pat.value;
    $("pattern_preview").textContent = previewName();
  };
  pat.onchange = () => commit((s) => (s.filename_pattern = pat.value.trim() || "CaptureME {date} {time}"));
  $("image_format").onchange = (e) => commit((s) => (s.image_format = (e.target as HTMLSelectElement).value as Settings["image_format"]));
  const q = $("jpg_quality") as HTMLInputElement;
  q.oninput = () => ($("jpg_quality_val").textContent = q.value);
  q.onchange = () => commit((s) => (s.jpg_quality = Number(q.value)));
  const lim = $("history_limit") as HTMLInputElement;
  lim.onchange = () => commit((s) => (s.history_limit = Math.max(1, Math.min(10000, Math.round(Number(lim.value) || 200)))));

  app.querySelectorAll<HTMLButtonElement>("button[data-hk]").forEach((b) => (b.onclick = () => startRecording(b.dataset.hk!)));
  $("reset_hotkeys").onclick = () => commit((s) => (s.hotkeys = { ...DEFAULT_HOTKEYS }));
  $("clear_history").onclick = async () => {
    if (await ask(t("tools.settings.clearConfirm"), { title: "CaptureME", kind: "warning" })) {
      await invoke("history_clear").catch((e) => toast(String(e), true));
      toast(t("tools.settings.cleared"));
    }
  };
  $("open_history").onclick = () => invoke("open_history_window").catch(() => {});
}

// ---- hotkey recording ---------------------------------------------------------------------
const CODE_KEYS: Record<string, string> = {
  Space: "Space", Enter: "Enter", Tab: "Tab", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
  Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backquote: "`",
  Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Insert: "Insert",
};
function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return CODE_KEYS[code] ?? null;
}

async function startRecording(action: string) {
  if (recording) return;
  recording = action;
  renderHotkeys();
  // Suspend the app's global shortcuts so pressing an existing combo doesn't trigger it.
  try {
    await unregisterAll();
  } catch {}
  window.addEventListener("keydown", onRecordKey, true);
  window.addEventListener("blur", cancelRecording);
}

function stopRecording() {
  window.removeEventListener("keydown", onRecordKey, true);
  window.removeEventListener("blur", cancelRecording);
  recording = null;
}

/** Re-save current settings so the capture core re-registers the global shortcuts. */
async function restoreShortcuts() {
  try {
    await api.saveSettings(cur);
  } catch {}
}

async function cancelRecording() {
  if (!recording) return;
  stopRecording();
  renderHotkeys();
  await restoreShortcuts();
}

function onRecordKey(e: KeyboardEvent) {
  if (!recording) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.code === "Escape") return void cancelRecording();
  if (["MetaLeft", "MetaRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight"].includes(e.code)) return;
  const key = keyFromCode(e.code);
  if (!key) return;
  const isF = /^F\d+$/.test(key);
  if (!e.metaKey && !e.ctrlKey && !e.altKey && !isF) {
    toast(t("tools.settings.hk.needMod"), true);
    return;
  }
  const mods: string[] = [];
  if (e.metaKey) mods.push("CmdOrCtrl");
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  const accel = [...mods, key].join("+");
  const action = recording;
  stopRecording();
  // On success the capture core re-registers on `settings-changed`; on failure we do it ourselves.
  commit((s) => (s.hotkeys[action] = accel)).then(async (ok) => {
    if (!ok) await restoreShortcuts();
  });
}

// ---- boot ---------------------------------------------------------------------------------
async function init() {
  cur = await api.getSettings();
  setLang(cur.language);
  build();
  applyI18n();
  syncControls();
  getVersion().then((v) => ($("version").textContent = v));
  await listen<Settings>("settings-changed", (ev) => {
    if (JSON.stringify(ev.payload) === JSON.stringify(cur)) return;
    const langChanged = ev.payload.language !== cur.language;
    cur = ev.payload;
    if (langChanged) setLang(cur.language);
    applyI18n();
    syncControls();
  });
}
init();
