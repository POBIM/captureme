import React from "react";
import { C, FONT } from "../theme";
import { Stage } from "./common";
import { cursorAt, seg, ease, window01, easeInOut, lerp } from "./anim";
import { Cursor, ClickRipple } from "../ui/Cursor";
import { MacWindow } from "../ui/MacWindow";
import { Wallpaper, MenuBar } from "../ui/Desktop";
import { AppIcon } from "../ui/AppIcon";
import { Check, Fingerprint, ShieldAlert, Camera, ArrowRight } from "lucide-react";

const FolderIcon: React.FC<{ size: number; glow?: number }> = ({ size, glow = 0 }) => (
  <div style={{ position: "relative", width: size, height: size * 0.82, filter: `drop-shadow(0 8px 14px rgba(0,0,0,.25)) drop-shadow(0 0 ${glow * 24}px rgba(37,99,235,${glow}))` }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: size * 0.42, height: size * 0.2, borderRadius: `${size * 0.08}px ${size * 0.08}px 0 0`, background: "#3b82f6" }} />
    <div style={{ position: "absolute", left: 0, top: size * 0.1, width: size, height: size * 0.72, borderRadius: size * 0.1, background: "linear-gradient(#60a5fa,#2563eb)" }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: size * 0.3, textAlign: "center", fontSize: size * 0.3, fontWeight: 700, color: "rgba(255,255,255,.85)", fontFamily: FONT }}>A</div>
  </div>
);

export const DmgDemo: React.FC<{ t: number }> = ({ t }) => {
  const cur = cursorAt(t, [
    { t: 0.4, x: 900, y: 560 }, { t: 1.4, x: 420, y: 335, click: true, hold: 0.25 }, { t: 3.2, x: 790, y: 345 },
  ]);
  // drag state: icon follows cursor from t=1.65 to 3.2, then drops in the folder
  const dragging = t >= 1.65 && t < 3.3;
  const iconX = t < 1.65 ? 420 : dragging ? cur.x : 790;
  const iconY = t < 1.65 ? 330 : dragging ? cur.y - 6 : 345;
  const drop = seg(t, 3.2, 3.6, ease);
  const copyP = seg(t, 3.7, 5.8, easeInOut);
  const done = seg(t, 5.9, 6.3, ease);
  const folderGlow = dragging && cur.x > 640 ? 1 : 0;
  return (
    <Stage>
      <Wallpaper width={1200} height={720} />
      <MenuBar width={1200} />
      <MacWindow width={820} height={470} x={190} y={110} title="CaptureME" bodyStyle={{ background: "linear-gradient(160deg,#ffffff,#f1f5f9)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 22, textAlign: "center", fontFamily: FONT, fontSize: 21, color: "#64748b", fontWeight: 500 }}>ลากไอคอน CaptureME ไปวางที่ Applications <span style={{ color: "#94a3b8" }}>· Drag to Applications</span></div>
        <div style={{ position: "absolute", left: 345, top: 180, opacity: 0.7 }}><ArrowRight size={90} color="#94a3b8" strokeWidth={2.5} /></div>
        <div style={{ position: "absolute", left: 164, top: 250, width: 132, textAlign: "center", fontFamily: FONT, fontSize: 19, fontWeight: 600, color: "#334155", opacity: 1 - drop }}>CaptureME</div>
        <div style={{ position: "absolute", left: 530, top: 133, transform: `scale(${1 + folderGlow * 0.08})` }}><FolderIcon size={140} glow={folderGlow * 0.7} /></div>
        <div style={{ position: "absolute", left: 525, top: 259, width: 150, textAlign: "center", fontFamily: FONT, fontSize: 19, fontWeight: 600, color: "#334155" }}>Applications</div>
      </MacWindow>
      {/* moving icon */}
      <div style={{ position: "absolute", left: iconX - 66, top: iconY - 66, opacity: t < 3.2 ? 1 : 1 - drop, transform: `scale(${t < 3.2 ? 1 + (dragging ? 0.06 : 0) : 1 - drop * 0.6})`, zIndex: 20 }}><AppIcon size={132} /></div>
      {/* copy progress */}
      {t > 3.6 && (
        <div style={{ position: "absolute", left: 400, top: 470, width: 400, padding: "16px 22px", borderRadius: 16, background: "rgba(255,255,255,.96)", boxShadow: "0 18px 40px rgba(0,0,0,.35)", fontFamily: FONT, opacity: Math.min(seg(t, 3.6, 3.9), 1 - seg(t, 7.2, 7.6)) }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.ink, display: "flex", justifyContent: "space-between" }}><span>{done > 0.5 ? "ติดตั้งเรียบร้อย" : "กำลังคัดลอก CaptureME…"}</span>{done > 0.5 && <Check size={22} color={C.green} strokeWidth={3} />}</div>
          <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: "#e2e8f0", overflow: "hidden" }}><div style={{ width: `${(done > 0.5 ? 1 : copyP) * 100}%`, height: 8, background: done > 0.5 ? C.green : "#2563eb" }} /></div>
        </div>
      )}
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

const GkDialog: React.FC<{ t: number; click: number }> = ({ t, click }) => (
  <div style={{ position: "absolute", left: 350, top: 140, width: 500, borderRadius: 22, background: "rgba(246,246,248,.97)", boxShadow: "0 30px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.2)", padding: "30px 32px 24px", fontFamily: FONT, textAlign: "center", opacity: window01(t, 0, 2.6, 0.3) }}>
    <div style={{ display: "flex", justifyContent: "center", position: "relative" }}><AppIcon size={72} shadow={false} /><div style={{ position: "absolute", left: "50%", top: 38, marginLeft: 8 }}><ShieldAlert size={38} color="#f59e0b" fill="#fff" strokeWidth={2.2} /></div></div>
    <div style={{ marginTop: 16, fontSize: 21, fontWeight: 700, color: "#111" }}>“CaptureME” Not Opened</div>
    <div style={{ marginTop: 8, fontSize: 16, lineHeight: 1.4, color: "#444" }}>Apple could not verify “CaptureME” is free of malware that may harm your Mac or compromise your privacy.</div>
    <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ padding: "9px 0", borderRadius: 9, background: click > 0 ? "#1d4ed8" : "#2563eb", color: "#fff", fontWeight: 600, fontSize: 17 }}>Done</div>
      <div style={{ padding: "9px 0", borderRadius: 9, background: "#fff", boxShadow: "0 0 0 1px #d4d4d8", color: "#111", fontSize: 17 }}>Move to Trash</div>
    </div>
  </div>
);

const SettingsSidebar: React.FC<{ active: number; items: string[] }> = ({ active, items }) => (
  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 210, background: "#e8e8ec", padding: 14, boxSizing: "border-box", fontFamily: FONT }}>
    {items.map((s, i) => (
      <div key={s} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 16, color: i === active ? "#fff" : "#27272a", background: i === active ? "#2563eb" : "transparent", marginBottom: 3, fontWeight: i === active ? 600 : 400 }}>{s}</div>
    ))}
  </div>
);

export const GatekeeperDemo: React.FC<{ t: number }> = ({ t }) => {
  const cur = cursorAt(t, [
    { t: 0.3, x: 900, y: 620 }, { t: 1.8, x: 600, y: 400, click: true }, // Done
    { t: 3.4, x: 560, y: 520 }, { t: 5.0, x: 888, y: 356, click: true }, // Open Anyway
    { t: 6.6, x: 640, y: 440 },
  ]);
  const pulse = 0.5 + 0.5 * Math.sin(t * 7);
  const phaseB = window01(t, 2.6, 6.2, 0.3);
  const phaseC = window01(t, 6.2, 8.0, 0.3);
  const touch = seg(t, 6.7, 7.2);
  return (
    <Stage>
      <Wallpaper width={1200} height={720} variant={1} />
      <MenuBar width={1200} trayActive={false} />
      <GkDialog t={t} click={t > 1.8 && t < 2.4 ? 1 : 0} />
      <div style={{ opacity: phaseB }}>
        <MacWindow width={800} height={470} x={200} y={120} title="Privacy & Security" bodyStyle={{ background: "#f4f4f6" }}>
          <SettingsSidebar active={2} items={["Wi-Fi", "Notifications", "Privacy & Security", "Desktop & Dock", "Displays"]} />
          <div style={{ position: "absolute", left: 240, right: 28, top: 22, fontFamily: FONT }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#111" }}>Privacy & Security</div>
            <div style={{ marginTop: 22, fontSize: 14, fontWeight: 600, color: "#71717a", letterSpacing: .5 }}>Security</div>
            <div style={{ marginTop: 10, borderRadius: 12, background: "#fff", boxShadow: "0 0 0 1px #e4e4e7", padding: 18 }}>
              <div style={{ fontSize: 15, color: "#27272a", lineHeight: 1.4 }}>“CaptureME” was blocked to protect your Mac.</div>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", position: "relative" }}>
                <div style={{ position: "relative", padding: "7px 18px", borderRadius: 8, background: "#2563eb", color: "#fff", fontSize: 15, fontWeight: 600, boxShadow: `0 0 0 ${4 + pulse * 6}px rgba(37,99,235,${0.25 * (1 - pulse * 0.4)})` }}>Open Anyway</div>
              </div>
            </div>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", fontSize: 15, color: "#52525b" }}><span>Allow applications from</span><span style={{ padding: "4px 12px", borderRadius: 7, background: "#fff", boxShadow: "0 0 0 1px #d4d4d8" }}>App Store & Known Developers</span></div>
          </div>
        </MacWindow>
      </div>
      <div style={{ opacity: phaseC }}>
        <div style={{ position: "absolute", left: 410, top: 150, width: 380, borderRadius: 18, background: "rgba(246,246,248,.97)", boxShadow: "0 30px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.2)", padding: "26px 26px 22px", textAlign: "center", fontFamily: FONT }}>
          <Fingerprint size={64} color={touch > 0.5 ? C.green : "#f43f5e"} strokeWidth={1.6} />
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700 }}>{touch > 0.5 ? "Allowed" : "Touch ID or enter your password"}</div>
          <div style={{ marginTop: 4, fontSize: 14, color: "#555" }}>to allow “CaptureME” to open</div>
        </div>
      </div>
      {/* success */}
      {t > 7.2 && (
        <div style={{ position: "absolute", left: 820, top: 60, padding: "12px 18px", borderRadius: 14, background: "rgba(255,255,255,.96)", boxShadow: "0 16px 40px rgba(0,0,0,.35)", display: "flex", alignItems: "center", gap: 12, fontFamily: FONT, opacity: seg(t, 7.2, 7.5), transform: `translateY(${(1 - seg(t, 7.2, 7.6, ease)) * -12}px)` }}>
          <AppIcon size={36} shadow={false} /><div style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>CaptureME เปิดแล้ว <Camera size={15} style={{ verticalAlign: -2 }} /></div>
        </div>
      )}
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

const Toggle: React.FC<{ on: number }> = ({ on }) => (
  <div style={{ width: 52, height: 30, borderRadius: 15, background: on > 0.5 ? "#34c759" : "#d4d4d8", position: "relative" }}>
    <div style={{ position: "absolute", top: 2, left: 2 + on * 22, width: 26, height: 26, borderRadius: 13, background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,.3)" }} />
  </div>
);

export const PermissionDemo: React.FC<{ t: number }> = ({ t }) => {
  const cur = cursorAt(t, [
    { t: 0.3, x: 900, y: 600 }, { t: 2.4, x: 870, y: 345, click: true },
    { t: 4.6, x: 640, y: 560 }, { t: 6.0, x: 620, y: 472, click: true }, { t: 7.2, x: 800, y: 560 },
  ]);
  const on = seg(t, 2.6, 2.9);
  const sheet = seg(t, 3.3, 3.7, ease) * (1 - seg(t, 6.4, 6.7));
  const ready = seg(t, 6.9, 7.3, ease);
  const rows: [string, string][] = [["Notes", "#facc15"], ["Browser", "#38bdf8"], ["CaptureME", C.red], ["Video Call", "#a78bfa"]];
  return (
    <Stage>
      <Wallpaper width={1200} height={720} />
      <MenuBar width={1200} trayActive={ready > 0.5} />
      <MacWindow width={820} height={520} x={190} y={90} title="Screen & System Audio Recording" bodyStyle={{ background: "#f4f4f6" }}>
        <SettingsSidebar active={1} items={["Location Services", "Screen & System Audio Recording", "Accessibility", "Microphone", "Camera"].map((x) => (x.length > 22 ? "Screen & Audio…" : x))} />
        <div style={{ position: "absolute", left: 240, right: 26, top: 22, fontFamily: FONT }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>Screen & System Audio Recording</div>
          <div style={{ marginTop: 6, fontSize: 14, color: "#71717a", lineHeight: 1.4 }}>Allow the applications below to record the contents of your screen.</div>
          <div style={{ marginTop: 16, borderRadius: 12, background: "#fff", boxShadow: "0 0 0 1px #e4e4e7", overflow: "hidden" }}>
            {rows.map(([name, color], i) => {
              const me = name === "CaptureME";
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderTop: i ? "1px solid #f1f1f3" : "none", background: me ? `rgba(220,38,38,${0.05 + 0.05 * Math.sin(t * 5) * (1 - on)})` : "transparent" }}>
                  {me ? <AppIcon size={34} shadow={false} /> : <div style={{ width: 34, height: 34, borderRadius: 9, background: color }} />}
                  <div style={{ flex: 1, fontSize: 17, fontWeight: me ? 700 : 500 }}>{name}</div>
                  <Toggle on={me ? on : name === "Browser" ? 1 : 0} />
                </div>
              );
            })}
          </div>
        </div>
      </MacWindow>
      {sheet > 0 && (
        <div style={{ position: "absolute", left: 350, top: 190, width: 500, borderRadius: 20, background: "rgba(246,246,248,.98)", boxShadow: "0 30px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.2)", padding: "26px 28px 22px", fontFamily: FONT, opacity: sheet, transform: `translateY(${(1 - sheet) * -20}px)` }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>“CaptureME” will not be able to record until it is quit.</div>
          <div style={{ marginTop: 6, fontSize: 15, color: "#555" }}>Quit & reopen the app so the change takes effect.</div>
          <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <div style={{ padding: "8px 20px", borderRadius: 9, background: "#fff", boxShadow: "0 0 0 1px #d4d4d8", fontSize: 16 }}>Later</div>
            <div style={{ padding: "8px 20px", borderRadius: 9, background: "#2563eb", color: "#fff", fontWeight: 600, fontSize: 16 }}>Quit & Reopen</div>
          </div>
        </div>
      )}
      {ready > 0 && (
        <div style={{ position: "absolute", left: 360, top: 330, padding: "20px 28px", borderRadius: 20, background: "rgba(255,255,255,.97)", boxShadow: "0 24px 60px rgba(0,0,0,.4)", display: "flex", alignItems: "center", gap: 16, fontFamily: FONT, opacity: ready, transform: `scale(${0.9 + ready * 0.1})` }}>
          <div style={{ width: 54, height: 54, borderRadius: 27, background: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={34} color="#fff" strokeWidth={3.5} /></div>
          <div><div style={{ fontSize: 26, fontWeight: 700, color: C.ink }}>พร้อมใช้งานแล้ว!</div><div style={{ fontSize: 17, color: C.slate }}>Ready to capture</div></div>
        </div>
      )}
      <ClickRipple x={cur.x} y={cur.y} p={cur.ripple} color="#fff" />
      <Cursor x={cur.x} y={cur.y} press={cur.press} />
    </Stage>
  );
};

export const InstallDemo: React.FC<{ t: number }> = ({ t }) => {
  // 0–8 DMG, 8–16 Gatekeeper, 16–24 permission – cross-fading
  const a = 1 - seg(t, 7.7, 8.3), b = seg(t, 7.7, 8.3) * (1 - seg(t, 15.7, 16.3)), c = seg(t, 15.7, 16.3);
  return (
    <div style={{ position: "relative", width: 1200, height: 720 }}>
      {a > 0 && <div style={{ position: "absolute", inset: 0, opacity: a }}><DmgDemo t={t} /></div>}
      {b > 0 && <div style={{ position: "absolute", inset: 0, opacity: b }}><GatekeeperDemo t={Math.max(0, t - 8)} /></div>}
      {c > 0 && <div style={{ position: "absolute", inset: 0, opacity: c }}><PermissionDemo t={Math.max(0, t - 16)} /></div>}
    </div>
  );
};
export { lerp };
