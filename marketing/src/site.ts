import site from "../site.json";
import app from "./generated/app.json";
import qr from "./generated/qr.json";

export const SITE = site;
export const APP = app as {
  version: string;
  minMacOS: string;
  hotkeys: Record<string, string>;
  shortcuts: Record<string, string[]>;
};
export const QR = qr as { url: string; size: number; rows: string[] };
/** Keys (⌃⇧2 → ["⌃","⇧","2"]) for an action id. */
export const keys = (action: string): string[] => APP.shortcuts[action] ?? [];

export const DOWNLOAD_URL_FULL = "github.com/POBIM/captureme/releases/latest";
