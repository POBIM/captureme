#!/usr/bin/env bash
# Regenerates every REAL capture + the docs images, driving the debug build of CaptureME in DEMO mode.
#   bash marketing/capture/run-all.sh [th] [en]          (default: th en)
# Needs: macOS, Rust, Node, Xcode CLT (swiftc), `cwebp` (brew install webp), Screen Recording permission for
# your terminal (screencapture -l photographs only the demo app's own windows).
# The demo driver is compiled into DEBUG builds only (src-tauri/src/demo.rs) and activates with CAPTUREME_DEMO=<dir>;
# the app runs with a throw-away HOME, so your own settings / history are never read or changed.
set -euo pipefail
cd "$(dirname "$0")/../.."          # marketing/
ROOT="$(cd .. && pwd)"
LANGS="${*:-th en}"

echo "▶ build the debug app (demo driver included)"
( cd "$ROOT/src-tauri" && cargo build )
echo "▶ helper tools"
swiftc -O capture/winlist.swift -o /tmp/winlist
echo "▶ sample 'screens' (real Chrome rendering of authored HTML)"
node capture/scenes/render-scenes.mjs
( cd capture/work
  sips -c 1480 2400 --cropOffset 160 240 scene-dashboard.png --out hist-1.png >/dev/null
  sips -c 900 1500 --cropOffset 700 700 scene-dashboard.png --out hist-2.png >/dev/null
  sips -c 1040 1960 --cropOffset 300 460 scene-doc.png --out hist-3.png >/dev/null
  sips -c 1280 1200 --cropOffset 260 840 scene-qr.png --out hist-4.png >/dev/null
  sips -c 940 2080 --cropOffset 340 400 scene-pal.png --out hist-5.png >/dev/null
  sips -c 1400 2240 --cropOffset 200 320 scene-boxes.png --out hist-6.png >/dev/null
  sips -c 1480 900 --cropOffset 160 240 scene-dashboard.png --out tall.png >/dev/null
  sips -c 340 900 --cropOffset 700 460 scene-pal.png --out sticker.png >/dev/null
  ffmpeg -loglevel error -y -loop 1 -i scene-dashboard.png -t 8 -r 30 -vf "scale=2880:-1,crop=1920:1080:'t*120':'t*20',scale=1280:720,format=yuv420p" -c:v libx264 -crf 22 sample.mp4 )
echo "▶ the real capture flow once (window capture → editor base image)"
python3 capture/shoot_flow.py th
for L in $LANGS; do
  echo "▶ shooting the app in '$L'"
  python3 capture/shoot_overlay.py "$L"; python3 capture/shoot_tools.py "$L"; python3 capture/shoot_editor.py "$L"; python3 capture/shoot_tray.py "$L"
  echo "▶ docs/images/$L"
  node capture/docs-images.mjs "$L"
done
echo "done – now: npm run render"
