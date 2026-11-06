// Floating recorder windows: ?mode=setup (options) → recording bar, ?mode=border (region frame),
// ?mode=fx (click rings + key caps over the recorded display).
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { applyI18n, setLang, t } from "../shared/i18n";
import { api, queryParam } from "../shared/api";
import { demoOverride } from "../shared/demo";
import { fmtClock, type RecOptions, type RecStatus } from "./types";
import "./style.css";

const mode = queryParam("mode") ?? "setup";
const app = document.getElementById("app")!;

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
  if (mode === "fx") return void runFx();
  const demo = demoOverride<RecStatus>("recording_status");
  const st = demo ? { ...demo, options: await invoke<RecOptions>("recording_options_get") } : await invoke<RecStatus>("recording_status");
  if (st.recording) showRecording(st);
  else showSetup(st);
  // recording started from elsewhere (hotkey flow, tests): switch the bar to the timer view
  listen<boolean>("recording-state", async (ev) => {
    if (ev.payload && !app.querySelector(".bar")) showRecording(await invoke<RecStatus>("recording_status"));
  });
  listen("settings-changed", async () => {
    try {
      setLang((await api.getSettings()).language);
      applyI18n();
    } catch {}
  });
}

// ------------------------------------------------------------------------------------------ fx
function runFx() {
  document.body.classList.add("fx");
  app.innerHTML = '<div id="rings"></div><div id="keys"></div>';
  const rings = document.getElementById("rings")!;
  const keys = document.getElementById("keys")!;
  const q = (n: string) => Number(queryParam(n) ?? NaN);
  if ([q("rx"), q("ry"), q("rw"), q("rh")].every(Number.isFinite)) {
    keys.style.left = q("rx") + "px";
    keys.style.right = "auto";
    keys.style.width = q("rw") + "px";
    keys.style.bottom = Math.max(12, window.innerHeight - (q("ry") + q("rh")) + 40) + "px";
  }
  listen<{ x: number; y: number; button: number }>("rec-click", (ev) => {
    const r = el("div", "ring" + (ev.payload.button === 0 ? "" : " right"));
    r.style.left = ev.payload.x + "px";
    r.style.top = ev.payload.y + "px";
    rings.append(r);
    setTimeout(() => r.remove(), 650);
  });
  let text: HTMLElement | null = null;
  let textTimer: number | undefined;
  listen<{ label: string; chord: boolean }>("rec-key", (ev) => {
    const { label, chord } = ev.payload;
    if (chord) {
      const cap = el("div", "cap chord", label);
      keys.append(cap);
      while (keys.children.length > 4) keys.firstElementChild?.remove();
      setTimeout(() => cap.remove(), 1500);
      return;
    }
    if (!text || !text.isConnected) {
      text = el("div", "cap text");
      keys.append(text);
    }
    if (label === "␣") text.textContent += " ";
    else if (label === "⌫") text.textContent = (text.textContent ?? "").slice(0, -1);
    else if (label === "⏎" || label === "⇥" || label === "⎋" || label.length > 1) {
      const cap = el("div", "cap chord", label);
      keys.append(cap);
      setTimeout(() => cap.remove(), 1200);
      return;
    } else text.textContent += label;
    const full = text.textContent ?? "";
    if (full.length > 36) text.textContent = "…" + full.slice(-34);
    clearTimeout(textTimer);
    textTimer = window.setTimeout(() => {
      text?.remove();
      text = null;
    }, 1800);
  });
}

// ---------------------------------------------------------------------------------------- setup
function showSetup(st: RecStatus) {
  const o: RecOptions = { ...st.options };
  const target = st.target;
  const gifOnlyCursorless = () => o.format === "gif";
  app.innerHTML = "";
  const panel = el("div", "panel");
  panel.setAttribute("data-tauri-drag-region", "");

  // header
  const head = el("div", "row");
  const title = el("div", "title");
  title.setAttribute("data-tauri-drag-region", "");
  const what = target === "display" ? t("extras.rec.display") : target === "window" ? t("extras.rec.window") : t("extras.rec.region");
  title.innerHTML = `<b>${t("extras.rec.title")}</b> · ${what} ${Math.round(st.width)}×${Math.round(st.height)}`;
  const close = el("button", "btn icon", "✕");
  close.onclick = () => invoke("recording_cancel");
  head.append(title, close);

  // row: format / fps / quality
  const r1 = el("div", "row");
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
  const select = (values: [string, string][], cur: string, on: (v: string) => void) => {
    const s = el("select");
    values.forEach(([v, l]) => s.append(new Option(l, v, false, v === cur)));
    s.value = cur;
    s.onchange = () => on(s.value);
    return s;
  };
  const fpsLabel = el("label", "row");
  const fpsVideo = select([["30", "30"], ["60", "60"]], String(o.video_fps >= 45 ? 60 : 30), (v) => (o.video_fps = Number(v)));
  const fpsGif = select([["10", "10"], ["12", "12"], ["15", "15"]], String([10, 12, 15].includes(o.fps) ? o.fps : 12), (v) => (o.fps = Number(v)));
  fpsLabel.append(el("span", "hint", t("extras.rec.fps")), fpsVideo, fpsGif);
  const qualLabel = el("label", "row");
  const quality = select([["low", t("extras.rec.q.low")], ["medium", t("extras.rec.q.medium")], ["high", t("extras.rec.q.high")]], o.quality, (v) => (o.quality = v as RecOptions["quality"]));
  qualLabel.append(el("span", "hint", t("extras.rec.quality")), quality);
  r1.append(seg, fpsLabel, qualLabel);

  // row: toggles
  const r2 = el("div", "row wrap");
  const hint = el("div", "hint warn hidden");
  const chip = (key: "cursor" | "clicks" | "keys" | "mic" | "system_audio" | "webcam", label: string, icon: string, onToggle?: (on: boolean) => Promise<boolean | void> | boolean | void) => {
    const c = el("button", "chip" + (o[key] ? " on" : ""), `${icon} ${label}`);
    c.onclick = async () => {
      const next = !o[key];
      hint.classList.add("hidden");
      if (onToggle) {
        const r = await onToggle(next);
        if (r === false) return;
      }
      o[key] = next;
      c.classList.toggle("on", next);
      refresh();
    };
    return c;
  };
  const cCursor = chip("cursor", t("extras.rec.cursor"), "⌖");
  const cClicks = chip("clicks", t("extras.rec.clicks"), "◉");
  const cKeys = chip("keys", t("extras.rec.keys"), "⌨", async (on) => {
    if (!on) return;
    const ok = await invoke<boolean>("recording_keys_access");
    if (ok) return;
    await invoke<boolean>("recording_keys_request");
    hint.textContent = t("extras.rec.keysNeedAccess");
    hint.classList.remove("hidden");
    return false;
  });
  const cMic = chip("mic", t("extras.rec.mic"), "🎙", async (on) => {
    if (!on) return;
    const st = await invoke<string>("recording_mic_status");
    if (st === "ok") return;
    hint.textContent = t(st === "denied" ? "extras.rec.micDenied" : "extras.rec.noMic");
    hint.classList.remove("hidden");
    return false;
  });
  const cSys = chip("system_audio", t("extras.rec.system"), "🔊");
  const cCam = chip("webcam", t("extras.rec.webcam"), "📷", async (on) => {
    try {
      await invoke("recording_camera", { on, size: o.webcam_size, shape: o.webcam_shape });
    } catch (e) {
      console.error(e);
    }
  });
  r2.append(cCursor, cClicks, cKeys, cMic, cSys, cCam);

  // row: webcam style
  const r3 = el("div", "row");
  r3.append(el("span", "hint", t("extras.rec.webcamStyle")));
  const sizeSeg = el("div", "seg small");
  (["s", "m", "l"] as const).forEach((s) => {
    const b = el("button", o.webcam_size === s ? "on" : "", s.toUpperCase());
    b.onclick = () => {
      o.webcam_size = s;
      sizeSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      void invoke("recording_camera", { on: true, size: o.webcam_size, shape: o.webcam_shape });
    };
    sizeSeg.append(b);
  });
  const shapeSeg = el("div", "seg small");
  ([["circle", "●"], ["rounded", "▣"]] as const).forEach(([s, icon]) => {
    const b = el("button", o.webcam_shape === s ? "on" : "", icon);
    b.onclick = () => {
      o.webcam_shape = s;
      shapeSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      void invoke("recording_camera", { on: true, size: o.webcam_size, shape: o.webcam_shape });
    };
    shapeSeg.append(b);
  });
  r3.append(sizeSeg, shapeSeg, el("span", "hint", t("extras.rec.webcamDrag")));

  // row: countdown / max duration / after
  const r4 = el("div", "row wrap");
  const lab = (key: string, ctl: HTMLElement) => {
    const l = el("label", "row");
    l.append(el("span", "hint", t(key)), ctl);
    return l;
  };
  r4.append(
    lab("extras.rec.countdown", select([["0", "—"], ["3", "3"], ["5", "5"], ["10", "10"]], String(o.countdown), (v) => (o.countdown = Number(v)))),
    lab("extras.rec.maxDuration", select([["0", t("extras.rec.noLimit")], ["1", "1 min"], ["5", "5 min"], ["10", "10 min"], ["30", "30 min"], ["60", "60 min"]], String(o.max_minutes), (v) => (o.max_minutes = Number(v)))),
    lab("extras.rec.after", select([["video", t("extras.rec.after.video")], ["reveal", t("extras.rec.after.reveal")], ["none", t("extras.rec.after.none")]], o.after, (v) => (o.after = v as RecOptions["after"]))),
  );

  // footer
  const foot = el("div", "row between");
  const note = el("div", "hint", "");
  const btns = el("div", "row");
  const cancel = el("button", "btn", t("extras.rec.cancel"));
  cancel.onclick = () => invoke("recording_cancel");
  const start = el("button", "btn primary", "● " + t("extras.rec.start"));
  btns.append(cancel, start);
  foot.append(note, btns);

  const body = el("div", "col");
  body.append(r1, r2, r3, r4, hint);
  panel.append(head, body, foot);
  app.append(panel);

  function refresh() {
    const gif = gifOnlyCursorless();
    const win = target === "window";
    fpsVideo.classList.toggle("hidden", gif);
    fpsGif.classList.toggle("hidden", !gif);
    qualLabel.classList.toggle("hidden", gif);
    cCursor.classList.toggle("hidden", gif);
    cClicks.classList.toggle("hidden", gif || win);
    cKeys.classList.toggle("hidden", gif || win);
    cMic.classList.toggle("hidden", gif);
    cSys.classList.toggle("hidden", gif || !st.sck);
    cCam.classList.toggle("hidden", gif || win);
    r3.classList.toggle("hidden", gif || win || !o.webcam);
    let msg = "";
    if (gif) msg = t("extras.rec.gifHint");
    else if (win) msg = t("extras.rec.windowHint");
    else if (!st.sck) msg = t("extras.rec.noSck");
    note.textContent = msg;
    if (gif && o.webcam) void invoke("recording_camera", { on: false, size: o.webcam_size, shape: o.webcam_shape });
    else if (!gif && !win && o.webcam) void invoke("recording_camera", { on: true, size: o.webcam_size, shape: o.webcam_shape });
  }
  refresh();

  listen("camera-closed", () => {
    o.webcam = false;
    cCam.classList.remove("on");
    refresh();
  });
  listen<string>("camera-error", (ev) => {
    const why = ev.payload.includes("NotAllowed") ? t("extras.rec.cameraDenied") : ev.payload.includes("NotFound") || ev.payload.includes("Overconstrained") ? t("extras.rec.noCamera") : `${t("extras.rec.cameraError")} (${ev.payload})`;
    hint.textContent = why;
    hint.classList.remove("hidden");
  });

  let counting = false;
  let timer: number | undefined;
  const begin = async () => {
    try {
      const sanitized: RecOptions = { ...o, clicks: o.clicks && target !== "window", keys: o.keys && target !== "window", webcam: o.webcam && target !== "window" };
      await invoke<number>("recording_begin", { options: sanitized });
      const status = await invoke<RecStatus>("recording_status");
      showRecording(status);
    } catch (e) {
      console.error(e);
      counting = false;
      btns.replaceChildren(cancel, start);
      hint.textContent = String(e);
      hint.classList.remove("hidden");
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
}

// ------------------------------------------------------------------------------------- recording
function showRecording(st: RecStatus) {
  app.innerHTML = "";
  const panel = el("div", "panel bar");
  panel.setAttribute("data-tauri-drag-region", "");
  const dot = el("div", "dot");
  const timer = el("div", "timer", fmtClock(st.elapsed_ms));
  timer.setAttribute("data-tauri-drag-region", "");
  const pause = el("button", "btn icon pause", "⏸");
  pause.title = t("extras.rec.pause");
  pause.classList.toggle("hidden", !st.can_pause);
  const setPaused = (p: boolean) => {
    panel.classList.toggle("paused", p);
    pause.textContent = p ? "▶" : "⏸";
    pause.title = p ? t("extras.rec.resume") : t("extras.rec.pause");
  };
  setPaused(st.paused);
  pause.onclick = async () => {
    try {
      setPaused(await invoke<boolean>("recording_pause"));
    } catch (e) {
      console.error(e);
    }
  };
  const stop = el("button", "btn primary", "■ " + t("extras.rec.stop"));
  stop.onclick = () => {
    stop.disabled = true;
    stop.textContent = t("extras.rec.saving");
    invoke("recording_stop");
  };
  const discard = el("button", "btn icon", "🗑");
  discard.title = t("extras.rec.discard");
  discard.onclick = () => invoke("recording_cancel");
  panel.append(dot, timer, el("span", "spacer"), pause, stop, discard);
  app.append(panel);
  listen<{ elapsed_ms: number; paused: boolean }>("recording-tick", (ev) => {
    timer.textContent = fmtClock(ev.payload.elapsed_ms);
    setPaused(ev.payload.paused);
  });
  listen<string>("recording-warning", (ev) => {
    timer.title = ev.payload === "mic-unavailable" || ev.payload === "mic-denied" ? t("extras.rec.micMissing") : ev.payload === "sck-fallback" ? t("extras.rec.fallback") : ev.payload;
    dot.classList.add("warn");
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === " " && st.can_pause) {
      e.preventDefault();
      pause.click();
    }
  });
}

void emit;
init();
