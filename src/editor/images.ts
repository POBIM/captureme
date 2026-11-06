// Registry of bitmaps used by `image` objects. Objects only carry a string key so undo
// snapshots (JSON) stay tiny; the bitmaps live here for the lifetime of the window.
import { uid } from "./geom";

export type Bitmap = ImageBitmap | HTMLCanvasElement | HTMLImageElement;
const reg = new Map<string, Bitmap>();

export function registerImage(img: Bitmap): string {
  const key = "img-" + uid();
  reg.set(key, img);
  return key;
}
export const getImage = (key: string) => reg.get(key);
export function imageSize(b: Bitmap): { w: number; h: number } {
  if (b instanceof HTMLImageElement) return { w: b.naturalWidth, h: b.naturalHeight };
  return { w: b.width, h: b.height };
}
/** Drop bitmaps that no snapshot / object references any more. `inUse` is a big JSON string. */
export function pruneImages(inUse: string) {
  for (const [k, b] of reg) {
    if (!inUse.includes(k)) { (b as ImageBitmap).close?.(); reg.delete(k); }
  }
}
