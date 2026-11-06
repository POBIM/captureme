import "./history.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { api, type CaptureResult, type Settings } from "../shared/api";
import { applyI18n, getLang, setLang, t } from "../shared/i18n";

interface HistoryItem extends CaptureResult {
  edited_path?: string | null;
  thumb_path?: string;
}

let items: HistoryItem[] = [];
let selecting = false;
const selected = new Set<string>();
let dateFilter = ""; // YYYY-MM-DD or ""

const app = document.getElementById("app")!;
app.innerHTML = `
  <div class="bar">
    <span class="title" data-i18n="tools.history.title"></span>
    <input type="date" id="date" data-i18n-title="tools.history.filterDate">
    <button class="btn" id="clear_date" data-i18n="tools.history.allDates"></button>
    <span class="count" id="count"></span>
    <span class="spacer"></span>
    <button class="btn" id="select_toggle" data-i18n="tools.history.select"></button>
    <button class="btn" id="select_all" data-i18n="tools.history.selectAll"></button>
    <button class="btn danger" id="delete_sel"></button>
  </div>
  <div id="content"></div>
  <div id="toast"></div>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const content = $("content");

let toastTimer: number | undefined;
function toast(msg: string) {
  const el = $("toast");
  el.textContent = msg;
  el.className = "show";
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.className = ""), 1500);
}
const fail = (e: unknown) => toast(String(e));

const bestPath = (i: HistoryItem) => i.edited_path || i.path;
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return t("tools.history.today");
  if (key === dayKey(y.toISOString())) return t("tools.history.yesterday");
  const [yy, mm, dd] = key.split("-").map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString(getLang() === "th" ? "th-TH" : "en-US", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(getLang() === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" });

function visible(): HistoryItem[] {
  return dateFilter ? items.filter((i) => dayKey(i.created_at) === dateFilter) : items;
}

function render() {
  const list = visible();
  document.body.classList.toggle("selecting", selecting);
  $("select_toggle").textContent = selecting ? t("tools.history.done") : t("tools.history.select");
  $("select_all").style.display = selecting ? "" : "none";
  const del = $("delete_sel") as HTMLButtonElement;
  del.style.display = selecting ? "" : "none";
  del.textContent = `${t("tools.history.deleteSel")} (${selected.size})`;
  del.disabled = selected.size === 0;
  $("count").textContent = `${list.length} ${t("tools.history.items")}`;

  if (list.length === 0) {
    content.innerHTML = `<div class="empty">${t(items.length === 0 ? "tools.history.empty" : "tools.history.noMatch")}</div>`;
    return;
  }
  const groups = new Map<string, HistoryItem[]>();
  for (const it of list) {
    const k = dayKey(it.created_at);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  content.innerHTML = "";
  for (const [k, arr] of groups) {
    const g = document.createElement("div");
    g.className = "group";
    const h = document.createElement("h3");
    h.innerHTML = `<span></span><span class="sel-all"></span>`;
    h.firstElementChild!.textContent = `${dayLabel(k)} · ${arr.length}`;
    const sa = h.lastElementChild as HTMLElement;
    sa.textContent = t("tools.history.selectDay");
    sa.onclick = () => {
      const all = arr.every((i) => selected.has(i.id));
      arr.forEach((i) => (all ? selected.delete(i.id) : selected.add(i.id)));
      render();
    };
    g.appendChild(h);
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const it of arr) grid.appendChild(card(it));
    g.appendChild(grid);
    content.appendChild(g);
  }
}

function card(it: HistoryItem): HTMLElement {
  const el = document.createElement("div");
  el.className = "card" + (selected.has(it.id) ? " selected" : "");
  const src = api.fileSrc(it.thumb_path || bestPath(it));
  el.innerHTML = `
    <img loading="lazy" draggable="false" alt="">
    ${it.edited_path ? `<span class="edited">${t("tools.history.edited")}</span>` : ""}
    <span class="check">${selected.has(it.id) ? "✓" : ""}</span>
    <div class="actions"></div>
    <div class="meta"><span>${timeLabel(it.created_at)}</span><span>${it.width}×${it.height}</span></div>`;
  (el.querySelector("img") as HTMLImageElement).src = src;
  const actions = el.querySelector(".actions")!;
  const mk = (icon: string, titleKey: string, fn: () => void) => {
    const b = document.createElement("button");
    b.textContent = icon;
    b.title = t(titleKey);
    b.onclick = (e) => {
      e.stopPropagation();
      fn();
    };
    b.ondblclick = (e) => e.stopPropagation();
    actions.appendChild(b);
  };
  mk("✎", "tools.history.open", () => invoke("history_open", { id: it.id }).catch(fail));
  mk("⧉", "tools.history.copy", () =>
    invoke("copy_image_file", { path: bestPath(it) }).then(() => toast(t("tools.history.copied")), fail),
  );
  mk("⌕", "tools.history.reveal", () => invoke("reveal_in_finder", { path: bestPath(it) }).catch(fail));
  mk("📌", "tools.history.pin", () => invoke("pin_file", { path: bestPath(it) }).catch(fail));
  mk("🗑", "tools.history.delete", () => invoke("history_delete", { id: it.id }).catch(fail));

  el.onclick = () => {
    if (!selecting) return void invoke("history_open", { id: it.id }).catch(fail);
    if (!selected.delete(it.id)) selected.add(it.id);
    render();
  };
  return el;
}

async function reload() {
  try {
    items = await invoke<HistoryItem[]>("history_list");
  } catch (e) {
    fail(e);
    items = [];
  }
  for (const id of [...selected]) if (!items.some((i) => i.id === id)) selected.delete(id);
  render();
}

$("select_toggle").onclick = () => {
  selecting = !selecting;
  if (!selecting) selected.clear();
  render();
};
$("select_all").onclick = () => {
  const list = visible();
  const all = list.every((i) => selected.has(i.id));
  list.forEach((i) => (all ? selected.delete(i.id) : selected.add(i.id)));
  render();
};
$("delete_sel").onclick = async () => {
  if (selected.size === 0) return;
  if (!(await ask(`${t("tools.history.confirmDelete")} (${selected.size})`, { title: "CaptureME", kind: "warning" }))) return;
  const ids = [...selected];
  selected.clear();
  await invoke("history_delete_many", { ids }).catch(fail);
};
($("date") as HTMLInputElement).onchange = (e) => {
  dateFilter = (e.target as HTMLInputElement).value;
  render();
};
$("clear_date").onclick = () => {
  dateFilter = "";
  ($("date") as HTMLInputElement).value = "";
  render();
};
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && selecting) {
    selecting = false;
    selected.clear();
    render();
  }
});

async function init() {
  const s = await api.getSettings();
  setLang(s.language);
  applyI18n();
  await reload();
  await listen("history-changed", reload);
  await listen<Settings>("settings-changed", (ev) => {
    setLang(ev.payload.language);
    applyI18n();
    render();
  });
}
init();
