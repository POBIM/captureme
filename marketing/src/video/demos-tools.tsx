import React from "react";
import { C, FONT } from "../theme";
import { Stage } from "./common";
import { cursorAt, seg, ease, easeInOut, lerp, typedThai, window01 } from "./anim";
import { Cursor, ClickRipple } from "../ui/Cursor";
import { MacWindow } from "../ui/MacWindow";
import { Wallpaper, MenuBar } from "../ui/Desktop";
import { FakePage } from "../ui/FakePage";
import { BrowserDesk, KeyPress } from "./demos-capture";
import { QrCode } from "../ui/Qr";
import { keys } from "../site";
import { Check, Copy, Pin, Pencil, X, Save, FolderOpen, Trash2, ScanText, History as HistoryIcon, Calendar } from "lucide-react";

const DocWindow: React.FC<{ x: number; y: number; w?: number; h?: number; title?: string; lines?: string[] }> = ({ x, y, w = 560, h = 470, title = "แผนงานสัปดาห์นี้.txt", lines }) => (
  <MacWindow width={w} height={h} x={x} y={y} title={title} bodyStyle={{ background: "#fff" }}>
    <div style={{ padding: "26px 32px", fontFamily: FONT, fontSize: 21, color: "#1e293b", lineHeight: 1.75 }}>
      {(lines ?? ["ประชุมทีมวันจันทร์ 10:00", "เตรียมรายงานยอดขายไตรมาส", "ส่งสไลด์ให้ลูกค้าก่อนเที่ยง", "ตรวจสอบตัวเลขในกราฟ", "นัดหมายสัมภาษณ์ผู้สมัคร", "สรุปงบประมาณเดือนหน้า"]).map((l, i) => <div key={i}>• {l}</div>)}
    </div>
  </MacWindow>
);

const PinnedShot: React.FC<{ x: number; y: number; scale?: number; opacity?: number; hover?: number; pop?: number }> = ({ x, y, scale = 1, opacity = 1, hover = 0, pop = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 380 * scale, height: 250 * scale, opacity: opacity * pop, transform: `scale(${0.7 + 0.3 * pop})`, transformOrigin: "50% 50%", zIndex: 30, borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.5), 0 0 0 5px #fff", background: "#fff" }}>
    <div style={{ position: "absolute", left: -250 * 0.46 * scale * 0.9, top: -190 * 0.46 * scale * 0.9, transform: `scale(${0.62 * scale})`, transformOrigin: "0 0" }}><FakePage /></div>
    <div style={{ position: "absolute", left: 8, top: 8, width: 30, height: 30, borderRadius: 15, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px rgba(0,0,0,.4)" }}><Pin size={16} color="#fff" strokeWidth={2.6} /></div>
    <div style={{ position: "absolute", right: 8, top: 8, display: "flex", gap: 6, opacity: hover }}>
      {[Copy, Save, Pencil, X].map((Ic, i) => <div key={i} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(15,23,42,.85)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic size={16} color="#fff" /></div>)}
    </div>
  </div>
);

export const PinDemo: React.FC<{ t: number }> = ({ t }) => {
  const cur = cursorAt(t, [
    { t: 0.4, x: 800, y: 560 }, { t: 1.1, x: 756, y: 466, click: true }, // toolbar pin
    { t: 2.8, x: 880, y: 330 }, { t: 3.2, x: 880, y: 330, click: true, hold: 0.1 }, { t: 4.4, x: 470, y: 420 }, { t: 5.2, x: 560, y: 470 },
  ]);
  const popAt = 1.5;
  const pop = seg(t, popAt, popAt + 0.5, ease);
  const dragging = t > 3.3 && t < 4.4;
  const pos = t < 3.3 ? { x: 740, y: 160 } : t < 4.4 ? { x: lerp(740, 330, seg(t, 3.3, 4.4)), y: lerp(160, 250, seg(t, 3.3, 4.4)) } : { x: 330, y: 250 };
  const opacity = 1 - 0.45 * seg(t, 5.0, 6.0);
  const hover = t > 2.7 && t < 4.6 ? 1 : 0;
  const hud = window01(t, 5.0, 6.8, 0.2);
  void dragging;
  return (
    <Stage>
      <Wallpaper width={1200} height={720} variant={1} />
      <MenuBar width={1200} />
      <DocWindow x={160} y={110} />
      <DocWindow x={560} y={190} w={520} h={420} title="บันทึกประชุม.txt" lines={["เป้าหมายยอดขาย 150,000 บาท", "โปรโมชันเดือนหน้า", "ตรวจสอบสต็อกสินค้า", "นัดลูกค้าใหม่ 3 ราย"]} />
      {t < 1.5 && (
        <>
          <div style={{ position: "absolute", left: 470, top: 290, width: 330, height: 170, boxShadow: "0 0 0 2400px rgba(0,0,0,.35)", outline: "2px solid #fff" }} />
          <div style={{ position: "absolute", left: 470 + 330 - 5 * 46 - 12, top: 478, display: "flex", gap: 4, padding: 6, borderRadius: 14, background: "rgba(15,23,42,.92)" }}>
            {[Check, Copy, Pin, ScanText, X].map((Ic, i) => <div key={i} style={{ width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: i === 2 ? C.red : "transparent", color: "#fff" }}><Ic size={22} strokeWidth={2.4} /></div>)}
          </div>
        </>
      )}
      {t >= popAt && <PinnedShot x={pos.x} y={pos.y} opacity={opacity} hover={hover} pop={pop} />}
      {hud > 0 && (
        <div style={{ position: "absolute", left: 600, top: 640, transform: "translateX(-50%)", opacity: hud, padding: "12px 24px", borderRadius: 16, background: "rgba(15,23,42,.9)", color: "#fff", fontFamily: FONT, fontSize: 22, fontWeight: 600, display: "flex", gap: 14, alignItems: "center", zIndex: 80 }}>
          <span style={{ padding: "4px 10px", borderRadius: 8, background: "#475569" }}>⌥</span> + สกรอลล์ · ความทึบ {Math.round(opacity * 100)}%
        </div>
      )}
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

const OCR_LINES = ["ใบแจ้งหนี้ INV-2026-0042", "ลูกค้า: คุณสมชาย ใจดี", "ยอดรวม 1,250.00 บาท", "ชำระภายใน 30 วัน"];

export const OcrDemo: React.FC<{ t: number }> = ({ t }) => {
  const sel = { x: 300, y: 240, w: 430, h: 220 };
  const cur = cursorAt(t, [
    { t: 0.8, x: 250, y: 200 }, { t: 1.2, x: sel.x, y: sel.y, click: true, hold: 0.1 }, { t: 2.6, x: sel.x + sel.w, y: sel.y + sel.h },
    { t: 4.5, x: 860, y: 520 }, { t: 5.6, x: 930, y: 545, click: true },
  ]);
  const drag = seg(t, 1.25, 2.6);
  const overlay = window01(t, 0.7, 3.6, 0.3);
  const scan = seg(t, 2.8, 3.8, easeInOut);
  const toast = seg(t, 3.9, 4.4, ease);
  const copied = t > 5.7;
  const nLines = Math.floor(seg(t, 4.2, 5.4) * 4.99);
  return (
    <Stage>
      <Wallpaper width={1200} height={720} />
      <MenuBar width={1200} />
      <MacWindow width={640} height={500} x={230} y={110} title="invoice.png" bodyStyle={{ background: "#f8fafc" }}>
        <div style={{ position: "absolute", left: 50, top: 50, width: 540, height: 340, background: "#fff", borderRadius: 10, boxShadow: "0 4px 18px rgba(15,23,42,.15)", padding: "34px 40px", fontFamily: FONT }}>
          <div style={{ position: "absolute", left: 40, top: 34 + 150, width: 0 }} />
          {OCR_LINES.map((l, i) => <div key={i} style={{ fontSize: i === 0 ? 28 : 24, fontWeight: i === 0 ? 700 : 500, color: "#0f172a", marginBottom: 18 }}>{l}</div>)}
          <div style={{ height: 10, width: 300, background: "#e2e8f0", borderRadius: 5, marginTop: 26 }} />
        </div>
      </MacWindow>
      {overlay > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: overlay, zIndex: 40 }}>
          {drag === 0 && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" }} />}
          {drag > 0 && (
            <div style={{ position: "absolute", left: sel.x, top: sel.y, width: sel.w * drag, height: sel.h * drag, boxShadow: "0 0 0 2400px rgba(0,0,0,.4)", outline: "2px solid #38bdf8", overflow: "hidden" }}>
              {scan > 0 && scan < 1 && <div style={{ position: "absolute", left: 0, right: 0, top: `${scan * 100}%`, height: 3, background: "#38bdf8", boxShadow: "0 0 18px 6px rgba(56,189,248,.8)" }} />}
            </div>
          )}
        </div>
      )}
      {toast > 0 && (
        <div style={{ position: "absolute", left: 790, top: 280, width: 360, borderRadius: 18, background: "rgba(255,255,255,.98)", boxShadow: "0 26px 60px rgba(0,0,0,.45)", padding: 20, fontFamily: FONT, opacity: toast, transform: `translateX(${(1 - toast) * 40}px)`, zIndex: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700, color: C.ink }}><ScanText size={22} color={C.blue} /> ข้อความจากภาพ</div>
          <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: "#f1f5f9", fontSize: 18, lineHeight: 1.55, color: "#0f172a", minHeight: 130 }}>
            {OCR_LINES.slice(0, nLines).map((l, i) => <div key={i}>{l}</div>)}
          </div>
          <div style={{ marginTop: 14, padding: "10px 0", borderRadius: 10, textAlign: "center", fontSize: 17, fontWeight: 700, color: "#fff", background: copied ? C.green : C.blue }}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอกข้อความ"}</div>
        </div>
      )}
      <KeyPress k={keys("ocr")} t={t} a={0.1} b={1.5} label="OCR อ่านข้อความ" />
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

export const HistoryDemo: React.FC<{ t: number }> = ({ t }) => {
  const cards = [
    { s: 0.215, ox: 0, oy: 0 }, { s: 0.34, ox: 228, oy: 20 }, { s: 0.34, ox: 200, oy: 180 }, { s: 0.34, ox: 228, oy: 400 },
    { s: 0.3, ox: 0, oy: 0 }, { s: 0.45, ox: 460, oy: 70 }, { s: 0.34, ox: 330, oy: 20 }, { s: 0.215, ox: 0, oy: 0 },
  ];
  const cw = 205, ch = 130;
  const cur = cursorAt(t, [{ t: 0.4, x: 900, y: 640 }, { t: 1.8, x: 514, y: 258 }, { t: 3.6, x: 514, y: 258 }, { t: 4.4, x: 463, y: 311, click: true }, { t: 5.5, x: 600, y: 600 }]);
  const hover = t > 1.9 && t < 5.6 ? 1 : 0;
  const open = seg(t, 4.6, 5.2, ease);
  const Card: React.FC<{ i: number; x: number; y: number }> = ({ i, x, y }) => {
    const c = cards[i];
    const pop = seg(t, 0.2 + i * 0.06, 0.6 + i * 0.06, ease);
    const hov = i === 1 && hover;
    return (
      <div style={{ position: "absolute", left: x, top: y, width: cw, height: ch, borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: hov ? `0 0 0 3px ${C.red}, 0 14px 30px rgba(15,23,42,.3)` : "0 1px 3px rgba(15,23,42,.15), 0 0 0 1px #e2e8f0", opacity: pop, transform: `translateY(${(1 - pop) * 16}px) scale(${hov ? 1.04 : 1})` }}>
        <div style={{ position: "absolute", left: -c.ox * c.s, top: -c.oy * c.s, transform: `scale(${c.s})`, transformOrigin: "0 0" }}><FakePage /></div>
        {hov && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 44, background: "rgba(15,23,42,.88)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {[Pencil, Copy, FolderOpen, Pin, Trash2].map((Ic, k) => <div key={k} style={{ width: 30, height: 30, borderRadius: 8, background: k === 0 && t > 4.3 ? C.red : "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic size={16} color="#fff" /></div>)}
          </div>
        )}
      </div>
    );
  };
  return (
    <Stage>
      <Wallpaper width={1200} height={720} variant={1} />
      <MenuBar width={1200} />
      <MacWindow width={940} height={600} x={130} y={76} title="ประวัติการจับภาพ" bodyStyle={{ background: "#f8fafc" }} right={<span style={{ fontFamily: FONT, fontSize: 14, color: "#64748b" }}>8 รายการ</span>}>
        <div style={{ position: "absolute", left: 28, top: 18, display: "flex", alignItems: "center", gap: 12, fontFamily: FONT }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "#fff", boxShadow: "0 0 0 1px #e2e8f0", fontSize: 16, color: "#334155" }}><Calendar size={17} /> ทุกวัน</div>
          <div style={{ padding: "8px 14px", borderRadius: 10, background: "#fff", boxShadow: "0 0 0 1px #e2e8f0", fontSize: 16, color: "#334155" }}>เลือกหลายรายการ</div>
        </div>
        <div style={{ position: "absolute", left: 28, top: 76, fontFamily: FONT, fontSize: 20, fontWeight: 700, color: C.ink }}>วันนี้</div>
        {[0, 1, 2, 3].map((i) => <Card key={i} i={i} x={28 + i * 220} y={112} />)}
        <div style={{ position: "absolute", left: 28, top: 268, fontFamily: FONT, fontSize: 20, fontWeight: 700, color: C.ink }}>เมื่อวาน</div>
        {[4, 5, 6, 7].map((i) => <Card key={i} i={i} x={28 + (i - 4) * 220} y={304} />)}
      </MacWindow>
      {open > 0 && (
        <div style={{ position: "absolute", left: 600, top: 360, transform: `translate(-50%,-50%) scale(${0.6 + open * 0.4})`, opacity: open * (1 - seg(t, 5.9, 6.0)), padding: "18px 28px", borderRadius: 18, background: "rgba(15,23,42,.92)", color: "#fff", fontFamily: FONT, fontSize: 24, fontWeight: 600, display: "flex", gap: 12, alignItems: "center", zIndex: 70 }}><Pencil size={26} /> เปิดในตัวแก้ไข</div>
      )}
      <KeyPress k={keys("history")} t={t} a={0.0} b={1.2} label="ประวัติ" />
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color={C.red} />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

const pageToStage = (x: number, y: number) => ({ x: 192 + x * 0.85, y: 136 + y * 0.85 });

export const MoreToolsDemo: React.FC<{ t: number }> = ({ t }) => {
  const a = 1 - seg(t, 2.5, 3.0), b = seg(t, 2.5, 3.0) * (1 - seg(t, 5.1, 5.6)), c = seg(t, 5.1, 5.6);
  return (
    <div style={{ position: "relative", width: 1200, height: 720 }}>
      {a > 0 && <div style={{ position: "absolute", inset: 0, opacity: a }}><ColorDemo t={t} /></div>}
      {b > 0 && <div style={{ position: "absolute", inset: 0, opacity: b }}><RulerDemo t={Math.max(0, t - 2.6)} /></div>}
      {c > 0 && <div style={{ position: "absolute", inset: 0, opacity: c }}><QrDemo t={Math.max(0, t - 5.2)} /></div>}
    </div>
  );
};

const ColorDemo: React.FC<{ t: number }> = ({ t }) => {
  const target = pageToStage(650, 300);
  const cur = cursorAt(t, [{ t: 0.1, x: 430, y: 560 }, { t: 1.3, x: target.x, y: target.y }, { t: 1.7, x: target.x, y: target.y, click: true }]);
  const px = (cur.x - 192) / 0.85, py = (cur.y - 136) / 0.85, Z = 8.5, R = 100;
  const copied = seg(t, 1.8, 2.1, ease);
  return (
    <Stage>
      <BrowserDesk />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.12)", zIndex: 30 }} />
      <div style={{ position: "absolute", left: cur.x + 30, top: cur.y - 120, width: 2 * R, zIndex: 50, fontFamily: FONT }}>
        <div style={{ width: 2 * R, height: 2 * R, borderRadius: R, overflow: "hidden", position: "relative", boxShadow: "0 18px 40px rgba(0,0,0,.5), 0 0 0 4px #fff", background: "#fff" }}>
          <div style={{ position: "absolute", left: R - px * Z, top: R - py * Z, transform: `scale(${Z})`, transformOrigin: "0 0", width: 960, height: 600 }}><FakePage /></div>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(0,0,0,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.18) 1px, transparent 1px)", backgroundSize: "13px 13px", backgroundPosition: `${R % 13}px ${R % 13}px` }} />
          <div style={{ position: "absolute", left: R - 7, top: R - 7, width: 14, height: 14, boxShadow: "0 0 0 2px #fff, 0 0 0 4px #111" }} />
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 12, background: "rgba(15,23,42,.92)", color: "#fff", fontSize: 19, fontWeight: 700, width: "fit-content" }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: "#6366f1", boxShadow: "0 0 0 2px #fff" }} />#6366F1
        </div>
      </div>
      {copied > 0 && (
        <div style={{ position: "absolute", left: 600, top: 70, transform: `translateX(-50%) translateY(${(1 - copied) * -12}px)`, opacity: copied, padding: "12px 22px", borderRadius: 14, background: "rgba(15,23,42,.94)", color: "#fff", fontFamily: FONT, fontSize: 20, fontWeight: 600, display: "flex", gap: 10, alignItems: "center", zIndex: 90 }}><Check size={22} color="#4ade80" strokeWidth={3.5} /> คัดลอก #6366F1 แล้ว · HEX / RGB / HSL</div>
      )}
      <KeyPress k={keys("color")} t={t} a={0} b={1.2} label="ดูดสี" />
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

const RulerDemo: React.FC<{ t: number }> = ({ t }) => {
  const tl = pageToStage(468, 84), br = pageToStage(688, 184);
  const cur = cursorAt(t, [{ t: 0.1, x: 900, y: 560 }, { t: 1.0, x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2 }, { t: 1.6, x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2, click: true }]);
  const p = seg(t, 0.8, 1.2, ease);
  const copied = seg(t, 1.7, 2.0, ease);
  const w = br.x - tl.x, h = br.y - tl.y;
  return (
    <Stage>
      <BrowserDesk />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.14)", zIndex: 30 }} />
      {p > 0 && (
        <div style={{ position: "absolute", left: tl.x, top: tl.y, width: w, height: h, outline: "2px solid #14b8a6", background: "rgba(20,184,166,.12)", opacity: p, zIndex: 40 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: -22, height: 2, background: "#14b8a6" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: -22, width: 2, background: "#14b8a6" }} />
          <div style={{ position: "absolute", left: "50%", top: -58, transform: "translateX(-50%)", padding: "5px 12px", borderRadius: 9, background: "#0f766e", color: "#fff", fontFamily: FONT, fontSize: 17, fontWeight: 700, whiteSpace: "nowrap" }}>220 pt</div>
          <div style={{ position: "absolute", right: -92, top: "50%", transform: "translateY(-50%)", padding: "5px 12px", borderRadius: 9, background: "#0f766e", color: "#fff", fontFamily: FONT, fontSize: 17, fontWeight: 700 }}>100 pt</div>
          <div style={{ position: "absolute", left: "50%", top: h + 12, transform: "translateX(-50%)", padding: "6px 14px", borderRadius: 10, background: "rgba(15,23,42,.94)", color: "#fff", fontFamily: FONT, fontSize: 18, fontWeight: 700, whiteSpace: "nowrap" }}>220 × 100 pt · 440 × 200 px</div>
        </div>
      )}
      {copied > 0 && (
        <div style={{ position: "absolute", left: 600, top: 70, transform: `translateX(-50%) translateY(${(1 - copied) * -12}px)`, opacity: copied, padding: "12px 22px", borderRadius: 14, background: "rgba(15,23,42,.94)", color: "#fff", fontFamily: FONT, fontSize: 20, fontWeight: 600, display: "flex", gap: 10, alignItems: "center", zIndex: 90 }}><Check size={22} color="#4ade80" strokeWidth={3.5} /> คัดลอกขนาดแล้ว</div>
      )}
      <KeyPress k={keys("measure")} t={t} a={0} b={1.1} label="ไม้บรรทัดพิกเซล" />
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

const QrDemo: React.FC<{ t: number }> = ({ t }) => {
  const sel = { x: 440, y: 230, w: 260, h: 260 };
  const cur = cursorAt(t, [{ t: 0.1, x: 400, y: 190 }, { t: 0.4, x: sel.x, y: sel.y, click: true, hold: 0.05 }, { t: 1.2, x: sel.x + sel.w, y: sel.y + sel.h }, { t: 2.8, x: 840, y: 470 }]);
  const drag = seg(t, 0.45, 1.2);
  const scan = seg(t, 1.3, 1.9, easeInOut);
  const res = seg(t, 2.0, 2.4, ease);
  return (
    <Stage>
      <Wallpaper width={1200} height={720} />
      <MenuBar width={1200} />
      <MacWindow width={640} height={500} x={230} y={110} title="poster.png" bodyStyle={{ background: "#fff" }}>
        <div style={{ position: "absolute", left: 190, top: 100, boxShadow: "0 0 0 2px #e2e8f0", borderRadius: 8, overflow: "hidden" }}><QrCode size={240} /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 40, textAlign: "center", fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.ink }}>สแกนเพื่อดาวน์โหลด</div>
      </MacWindow>
      {t < 2.6 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, opacity: 1 - seg(t, 2.4, 2.7) }}>
          {drag === 0 && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" }} />}
          {drag > 0 && (
            <div style={{ position: "absolute", left: sel.x, top: sel.y, width: sel.w * drag, height: sel.h * drag, boxShadow: "0 0 0 2400px rgba(0,0,0,.4)", outline: "2px solid #818cf8", overflow: "hidden" }}>
              {scan > 0 && scan < 1 && <div style={{ position: "absolute", left: 0, right: 0, top: `${scan * 100}%`, height: 3, background: "#818cf8", boxShadow: "0 0 18px 6px rgba(129,140,248,.8)" }} />}
            </div>
          )}
        </div>
      )}
      {res > 0 && (
        <div style={{ position: "absolute", left: 760, top: 250, width: 360, borderRadius: 18, background: "rgba(255,255,255,.98)", boxShadow: "0 26px 60px rgba(0,0,0,.45)", padding: 20, fontFamily: FONT, opacity: res, transform: `translateX(${(1 - res) * 40}px)`, zIndex: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700, color: C.ink }}><ScanText size={22} color="#4f46e5" /> ผลการอ่าน QR / บาร์โค้ด</div>
          <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: "#f1f5f9", fontSize: 16, color: "#0f172a", wordBreak: "break-all", fontFamily: "'SF Mono', Menlo, monospace" }}>https://github.com/POBIM/captureme</div>
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <div style={{ flex: 1, padding: "9px 0", borderRadius: 10, textAlign: "center", fontSize: 16, fontWeight: 700, color: "#fff", background: "#4f46e5" }}>คัดลอก ✓</div>
            <div style={{ flex: 1, padding: "9px 0", borderRadius: 10, textAlign: "center", fontSize: 16, fontWeight: 700, color: "#4f46e5", background: "#eef2ff" }}>เปิดลิงก์</div>
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: C.slate2 }}>ลิงก์จะไม่ถูกเปิดโดยอัตโนมัติ · ต้องกดยืนยันก่อน</div>
        </div>
      )}
      <KeyPress k={keys("qr")} t={t} a={0} b={1.1} label="อ่าน QR" />
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

/** Pin → OCR → History in one 21 s demo (cross-faded). */
export const ToolsDemo: React.FC<{ t: number }> = ({ t }) => {
  const a = 1 - seg(t, 6.7, 7.3), b = seg(t, 6.7, 7.3) * (1 - seg(t, 13.7, 14.3)), c = seg(t, 13.7, 14.3) * (1 - seg(t, 20.7, 21.3)), d = seg(t, 20.7, 21.3);
  return (
    <div style={{ position: "relative", width: 1200, height: 720 }}>
      {a > 0 && <div style={{ position: "absolute", inset: 0, opacity: a }}><PinDemo t={t} /></div>}
      {b > 0 && <div style={{ position: "absolute", inset: 0, opacity: b }}><OcrDemo t={Math.max(0, t - 7)} /></div>}
      {c > 0 && <div style={{ position: "absolute", inset: 0, opacity: c }}><HistoryDemo t={Math.max(0, t - 14)} /></div>}
      {d > 0 && <div style={{ position: "absolute", inset: 0, opacity: d }}><MoreToolsDemo t={Math.max(0, t - 21)} /></div>}
    </div>
  );
};
export { BrowserDesk, typedThai, HistoryIcon };
