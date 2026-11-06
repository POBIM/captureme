import React from "react";
import { C, FONT } from "../theme";
import { Stage } from "./common";
import { cursorAt, seg, ease, window01, easeInOut, lerp } from "./anim";
import { Cursor, ClickRipple } from "../ui/Cursor";
import { MacWindow } from "../ui/MacWindow";
import { Wallpaper, MenuBar, TrayMenu } from "../ui/Desktop";
import { FakePage } from "../ui/FakePage";
import { KeyCombo } from "../ui/Keys";
import { keys } from "../site";
import { Check, Copy, Pin, ScanText, X, Crosshair } from "lucide-react";

/** Desktop with a "browser" window showing the fake dashboard. */
export const BrowserDesk: React.FC<{ children?: React.ReactNode; trayActive?: boolean; wp?: number }> = ({ children, trayActive, wp = 0 }) => (
  <>
    <Wallpaper width={1200} height={720} variant={wp} />
    <MenuBar width={1200} trayActive={trayActive} />
    <MacWindow width={816} height={554} x={192} y={92} title="รายงานยอดขาย – Browser" bodyStyle={{ background: "#fff" }}>
      <div style={{ transform: "scale(.85)", transformOrigin: "0 0", width: 960, height: 600 }}><FakePage /></div>
    </MacWindow>
    {children}
  </>
);

export const KeyPress: React.FC<{ k: string[]; t: number; a: number; b: number; label?: string }> = ({ k, t, a, b, label }) => {
  const o = window01(t, a, b, 0.25);
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 600, bottom: 36, transform: `translateX(-50%) scale(${0.9 + 0.1 * o})`, opacity: o, display: "flex", alignItems: "center", gap: 18, padding: "14px 26px", borderRadius: 22, background: "rgba(15,23,42,.88)", boxShadow: "0 16px 40px rgba(0,0,0,.4)", zIndex: 80, fontFamily: FONT }}>
      <KeyCombo keys={k} size={30} dark />
      {label && <span style={{ color: "#fff", fontSize: 24, fontWeight: 600 }}>{label}</span>}
    </div>
  );
};

const HintPill: React.FC<{ text: string; o: number }> = ({ text, o }) => (
  <div style={{ position: "absolute", left: 600, top: 62, transform: "translateX(-50%)", padding: "9px 20px", borderRadius: 999, background: "rgba(15,23,42,.85)", color: "#fff", fontFamily: FONT, fontSize: 16, fontWeight: 500, opacity: o, zIndex: 70, whiteSpace: "nowrap" }}>{text}</div>
);

const Flash: React.FC<{ t: number; at: number }> = ({ t, at }) => {
  const p = seg(t, at, at + 0.35, easeInOut);
  const o = t < at ? 0 : 0.9 * (1 - p);
  return o > 0 ? <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: o, zIndex: 90 }} /> : null;
};

const Thumb: React.FC<{ t: number; at: number; w: number; h: number; label: string; content?: "crop" | "full" | "window" }> = ({ t, at, w, h, label, content = "crop" }) => {
  const p = seg(t, at, at + 0.5, ease);
  if (t < at) return null;
  return (
    <div style={{ position: "absolute", right: 28, bottom: 28, transform: `translateX(${(1 - p) * 140}px)`, opacity: p, zIndex: 85, fontFamily: FONT }}>
      <div style={{ width: w + 16, padding: 8, borderRadius: 16, background: "rgba(255,255,255,.96)", boxShadow: "0 20px 50px rgba(0,0,0,.45)" }}>
        <div style={{ width: w, height: h, borderRadius: 10, overflow: "hidden", position: "relative", background: "#f1f5f9" }}>
          <div style={{ position: "absolute", left: content === "crop" ? -w * 0.62 : 0, top: content === "crop" ? -h * 0.55 : 0, transform: `scale(${content === "crop" ? 0.62 * (w / 340) * 1.1 : w / 960})`, transformOrigin: "0 0" }}><FakePage /></div>
        </div>
        <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600, color: C.ink, display: "flex", alignItems: "center", gap: 6 }}><Check size={16} color={C.green} strokeWidth={3} /> {label}</div>
      </div>
    </div>
  );
};

export const RegionDemo: React.FC<{ t: number }> = ({ t }) => {
  const sel = { x: 452, y: 232, w: 352, h: 238 };
  const cur = cursorAt(t, [
    { t: 1.3, x: 330, y: 210 }, { t: 2.3, x: sel.x, y: sel.y, click: true, hold: 0.1 }, { t: 4.2, x: sel.x + sel.w, y: sel.y + sel.h },
    { t: 5.4, x: 640, y: 560 }, { t: 6.1, x: 560 + 20, y: sel.y + sel.h + 36, click: true },
  ]);
  const overlay = window01(t, 1.2, 6.2, 0.3);
  const drag = seg(t, 2.35, 4.2, easeInOut);
  const rect = t < 2.35 ? null : { x: sel.x, y: sel.y, w: sel.w * drag, h: sel.h * drag };
  const toolbar = seg(t, 4.7, 5.1, ease);
  const gone = 1 - seg(t, 6.3, 6.5);
  const tools = [Check, Copy, Pin, ScanText, X];
  return (
    <Stage>
      <BrowserDesk trayActive={false} />
      {overlay > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: overlay * gone, zIndex: 40 }}>
          {!rect && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.42)" }} />}
          {/* crosshair before drag */}
          {!rect && (
            <>
              <div style={{ position: "absolute", left: cur.x, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.55)" }} />
              <div style={{ position: "absolute", top: cur.y, left: 0, right: 0, height: 1, background: "rgba(255,255,255,.55)" }} />
            </>
          )}
          {rect && (
            <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxShadow: "0 0 0 2400px rgba(0,0,0,.42)", outline: "2px solid #fff", borderRadius: 2 }}>
              {[[0, 0], [1, 0], [0, 1], [1, 1], [.5, 0], [.5, 1], [0, .5], [1, .5]].map(([ax, ay], i) => (
                <div key={i} style={{ position: "absolute", left: `${ax * 100}%`, top: `${ay * 100}%`, width: 11, height: 11, marginLeft: -5.5, marginTop: -5.5, borderRadius: 6, background: "#fff", boxShadow: "0 0 0 1.5px #dc2626", opacity: drag > 0.95 ? 1 : 0 }} />
              ))}
              <div style={{ position: "absolute", left: 0, top: -34, padding: "4px 10px", borderRadius: 7, background: "rgba(15,23,42,.9)", color: "#fff", fontFamily: FONT, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{Math.round(rect.w * 1.0)} × {Math.round(rect.h * 1.0)}</div>
            </div>
          )}
          <HintPill text="ลากเพื่อเลือกพื้นที่ · คลิกเพื่อเลือกหน้าต่าง · Esc ยกเลิก" o={1 - seg(t, 2.3, 2.7)} />
          {toolbar > 0 && (
            <div style={{ position: "absolute", left: sel.x + sel.w - 5 * 46 - 12, top: sel.y + sel.h + 14, display: "flex", gap: 4, padding: 6, borderRadius: 14, background: "rgba(15,23,42,.92)", opacity: toolbar, transform: `translateY(${(1 - toolbar) * 8}px)`, boxShadow: "0 12px 30px rgba(0,0,0,.4)" }}>
              {tools.map((Ic, i) => (
                <div key={i} style={{ width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: i === 0 ? (t > 6.05 ? "#16a34a" : C.red) : "transparent", color: "#fff" }}><Ic size={22} strokeWidth={2.4} /></div>
              ))}
            </div>
          )}
        </div>
      )}
      <Flash t={t} at={6.2} />
      <Thumb t={t} at={6.5} w={230} h={156} label="จับภาพแล้ว · คัดลอกแล้ว" />
      <KeyPress k={keys("region")} t={t} a={0.3} b={2.0} label="จับภาพพื้นที่" />
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} opacity={t > 6.4 ? 0.0 : 1} />
    </Stage>
  );
};

export const WindowDemo: React.FC<{ t: number }> = ({ t }) => {
  const cur = cursorAt(t, [
    { t: 0.9, x: 330, y: 560 }, { t: 1.9, x: 880, y: 420 }, { t: 2.3, x: 640, y: 360 }, { t: 3.2, x: 600, y: 350, click: true },
  ]);
  const over = window01(t, 0.4, 3.3, 0.2);
  // hover highlight shifts from "notes" window (right-bottom) to browser once the cursor leaves it
  const notesHover = cur.x > 800 && cur.y > 380;
  const notes = { x: 760, y: 360, w: 360, h: 270 };
  const browser = { x: 192, y: 92, w: 816, h: 554 };
  const h = notesHover ? notes : browser;
  return (
    <Stage>
      <BrowserDesk wp={1}>
        <MacWindow width={notes.w} height={notes.h} x={notes.x} y={notes.y} title="Notes" bodyStyle={{ background: "#fffbeb" }}>
          <div style={{ padding: 20, fontFamily: FONT, fontSize: 18, color: "#78350f", lineHeight: 1.6 }}>• ซื้อนม<br />• ส่งรายงาน<br />• โทรหาลูกค้า</div>
        </MacWindow>
      </BrowserDesk>
      <div style={{ position: "absolute", inset: 0, opacity: over, zIndex: 40 }}>
        <div style={{ position: "absolute", left: h.x, top: h.y, width: h.w, height: h.h, background: "rgba(37,99,235,.28)", outline: "3px solid #2563eb", borderRadius: 14, transition: "none" }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", padding: "6px 14px", borderRadius: 8, background: "rgba(15,23,42,.9)", color: "#fff", fontFamily: FONT, fontSize: 15, fontWeight: 600 }}>{notesHover ? "Notes" : "Browser"} · {h.w} × {h.h}</div>
        </div>
        <HintPill text="คลิกที่หน้าต่างที่ต้องการจับภาพ · Esc ยกเลิก" o={1} />
      </div>
      <Flash t={t} at={3.3} />
      <Thumb t={t} at={3.6} w={250} h={170} label="จับภาพหน้าต่างแล้ว" content="window" />
      <KeyPress k={keys("window")} t={t} a={0.1} b={1.6} label="จับภาพหน้าต่าง" />
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} opacity={t > 3.5 ? 0 : 1} />
    </Stage>
  );
};

export const FullDelayDemo: React.FC<{ t: number }> = ({ t }) => {
  const items = [
    { label: "จับภาพพื้นที่", keys: keys("region").join("") },
    { label: "จับภาพหน้าต่าง", keys: keys("window").join("") },
    { label: "จับภาพเต็มหน้าจอ", keys: keys("fullscreen").join("") },
    { label: "จับภาพแบบหน่วงเวลา  ›", keys: "" },
    { sep: true },
    { label: "จับภาพแบบเลื่อน", keys: keys("scroll").join("") },
    { label: "บันทึกหน้าจอ", keys: keys("record").join("") },
    { label: "ดึงข้อความ (OCR)", keys: keys("ocr").join("") },
  ];
  const cur = cursorAt(t, [
    { t: 0.4, x: 700, y: 400 }, { t: 1.0, x: 1112, y: 17, click: true }, { t: 2.0, x: 920, y: 150 }, { t: 2.6, x: 900, y: 150, click: true },
  ]);
  const menu = window01(t, 1.0, 2.7, 0.2);
  const hi = t > 1.7 && t < 2.8 ? 2 : -1;
  // delayed: countdown 5..1 from 3.6
  const cd = t >= 3.6 && t < 6.2 ? 5 - Math.floor((t - 3.6) / 0.55) : 0;
  return (
    <Stage>
      <BrowserDesk trayActive={menu > 0.5 && t < 2.8} />
      {menu > 0 && <div style={{ opacity: menu }}><TrayMenu x={820} y={40} items={items as any} highlight={hi} width={340} scale={0.95} /></div>}
      <Flash t={t} at={2.7} />
      {t > 2.9 && t < 3.5 && (
        <div style={{ position: "absolute", inset: 0, border: "6px solid #fff", borderRadius: 4, opacity: 1 - seg(t, 3.1, 3.5), zIndex: 60, boxSizing: "border-box" }} />
      )}
      <Thumb t={t} at={2.9} w={250} h={158} label="จับภาพเต็มหน้าจอแล้ว" content="full" />
      {cd > 0 && (
        <div style={{ position: "absolute", left: 600, top: 360, width: 150, height: 150, borderRadius: 75, background: "rgba(15,23,42,.82)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 90, fontWeight: 700, boxShadow: "0 20px 50px rgba(0,0,0,.45)", zIndex: 70, transform: `translate(-50%,-50%) scale(${1 + 0.1 * (1 - ((t - 3.6) % 0.55) / 0.55)})` }}>{cd}</div>
      )}
      {t >= 3.6 && t < 6.2 && <KeyPress k={keys("delayed")} t={t} a={3.4} b={6.1} label="หน่วงเวลา" />}
      {t < 3.4 && <KeyPress k={keys("fullscreen")} t={t} a={0.1} b={0.95} label="เต็มหน้าจอ" />}
      <Flash t={t} at={6.2} />
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} opacity={t > 2.9 ? 0 : 1} />
    </Stage>
  );
};

export const CaptureDemo: React.FC<{ t: number }> = ({ t }) => {
  const a = 1 - seg(t, 8.7, 9.3), b = seg(t, 8.7, 9.3) * (1 - seg(t, 13.7, 14.3)), c = seg(t, 13.7, 14.3);
  return (
    <div style={{ position: "relative", width: 1200, height: 720 }}>
      {a > 0 && <div style={{ position: "absolute", inset: 0, opacity: a }}><RegionDemo t={t} /></div>}
      {b > 0 && <div style={{ position: "absolute", inset: 0, opacity: b }}><WindowDemo t={Math.max(0, t - 9)} /></div>}
      {c > 0 && <div style={{ position: "absolute", inset: 0, opacity: c }}><FullDelayDemo t={Math.max(0, t - 14)} /></div>}
    </div>
  );
};
export { lerp, Crosshair };
