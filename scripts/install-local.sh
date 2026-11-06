#!/usr/bin/env bash
# CaptureME – install the app into /Applications on this Mac.
#
#   scripts/install-local.sh [--rebuild] [--reset-permissions] [--no-launch] [-h]
#
#   --rebuild            always build a fresh .app first (default: reuse an existing build)
#   --reset-permissions  tccutil reset ScreenCapture / Accessibility / Microphone for the app.
#                        Needed after re-installing an ad-hoc signed build, because macOS ties the
#                        permission to the code signature, which changes with every build.
#   --no-launch          don't start the app afterwards
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
BUNDLE_ID="com.sitthichat.captureme"

REBUILD=0; RESET=0; LAUNCH=1
for a in "$@"; do
  case "$a" in
    --rebuild) REBUILD=1 ;;
    --reset-permissions) RESET=1 ;;
    --no-launch) LAUNCH=0 ;;
    -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }
[[ "$(uname -s)" == "Darwin" ]] || die "macOS only"

PRODUCT="$(node -p "require('./src-tauri/tauri.conf.json').productName" 2>/dev/null || echo CaptureME)"
APP="src-tauri/target/release/bundle/macos/$PRODUCT.app"

if [[ $REBUILD -eq 1 || ! -d "$APP" ]]; then
  for bin in cargo node npm; do command -v "$bin" >/dev/null || die "'$bin' not found"; done
  say "Building $PRODUCT.app"
  [[ -d node_modules ]] || npm ci
  npm run tauri build -- --bundles app
fi
[[ -d "$APP" ]] || die "app bundle not found: $APP"

say "Quitting running instance (if any)"
osascript -e "tell application \"$PRODUCT\" to quit" >/dev/null 2>&1 || true
sleep 1
pkill -x captureme >/dev/null 2>&1 || true

DEST="/Applications/$PRODUCT.app"
say "Installing to $DEST"
if [[ -e "$DEST" ]]; then rm -rf "$DEST" 2>/dev/null || sudo rm -rf "$DEST"; fi
ditto "$APP" "$DEST" 2>/dev/null || sudo ditto "$APP" "$DEST"

say "Clearing quarantine + ad-hoc signing"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || sudo xattr -dr com.apple.quarantine "$DEST" || true
codesign --verify --deep --strict "$DEST" 2>/dev/null || codesign --force --deep -s - "$DEST" 2>/dev/null || sudo codesign --force --deep -s - "$DEST"

if [[ $RESET -eq 1 ]]; then
  say "Resetting privacy permissions for $BUNDLE_ID"
  tccutil reset ScreenCapture "$BUNDLE_ID" || true
  tccutil reset Accessibility "$BUNDLE_ID" || true
  tccutil reset Microphone "$BUNDLE_ID" || true
fi

cat <<MSG

Installed: $DEST

Reminder – grant these in System Settings ▸ Privacy & Security:
  • Screen & System Audio Recording → enable CaptureME   (required for every capture)
  • Accessibility                    → only for "auto-scroll" in scrolling capture
  • Microphone                       → only when recording with the microphone
If captures are blank/black after re-installing, run:
  scripts/install-local.sh --reset-permissions
then re-enable Screen Recording and restart the app.
MSG

if [[ $LAUNCH -eq 1 ]]; then
  say "Launching"
  open "$DEST"
fi
