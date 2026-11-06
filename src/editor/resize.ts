import { st, setSelection, touch } from "./state";
import { commit } from "./history";
import { mapObj, moveObj, rectIntersect } from "./geom";
import { fit } from "./viewport";

function newCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

/** Scale image pixels (and all annotations) to a new pixel size. */
export function resizeImage(w: number, h: number) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const ow = st.base.width, oh = st.base.height;
  if (w === ow && h === oh) return;
  const nc = newCanvas(w, h);
  const ctx = nc.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(st.base, 0, 0, w, h);
  const from = { x: 0, y: 0, w: ow, h: oh }, to = { x: 0, y: 0, w, h };
  const sc = (w / ow + h / oh) / 2;
  for (const o of st.objects) {
    mapObj(o, from, to);
    o.s.width *= sc; o.s.strength *= sc; o.s.radius *= sc;
  }
  if (st.crop) {
    const c = st.crop;
    const x = Math.round(c.x * w / ow), y = Math.round(c.y * h / oh);
    st.crop = { x, y, w: Math.max(1, Math.min(w - x, Math.round(c.w * w / ow))), h: Math.max(1, Math.min(h - y, Math.round(c.h * h / oh))) };
  }
  st.base = nc;
  finish();
}

/** Change canvas size, anchoring existing content (ax/ay in 0,.5,1). fill = css colour or null for transparent. */
export function resizeCanvas(w: number, h: number, ax: number, ay: number, fill: string | null) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const ow = st.base.width, oh = st.base.height;
  if (w === ow && h === oh) return;
  const ox = Math.round((w - ow) * ax), oy = Math.round((h - oh) * ay);
  const nc = newCanvas(w, h);
  const ctx = nc.getContext("2d")!;
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(st.base, ox, oy);
  for (const o of st.objects) moveObj(o, ox, oy);
  if (st.crop) {
    const c = { x: st.crop.x + ox, y: st.crop.y + oy, w: st.crop.w, h: st.crop.h };
    st.crop = rectIntersect(c, { x: 0, y: 0, w, h });
  }
  st.base = nc;
  finish();
}

function finish() {
  setSelection([]);
  touch(); commit(); fit();
}
