#!/usr/bin/env bash
# CaptureME – build a release for everyone on Mac: .app + .dmg + .zip + SHA256SUMS.txt
#
#   scripts/build-installer.sh [--native | --universal] [--skip-npm] [-h]
#
#   (default)    universal binary (Apple Silicon + Intel) when the x86_64-apple-darwin Rust target is
#                installed (`rustup target add x86_64-apple-darwin`); otherwise a native build + a warning
#   --universal  force a universal build (installs both Rust targets with rustup if missing)
#   --native     build only for this Mac's architecture (faster; for testing)
#   --skip-npm   don't run `npm ci`
#
# Output (./release/):
#   CaptureME_<version>_universal.dmg   disk image with drag-to-Applications layout
#   CaptureME_<version>_universal.zip   zipped CaptureME.app (ditto, keeps signature + xattrs)
#   SHA256SUMS.txt                      checksums of the files above (`shasum -a 256 -c SHA256SUMS.txt`)
#   (native builds are labelled _aarch64 / _x64 instead of _universal)
#
# Minimum macOS: see bundle.macOS.minimumSystemVersion in src-tauri/tauri.conf.json (14.0).
#
# Signing / notarisation (optional, all via environment variables):
#   APPLE_SIGNING_IDENTITY   e.g. "Developer ID Application: Your Name (TEAMID)"  → real signature
#                            (unset = ad-hoc signature "-", fine for your own Mac)
#   APPLE_ID                 Apple ID e-mail            ┐ if all four are set the build is
#   APPLE_TEAM_ID            10-char team id            │ notarised (Tauri does it during the
#   APPLE_PASSWORD           app-specific password      ┘ bundle step) and the ticket is stapled
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

UNIVERSAL=auto
SKIP_NPM=0
for a in "$@"; do
  case "$a" in
    --universal) UNIVERSAL=1 ;;
    --native) UNIVERSAL=0 ;;
    --skip-npm) SKIP_NPM=1 ;;
    -h|--help) sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- dependency checks
[[ "$(uname -s)" == "Darwin" ]] || die "this script only runs on macOS"
for bin in cargo rustc node npm; do
  command -v "$bin" >/dev/null 2>&1 || die "'$bin' not found. Install Rust (https://rustup.rs) and Node.js (https://nodejs.org)."
done
xcode-select -p >/dev/null 2>&1 || die "Xcode command line tools missing – run: xcode-select --install"
command -v codesign >/dev/null || die "codesign not found (Xcode command line tools)"
say "rust $(rustc --version | cut -d' ' -f2), node $(node --version), npm $(npm --version)"

VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"
PRODUCT="$(node -p "require('./src-tauri/tauri.conf.json').productName")"

if [[ $SKIP_NPM -eq 0 ]]; then
  say "Installing JS dependencies (npm ci)"
  if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
fi

# ---------------------------------------------------------------- target
TARGET_ARGS=()
BUNDLE_DIR="src-tauri/target/release/bundle"
ARCH_LABEL="aarch64"
if [[ "$(uname -m)" != "arm64" ]]; then ARCH_LABEL="x64"; fi
if [[ "$UNIVERSAL" == "auto" ]]; then
  if command -v rustup >/dev/null 2>&1 && rustup target list --installed 2>/dev/null | grep -qx "x86_64-apple-darwin" \
     && rustup target list --installed 2>/dev/null | grep -qx "aarch64-apple-darwin"; then
    UNIVERSAL=1
  else
    UNIVERSAL=0
    warn "x86_64-apple-darwin / aarch64-apple-darwin Rust targets not both installed → NATIVE build only."
    warn "For a release that also runs on Intel Macs:  rustup target add aarch64-apple-darwin x86_64-apple-darwin"
  fi
fi
if [[ $UNIVERSAL -eq 1 ]]; then
  say "Universal build (Apple Silicon + Intel): ensuring Rust targets"
  rustup target add aarch64-apple-darwin x86_64-apple-darwin
  TARGET_ARGS=(--target universal-apple-darwin)
  BUNDLE_DIR="src-tauri/target/universal-apple-darwin/release/bundle"
  ARCH_LABEL="universal"
fi

# ---------------------------------------------------------------- signing identity
IDENTITY="${APPLE_SIGNING_IDENTITY:--}"
CONFIG_ARGS=()
if [[ "$IDENTITY" != "-" ]]; then
  say "Signing with: $IDENTITY"
  CONFIG_ARGS=(--config "{\"bundle\":{\"macOS\":{\"signingIdentity\":\"$IDENTITY\"}}}")
  if [[ -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_PASSWORD:-}" ]]; then
    say "Notarisation enabled (APPLE_ID / APPLE_TEAM_ID / APPLE_PASSWORD present)"
  else
    warn "APPLE_ID / APPLE_TEAM_ID / APPLE_PASSWORD not all set → the build will be signed but NOT notarised"
  fi
else
  say "No APPLE_SIGNING_IDENTITY → ad-hoc signature (works on this Mac; other Macs need right-click ▸ Open)"
fi

# ---------------------------------------------------------------- build
say "Building $PRODUCT $VERSION ($ARCH_LABEL) – this takes a few minutes"
BUILD_OK=1
npm run tauri build -- --bundles app,dmg ${TARGET_ARGS[@]+"${TARGET_ARGS[@]}"} ${CONFIG_ARGS[@]+"${CONFIG_ARGS[@]}"} || BUILD_OK=0

APP="$BUNDLE_DIR/macos/$PRODUCT.app"
if [[ $BUILD_OK -eq 0 ]]; then
  warn "DMG bundling failed (the pretty DMG needs Finder scripting) – retrying with the .app only"
  npm run tauri build -- --bundles app ${TARGET_ARGS[@]+"${TARGET_ARGS[@]}"} ${CONFIG_ARGS[@]+"${CONFIG_ARGS[@]}"}
fi
[[ -d "$APP" ]] || die "app bundle not found at $APP"

# ---------------------------------------------------------------- codesign
say "Verifying code signature"
if ! codesign --verify --deep --strict "$APP" 2>/dev/null; then
  warn "signature invalid/missing – signing now ($IDENTITY)"
  if [[ "$IDENTITY" == "-" ]]; then
    codesign --force --deep -s - "$APP"
  else
    codesign --force --deep --options runtime --timestamp -s "$IDENTITY" "$APP"
  fi
  RESIGNED=1
else
  RESIGNED=0
fi
codesign --verify --deep --strict "$APP" && echo "    signature OK ($(codesign -dv "$APP" 2>&1 | grep -E '^(Signature|Authority)' | head -1))"

# ---------------------------------------------------------------- dmg
mkdir -p release
OUT="release/${PRODUCT}_${VERSION}_${ARCH_LABEL}.dmg"
TAURI_DMG="$(ls -t "$BUNDLE_DIR"/dmg/*.dmg 2>/dev/null | head -1 || true)"

make_plain_dmg() {
  say "Creating DMG with hdiutil"
  local stage; stage="$(mktemp -d)"
  ditto "$APP" "$stage/$PRODUCT.app"
  ln -s /Applications "$stage/Applications"
  rm -f "$OUT"
  hdiutil create -volname "$PRODUCT" -srcfolder "$stage" -fs HFS+ -format UDZO -ov "$OUT" >/dev/null
  rm -rf "$stage"
}

if [[ -n "$TAURI_DMG" && $RESIGNED -eq 0 && $BUILD_OK -eq 1 ]]; then
  cp -f "$TAURI_DMG" "$OUT"
else
  make_plain_dmg
fi

# ---------------------------------------------------------------- notarisation (when Tauri could not do it)
if [[ "$IDENTITY" != "-" && -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_PASSWORD:-}" ]]; then
  if ! xcrun stapler validate "$OUT" >/dev/null 2>&1; then
    say "Notarising the DMG (xcrun notarytool) …"
    codesign --force -s "$IDENTITY" "$OUT" || true
    xcrun notarytool submit "$OUT" --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD" --wait
    xcrun stapler staple "$OUT"
  fi
fi

# ---------------------------------------------------------------- architectures
BIN="$APP/Contents/MacOS/$(defaults read "$ROOT/$APP/Contents/Info" CFBundleExecutable 2>/dev/null || echo captureme)"
ARCHS="$(lipo -archs "$BIN" 2>/dev/null || echo '?')"
say "Binary architectures: $ARCHS"
if [[ "$ARCH_LABEL" == "universal" && "$ARCHS" != *arm64* || "$ARCH_LABEL" == "universal" && "$ARCHS" != *x86_64* ]]; then
  die "expected a universal binary (arm64 + x86_64) but got: $ARCHS"
fi
MINOS="$(defaults read "$ROOT/$APP/Contents/Info" LSMinimumSystemVersion 2>/dev/null || echo '?')"
say "LSMinimumSystemVersion: $MINOS"

# ---------------------------------------------------------------- zip of the .app
ZIP="release/${PRODUCT}_${VERSION}_${ARCH_LABEL}.zip"
say "Creating $ZIP"
rm -f "$ZIP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"

# ---------------------------------------------------------------- checksums
say "Writing release/SHA256SUMS.txt"
( cd release && shasum -a 256 "$(basename "$OUT")" "$(basename "$ZIP")" > SHA256SUMS.txt )
cat release/SHA256SUMS.txt | sed 's/^/    /'

say "Done"
echo "    app: $APP"
echo "    dmg: $ROOT/$OUT ($(du -h "$OUT" | cut -f1))"
echo "    zip: $ROOT/$ZIP ($(du -h "$ZIP" | cut -f1))"
echo "    sha: $ROOT/release/SHA256SUMS.txt"
