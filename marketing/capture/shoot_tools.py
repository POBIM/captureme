"""Real windows of the tools: OCR / QR / pin / colours / thumbnail / history / settings / recorder / scroll / video / onboarding."""
import base64, datetime, json, os, subprocess, sys, time
import driver as d
from shoot_overlay import DASH_WIN, WORK

POS = dict(x=-1400, y=-400)


def grab(name_title, shot_name, x=100, y=100, zoom=2, timeout=8):
    """Find the (frameless) window titled name_title, magnify it 2x, photograph it."""
    t0 = time.time(); w = None
    while time.time() - t0 < timeout and not w:
        ws = [x_ for x_ in d.windows() if x_["name"] == name_title]
        w = ws[0] if ws else None
        time.sleep(0.2)
    assert w, name_title
    labels = {l["label"]: l for l in d.cmd("windows")}
    return w


def zshot(prefix, title, shot_name, x=100, y=100, zoom=2):
    lab = d.label_like(prefix, timeout=40)
    time.sleep(0.8)
    w = [x_ for x_ in d.windows() if x_["name"] == title][0]
    d.place(lab, w["w"], w["h"], x, y, zoom)
    w2 = [x_ for x_ in d.windows() if x_["name"] == title][0]
    d.shot(w2, shot_name, lab=lab)
    return lab


def iso(days=0, hours=0):
    return (datetime.datetime.now().astimezone() - datetime.timedelta(days=days, hours=hours)).isoformat()


def overlay_flow(mode, scene, windows, drag, finish="confirm"):
    d.overlay(mode, scene, windows)
    d.ev("overlay-1", "__drag(%d,%d,%d,%d,10)" % drag); time.sleep(0.5)
    d.ev("overlay-1", "__click('[data-act=%s]')" % finish)


def run(lang):
    d.start(lang)
    # ---------------- OCR (real Apple Vision) ----------------
    overlay_flow("ocr", "doc", [], (250, 230, 1200, 500))
    zshot("ocr-", "CaptureME OCR", "ocr-result", 300, 150)
    d.close_all()
    # ---------------- QR (real decode) ----------------
    overlay_flow("qr", "qr", [], (530, 280, 910, 680))
    zshot("qr-", "CaptureME QR", "qr-result", 300, 150)
    d.close_all()
    # ---------------- Pin ----------------
    overlay_flow("pin", "dashboard", DASH_WIN, (340, 355, 922, 678), "pin")
    time.sleep(1.5)
    zshot("pin-", "CaptureME Pin", "pin-window", 200, 150)
    d.close_all()
    # ---------------- Thumbnail ----------------
    d.cmd("settings", patch={"after_capture": "thumbnail", "thumbnail_seconds": 0})
    overlay_flow("capture", "dashboard", DASH_WIN, (335, 215, 1305, 680))
    time.sleep(1.5)
    zshot("thumb", "CaptureME", "thumbnail", 900, 300)
    d.close_all()
    d.cmd("settings", patch={"after_capture": "editor"})
    # ---------------- Countdown ----------------
    d.cmd("open", label="countdown", page="overlay", query="mode=countdown&secs=5", w=140, h=140, x=300, y=300, frameless=True, shadow=False)
    time.sleep(1.2)
    w = [x_ for x_ in d.windows() if x_["w"] == 140][0]
    d.place("countdown", 140, 140, 300, 300, 2)
    d.shot([x_ for x_ in d.windows() if x_["w"] == 280][0], "countdown", lab="countdown")
    d.close_all()
    # ---------------- Colours panel (real picks, copied in the chosen format) ----------------
    d.cmd("colors", list=[[99, 102, 241], [14, 165, 233], [22, 163, 74], [250, 204, 21], [249, 115, 22], [220, 38, 38]])
    time.sleep(1.5)
    lab = "colors"
    d.place(lab, 300, 420, POS["x"], POS["y"], 2)
    d.shot([x_ for x_ in d.windows() if abs(x_["w"] - 600) < 8][0], "colors-panel", lab="colors")
    d.close_all()
    # ---------------- History (sample entries) ----------------
    ages = [(0, 0), (0, 3), (1, 0), (1, 6), (3, 0), (4, 2)]
    for i, (dd, hh) in enumerate(ages, 1):
        d.cmd("history_add", path=os.path.join(WORK, f"hist-{i}.png"), created_at=iso(dd, hh))
        time.sleep(0.4)
    time.sleep(1.0)
    d.cmd("history_window")
    time.sleep(1.5)
    d.place("history", 960, 640, POS["x"], POS["y"], 2)
    d.shot(d.find_window(w=1920, h=1280, tol=40), "history", lab="history")
    d.close_all()
    # ---------------- Settings tabs ----------------
    d.cmd("settings", patch={"save_dir": "~/Pictures/CaptureME"})
    d.cmd("settings_window", query="tab=general", h=760)
    time.sleep(1.2)
    d.place("settings", 720, 760, POS["x"], POS["y"], 2)
    for tab in ["general", "save", "recording", "hotkeys", "history", "about"]:
        d.ev("settings", f"document.querySelector('.tab[data-tab={tab}]').click()")
        time.sleep(0.9)
        d.shot(d.find_window(w=1440, h=1520, tol=40), f"settings-{tab}", lab="settings")
    d.close_all()
    # ---------------- Recorder setup bar + recording bar ----------------
    def rec_init(recording, pending):
        return d.demo_init("{recording_status:{recording:%s,pending:%s,paused:false,started_ms:Date.now()-83000,elapsed_ms:83000,width:980,height:710,target:'region',can_pause:true,keys_access:true,sck:true}}" % (recording, pending))
    for kind, size, nm in [("setup", (600, 276), "record-setup"), ("rec", (330, 52), "record-bar")]:
        init = rec_init(*(("false", "true") if kind == "setup" else ("true", "false")))
        d.cmd("open", label="rec", page="recorder", query="mode=setup", w=size[0], h=size[1], x=200, y=200, frameless=True, init=init)
        time.sleep(1.5)
        d.place("rec", size[0], size[1], 200, 200, 2)
        d.shot([x_ for x_ in d.windows() if abs(x_["w"] - size[0] * 2) < 8][0], nm, lab="rec")
        d.close_all()
    # ---------------- Scroll capture control ----------------
    scroll = d.demo_init("{scroll_status:{active:true,width:980,height:710,auto:true,accessibility:true}}")
    d.cmd("open", label="scroll-control", page="scroll", query="mode=control", w=268, h=408, x=200, y=200, frameless=True, init=scroll)
    time.sleep(1.5)
    subprocess.run(["sips", "-s", "format", "jpeg", "-Z", "520", os.path.join(WORK, "tall.png"), "--out", os.path.join(WORK, "tall.jpg")], capture_output=True)
    b64 = base64.b64encode(open(os.path.join(WORK, "tall.jpg"), "rb").read()).decode()
    d.cmd("emit", event="scroll-preview", payload={"jpeg": "data:image/jpeg;base64," + b64, "rows": 3420, "width": 900, "frames": 14, "limit": False})
    time.sleep(0.8)
    d.place("scroll-control", 268, 408, 200, 200, 2)
    d.shot([x_ for x_ in d.windows() if abs(x_["w"] - 536) < 8][0], "scroll-control", lab="scroll-control")
    d.close_all()
    # ---------------- Video window (real trim UI on a sample clip) ----------------
    clip = os.path.join(WORK, "sample.mp4")
    d.cmd("open", label="video", page="video", query="path=" + clip.replace("/", "%2F"), title="CaptureME Video", w=1080, h=740, **POS, allow=clip)
    time.sleep(2.5)
    d.place("video", 1080, 740, POS["x"], POS["y"], 2)
    time.sleep(1.5)
    d.shot(d.find_window(w=2160, h=1480, tol=40), "video-window", lab="video")
    d.close_all()
    # ---------------- Onboarding (first launch, permission not yet granted) ----------------
    mock = d.demo_init("{check_screen_permission:false}")
    d.cmd("open", label="onboarding", page="onboarding", title="CaptureME", w=580, h=720, **POS, init=mock)
    time.sleep(2)
    d.place("onboarding", 580, 720, POS["x"], POS["y"], 2)
    d.shot(d.find_window(w=1160, h=1440, tol=40), "onboarding", lab="onboarding")
    d.close_all()
    d.stop()


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "th")
