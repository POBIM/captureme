// Video window: preview + trim + export (MP4 / GIF) + recent recordings list.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { applyI18n, setLang, t } from "../shared/i18n";
import { api, queryParam } from "../shared/api";
import { fmtClock, type RecordingEntry } from "../recorder/types";
import "./style.css";

interface VideoInfo {
  path: string;
  format: string;
  duration_ms: number;
  width: number;
  height: number;
  fps: number;
  has_audio: boolean;
  audio_tracks: number;
  size_bytes: number;
}

const app = document.getElementById("app")!;
let tab: "edit" | "list" = "edit";
let info: VideoInfo | null = null;
let path = queryParam("path") ?? "";
let tStart = 0;
let tEnd = 0;
let dur = 0;
let toastTimer: number | undefined;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const base = (p: string) => p.split("/").pop() ?? p;
const fmtT = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, "0")}:${sec.toFixed(1).padStart(4, "0")}`;
};
const fmtSize = (b: number) => (b > 1e9 ? (b / 1e9).toFixed(2) + " GB" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");

function build() {
  app.innerHTML = `
  <header>
    <div class="tabs">
      <button class="tab" data-tab="edit" data-i18n="extras.vid.tab.edit"></button>
      <button class="tab" data-tab="list" data-i18n="extras.vid.tab.list"></button>
    </div>
    <div class="fname" id="fname"></div>
    <button class="btn" id="openfolder" data-i18n="extras.vid.openFolder"></button>
  </header>

  <main id="view-edit">
    <div class="empty" id="noclip"><p data-i18n="extras.vid.noClip"></p></div>
    <div id="clip" class="hidden">
      <div class="stage"><video id="player" playsinline preload="auto"></video><img id="gifview" class="hidden" alt=""></div>
      <div id="trimui">
        <div class="transport">
          <button class="btn icon" id="play">▶</button>
          <span class="time" id="timeinfo">00:00.0 / 00:00.0</span>
          <span class="spacer"></span>
          <span class="hint" data-i18n="extras.vid.keys"></span>
        </div>
        <div class="tl" id="tl">
          <div class="thumbs" id="thumbs"></div>
          <div class="shade" id="shade-l"></div><div class="shade" id="shade-r"></div>
          <div class="sel" id="sel"></div>
          <div class="h start" id="h-start"></div><div class="h end" id="h-end"></div>
          <div class="playhead" id="playhead"></div>
        </div>
        <div class="trimrow">
          <button class="btn" id="set-in" data-i18n="extras.vid.setIn"></button>
          <button class="btn" id="set-out" data-i18n="extras.vid.setOut"></button>
          <button class="btn" id="reset" data-i18n="extras.vid.reset"></button>
          <span class="spacer"></span>
          <span class="time" id="rangeinfo"></span>
        </div>
        <div class="export">
          <label class="check" id="mute-row"><input type="checkbox" id="mute"><span data-i18n="extras.vid.mute"></span></label>
          <div class="grp">
            <b>MP4</b>
            <select id="mp4mode"><option value="fast" data-i18n="extras.vid.mp4.fast"></option><option value="precise" data-i18n="extras.vid.mp4.precise"></option></select>
            <button class="btn primary" id="exp-mp4" data-i18n="extras.vid.exportMp4"></button>
          </div>
          <div class="grp">
            <b>GIF</b>
            <select id="gif-fps"><option>10</option><option selected>15</option><option>20</option><option>24</option></select><span class="hint">fps</span>
            <select id="gif-w"><option value="480">480 px</option><option value="640" selected>640 px</option><option value="800">800 px</option><option value="0" data-i18n="extras.vid.gif.orig"></option></select>
            <button class="btn primary" id="exp-gif" data-i18n="extras.vid.exportGif"></button>
          </div>
        </div>
        <div class="progress hidden" id="progress"><div id="bar"></div><span id="ptext"></span></div>
      </div>
      <div class="actions">
        <button class="btn" id="copy" data-i18n="extras.vid.copy"></button>
        <button class="btn" id="reveal" data-i18n="extras.vid.reveal"></button>
        <span class="spacer"></span>
        <button class="btn danger" id="del" data-i18n="extras.vid.delete"></button>
      </div>
    </div>
  </main>

  <main id="view-list" class="hidden">
    <div class="grid" id="grid"></div>
    <div class="empty hidden" id="listempty"><p data-i18n="extras.vid.listEmpty"></p></div>
  </main>
  <div id="toast"></div>`;
  app.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => (b.onclick = () => showTab(b.dataset.tab as "edit" | "list")));
  $("openfolder").onclick = () => invoke("recordings_open_folder");
  bindEditor();
  applyI18n();
  showTab(tab);
}

function showTab(next: "edit" | "list") {
  tab = next;
  app.querySelectorAll<HTMLElement>(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === next));
  $("view-edit").classList.toggle("hidden", next !== "edit");
  $("view-list").classList.toggle("hidden", next !== "list");
  if (next === "list") void renderList();
}

function toast(html: string, err = false, ms = 5000, actions: [string, () => void][] = []) {
  const el = $("toast");
  el.innerHTML = "";
  const s = document.createElement("span");
  s.textContent = html;
  el.append(s);
  for (const [label, fn] of actions) {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => {
      fn();
      el.className = "";
    };
    el.append(b);
  }
  el.className = "show" + (err ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.className = ""), ms);
}

// ---------------------------------------------------------------------------------------- editor
const player = () => $("player") as HTMLVideoElement;

async function load(p: string) {
  path = p;
  info = null;
  showTab("edit");
  $("noclip").classList.add("hidden");
  $("clip").classList.remove("hidden");
  $("fname").textContent = base(p);
  try {
    info = await invoke<VideoInfo>("video_probe", { path: p });
  } catch (e) {
    toast(String(e), true);
    return;
  }
  const isGif = info.format === "gif";
  $("gifview").classList.toggle("hidden", !isGif);
  player().classList.toggle("hidden", isGif);
  $("trimui").classList.toggle("hidden", isGif);
  if (isGif) {
    ($("gifview") as HTMLImageElement).src = api.fileSrc(p);
    return;
  }
  const v = player();
  v.src = api.fileSrc(p);
  v.muted = false;
  ($("mute") as HTMLInputElement).checked = false;
  $("mute-row").classList.toggle("hidden", !info.has_audio);
  dur = info.duration_ms / 1000;
  v.onloadedmetadata = () => {
    if (isFinite(v.duration) && v.duration > 0) dur = v.duration;
    tStart = 0;
    tEnd = dur;
    updateUi();
  };
  tStart = 0;
  tEnd = dur;
  updateUi();
  $("thumbs").innerHTML = "";
  void invoke<string[]>("video_thumbs", { path: p, count: 14, width: 160 })
    .then((list) => {
      if (path !== p) return;
      const box = $("thumbs");
      box.innerHTML = "";
      list.forEach((u) => {
        const c = document.createElement("div");
        if (u) c.style.backgroundImage = `url(${u})`;
        box.append(c);
      });
    })
    .catch(console.error);
}

function pct(s: number) {
  return dur > 0 ? (s / dur) * 100 : 0;
}

function updateUi() {
  if (!dur) return;
  const v = player();
  $("h-start").style.left = pct(tStart) + "%";
  $("h-end").style.left = pct(tEnd) + "%";
  $("shade-l").style.width = pct(tStart) + "%";
  $("shade-r").style.width = 100 - pct(tEnd) + "%";
  $("sel").style.left = pct(tStart) + "%";
  $("sel").style.width = pct(tEnd) - pct(tStart) + "%";
  $("playhead").style.left = pct(v.currentTime) + "%";
  $("timeinfo").textContent = `${fmtT(v.currentTime)} / ${fmtT(dur)}`;
  $("rangeinfo").textContent = `${fmtT(tStart)} → ${fmtT(tEnd)}  ·  ${t("extras.vid.length")} ${fmtT(tEnd - tStart)}`;
  $("play").textContent = v.paused ? "▶" : "⏸";
}

function seek(s: number) {
  const v = player();
  v.currentTime = Math.min(Math.max(s, 0), dur);
  updateUi();
}

function bindEditor() {
  const v = player();
  v.addEventListener("timeupdate", () => {
    if (!v.paused && v.currentTime >= tEnd - 0.02) {
      v.pause();
      v.currentTime = tEnd;
    }
    updateUi();
  });
  v.addEventListener("play", updateUi);
  v.addEventListener("pause", updateUi);
  v.addEventListener("click", () => togglePlay());
  $("play").onclick = () => togglePlay();
  $("mute").onchange = () => (v.muted = ($("mute") as HTMLInputElement).checked);
  $("set-in").onclick = () => setIn();
  $("set-out").onclick = () => setOut();
  $("reset").onclick = () => {
    tStart = 0;
    tEnd = dur;
    updateUi();
  };

  // timeline pointer interaction
  const tl = $("tl");
  const toTime = (e: PointerEvent) => {
    const r = tl.getBoundingClientRect();
    return Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * dur;
  };
  let drag: "start" | "end" | "head" | null = null;
  tl.addEventListener("pointerdown", (e) => {
    const target = e.target as HTMLElement;
    drag = target.id === "h-start" ? "start" : target.id === "h-end" ? "end" : "head";
    tl.setPointerCapture(e.pointerId);
    if (drag === "head") {
      v.pause();
      seek(toTime(e));
    }
  });
  tl.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const s = toTime(e);
    if (drag === "start") {
      tStart = Math.min(s, tEnd - 0.1);
      seek(tStart);
    } else if (drag === "end") {
      tEnd = Math.max(s, tStart + 0.1);
      seek(tEnd);
    } else seek(s);
  });
  const up = () => (drag = null);
  tl.addEventListener("pointerup", up);
  tl.addEventListener("pointercancel", up);

  // export
  $("exp-mp4").onclick = () => exportMp4();
  $("exp-gif").onclick = () => exportGif();
  $("copy").onclick = async () => {
    try {
      await invoke("video_copy_file", { path });
      toast(t("extras.vid.copied"), false, 2200);
    } catch (e) {
      toast(String(e), true);
    }
  };
  $("reveal").onclick = () => invoke("reveal_in_finder", { path });
  $("del").onclick = async () => {
    if (!path) return;
    if (!(await ask(t("extras.vid.deleteConfirm"), { title: "CaptureME", kind: "warning" }))) return;
    try {
      await invoke("video_trash", { path });
      toast(t("extras.vid.deleted"), false, 2200);
      clearClip();
      showTab("list");
    } catch (e) {
      toast(String(e), true);
    }
  };

  window.addEventListener("keydown", (e) => {
    if (tab !== "edit" || !info || info.format === "gif") return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "SELECT") return;
    if (e.key === " ") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "i" || e.key === "I") setIn();
    else if (e.key === "o" || e.key === "O") setOut();
    else if (e.key === "ArrowLeft") seek(v.currentTime - (e.shiftKey ? 1 : 1 / 30));
    else if (e.key === "ArrowRight") seek(v.currentTime + (e.shiftKey ? 1 : 1 / 30));
  });
}

function clearClip() {
  path = "";
  info = null;
  player().removeAttribute("src");
  player().load();
  $("clip").classList.add("hidden");
  $("noclip").classList.remove("hidden");
  $("fname").textContent = "";
}

function togglePlay() {
  const v = player();
  if (v.paused) {
    if (v.currentTime < tStart || v.currentTime >= tEnd - 0.05) v.currentTime = tStart;
    void v.play();
  } else v.pause();
}
function setIn() {
  tStart = Math.min(player().currentTime, tEnd - 0.1);
  updateUi();
}
function setOut() {
  tEnd = Math.max(player().currentTime, tStart + 0.1);
  updateUi();
}

let busy = false;
function setBusy(on: boolean, label = "") {
  busy = on;
  $("progress").classList.toggle("hidden", !on);
  $("bar").style.width = "0%";
  $("ptext").textContent = label;
  ($("exp-mp4") as HTMLButtonElement).disabled = on;
  ($("exp-gif") as HTMLButtonElement).disabled = on;
}

async function runExport(kind: "mp4" | "gif", args: Record<string, unknown>) {
  if (busy || !info) return;
  const job = `job-${Date.now()}`;
  setBusy(true, t("extras.vid.exporting"));
  const un = await listen<{ job: string; progress: number }>("video-export-progress", (ev) => {
    if (ev.payload.job !== job) return;
    $("bar").style.width = Math.round(ev.payload.progress * 100) + "%";
    $("ptext").textContent = `${t("extras.vid.exporting")} ${Math.round(ev.payload.progress * 100)}%`;
  });
  try {
    const out = await invoke<{ path: string; size_bytes: number }>(kind === "mp4" ? "video_export_mp4" : "video_export_gif", { path, job, ...args });
    toast(`${t("extras.vid.exported")}: ${base(out.path)} (${fmtSize(out.size_bytes)})`, false, 9000, [
      [t("extras.vid.reveal"), () => invoke("reveal_in_finder", { path: out.path })],
      [t("extras.vid.copy"), () => invoke("video_copy_file", { path: out.path })],
      [t("extras.vid.openIt"), () => load(out.path)],
    ]);
  } catch (e) {
    toast(`${t("extras.vid.exportFailed")}: ${e}`, true, 7000);
  } finally {
    un();
    setBusy(false);
  }
}

function exportMp4() {
  void runExport("mp4", {
    startMs: Math.round(tStart * 1000),
    endMs: Math.round(tEnd * 1000),
    mute: ($("mute") as HTMLInputElement).checked,
    precise: ($("mp4mode") as HTMLSelectElement).value === "precise",
  });
}
function exportGif() {
  void runExport("gif", {
    startMs: Math.round(tStart * 1000),
    endMs: Math.round(tEnd * 1000),
    fps: Number(($("gif-fps") as HTMLSelectElement).value),
    width: Number(($("gif-w") as HTMLSelectElement).value),
  });
}

// ------------------------------------------------------------------------------------ recordings
async function renderList() {
  const grid = $("grid");
  let items: RecordingEntry[] = [];
  try {
    items = await invoke<RecordingEntry[]>("recordings_list");
  } catch (e) {
    console.error(e);
  }
  grid.innerHTML = "";
  $("listempty").classList.toggle("hidden", items.length > 0);
  for (const r of items) {
    const card = document.createElement("div");
    card.className = "card";
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (r.thumb) thumb.style.backgroundImage = `url("${api.fileSrc(r.thumb)}")`;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = r.format.toUpperCase() + (r.duration_ms ? " · " + fmtClock(r.duration_ms) : "");
    thumb.append(badge);
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = base(r.path);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = `${r.width ? `${r.width}×${r.height} · ` : ""}${fmtSize(r.size_bytes)} · ${new Date(r.created_at).toLocaleString()}`;
    const row = document.createElement("div");
    row.className = "cardact";
    const mk = (label: string, fn: () => void, cls = "") => {
      const b = document.createElement("button");
      b.className = "btn small " + cls;
      b.textContent = label;
      b.onclick = (e) => {
        e.stopPropagation();
        fn();
      };
      return b;
    };
    row.append(
      mk(t("extras.vid.reveal"), () => invoke("reveal_in_finder", { path: r.path })),
      mk(t("extras.vid.copy"), () => invoke("video_copy_file", { path: r.path }).then(() => toast(t("extras.vid.copied"), false, 2000))),
      mk(t("extras.vid.delete"), async () => {
        if (await ask(t("extras.vid.deleteConfirm"), { title: "CaptureME", kind: "warning" })) {
          await invoke("recordings_remove", { id: r.id, deleteFile: true });
          if (path === r.path) clearClip();
        }
      }, "danger"),
    );
    meta.append(name, sub, row);
    card.append(thumb, meta);
    card.onclick = () => void load(r.path);
    grid.append(card);
  }
}

// ------------------------------------------------------------------------------------------ init
async function init() {
  try {
    setLang((await api.getSettings()).language);
  } catch {}
  build();
  await listen<string>("video-open", (ev) => void load(ev.payload));
  await listen<string>("video-tab", (ev) => showTab(ev.payload === "recordings" ? "list" : "edit"));
  await listen("recordings-changed", () => {
    if (tab === "list") void renderList();
  });
  await listen("settings-changed", async () => {
    try {
      setLang((await api.getSettings()).language);
      applyI18n();
      if (tab === "list") void renderList();
    } catch {}
  });
  if (path) void load(path);
  else {
    const list = await invoke<RecordingEntry[]>("recordings_list").catch(() => []);
    if (list.length) showTab("list");
  }
}
init();
