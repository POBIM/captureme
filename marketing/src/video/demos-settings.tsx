import React from "react";
import { C, FONT } from "../theme";
import { Stage } from "./common";
import { cursorAt, seg, ease, window01 } from "./anim";
import { Cursor, ClickRipple } from "../ui/Cursor";
import { MacWindow } from "../ui/MacWindow";
import { Wallpaper, MenuBar } from "../ui/Desktop";
import { KeyCombo } from "../ui/Keys";
import { keys } from "../site";

const TABS = ["ทั่วไป", "บันทึก", "ปุ่มลัด", "ประวัติ", "เกี่ยวกับ"];
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid #eef2f7", fontFamily: FONT }}>
    <div style={{ fontSize: 18, color: C.ink, fontWeight: 500 }}>{label}</div><div>{children}</div>
  </div>
);
const Sw: React.FC<{ on: boolean }> = ({ on }) => (
  <div style={{ width: 50, height: 28, borderRadius: 14, background: on ? "#34c759" : "#d4d4d8", position: "relative" }}><div style={{ position: "absolute", top: 2, left: on ? 24 : 2, width: 24, height: 24, borderRadius: 12, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} /></div>
);
const Select: React.FC<{ v: string }> = ({ v }) => <div style={{ padding: "6px 16px", borderRadius: 9, background: "#f1f5f9", boxShadow: "0 0 0 1px #e2e8f0", fontSize: 16, fontFamily: FONT, color: C.ink }}>{v} ⌄</div>;

const HOT: [string, string][] = [
  ["จับภาพพื้นที่", "region"], ["จับภาพหน้าต่าง", "window"], ["จับภาพทั้งหน้าจอ", "fullscreen"], ["จับภาพแบบหน่วงเวลา", "delayed"],
  ["จับภาพเลื่อนยาว", "scroll"], ["บันทึกหน้าจอ", "record"], ["อ่านข้อความจากภาพ (OCR)", "ocr"], ["เปิดประวัติ", "history"],
];

export const SettingsDemo: React.FC<{ t: number }> = ({ t }) => {
  const tab = t < 2.8 ? 0 : t < 5.2 ? 1 : 2;
  const cur = cursorAt(t, [
    { t: 0.4, x: 900, y: 600 }, { t: 1.4, x: 840, y: 260 }, { t: 2.2, x: 840, y: 260 },
    { t: 3.0, x: 316, y: 162, click: true }, { t: 4.2, x: 600, y: 260 },
    { t: 5.4, x: 402, y: 162, click: true }, { t: 6.8, x: 950, y: 230, click: true }, { t: 9.0, x: 800, y: 500 },
  ]);
  const capturing = t > 7.0 && t < 8.6;
  const changed = t >= 8.6;
  const hotKeys = (id: string, i: number) => (i === 0 ? (changed ? ["⌃", "⌥", "R"] : keys(id)) : keys(id));
  const rowsIn = seg(t, 5.2, 5.9, ease);
  return (
    <Stage>
      <Wallpaper width={1200} height={720} />
      <MenuBar width={1200} />
      <MacWindow width={860} height={560} x={170} y={80} title="CaptureME – ตั้งค่า" bodyStyle={{ background: "#fff" }}>
        <div style={{ display: "flex", gap: 8, padding: "16px 28px 0", fontFamily: FONT }}>
          {TABS.map((x, i) => <div key={x} style={{ padding: "8px 18px", borderRadius: 10, fontSize: 17, fontWeight: 600, background: i === tab ? C.red : "transparent", color: i === tab ? "#fff" : C.slate }}>{x}</div>)}
        </div>
        <div style={{ position: "absolute", left: 28, right: 28, top: 76 }}>
          {tab === 0 && (
            <div>
              <Row label="ภาษา"><Select v="ไทย" /></Row>
              <Row label="คัดลอกไปคลิปบอร์ดอัตโนมัติ"><Sw on /></Row>
              <Row label="เปิดตัวแก้ไขภาพหลังจับภาพ"><Sw on /></Row>
              <Row label="เล่นเสียงชัตเตอร์"><Sw on={false} /></Row>
              <Row label="เปิดอัตโนมัติเมื่อเข้าสู่ระบบ"><Sw on /></Row>
            </div>
          )}
          {tab === 1 && (
            <div style={{ opacity: seg(t, 2.8, 3.2) }}>
              <Row label="โฟลเดอร์ปลายทาง"><Select v="~/Pictures/CaptureME" /></Row>
              <Row label="รูปแบบชื่อไฟล์"><Select v="CaptureME {date} {time}" /></Row>
              <Row label="ชนิดไฟล์"><div style={{ display: "flex", gap: 6 }}>{["PNG", "JPG", "WebP"].map((f, i) => <div key={f} style={{ padding: "6px 14px", borderRadius: 8, fontFamily: FONT, fontSize: 15, fontWeight: 700, background: i === 0 ? C.ink : "#f1f5f9", color: i === 0 ? "#fff" : C.slate }}>{f}</div>)}</div></Row>
              <Row label="คุณภาพ JPG"><Select v="90" /></Row>
            </div>
          )}
          {tab === 2 && (
            <div>
              {HOT.map(([label, id], i) => (
                <div key={id} style={{ opacity: Math.min(1, rowsIn * 3 - i * 0.2) }}>
                  <Row label={label}>
                    <div style={{ minWidth: 190, display: "flex", justifyContent: "flex-end", padding: "4px 8px", borderRadius: 10, background: i === 0 && capturing ? "#fef2f2" : "transparent", boxShadow: i === 0 && capturing ? `0 0 0 2px ${C.red}` : "none" }}>
                      {i === 0 && capturing ? <span style={{ fontFamily: FONT, fontSize: 16, color: C.red, fontWeight: 600 }}>กดคีย์ลัด…</span> : <KeyCombo keys={hotKeys(id, i)} size={16} />}
                    </div>
                  </Row>
                </div>
              ))}
            </div>
          )}
        </div>
      </MacWindow>
      {capturing && t > 7.9 && (
        <div style={{ position: "absolute", left: 790, top: 600, display: "flex", gap: 10 }}><KeyCombo keys={["⌃", "⌥", "R"]} size={26} dark /></div>
      )}
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color={C.red} />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};
export { window01 };
