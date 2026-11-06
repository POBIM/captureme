import React from "react";
import { C, FONT } from "../theme";
import { Stage } from "./common";
import { cursorAt, seg, ease, easeInOut, lerp, typedThai, window01 } from "./anim";
import { Cursor, ClickRipple } from "../ui/Cursor";
import { EditorMock, CANVAS_ORIGIN, CANVAS_SCALE } from "../ui/EditorMock";
import { ANCHORS } from "../ui/FakePage";
import { KeyCap } from "../ui/Keys";
import { Check } from "lucide-react";

/** page (FakePage space) -> stage coordinates (at rest, before crop/beautify). */
const P = (x: number, y: number) => ({ x: CANVAS_ORIGIN.x + x * CANVAS_SCALE, y: CANVAS_ORIGIN.y + y * CANVAS_SCALE });

const ToolChip: React.FC<{ k: string; label: string; a: number; b: number; t: number }> = ({ k, label, a, b, t }) => {
  const o = window01(t, a, b, 0.2);
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 600, bottom: 22, transform: "translateX(-50%)", opacity: o, display: "flex", alignItems: "center", gap: 14, padding: "10px 22px", borderRadius: 18, background: "rgba(15,23,42,.9)", boxShadow: "0 14px 36px rgba(0,0,0,.4)", fontFamily: FONT, zIndex: 80 }}>
      <KeyCap k={k} size={24} dark /><span style={{ color: "#fff", fontSize: 22, fontWeight: 600 }}>{label}</span>
    </div>
  );
};

const CROP = { x: 200, y: 20, w: 740, h: 410 };

export const EditorDemo: React.FC<{ t: number }> = ({ t }) => {
  const a = ANCHORS.card2, acc = ANCHORS.account;
  const toolAt = (x: number) => x;
  void toolAt;
  const active =
    t < 0.8 ? "select" : t < 2.9 ? "arrow" : t < 4.5 ? "rect" : t < 7.2 ? "text" : t < 10.0 ? "step" : t < 14.5 ? "blur" : t < 19 ? "crop" : "select";

  // --- cursor script (stage coordinates)
  const pa = P(560, 238), pb = P(662, 246), r0 = P(a.x - 6, a.y - 6), r1 = P(a.x + a.w + 6, a.y + a.h + 6);
  const tx = P(446, 194), s1 = P(a.x - 2, a.y - 2), s2 = P(acc.x - 2, acc.y - 22), s3 = P(236, 212);
  const b0 = P(acc.x - 4, acc.y - 4), b1 = P(acc.x + acc.w + 4, acc.y + acc.h + 4);
  const c0 = P(CROP.x, CROP.y), c1 = P(CROP.x + CROP.w, CROP.y + CROP.h);
  const cur = cursorAt(t, [
    { t: 0.3, x: 950, y: 640 }, { t: 1.0, x: pa.x, y: pa.y, click: true, hold: 0.1 }, { t: 2.4, x: pb.x, y: pb.y },
    { t: 3.0, x: r0.x, y: r0.y, click: true, hold: 0.1 }, { t: 4.0, x: r1.x, y: r1.y },
    { t: 4.8, x: tx.x, y: tx.y, click: true }, { t: 6.8, x: tx.x + 90, y: tx.y + 70 },
    { t: 7.5, x: s1.x, y: s1.y, click: true }, { t: 8.5, x: s2.x, y: s2.y, click: true }, { t: 9.5, x: s3.x, y: s3.y, click: true },
    { t: 10.6, x: b0.x, y: b0.y, click: true, hold: 0.1 }, { t: 12.0, x: b1.x, y: b1.y },
    { t: 14.9, x: c0.x, y: c0.y, click: true, hold: 0.1 }, { t: 16.6, x: c1.x, y: c1.y }, { t: 17.8, x: 700, y: 400 },
    { t: 20.6, x: 910, y: 73, click: true }, { t: 22.8, x: 700, y: 360 }, { t: 24.2, x: 1038, y: 73, click: true },
  ]);

  // --- arrow
  const arrowP = seg(t, 1.0, 2.4);
  // --- rect
  const rectP = seg(t, 3.0, 4.0);
  // --- text
  const label = typedThai("ยอดพุ่ง!", t, 5.0, 6);
  // --- steps
  const step = (at: number) => seg(t, at, at + 0.3, ease);
  // --- blur
  const blurP = seg(t, 10.8, 12.2);
  const blurPx = 9 * blurP;
  // --- crop
  const cropDrag = seg(t, 14.9, 16.6);
  const cropApply = seg(t, 18.4, 19.4, easeInOut);
  const beauty = seg(t, 20.8, 22.0, easeInOut);
  const kf = Math.min(1100 / CROP.w, 600 / CROP.h);
  const k0 = CANVAS_SCALE;
  const kBase = lerp(k0, kf, cropApply);
  const k = lerp(kBase, kf * 0.8, beauty);
  const left0 = (1200 - 960 * CANVAS_SCALE) / 2, top0 = 14;
  const cx = CROP.x + CROP.w / 2, cy = CROP.y + CROP.h / 2;
  const shiftX = -90 * beauty;
  const txf = lerp(0, 600 - left0 - kf * cx + shiftX, cropApply) * (1 - beauty) + (600 - left0 - k * cx + shiftX) * beauty;
  const tyf = lerp(0, 331 - top0 - kf * cy, cropApply) * (1 - beauty) + (331 - top0 - k * cy) * beauty;
  const pageTransform = `translate(${txf}px, ${tyf}px) scale(${k})`;
  const clip = `inset(${CROP.y * cropApply}px ${(960 - CROP.x - CROP.w) * cropApply}px ${(600 - CROP.y - CROP.h) * cropApply}px ${CROP.x * cropApply}px round ${beauty * 16}px)`;
  const bgGrad = `linear-gradient(135deg, rgba(99,102,241,${beauty}), rgba(236,72,153,${beauty})), radial-gradient(#cbd5e1 1px, transparent 1px)`;
  const copyToast = seg(t, 24.4, 24.8, ease);


  const panelO = window01(t, 20.8, 25.8, 0.4);

  return (
    <Stage bg="#e5e7eb">
      <EditorMock
        active={active}
        blur={blurPx}
        pageStyle={{ transform: pageTransform, clipPath: clip, boxShadow: beauty > 0 ? `0 ${30 * beauty}px ${60 * beauty}px rgba(15,23,42,${0.45 * beauty})` : undefined }}
        bgStyle={{ backgroundImage: bgGrad, backgroundSize: "auto, 18px 18px" }}
        canvasOverlay={
          panelO > 0 ? (
            <div style={{ position: "absolute", right: 22, top: 70, width: 250, padding: 18, borderRadius: 16, background: "rgba(255,255,255,.97)", boxShadow: "0 20px 50px rgba(15,23,42,.3)", opacity: panelO, transform: `translateX(${(1 - panelO) * 30}px)`, fontFamily: FONT, zIndex: 5 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 12 }}>พื้นหลังตกแต่ง</div>
              {[["ระยะขอบ", 0.7], ["เงาใต้ภาพ", 0.55], ["มุมโค้ง", 0.4]].map(([name, v]) => (
                <div key={name as string} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: C.slate, marginBottom: 5 }}>{name as string}</div>
                  <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0", position: "relative" }}>
                    <div style={{ width: `${(v as number) * beauty * 100}%`, height: 6, borderRadius: 3, background: C.red }} />
                    <div style={{ position: "absolute", left: `${(v as number) * beauty * 100}%`, top: -5, width: 16, height: 16, marginLeft: -8, borderRadius: 8, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.4)" }} />
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {["linear-gradient(135deg,#6366f1,#ec4899)", "linear-gradient(135deg,#06b6d4,#3b82f6)", "linear-gradient(135deg,#f59e0b,#ef4444)", "#0f172a"].map((g, i) => (
                  <div key={i} style={{ width: 38, height: 30, borderRadius: 8, background: g, boxShadow: i === 0 ? `0 0 0 3px ${C.red}` : "none" }} />
                ))}
              </div>
            </div>
          ) : null
        }
      >
        <svg width="960" height="600" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {/* arrow */}
          {arrowP > 0 && (
            <g>
              <path d="M 560 238 C 600 224 630 222 662 246" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - arrowP} fill="none" stroke={C.red} strokeWidth="6" strokeLinecap="round" />
              {arrowP > 0.9 && <path d="M 662 246 L 640 244 M 662 246 L 654 224" fill="none" stroke={C.red} strokeWidth="6" strokeLinecap="round" />}
            </g>
          )}
          {/* rect */}
          {rectP > 0 && <rect x={a.x - 6} y={a.y - 6} width={(a.w + 12) * rectP} height={(a.h + 12) * rectP} rx="16" fill="none" stroke={C.red} strokeWidth="5" />}
          {/* steps */}
          {[[a.x - 2, a.y - 2, "1", 7.5], [acc.x - 2, acc.y - 22, "2", 8.5], [236, 212, "3", 9.5]].map(([x, y, n, at]) => {
            const p = step(at as number);
            return p > 0 ? (
              <g key={n as string} transform={`translate(${x},${y}) scale(${p})`}>
                <circle r="16" fill={C.red} stroke="#fff" strokeWidth="3" />
                <text y="7" textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize="20" fill="#fff">{n}</text>
              </g>
            ) : null;
          })}
          {/* blur selection outline */}
          {t > 10.6 && t < 14.8 && <rect x={acc.x - 4} y={acc.y - 4} width={(acc.w + 8) * seg(t, 10.8, 12.2)} height={acc.h + 8} rx="8" fill="none" stroke="#7c3aed" strokeWidth="3" strokeDasharray="8 6" />}
          {/* crop */}
          {t > 14.8 && cropApply < 0.01 && cropDrag > 0 && (
            <g>
              <path fillRule="evenodd" fill="rgba(0,0,0,.55)" d={`M0 0H960V600H0Z M${CROP.x} ${CROP.y}h${CROP.w * cropDrag}v${CROP.h * cropDrag}h-${CROP.w * cropDrag}Z`} />
              <rect x={CROP.x} y={CROP.y} width={CROP.w * cropDrag} height={CROP.h * cropDrag} fill="none" stroke="#fff" strokeWidth="2" />
              {cropDrag > 0.95 && [1 / 3, 2 / 3].flatMap((f) => [
                <line key={"v" + f} x1={CROP.x + CROP.w * f} y1={CROP.y} x2={CROP.x + CROP.w * f} y2={CROP.y + CROP.h} stroke="rgba(255,255,255,.5)" />,
                <line key={"h" + f} x1={CROP.x} y1={CROP.y + CROP.h * f} x2={CROP.x + CROP.w} y2={CROP.y + CROP.h * f} stroke="rgba(255,255,255,.5)" />,
              ])}
            </g>
          )}
        </svg>
        {/* text label */}
        {label && (
          <div style={{ position: "absolute", left: 440, top: 190, padding: "6px 14px", background: C.red, color: "#fff", fontFamily: FONT, fontWeight: 700, fontSize: 20, borderRadius: 10, boxShadow: "0 6px 14px rgba(220,38,38,.35)" }}>
            {label}{Math.floor(t * 2) % 2 === 0 && t < 7 ? "|" : ""}
          </div>
        )}
        {t > 14.8 && cropApply < 0.01 && cropDrag > 0.95 && (
          <div style={{ position: "absolute", left: CROP.x, top: CROP.y - 34, padding: "4px 10px", borderRadius: 7, background: "rgba(15,23,42,.9)", color: "#fff", fontFamily: FONT, fontSize: 15, fontWeight: 600 }}>{CROP.w} × {CROP.h}</div>
        )}
      </EditorMock>
      <ToolChip k="A" label="ลูกศร" a={0.7} b={2.7} t={t} />
      <ToolChip k="R" label="สี่เหลี่ยม" a={2.8} b={4.4} t={t} />
      <ToolChip k="T" label="ข้อความ" a={4.5} b={7.0} t={t} />
      <ToolChip k="N" label="ตัวนับลำดับ" a={7.2} b={9.8} t={t} />
      <ToolChip k="B" label="เบลอข้อมูลลับ" a={10.2} b={13.5} t={t} />
      <ToolChip k="C" label="ครอป  ·  Enter = ใช้" a={14.5} b={18.6} t={t} />
      {copyToast > 0 && (
        <div style={{ position: "absolute", left: 600, top: 100, transform: `translateX(-50%) translateY(${(1 - copyToast) * -14}px)`, opacity: copyToast * (1 - seg(t, 25.5, 25.95)), padding: "12px 22px", borderRadius: 14, background: "rgba(15,23,42,.92)", color: "#fff", fontFamily: FONT, fontSize: 20, fontWeight: 600, display: "flex", gap: 10, alignItems: "center", zIndex: 90 }}><Check size={22} color="#4ade80" strokeWidth={3.5} /> คัดลอกภาพแล้ว</div>
      )}
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color={C.red} />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};
