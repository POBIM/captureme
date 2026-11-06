"""One editor screenshot per tool, driven through the editor's real tools / dialogs (see src/editor/demo.ts)."""
import os, sys, time, json
import driver as d
from shoot_overlay import WORK

BASE = os.path.join(WORK, "base-dashboard.png")
STICKER = os.path.join(WORK, "sticker.png")
ESC = "window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"
POS = dict(x=-1400, y=-400)


class Ed:
    def __init__(self):
        self.lab = d.cmd("editor", path=BASE, **POS, w=1100, h=760)
        time.sleep(1.5)
        d.place(self.lab, 1100, 760, POS["x"], POS["y"], 2)
        time.sleep(1.5)

    def js(self, code, wait=0.5):
        d.ev(self.lab, code); time.sleep(wait)

    def reset(self):
        self.js(ESC + ";" + ESC + ";__demo.clear();__demo.tool('select');__demo.bg({enabled:false});", 0.6)

    GEOM = """(()=>{const R=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};
      const q=s=>{const e=document.querySelector(s);return e?R(e):null};
      return {ih:innerHeight,tools:[...document.querySelectorAll('.tools button.tool')].map(R),acts:[...document.querySelectorAll('.toolbar button.ib:not(.tool)')].map(R),
        props:q('.props'),pop:q('.popover'),modal:q('.modal'),stage:q('.stage')}})()"""
    TOOLS = ["select", "crop", "arrow", "line", "rect", "ellipse", "pen", "highlighter", "text", "step", "callout", "marker", "underline", "measure", "redact", "blur", "pixelate", "spotlight", "magnify", "stamp", "eyedropper"]
    ACTS = ["undo", "redo", "resize", "pad", "tf", "bg", "wm", "export", "copy", "save", "saveas", "pin", "ocr", "help", "done"]

    def shot(self, name):
        w = d.find_window(w=2200, h=1520, tol=40)
        path = d.shot(w, name)
        g = d.query(self.lab, self.GEOM)
        tb = w["h"] - g["ih"] * 2
        cv = lambda r: r and [r[0] * 2, tb + r[1] * 2, r[2] * 2, r[3] * 2]
        info = {"w": w["w"], "h": w["h"], "tb": tb, "rects": {"props": cv(g["props"]), "pop": cv(g["pop"]), "modal": cv(g["modal"]), "stage": cv(g["stage"])}}
        for i, r in enumerate(g["tools"]):
            info["rects"]["tool_" + self.TOOLS[i]] = cv(r)
        for i, r in enumerate(g["acts"]):
            info["rects"]["act_" + self.ACTS[i]] = cv(r)
        info["rects"] = {k: v for k, v in info["rects"].items() if v}
        json.dump(info, open(os.path.join(d.RAW, d.LANG, name + ".json"), "w"))
        return path


def run(lang):
    d.start(lang)
    e = Ed()
    # make window title + toolbar geometry known
    info = d.query(e.lab, "({iw:innerWidth,ih:innerHeight,btns:__demo.btnRects()})")
    json.dump(info, open(os.path.join(WORK, f"editor-geom-{lang}.json"), "w"))
    e.reset(); e.shot("editor-fresh")

    # arrows (straight / curved / double)
    e.reset()
    e.js("""__demo.props('arrow',{color:'#ef4444',width:9,arrowStyle:'straight'});
      __demo.drag('arrow',[1560,640],[1296,722]);
      __demo.props('arrow',{arrowStyle:'curved',color:'#f97316'}); __demo.drag('arrow',[760,720],[1000,900]);
      __demo.props('arrow',{arrowStyle:'double',color:'#3b82f6'}); __demo.drag('arrow',[500,1010],[1100,1010]);
      __demo.props('arrow',{arrowStyle:'straight',color:'#ef4444'}); __demo.tool('arrow');""", 0.8)
    e.shot("editor-arrow")

    # shapes
    e.reset()
    e.js("""__demo.props('rect',{color:'#ef4444',width:7,fill:'none',radius:10}); __demo.drag('rect',[440,276],[922,550]);
      __demo.props('ellipse',{color:'#22c55e',width:7,fill:'none'}); __demo.drag('ellipse',[1130,670],[1320,740]);
      __demo.props('line',{color:'#3b82f6',width:6}); __demo.drag('line',[1650,930],[2330,930]);
      __demo.tool('rect');""", 0.8)
    e.shot("editor-shapes")

    # pen + highlighter
    e.reset()
    e.js("""__demo.props('highlighter',{color:'#facc15',width:44,opacity:0.6}); __demo.path('highlighter',[[470,160],[700,160],[960,160]]);
      __demo.props('pen',{color:'#ef4444',width:8});
      __demo.path('pen',[[1620,980],[1700,1030],[1780,960],[1860,1030],[1940,960],[2020,1030],[2100,960],[2180,1030]]);
      __demo.tool('pen');""", 0.8)
    e.shot("editor-pen")

    # text
    e.reset()
    e.js("""__demo.text(1290,590,'ขายดีที่สุด!',{color:'#ef4444',fontSize:64,bold:true});
      __demo.text(1650,1010,'ตรวจสอบก่อนส่งทุกครั้ง',{color:'#3b82f6',fontSize:44,textBg:true});
      __demo.tool('text');""", 0.8)
    e.shot("editor-text")

    # steps
    e.reset()
    e.js("""__demo.props('step',{color:'#ef4444',stepStyle:'filled',fontSize:44});
      __demo.click('step',[470,312]); __demo.click('step',[1236,716]); __demo.click('step',[1640,590]); __demo.click('step',[470,1148]);
      __demo.tool('step');""", 0.8)
    e.shot("editor-step")

    # callout
    e.reset()
    e.js("""__demo.callout(1330,800,'ยอดสัปดาห์นี้\\nสูงสุดของเดือน',[1262,760],{});
      __demo.tool('callout');""", 0.8)
    e.shot("editor-callout")

    # redact vs blur vs pixelate
    e.reset()
    e.js("""__demo.drag('pixelate',[1826,722],[2046,764]); __demo.drag('blur',[1826,784],[2150,828]); __demo.drag('redact',[1826,842],[2012,888]);
      __demo.tool('redact');""", 0.8)
    e.shot("editor-redact")

    # spotlight
    e.reset()
    e.js("""__demo.props('spotlight',{spotMode:'dim',dim:0.65}); __demo.drag('spotlight',[460,570],[1584,1100]); __demo.tool('spotlight');""", 0.8)
    e.shot("editor-spotlight")

    # magnifier
    e.reset()
    e.js("""__demo.props('magnify',{zoom:3,leader:true,color:'#ffffff'}); __demo.drag('magnify',[1660,930],[2000,1070]); __demo.edit(0,{sc:{x:1224,y:702}}); __demo.tool('magnify');""", 0.8)
    e.shot("editor-magnify")

    # measure
    e.reset()
    e.js("""__demo.drag('measure',[1174,1030],[1274,1030]); __demo.drag('measure',[1330,722],[1330,1002]); __demo.tool('measure');""", 0.8)
    e.shot("editor-measure")

    # crop
    e.reset()
    e.js("""__demo.tool('crop'); __demo.drag('crop',[456,540],[1620,1130]);""", 0.8)
    e.shot("editor-crop")
    e.js("__demo.tool('select')", 0.4)

    # hero: several annotations
    e.reset()
    e.js("""__demo.props('rect',{color:'#ef4444',width:7,fill:'none',radius:10}); __demo.drag('rect',[440,276],[922,550]);
      __demo.props('arrow',{color:'#ef4444',width:9,arrowStyle:'straight'}); __demo.drag('arrow',[1500,690],[1300,740]);
      __demo.text(1290,580,'ขายดีที่สุด!',{color:'#ef4444',fontSize:60,bold:true});
      __demo.props('highlighter',{color:'#facc15',width:44,opacity:0.6}); __demo.path('highlighter',[[470,160],[700,160],[960,160]]);
      __demo.drag('redact',[1826,842],[2012,888]); __demo.drag('blur',[1826,784],[2150,828]);
      __demo.props('step',{color:'#ef4444',fontSize:44}); __demo.click('step',[470,312]); __demo.click('step',[1120,716]);
      __demo.tool('select');""", 1.0)
    e.shot("editor-hero")

    # background beautifier
    e.js("__demo.deselect(); __demo.bg({enabled:true,padding:120,mode:'gradient',gradient:2,radius:28,shadow:true}); __demo.btn('bg');", 1.0)
    e.shot("editor-background")
    e.js(ESC, 0.4)

    # popovers / dialogs on the hero image
    e.reset()
    e.js("__demo.drag('arrow',[1560,640],[1296,722]); __demo.tool('select'); __demo.btn('wm');", 0.8)
    e.js("document.querySelector('.popover input[type=checkbox]')?.click()", 0.8)
    e.shot("editor-watermark")
    e.js("document.querySelector('.popover input[type=checkbox]')?.click()", 0.3)
    e.js(ESC, 0.4)
    e.js("__demo.btn('export');", 0.8); e.shot("editor-export"); e.js(ESC, 0.4)
    e.js("__demo.btn('tf');", 0.8); e.shot("editor-transform"); e.js(ESC, 0.4)
    e.js("__demo.btn('pad');", 0.8); e.shot("editor-padding"); e.js(ESC, 0.4)
    e.js("__demo.btn('resize');", 0.8); e.shot("editor-resize"); e.js(ESC, 0.4)
    e.js("__demo.btn('help');", 0.8); e.shot("editor-help"); e.js(ESC, 0.4)

    # align / group
    e.reset()
    e.js("""__demo.props('rect',{color:'#3b82f6',width:6,fill:'none'}); __demo.drag('rect',[500,300],[700,420]); __demo.drag('rect',[900,330],[1100,480]); __demo.drag('rect',[1300,290],[1500,400]);
      __demo.tool('select'); __demo.select([0,1,2]);""", 0.8)
    e.js("document.querySelectorAll('.pright button')[5]?.click()", 0.8)
    e.shot("editor-arrange")
    e.js(ESC, 0.3)

    # pasted image
    e.reset()
    e.js(f"__demo.image({json.dumps(STICKER)}, [1900,1180]);", 1.5)
    e.shot("editor-paste")
    e.reset()
    d.stop()


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "th")
