# CaptureME docs

| | ภาษาไทย | English |
|---|---|---|
| Install (Gatekeeper "Open Anyway", Screen Recording) | [INSTALL-TH.md](INSTALL-TH.md) | [INSTALL-EN.md](INSTALL-EN.md) |
| User guide (every feature + shortcuts) | [USER-GUIDE-TH.md](USER-GUIDE-TH.md) | [USER-GUIDE-EN.md](USER-GUIDE-EN.md) |
| Privacy policy | [../PRIVACY.md](../PRIVACY.md) | [../PRIVACY.md](../PRIVACY.md#english) |
| License (MIT) | [../LICENSE](../LICENSE) | [../LICENSE](../LICENSE) |
| Poster / tutorial video (Remotion) | [../marketing/README.md](../marketing/README.md) | |

Maintainer notes
- Default shortcuts live in `src-tauri/src/types.rs` (`DEFAULT_HOTKEYS`). After changing them, update the tables in the README and the two user guides, then `cd marketing && npm run sync && npm run render`.
- Release: `scripts/build-installer.sh` → `release/CaptureME_<ver>_universal.dmg`, `.zip`, `SHA256SUMS.txt`. Upload all three to a GitHub Release. The app is ad-hoc signed (no Apple Developer ID), which is why the install guides explain *Open Anyway*; set `APPLE_SIGNING_IDENTITY` + `APPLE_ID`/`APPLE_TEAM_ID`/`APPLE_PASSWORD` to sign and notarise.
- Minimum macOS is **14.0** (`bundle.macOS.minimumSystemVersion`). Thai text recognition (`th-TH`) was confirmed to be offered by Apple Vision on macOS 27 (the dev machine); Vision's newer language set only exists on its recent revisions, so 14 is the conservative floor – *not* verified on real macOS 13/14 hardware. ScreenCaptureKit (used for recording / system audio) needs 13+. Lowering to 13.0 should work, but Thai OCR may then be unavailable (the app falls back to English-only OCR).
- `src-tauri/Entitlements.plist` grants the hardened-runtime microphone + camera entitlements; without them macOS would never show the permission prompts for the recording mic / webcam bubble.
