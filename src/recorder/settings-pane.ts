// "Recording" tab of the settings window. Options live in recording.json (Rust), not settings.json.
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { applyI18n, t } from "../shared/i18n";
import type { RecOptions } from "./types";

const sw = (id: string) => `<label class="switch"><input type="checkbox" id="${id}"><span></span></label>`;
const row = (label: string, ctl: string, hint?: string) =>
  `<div class="row"><div class="label"><span data-i18n="${label}"></span>${hint ? `<small data-i18n="${hint}"></small>` : ""}</div><div class="ctl">${ctl}</div></div>`;
const sel = (id: string, opts: [string, string][]) =>
  `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}"${l.startsWith("extras.") ? ` data-i18n="${l}"` : ""}>${l.startsWith("extras.") ? "" : l}</option>`).join("")}</select>`;

export async function mountRecordingPane(root: HTMLElement, toast: (msg: string) => void) {
  root.innerHTML = `
    <h2 data-i18n="extras.set.video"></h2>
    ${row("extras.set.format", sel("rc_format", [["mp4", "MP4 (H.264/HEVC)"], ["mov", "MOV"], ["gif", "GIF"]]))}
    ${row("extras.set.fps", sel("rc_video_fps", [["30", "30"], ["60", "60"]]))}
    ${row("extras.rec.quality", sel("rc_quality", [["low", "extras.rec.q.low"], ["medium", "extras.rec.q.medium"], ["high", "extras.rec.q.high"]]))}
    ${row("extras.set.codec", sel("rc_codec", [["h264", "H.264 (compatible)"], ["hevc", "HEVC (smaller)"]]), "extras.set.codec.hint")}
    ${row("extras.set.gifFps", sel("rc_fps", [["10", "10"], ["12", "12"], ["15", "15"]]))}
    <h2 data-i18n="extras.set.sources"></h2>
    ${row("extras.rec.mic", sw("rc_mic"), "extras.set.mic.hint")}
    ${row("extras.rec.system", sw("rc_system_audio"), "extras.set.system.hint")}
    ${row("extras.rec.cursor", sw("rc_cursor"))}
    ${row("extras.rec.clicks", sw("rc_clicks"), "extras.set.clicks.hint")}
    ${row("extras.rec.keys", sw("rc_keys"), "extras.set.keys.hint")}
    ${row("extras.rec.webcam", sw("rc_webcam"), "extras.set.webcam.hint")}
    ${row("extras.set.webcamSize", sel("rc_webcam_size", [["s", "S"], ["m", "M"], ["l", "L"]]))}
    ${row("extras.set.webcamShape", sel("rc_webcam_shape", [["circle", "extras.set.circle"], ["rounded", "extras.set.rounded"]]))}
    <h2 data-i18n="extras.set.behaviour"></h2>
    ${row("extras.rec.countdown", sel("rc_countdown", [["0", "—"], ["3", "3"], ["5", "5"], ["10", "10"]]))}
    ${row("extras.rec.maxDuration", sel("rc_max_minutes", [["0", "extras.rec.noLimit"], ["1", "1 min"], ["5", "5 min"], ["10", "10 min"], ["30", "30 min"], ["60", "60 min"]]))}
    ${row("extras.rec.after", sel("rc_after", [["video", "extras.rec.after.video"], ["reveal", "extras.rec.after.reveal"], ["none", "extras.rec.after.none"]]))}
    ${row("extras.set.folder", `<span class="path" id="rc_dir_label"></span><button class="btn" id="rc_choose" data-i18n="tools.settings.choose"></button><button class="btn" id="rc_default" data-i18n="extras.set.defaultFolder"></button><button class="btn" id="rc_open" data-i18n="tools.settings.openFolder"></button>`)}
  `;
  applyI18n(root);
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>("#" + id)!;
  let o = await invoke<RecOptions>("recording_options_get");
  const defaultDir = await invoke<string>("recording_default_dir");

  const bools = ["mic", "system_audio", "cursor", "clicks", "keys", "webcam"] as const;
  const strs = ["format", "quality", "codec", "webcam_size", "webcam_shape", "after"] as const;
  const nums = ["video_fps", "fps", "countdown", "max_minutes"] as const;

  const paint = () => {
    for (const k of bools) ($(`rc_${k}`) as HTMLInputElement).checked = o[k];
    for (const k of strs) ($(`rc_${k}`) as HTMLSelectElement).value = o[k];
    for (const k of nums) ($(`rc_${k}`) as HTMLSelectElement).value = String(o[k]);
    $("rc_dir_label").textContent = o.save_dir || defaultDir;
  };
  const save = async () => {
    o = await invoke<RecOptions>("recording_options_save", { options: o });
    paint();
    toast(t("tools.settings.saved"));
  };
  for (const k of bools) {
    $(`rc_${k}`).onchange = () => {
      o[k] = ($(`rc_${k}`) as HTMLInputElement).checked;
      void save();
    };
  }
  for (const k of strs) {
    $(`rc_${k}`).onchange = () => {
      (o as unknown as Record<string, string>)[k] = ($(`rc_${k}`) as HTMLSelectElement).value;
      void save();
    };
  }
  for (const k of nums) {
    $(`rc_${k}`).onchange = () => {
      o[k] = Number(($(`rc_${k}`) as HTMLSelectElement).value);
      void save();
    };
  }
  $("rc_choose").onclick = async () => {
    const dir = await openDialog({ directory: true, multiple: false, defaultPath: o.save_dir || defaultDir });
    if (typeof dir === "string") {
      o.save_dir = dir;
      void save();
    }
  };
  $("rc_default").onclick = () => {
    o.save_dir = "";
    void save();
  };
  $("rc_open").onclick = () => invoke("recordings_open_folder");
  paint();
}
