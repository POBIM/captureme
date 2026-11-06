"""Drives the debug build of CaptureME in demo mode and photographs ITS windows only.

Nothing here touches the user's desktop: windows of the demo process are listed by pid
(CGWindowList) and captured one by one with `screencapture -x -o -l <windowID>`; the app is
steered through files (src-tauri/src/demo.rs) and DOM scripts inside its own webviews.
Data (settings, history, captures) lives in a throw-away HOME.
"""
import json, os, shutil, signal, subprocess, sys, time, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HOME = "/tmp/cm-home"
CTL = "/tmp/cm-ctl"
RAW = os.path.join(ROOT, "marketing", "capture", "raw")
BIN = os.path.join(ROOT, "src-tauri", "target", "debug", "captureme")
WINLIST = "/tmp/winlist"
_vite = None
_app = None
_seq = 0


def start(lang="th"):
    """Start vite (dev server) + the debug binary with an isolated HOME."""
    global _vite, _app, LANG
    LANG = lang
    subprocess.run(["pkill", "-f", "target/debug/captureme"])  # stale demo instance (never the installed app)
    time.sleep(0.5)
    import atexit; atexit.register(lambda: _app and _app.poll() is None and _app.kill())
    # the demo flows (copy / OCR / colour pick) overwrite the clipboard: keep a text copy and put it back in stop()
    try:
        open("/tmp/cm-clip.txt", "wb").write(subprocess.run(["pbpaste"], capture_output=True).stdout)
    except Exception:
        pass
    shutil.rmtree(HOME, ignore_errors=True)
    shutil.rmtree(CTL, ignore_errors=True)
    os.makedirs(HOME + "/Library/Application Support/com.sitthichat.captureme", exist_ok=True)
    os.makedirs(CTL, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    try:
        urllib.request.urlopen("http://localhost:1420/", timeout=1)
    except Exception:
        _vite = subprocess.Popen(["npm", "run", "dev"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(60):
            time.sleep(0.5)
            try:
                urllib.request.urlopen("http://localhost:1420/", timeout=1); break
            except Exception:
                pass
    env = dict(os.environ, HOME=HOME, CAPTUREME_DEMO=CTL)
    _app = subprocess.Popen([BIN], env=env, stdout=open("/tmp/cm-app.log", "w"), stderr=subprocess.STDOUT)
    time.sleep(2.5)
    cmd("settings", patch={"language": lang, "after_capture": "editor", "play_sound": False})


def stop():
    global _vite, _app
    try:
        cmd("closeall"); cmd("quit", timeout=3)
    except Exception:
        pass
    if _app:
        try: _app.wait(timeout=5)
        except Exception: _app.kill()
    if _vite:
        _vite.terminate()
    _app = _vite = None
    shutil.rmtree(HOME, ignore_errors=True)
    try:
        subprocess.run(["pbcopy"], input=open("/tmp/cm-clip.txt", "rb").read())
    except Exception:
        pass


def cmd(op, timeout=20, **kw):
    global _seq
    _seq += 1
    name = f"{_seq:05d}-{op}"
    body = dict(kw, op=op)
    tmp = f"{CTL}/{name}.tmp"
    json.dump(body, open(tmp, "w"))
    os.rename(tmp, f"{CTL}/{name}.cmd.json")
    ack = f"{CTL}/{name}.ack"
    t0 = time.time()
    while not os.path.exists(ack):
        if time.time() - t0 > timeout:
            raise TimeoutError(op)
        time.sleep(0.05)
    r = json.load(open(ack))
    os.remove(ack)
    if not r["ok"]:
        raise RuntimeError(f"{op}: {r['error']}")
    return r["result"]


def ev(label, js):
    return cmd("eval", label=label, js=js)


def windows():
    out = subprocess.run([WINLIST, str(_app.pid)], capture_output=True, text=True).stdout
    return json.loads(out or "[]")


def wait_window(pred=lambda w: True, timeout=10, settle=0.8):
    t0 = time.time()
    while time.time() - t0 < timeout:
        ws = [w for w in windows() if pred(w)]
        if ws:
            time.sleep(settle)
            ws = [w for w in windows() if pred(w)]
            return ws[0] if ws else None
        time.sleep(0.2)
    return None


LANG = "th"


def shot(w, name, shadow=False, lab=None, sels=None, zoom=2):
    """Capture window dict `w` (from windows()) to RAW/<lang>/name.png (+ name.json with element rectangles in
    raw pixels for the callouts: sels = {key: css selector}). -o: no system shadow."""
    os.makedirs(os.path.join(RAW, LANG), exist_ok=True)
    path = os.path.join(RAW, LANG, name + ".png")
    args = ["screencapture", "-x", "-l", str(w["id"])]
    if not shadow:
        args.insert(2, "-o")
    subprocess.run(args + [path], check=True)
    info = {"w": w["w"], "h": w["h"]}
    if lab:
        sels = sels or {}
        js = """(()=>{const o={};const S=%s;for(const k in S){const e=document.querySelector(S[k]);if(e){const r=e.getBoundingClientRect();o[k]=[r.x,r.y,r.width,r.height]}}
          const els=[...document.querySelectorAll('button,[data-act],[data-p],select,.tab,.row,label.switch,input[type=checkbox]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>4&&r.height>4}).map(e=>{const r=e.getBoundingClientRect();return {t:(e.title||e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,40),a:e.dataset.act||e.dataset.p||e.dataset.tab||e.id||'',r:[r.x,r.y,r.width,r.height]}});
          return {ih:innerHeight,rects:o,els}})()""" % json.dumps(sels)
        try:
            g = query(lab, js)
            tb = w["h"] - g["ih"] * zoom  # native title bar (1x) above the magnified page
            cv = lambda v: [v[0] * zoom, tb + v[1] * zoom, v[2] * zoom, v[3] * zoom]
            info["rects"] = {k: cv(v) for k, v in g["rects"].items()}
            info["els"] = [{"t": e["t"], "a": e["a"], "r": cv(e["r"])} for e in g["els"]]
            info["tb"] = tb
        except Exception as e:  # geometry is optional
            print("geom failed", name, e)
    json.dump(info, open(os.path.join(RAW, LANG, name + ".json"), "w"))
    return path


def close_all():
    cmd("closeall")
    time.sleep(0.5)


# ------------------------------------------------------------------ overlay helpers (DOM events inside the overlay page)
MOUSE_JS = """
window.__m = (type, x, y, o) => {
  const el = document.elementFromPoint(x, y) || document.body;
  el.dispatchEvent(new MouseEvent(type, Object.assign({bubbles:true, cancelable:true, clientX:x, clientY:y, button:0, buttons:type==='mouseup'?0:1, view:window}, o||{})));
};
window.__drag = (x1, y1, x2, y2, steps) => { __m('mousemove',x1,y1); __m('mousedown',x1,y1); steps=steps||10;
  for (let i=1;i<=steps;i++) __m('mousemove', x1+(x2-x1)*i/steps, y1+(y2-y1)*i/steps); __m('mouseup',x2,y2); };
window.__hover = (x, y) => { __m('mousemove', x, y); };
window.__dragto = (x1, y1, x2, y2, steps) => { __m('mousemove',x1,y1); __m('mousedown',x1,y1); steps=steps||10;
  for (let i=1;i<=steps;i++) __m('mousemove', x1+(x2-x1)*i/steps, y1+(y2-y1)*i/steps); };
window.__up = (x, y) => __m('mouseup', x, y);
window.__click = (sel) => document.querySelector(sel).click();
"""


def overlay(mode, scene, windows=(), zoom=2, settle=1.2):
    """Open the real capture overlay over a prepared scene PNG (no real screen grab). Returns the window dict."""
    for attempt in range(3):
        while any(x["label"].startswith("overlay-") for x in cmd("windows")):  # previous session still closing
            time.sleep(0.3)
        cmd("overlay", mode=mode, bg=os.path.join(ROOT, "marketing", "capture", "work", f"scene-{scene}.png"), scale=2, zoom=zoom, windows=list(windows))
        t0 = time.time()
        while time.time() - t0 < 6:
            if any(x["label"] == "overlay-1" for x in cmd("windows")):
                w = wait_window(lambda w: w["w"] > 1000, settle=settle)
                ev("overlay-1", MOUSE_JS)
                return w
            time.sleep(0.3)
    raise RuntimeError("overlay did not open")


def find_window(w=None, h=None, tol=6, timeout=8):
    """Wait for a window of (about) the given pixel size."""
    def pred(x):
        return (w is None or abs(x["w"] - w) <= tol) and (h is None or abs(x["h"] - h) <= tol)
    return wait_window(pred, timeout=timeout)


def label_like(prefix, timeout=8):
    t0 = time.time()
    while time.time() - t0 < timeout:
        for x in cmd("windows"):
            if x["label"].startswith(prefix):
                return x["label"]
        time.sleep(0.2)
    return None


def place(label, w, h, x, y, zoom=2):
    """Resize a window to (w*zoom, h*zoom) logical points, move it and magnify its page by `zoom`."""
    cmd("place", label=label, w=w * zoom, h=h * zoom, x=x, y=y, zoom=zoom)
    time.sleep(1.2)


def demo_init(js_object):
    """Init script for a page: `window.__DEMO = {...}` (honoured by src/shared/demo.ts in `vite dev` only)."""
    return "window.__DEMO = %s;" % js_object


def query(label, expr, timeout=5):
    """Evaluate a JS expression in a page and read its JSON result back (through demo_report)."""
    rep = os.path.join(CTL, "report.jsonl")
    if os.path.exists(rep):
        os.remove(rep)
    ev(label, "window.__TAURI_INTERNALS__.invoke('demo_report',{json:JSON.stringify((()=>{return %s})())})" % expr)
    t0 = time.time()
    while time.time() - t0 < timeout:
        if os.path.exists(rep) and open(rep).read().strip():
            return json.loads(open(rep).read().strip().splitlines()[-1])
        time.sleep(0.1)
    raise TimeoutError("query " + expr)
