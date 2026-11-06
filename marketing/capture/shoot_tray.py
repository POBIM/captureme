"""The real menu-bar menu (native NSMenu popped up from the app itself). Run ends by killing the demo app."""
import sys, time, subprocess
import driver as d

def run(lang):
    d.start(lang)
    # a neutral backdrop of our own, so the translucent menu material only blends with it (never with the real desktop)
    d.cmd("open", label="backdrop", page="colors", w=520, h=680, x=200, y=120, frameless=True, shadow=False)
    time.sleep(1)
    d.ev("backdrop", "document.documentElement.style.background=document.body.style.background='linear-gradient(160deg,#dfe6f1,#d4dbe8)';document.body.innerHTML=''")
    d.cmd("open", label="anchor", page="overlay", query="mode=countdown&secs=99", w=40, h=40, x=300, y=160, frameless=True, shadow=False)
    time.sleep(1)
    d.cmd("tray_menu", label="anchor", mx=0, my=0)
    time.sleep(1.5)
    ws = d.windows()
    print(ws)
    big = [w for w in ws if w["layer"] > 20 and w["h"] > 100]
    if big:
        d.shot(big[0], "tray-menu", shadow=True)
    subprocess.run(["pkill", "-f", "target/debug/captureme"])
    d.stop()

if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "th")
