// Floating recorder windows: ?mode=setup (options) → recording bar, ?mode=border (region frame).
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { applyI18n, setLang, t } from "../shared/i18n";
import { api, queryParam } from "../shared/api";
import "./style.css";

interface Options {
  format: "mp4" | "mov" | "gif";
  fps: number;
  cursor: boolean;
  clicks: boolean;
  mic: boolean;
  countdown: number;
}
interface Status {
  recording: boolean;
  pending: boolean;
  started_ms: number;
  width: number;
  height: number;
  options: Options;
}

const mode = queryParam("mode") ?? "setup";
const app = document.getElementById("app")!;
const win = getCurrentWindow();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", html = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

async function init() {
  try {
    setLang((await api.getSettings()).language);
  } catch {}
  applyI18n();
  if (mode === "border") {
    document.body.classList.add("border", queryParam("kind") === "scroll" ? "scroll" : "rec");
    app.innerHTML = '<div class="frame"></div>';
    return;
  }
  const st = await invoke<Status>("recording_status");
  if (st.recording) showRecording(st.started_ms);
  else showSetup(st);
  listen("settings-changed", async () => {
    try {
      setLang((await api.getSettings()).language);
      applyI18n();
    } catch {}
  });
}

// ---------------------------------------------------------------------------------------- setup
function showSetup(st: Status) {
  const o: Options = { ...st.options };
  app.innerHTML = "";
  const panel = el("div", "panel");
  panel.setAttribute("data-tauri-drag-region", "");

  // header
  const head = el("div", "row");
  const title = el("div", "title");
  title.setAttribute("data-tauri-drag-region", "");
  title.innerHTML = `<b>${t("extras.rec.title")}</b> · ${t("extras.rec.region")} ${Math.round(st.width)}×${Math.round(st.height)}`;
  const close = el("button", "btn icon", "✕");
  close.onclick = () => invoke("recording_cancel");
  head.append(title, close);

  // options
  const opts = el("div", "row");
  const seg = el("div", "seg");
  (["mp4", "mov", "gif"] as const).forEach((f) => {
    const b = el("button", o.format === f ? "on" : "", f.toUpperCase());
    b.onclick = () => {
      o.format = f;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      refresh();
    };
    seg.append(b);
  });
  const fpsWrap = el("label", "row");
  fpsWrap.append(el("span", "hint", t("extras.rec.fps")));
  const fps = el("select");
  [10, 12, 15].forEach((n) => fps.append(new Option(String(n), String(n), false, o.fps === n)));
  if (![10, 12, 15].includes(o.fps)) fps.value = "12";
  fps.onchange = () => (o.fps = Number(fps.value));
  fpsWrap.append(fps);
  const chip = (key: "cursor" | "clicks" | "mic", label: string, icon: string) => {
    const c = el("button", "chip" + (o[key] ? " on" : ""), `${icon} ${label}`);
    c.onclick = () => {
      o[key] = !o[key];
      c.classList.toggle("on", o[key]);
    };
    return c;
  };
  const cCursor = chip("cursor", t("extras.rec.cursor"), "⌖");
  const cClicks = chip("clicks", t("extras.rec.clicks"), "◉");
  const cMic = chip("mic", t("extras.rec.mic"), "🎙");
  opts.append(seg, fpsWrap, el("span", "spacer"), cCursor, cClicks, cMic);

  // footer
  const foot = el("div", "row between");
  const hint = el("div", "hint", t("extras.rec.gifHint"));
  const btns = el("div", "row");
  const cancel = el("button", "btn", t("extras.rec.cancel"));
  cancel.onclick = () => invoke("recording_cancel");
  const start = el("button", "btn primary", "● " + t("extras.rec.start"));
  btns.append(cancel, start);
  foot.append(hint, btns);

  panel.append(head, opts, foot);
  app.append(panel);

  function refresh() {
    const gif = o.format === "gif";
    fpsWrap.classList.toggle("hidden", !gif);
    cClicks.classList.toggle("hidden", gif);
    cMic.classList.toggle("hidden", gif);
    cCursor.classList.toggle("hidden", gif);
    hint.classList.toggle("hidden", !gif);
  }
  refresh();

  let counting = false;
  let timer: number | undefined;
  const begin = async () => {
    try {
      const started = await invoke<number>("recording_begin", { options: o });
      showRecording(started);
    } catch (e) {
      console.error(e);
    }
  };
  start.onclick = () => {
    if (counting) return;
    if (o.countdown <= 0) return void begin();
    counting = true;
    let n = o.countdown;
    const cd = el("div", "countdown", String(n));
    btns.replaceChildren(cancel, cd);
    timer = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(timer);
        begin();
      } else cd.textContent = String(n);
    }, 1000);
  };
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      clearInterval(timer);
      invoke("recording_cancel");
    } else if (e.key === "Enter" && !counting) start.click();
  });
  void win;
}

// ------------------------------------------------------------------------------------- recording
function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function showRecording(startedMs: number) {
  app.innerHTML = "";
  const panel = el("div", "panel bar");
  panel.setAttribute("data-tauri-drag-region", "");
  const dot = el("div", "dot");
  const timer = el("div", "timer", "00:00");
  timer.setAttribute("data-tauri-drag-region", "");
  const stop = el("button", "btn primary", "■ " + t("extras.rec.stop"));
  stop.onclick = () => {
    stop.disabled = true;
    stop.textContent = t("extras.rec.saving");
    invoke("recording_stop");
  };
  const discard = el("button", "btn icon", "✕");
  discard.title = t("extras.rec.discard");
  discard.onclick = () => invoke("recording_cancel");
  panel.append(dot, timer, el("span", "spacer"), stop, discard);
  app.append(panel);
  const tick = () => (timer.textContent = fmt(Date.now() - startedMs));
  tick();
  setInterval(tick, 250);
}

init();
