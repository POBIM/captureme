// Tiny i18n. Each feature area owns its own dictionary file in src/i18n/<area>.ts
// and registers it here via the import list below.
import { common } from "../i18n/common";
import { capture } from "../i18n/capture";
import { editor } from "../i18n/editor";
import { tools } from "../i18n/tools";
import { extras } from "../i18n/extras";

export type Lang = "th" | "en";
type Dict = Record<string, { th: string; en: string }>;
const dict: Dict = { ...common, ...capture, ...editor, ...tools, ...extras };

let lang: Lang = (localStorage.getItem("captureme.lang") as Lang) || "th";

export function setLang(l: Lang) {
  lang = l;
  localStorage.setItem("captureme.lang", l);
  applyI18n();
}
export function getLang(): Lang {
  return lang;
}
export function t(key: string): string {
  return dict[key]?.[lang] ?? key;
}
/** Replace text of every element with data-i18n="key" (and data-i18n-title for tooltips). */
export function applyI18n(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n!)));
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle!)));
}
