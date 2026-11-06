// Webcam bubble: a small floating window showing the camera (getUserMedia). It is part of the
// screen recording because the window is not excluded from capture.
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { applyI18n, setLang, t } from "../shared/i18n";
import { api, queryParam } from "../shared/api";
import "./style.css";

const app = document.getElementById("app")!;
let size = queryParam("size") ?? "m";
let shape = queryParam("shape") ?? "circle";

app.innerHTML = `
  <div id="wrap" data-tauri-drag-region>
    <video id="cam" autoplay muted playsinline></video>
    <div id="msg" class="hidden"></div>
    <div id="ctl">
      <button data-size="s">S</button><button data-size="m">M</button><button data-size="l">L</button>
      <button data-shape="toggle" id="shape">◐</button><button data-close="1">✕</button>
    </div>
  </div>`;
const wrap = document.getElementById("wrap")!;
const video = document.getElementById("cam") as HTMLVideoElement;
const msg = document.getElementById("msg")!;

function style() {
  wrap.className = shape;
  document.querySelectorAll<HTMLButtonElement>("button[data-size]").forEach((b) => b.classList.toggle("on", b.dataset.size === size));
}
style();

async function applyRemote(newSize: string, newShape: string) {
  size = newSize;
  shape = newShape;
  style();
  await invoke("recording_camera", { on: true, size, shape });
}

document.querySelectorAll<HTMLButtonElement>("button[data-size]").forEach((b) => (b.onclick = () => applyRemote(b.dataset.size!, shape)));
document.getElementById("shape")!.onclick = () => applyRemote(size, shape === "circle" ? "rounded" : "circle");
(document.querySelector("button[data-close]") as HTMLButtonElement).onclick = async () => {
  await emit("camera-closed", null);
  await invoke("recording_camera", { on: false, size, shape });
};

listen<{ size: string; shape: string }>("camera-style", (ev) => {
  size = ev.payload.size;
  shape = ev.payload.shape;
  style();
});

async function start() {
  try {
    setLang((await api.getSettings()).language);
  } catch {}
  applyI18n();
  if (!navigator.mediaDevices?.getUserMedia) {
    return fail("mediaDevices unavailable");
  }
  try {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      const name = (e as Error)?.name;
      if (name !== "OverconstrainedError" && name !== "NotReadableError") throw e;
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    msg.classList.add("hidden");
    void emit("camera-ready", null);
  } catch (e) {
    fail(String((e as Error)?.name ?? e));
  }
}

function fail(reason: string) {
  msg.innerHTML = `<div style="text-align:center;font-size:11px;line-height:1.3;padding:0 18%">📷<br>${t(reason.includes("NotAllowed") ? "extras.rec.cameraDeniedShort" : "extras.rec.noCameraShort")}</div>`;
  msg.title = t("extras.rec.cameraError");
  msg.classList.remove("hidden");
  void emit("camera-error", reason);
  console.error("camera:", reason);
}

void getCurrentWindow;
start();
