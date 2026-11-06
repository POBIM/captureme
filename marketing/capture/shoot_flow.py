"""Real capture flow -> base image for the editor, floating thumbnail; then sample files for history/video."""
import os, shutil, sys, time, glob, subprocess
import driver as d
from shoot_overlay import DASH_WIN, WORK


def captures():
    return sorted(glob.glob(d.HOME + "/Library/Application Support/com.sitthichat.captureme/captures/*.png"), key=os.path.getmtime)


def run(lang):
    d.start(lang)
    # 1) window-mode capture of the dashboard "window" -> editor (default after-capture action)
    d.overlay("window", "dashboard", DASH_WIN)
    d.ev("overlay-1", "__hover(760,420)"); time.sleep(0.5)
    d.ev("overlay-1", "__m('mousedown',760,420);__m('mouseup',760,420)")
    lab = d.label_like("editor-")
    time.sleep(2.5)
    base = captures()[-1]
    shutil.copy(base, os.path.join(WORK, "base-dashboard.png"))
    print("base", base)
    w = d.find_window(w=1100, h=760)
    if w: d.shot(w, "editor-fresh-1x")
    d.close_all()
    # 2) region capture with "thumbnail" after-capture action
    d.cmd("settings", patch={"after_capture": "thumbnail", "thumbnail_seconds": 0})
    d.overlay("capture", "dashboard", DASH_WIN)
    d.ev("overlay-1", "__drag(335,215,1305,680,10)"); time.sleep(0.4)
    d.ev("overlay-1", "__click('[data-act=confirm]')")
    time.sleep(2.0)
    print(d.cmd("windows"))
    lab = d.label_like("thumb")
    d.cmd("place", label=lab, x=900, y=300)
    ws = d.windows()
    print(ws)
    d.stop()


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "th")
