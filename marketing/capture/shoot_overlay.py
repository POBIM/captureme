"""Capture overlay states (frozen scene) + the real capture flow -> editor base image, thumbnail, history samples."""
import os, shutil, sys, time, glob
import driver as d

WORK = os.path.join(d.ROOT, "marketing", "capture", "work")
DASH_WIN = [{"x": 120, "y": 80, "w": 1200, "h": 740, "app": "บ้านสวนคาเฟ่", "title": "แดชบอร์ดยอดขาย"}]


OV = {"toolbar": "#toolbar", "presets": "#presets", "size": "#size", "loupe": "#loupe", "hint": "#hint", "sel": "#sel", "hl": "#hl"}


def finish_overlay():
    d.ev("overlay-1", "__click('[data-act=cancel]')"); time.sleep(0.8)


def run(lang):
    d.start(lang)
    # --- 1 idle: crosshair + loupe + hint + presets
    d.overlay("capture", "dashboard", DASH_WIN)
    d.ev("overlay-1", "__hover(707,520)"); time.sleep(0.5)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="capture-idle")
    # --- 2 mid-drag: size chip + loupe
    d.ev("overlay-1", "__dragto(335,215,1305,680,14)"); time.sleep(0.5)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="capture-drag")
    d.ev("overlay-1", "__up(1305,680)"); time.sleep(0.6)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="capture-region")
    # --- 3 aspect preset 16:9
    d.ev("overlay-1", "__click('[data-p=\"r:16x9\"]')"); time.sleep(0.6)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="capture-preset")
    finish_overlay()
    # --- 4 window snapping
    d.overlay("window", "dashboard", DASH_WIN)
    d.ev("overlay-1", "__hover(760,420)"); time.sleep(0.6)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="capture-window")
    finish_overlay()
    # --- 5 other modes (toolbar / badge variants)
    d.overlay("scroll", "dashboard", DASH_WIN)
    d.ev("overlay-1", "__drag(330,100,1310,810,10)"); time.sleep(0.6)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="overlay-scroll")
    finish_overlay()
    d.overlay("record", "dashboard", DASH_WIN)
    d.ev("overlay-1", "__drag(330,100,1310,810,10)"); time.sleep(0.6)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="overlay-record")
    finish_overlay()
    d.overlay("ocr", "doc", [])
    d.ev("overlay-1", "__drag(250,230,1200,500,10)"); time.sleep(0.6)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="overlay-ocr")
    finish_overlay()
    d.overlay("pin", "dashboard", DASH_WIN)
    d.ev("overlay-1", "__drag(340,355,922,678,10)"); time.sleep(0.6)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="overlay-pin")
    finish_overlay()
    d.overlay("qr", "qr", [])
    d.ev("overlay-1", "__drag(530,280,910,680,10)"); time.sleep(0.6)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="overlay-qr")
    finish_overlay()
    d.overlay("color", "pal", [])
    d.ev("overlay-1", "__hover(350,420)"); time.sleep(0.8)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="overlay-color")
    finish_overlay()
    d.overlay("measure", "boxes", [])
    d.ev("overlay-1", "__hover(350,300)"); time.sleep(0.9)
    d.shot(d.windows()[0], lab="overlay-1", sels=OV, name="overlay-measure")
    finish_overlay()
    d.stop()


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "th")
