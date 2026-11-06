import React from "react";
import { FONT } from "../theme";

/** Anchor rectangles (in FakePage's 960×600 space) that annotations point at. */
export const ANCHORS = {
  card2: { x: 468, y: 84, w: 220, h: 100 },
  chart: { x: 228, y: 204, w: 460, h: 210 },
  account: { x: 716, y: 318, w: 204, h: 30 },
  title: { x: 228, y: 28, w: 300, h: 36 },
};

const Card: React.FC<{ x: number; label: string; value: string; delta: string; up?: boolean }> = ({ x, label, value, delta, up = true }) => (
  <div style={{ position: "absolute", left: x, top: 84, width: 220, height: 100, borderRadius: 14, background: "#fff", boxShadow: "0 1px 3px rgba(15,23,42,.1), 0 0 0 1px #e2e8f0", padding: 16 }}>
    <div style={{ fontSize: 14, color: "#64748b" }}>{label}</div>
    <div style={{ fontSize: 30, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{value}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: up ? "#16a34a" : "#dc2626" }}>{up ? "▲" : "▼"} {delta}</div>
  </div>
);

/** A neutral fake "dashboard" screenshot used as demo content (no real brands or data). */
export const FakePage: React.FC<{ blur?: number; style?: React.CSSProperties }> = ({ blur = 0, style }) => {
  const bars = [46, 62, 54, 78, 70, 92, 84, 110, 98, 128, 120, 150];
  return (
    <div style={{ position: "relative", width: 960, height: 600, background: "#f1f5f9", fontFamily: FONT, overflow: "hidden", ...style }}>
      {/* sidebar */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 200, height: 600, background: "#0f172a", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", fontWeight: 700, fontSize: 18 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#38bdf8,#6366f1)" }} /> ร้านตัวอย่าง
        </div>
        {["ภาพรวม", "คำสั่งซื้อ", "สินค้า", "ลูกค้า", "รายงาน", "ตั้งค่า"].map((s, i) => (
          <div key={s} style={{ marginTop: i === 0 ? 34 : 6, padding: "9px 12px", borderRadius: 9, fontSize: 15, color: i === 4 ? "#fff" : "#94a3b8", background: i === 4 ? "#1e293b" : "transparent", fontWeight: i === 4 ? 600 : 400 }}>{s}</div>
        ))}
      </div>
      {/* header */}
      <div style={{ position: "absolute", left: 228, top: 28, fontSize: 26, fontWeight: 700, color: "#0f172a" }}>รายงานสรุปยอดขาย</div>
      <div style={{ position: "absolute", right: 32, top: 26, width: 38, height: 38, borderRadius: 19, background: "linear-gradient(135deg,#fda4af,#fb7185)" }} />
      <Card x={228} label="ยอดขายเดือนนี้" value="฿128,450" delta="12.4%" />
      <Card x={468} label="คำสั่งซื้อใหม่" value="1,284" delta="24.0%" />
      <Card x={708} label="ยกเลิก" value="37" delta="3.1%" up={false} />
      {/* chart */}
      <div style={{ position: "absolute", left: 228, top: 204, width: 460, height: 210, borderRadius: 14, background: "#fff", boxShadow: "0 1px 3px rgba(15,23,42,.1), 0 0 0 1px #e2e8f0", padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#334155" }}>ยอดขายรายเดือน</div>
        <div style={{ position: "absolute", left: 20, right: 20, bottom: 18, height: 150, display: "flex", alignItems: "flex-end", gap: 10 }}>
          {bars.map((h, i) => <div key={i} style={{ flex: 1, height: h, borderRadius: "6px 6px 0 0", background: i === bars.length - 1 ? "#6366f1" : "#c7d2fe" }} />)}
        </div>
      </div>
      {/* account */}
      <div style={{ position: "absolute", left: 708, top: 204, width: 220, height: 210, borderRadius: 14, background: "#fff", boxShadow: "0 1px 3px rgba(15,23,42,.1), 0 0 0 1px #e2e8f0", padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#334155" }}>บัญชีรับเงิน</div>
        <div style={{ marginTop: 14, fontSize: 13, color: "#64748b" }}>ธนาคารตัวอย่าง</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>เลขที่บัญชี</div>
        <div style={{ position: "absolute", left: 8, top: 114, width: 204, height: 30, display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 19, fontWeight: 700, color: "#0f172a", letterSpacing: 0.5, filter: blur ? `blur(${blur}px)` : undefined }}>123-4-56789-0</div>
        <div style={{ position: "absolute", left: 16, bottom: 16, width: 188, height: 8, borderRadius: 4, background: "#e2e8f0" }}><div style={{ width: "62%", height: 8, borderRadius: 4, background: "#16a34a" }} /></div>
      </div>
      {/* table */}
      <div style={{ position: "absolute", left: 228, top: 434, width: 700, height: 140, borderRadius: 14, background: "#fff", boxShadow: "0 1px 3px rgba(15,23,42,.1), 0 0 0 1px #e2e8f0", overflow: "hidden" }}>
        {[["#10428", "คุณสมชาย", "฿1,250", "ชำระแล้ว"], ["#10429", "คุณมาลี", "฿890", "รอชำระ"], ["#10430", "คุณวิชัย", "฿3,400", "ชำระแล้ว"]].map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", height: 46, padding: "0 18px", borderTop: i ? "1px solid #f1f5f9" : "none", fontSize: 15, color: "#334155" }}>
            <span style={{ width: 120, fontWeight: 600 }}>{r[0]}</span><span style={{ width: 260 }}>{r[1]}</span><span style={{ width: 160 }}>{r[2]}</span>
            <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 13, background: r[3] === "ชำระแล้ว" ? "#dcfce7" : "#fef3c7", color: r[3] === "ชำระแล้ว" ? "#15803d" : "#b45309" }}>{r[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Long article used by the scrolling-capture demo (960 wide, `height` tall). */
export const FakeArticle: React.FC<{ height?: number }> = ({ height = 1500 }) => (
  <div style={{ width: 760, height, background: "#fff", fontFamily: FONT, padding: "40px 48px", boxSizing: "border-box" }}>
    {[0, 1, 2, 3].map((s) => (
      <div key={s} style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>{["วิธีเริ่มต้นใช้งาน", "ขั้นตอนที่สอง", "เคล็ดลับการใช้งาน", "สรุป"][s]}</div>
        <div style={{ width: "100%", height: 150, borderRadius: 12, background: ["linear-gradient(135deg,#fecaca,#fda4af 50%,#c7d2fe)", "linear-gradient(135deg,#bae6fd,#a5b4fc)", "linear-gradient(135deg,#bbf7d0,#fde68a)", "linear-gradient(135deg,#fbcfe8,#c4b5fd)"][s], marginBottom: 16 }} />
        {[100, 96, 100, 92, 100, 70].map((w, i) => <div key={i} style={{ width: `${w}%`, height: 14, borderRadius: 7, background: "#e2e8f0", marginBottom: 14 }} />)}
      </div>
    ))}
  </div>
);
