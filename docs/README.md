# CaptureME docs

| | ภาษาไทย | English |
|---|---|---|
| Install – download from GitHub, DMG, *Open Anyway*, Screen Recording, first capture (real screenshots) | [INSTALL-TH.md](INSTALL-TH.md) | [INSTALL-EN.md](INSTALL-EN.md) |
| User guide – one section per tool, with real screenshots + shortcuts | [USER-GUIDE-TH.md](USER-GUIDE-TH.md) | [USER-GUIDE-EN.md](USER-GUIDE-EN.md) |
| Privacy policy | [../PRIVACY.md](../PRIVACY.md) | [../PRIVACY.md](../PRIVACY.md#english) |
| License (MIT) | [../LICENSE](../LICENSE) | [../LICENSE](../LICENSE) |
| Posters, social cards, tutorial video (Remotion) – and how the real screenshots are produced | [../marketing/README.md](../marketing/README.md) | |

All pictures in `images/` are **real captures of the app** (`images/th` = Thai UI, `images/en` = English UI) – regenerate with `marketing/capture/run-all.sh`.

## Maintainer notes
- Default shortcuts live in `src-tauri/src/types.rs` (`DEFAULT_HOTKEYS`). After changing them: update the tables in the README and the two user guides, then `cd marketing && npm run sync && npm run render`.
- Release: `scripts/build-installer.sh` → `release/CaptureME_<ver>_universal.dmg`, `.zip`, `SHA256SUMS.txt`. Upload all three to a GitHub Release. The app is ad-hoc signed (no Apple Developer ID), which is why the install guides explain *Open Anyway*; set `APPLE_SIGNING_IDENTITY` + `APPLE_ID`/`APPLE_TEAM_ID`/`APPLE_PASSWORD` to sign and notarise.
- Minimum macOS is **14.0** (`bundle.macOS.minimumSystemVersion`). Thai text recognition (`th-TH`) was confirmed to be offered by Apple Vision on macOS 27 (the dev machine); 14 is the conservative floor – *not* verified on real macOS 13/14 hardware. ScreenCaptureKit (recording / system audio) needs 13+. Lowering to 13.0 should work, but Thai OCR may then be unavailable (the app falls back to English-only OCR).
- `src-tauri/Entitlements.plist` grants the hardened-runtime microphone + camera entitlements; without them macOS would never show the permission prompts for the recording mic / webcam bubble.
- Review notes from earlier rounds: [dev/REVIEW-APP.md](dev/REVIEW-APP.md), [dev/REVIEW-EDITOR.md](dev/REVIEW-EDITOR.md).
- Demo driver for the marketing captures: `src-tauri/src/demo.rs` (debug builds + `CAPTUREME_DEMO` only) – see [../marketing/README.md](../marketing/README.md).
