import React from "react";
import { C, FONT } from "../theme";
import { Stage } from "./common";
import { cursorAt, seg, ease, easeInOut, lerp, window01 } from "./anim";
import { Cursor, ClickRipple } from "../ui/Cursor";
import { MacWindow } from "../ui/MacWindow";
import { Wallpaper, MenuBar } from "../ui/Desktop";
import { FakeArticle } from "../ui/FakePage";
import { KeyCombo } from "../ui/Keys";
import { KeyPress } from "./demos-capture";
import { keys } from "../site";
import { Check, Mic, MousePointer2, FolderOpen, Square, Film, Camera as CamIcon } from "lucide-react";

const ARTICLE_H = 1500;

export const ScrollDemo: React.FC<{ t: number }> = ({ t }) => {
  const view = { x: 190, y: 120, w: 760, h: 440 };
  const cur = cursorAt(t, [
    { t: 0.5, x: 230, y: 160 }, { t: 0.7, x: view.x, y: view.y, click: true, hold: 0.05 }, { t: 1.7, x: view.x + view.w, y: view.y + view.h },
    { t: 2.4, x: 560, y: 380 }, { t: 6.4, x: 560, y: 380 }, { t: 7.5, x: 1060, y: 372, click: true }, { t: 8.5, x: 900, y: 600 },
  ]);
  const drag = seg(t, 0.75, 1.7);
  const frameO = seg(t, 1.8, 2.2);
  const scrollY = seg(t, 2.6, 6.4, easeInOut) * (ARTICLE_H - view.h);
  const stitched = view.h + scrollY;
  const frames = Math.max(1, Math.round(stitched / 240));
  const done = seg(t, 7.6, 8.1, ease);
  const overlayO = 1 - seg(t, 1.7, 2.0);
  return (
    <Stage>
      <Wallpaper width={1200} height={720} />
      <MenuBar width={1200} />
      <MacWindow width={800} height={520} x={170} y={76} title="บทความ – Browser" bodyStyle={{ background: "#fff" }}>
        <div style={{ position: "absolute", left: 20, top: 24 - 0, width: 760, height: 440, overflow: "hidden" }}>
          <div style={{ transform: `translateY(${-scrollY}px)` }}><FakeArticle height={ARTICLE_H} /></div>
        </div>
      </MacWindow>
      {t < 1.9 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, opacity: overlayO }}>
          {drag === 0 && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" }} />}
          {drag > 0 && <div style={{ position: "absolute", left: view.x, top: view.y, width: view.w * drag, height: view.h * drag, boxShadow: "0 0 0 2400px rgba(0,0,0,.4)", outline: "2px solid #fff" }} />}
        </div>
      )}
      {frameO > 0 && (
        <div style={{ position: "absolute", left: view.x, top: view.y, width: view.w, height: view.h, border: "3px dashed #3b82f6", boxSizing: "border-box", opacity: frameO, zIndex: 30 }} />
      )}
      {frameO > 0 && (
        <div style={{ position: "absolute", left: 975, top: 100, width: 210, borderRadius: 16, background: "rgba(255,255,255,.97)", boxShadow: "0 22px 50px rgba(0,0,0,.45)", padding: 14, fontFamily: FONT, opacity: frameO * (1 - done), zIndex: 50 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>สกรอลล์จับภาพ</div>
          <div style={{ marginTop: 8, height: 200, borderRadius: 10, background: "#f1f5f9", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 182, height: (stitched / ARTICLE_H) * 200 * (ARTICLE_H / 1500) * 1.0, overflow: "hidden" }}>
              <div style={{ transform: `scale(${182 / 760})`, transformOrigin: "0 0" }}><FakeArticle height={ARTICLE_H} /></div>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: C.slate }}>ความสูง {Math.round(stitched * 2).toLocaleString()} px · {frames} เฟรม</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <div style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 8, background: "#eff6ff", color: "#1d4ed8", fontSize: 13, fontWeight: 700 }}>เลื่อนอัตโนมัติ</div>
            <div style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 8, background: C.red, color: "#fff", fontSize: 13, fontWeight: 700 }}>เสร็จสิ้น</div>
          </div>
        </div>
      )}
      {done > 0 && (
        <div style={{ position: "absolute", left: 820, top: 70, width: 330, height: 570, borderRadius: 16, background: "#fff", boxShadow: "0 30px 70px rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.1)", overflow: "hidden", opacity: done, transform: `translateX(${(1 - done) * 60}px)`, zIndex: 60, fontFamily: FONT }}>
          <div style={{ height: 34, background: "#f1f5f9", fontSize: 13, fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", padding: "0 12px" }}>ตัวแก้ไข · ภาพที่ต่อแล้ว 1,520 × 3,000 px</div>
          <div style={{ transform: `scale(${330 / 760}) `, transformOrigin: "0 0" }}><FakeArticle height={ARTICLE_H} /></div>
          <div style={{ position: "absolute", left: 14, bottom: 14, padding: "8px 14px", borderRadius: 10, background: C.green, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", gap: 6, alignItems: "center" }}><Check size={16} strokeWidth={3.5} /> ต่อภาพสำเร็จ</div>
        </div>
      )}
      <KeyPress k={keys("scroll")} t={t} a={0.0} b={1.3} label="สกรอลล์จับภาพ" />
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

const Seg: React.FC<{ items: string[]; active: number }> = ({ items, active }) => (
  <div style={{ display: "flex", padding: 3, borderRadius: 10, background: "#334155" }}>
    {items.map((x, i) => <div key={x} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 15, fontWeight: 700, color: i === active ? C.ink : "#cbd5e1", background: i === active ? "#fff" : "transparent" }}>{x}</div>)}
  </div>
);

export const RecordDemo: React.FC<{ t: number }> = ({ t }) => {
  const sel = { x: 250, y: 130, w: 520, h: 330 };
  const cur = cursorAt(t, [
    { t: 0.4, x: 220, y: 100 }, { t: 0.6, x: sel.x, y: sel.y, click: true, hold: 0.05 }, { t: 1.5, x: sel.x + sel.w, y: sel.y + sel.h },
    { t: 2.6, x: 830, y: sel.y + sel.h + 50, click: false }, { t: 3.0, x: 830, y: sel.y + sel.h + 50, click: true },
    { t: 4.9, x: 400, y: 300 }, { t: 5.4, x: 520, y: 260, click: true }, { t: 6.4, x: 620, y: 360, click: true }, { t: 7.2, x: 600, y: 330 },
    { t: 7.9, x: 700, y: sel.y - 40, click: true }, { t: 8.8, x: 900, y: 600 },
  ]);
  const drag = seg(t, 0.65, 1.5);
  const setup = seg(t, 1.8, 2.2, ease) * (1 - seg(t, 3.15, 3.4));
  const recording = t >= 4.7 && t < 8.0;
  const count = t >= 3.2 && t < 4.7 ? 3 - Math.floor((t - 3.2) / 0.5) : 0;
  const secs = Math.max(0, Math.floor((t - 4.7) * 1));
  const pulse = 0.55 + 0.45 * Math.sin(t * 6);
  const saved = seg(t, 8.2, 8.6, ease);
  const overlay = t < 3.2 ? 1 : 0;
  return (
    <Stage>
      <Wallpaper width={1200} height={720} variant={1} />
      <MenuBar width={1200} recording={recording} />
      <MacWindow width={900} height={560} x={150} y={70} title="เว็บไซต์ตัวอย่าง" bodyStyle={{ background: "#fff" }}>
        <div style={{ transform: "scale(.93)", transformOrigin: "0 0" }}><div style={{ width: 960, height: 560 }}><FakeArticleWide t={t} /></div></div>
      </MacWindow>
      {overlay > 0 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
          {drag === 0 && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" }} />}
          {drag > 0 && <div style={{ position: "absolute", left: sel.x, top: sel.y, width: sel.w * drag, height: sel.h * drag, boxShadow: "0 0 0 2400px rgba(0,0,0,.4)", outline: "2px solid #fff" }} />}
        </div>
      )}
      {setup > 0 && (
        <div style={{ position: "absolute", left: 230, top: sel.y + sel.h + 14, width: 760, display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 16, background: "rgba(15,23,42,.94)", opacity: setup, transform: `translateY(${(1 - setup) * 10}px)`, boxShadow: "0 18px 40px rgba(0,0,0,.45)", zIndex: 60, fontFamily: FONT, color: "#fff" }}>
          <Seg items={["MP4", "MOV", "GIF"]} active={0} />
          {[[MousePointer2, "เคอร์เซอร์"], [Check, "แสดงการคลิก"], [Mic, "ไมค์"], [CamIcon, "เว็บแคม"]].map(([Ic, l], i) => {
            const I = Ic as typeof Mic;
            return <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, color: "#e2e8f0" }}><I size={17} color="#4ade80" strokeWidth={2.6} />{l as string}</div>;
          })}
          <div style={{ marginLeft: "auto", padding: "9px 18px", borderRadius: 10, background: C.red, fontSize: 16, fontWeight: 700 }}>● เริ่มบันทึก</div>
        </div>
      )}
      {count > 0 && (
        <div style={{ position: "absolute", left: sel.x + sel.w / 2, top: sel.y + sel.h / 2, transform: `translate(-50%,-50%) scale(${1 + 0.15 * (1 - ((t - 3.2) % 0.5) / 0.5)})`, width: 140, height: 140, borderRadius: 70, background: "rgba(15,23,42,.8)", color: "#fff", fontFamily: FONT, fontSize: 86, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }}>{count}</div>
      )}
      {(recording || (t >= 3.2 && t < 4.7)) && (
        <div style={{ position: "absolute", left: sel.x, top: sel.y, width: sel.w, height: sel.h, border: `4px solid ${C.red}`, boxSizing: "border-box", boxShadow: recording ? `0 0 ${12 + pulse * 14}px rgba(220,38,38,.7)` : "none", zIndex: 50 }} />
      )}
      {recording && (
        <div style={{ position: "absolute", left: sel.x + 22, top: sel.y + sel.h - 138, width: 116, height: 116, borderRadius: 58, background: "linear-gradient(160deg,#fbbf24,#f97316)", boxShadow: "0 10px 26px rgba(0,0,0,.45), 0 0 0 4px #fff", overflow: "hidden", zIndex: 55 }}>
          <div style={{ position: "absolute", left: 38, top: 24, width: 40, height: 40, borderRadius: 20, background: "#7c2d12" }} />
          <div style={{ position: "absolute", left: 16, top: 70, width: 84, height: 70, borderRadius: 42, background: "#7c2d12" }} />
        </div>
      )}
      {recording && (
        <>
          <div style={{ position: "absolute", left: sel.x + sel.w / 2, top: sel.y + sel.h + 14, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", borderRadius: 14, background: "rgba(15,23,42,.94)", color: "#fff", fontFamily: FONT, zIndex: 60 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: C.red, opacity: pulse }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>กำลังบันทึก 00:{String(secs).padStart(2, "0")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 9, background: "#fff", color: C.ink, fontSize: 15, fontWeight: 700 }}><Square size={13} fill={C.red} color={C.red} /> หยุด</div>
          </div>
        </>
      )}
      {saved > 0 && (
        <div style={{ position: "absolute", left: 600, top: 300, transform: `translate(-50%,-50%) scale(${0.9 + saved * 0.1})`, opacity: saved, padding: "18px 26px", borderRadius: 18, background: "rgba(255,255,255,.98)", boxShadow: "0 26px 60px rgba(0,0,0,.45)", fontFamily: FONT, display: "flex", gap: 16, alignItems: "center", zIndex: 80 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg,#ef4444,#7f1d1d)", display: "flex", alignItems: "center", justifyContent: "center" }}><Film size={30} color="#fff" /></div>
          <div><div style={{ fontSize: 19, fontWeight: 700, color: C.ink }}>CaptureME … Recording.mp4</div><div style={{ fontSize: 15, color: C.slate, display: "flex", alignItems: "center", gap: 6 }}><FolderOpen size={15} /> บันทึกที่ Pictures/CaptureME/Recordings</div></div>
        </div>
      )}
      {t < 0.9 && <KeyPress k={keys("record")} t={t} a={0} b={0.9} label="บันทึกหน้าจอ" />}
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color={recording ? "#facc15" : "#fff"} />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

/** Lightly animated page used under the recording demo (so the video "has motion"). */
const FakeArticleWide: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ width: 960, height: 560, background: "#f8fafc", position: "relative", fontFamily: FONT }}>
    <div style={{ position: "absolute", left: 40, top: 30, fontSize: 30, fontWeight: 700, color: C.ink }}>ภาพรวมโครงการ</div>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ position: "absolute", left: 40 + i * 290, top: 100, width: 270, height: 150, borderRadius: 14, background: "#fff", boxShadow: "0 1px 3px rgba(15,23,42,.1)", padding: 16 }}>
        <div style={{ width: 90, height: 12, borderRadius: 6, background: "#e2e8f0" }} />
        <div style={{ marginTop: 22, display: "flex", alignItems: "flex-end", gap: 8, height: 70 }}>
          {[0, 1, 2, 3, 4, 5].map((k) => <div key={k} style={{ flex: 1, height: 14 + 50 * Math.abs(Math.sin(t * 1.6 + i + k * 0.7)), borderRadius: 4, background: ["#fca5a5", "#a5b4fc", "#86efac"][i] }} />)}
        </div>
      </div>
    ))}
    {[0, 1, 2, 3].map((i) => <div key={i} style={{ position: "absolute", left: 40, top: 290 + i * 40, width: 880 - i * 120, height: 14, borderRadius: 7, background: "#e2e8f0" }} />)}
  </div>
);

export const AdvDemo: React.FC<{ t: number }> = ({ t }) => {
  const a = 1 - seg(t, 8.7, 9.3), b = seg(t, 8.7, 9.3);
  return (
    <div style={{ position: "relative", width: 1200, height: 720 }}>
      {a > 0 && <div style={{ position: "absolute", inset: 0, opacity: a }}><ScrollDemo t={t} /></div>}
      {b > 0 && <div style={{ position: "absolute", inset: 0, opacity: b }}><RecordDemo t={Math.max(0, t - 9)} /></div>}
    </div>
  );
};
export { KeyCombo, lerp, window01 };
