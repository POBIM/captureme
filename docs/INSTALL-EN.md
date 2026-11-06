# CaptureME – Installation Guide (English)

[ภาษาไทย](INSTALL-TH.md) · [User guide](USER-GUIDE-EN.md) · [← README](../README.md)

CaptureME is free, collects nothing and never uses the internet. Installing takes 4 steps (~2 minutes).

## Requirements
- **macOS 14 (Sonoma) or later** – including macOS 15 Sequoia and macOS 26/27.
  - Why 14: Apple Vision's Thai OCR (`th-TH`) needs a recent system, and screen recording relies on the system recorder (`screencapture -v`).
- An **Apple Silicon (M1–M4) or Intel** Mac – the DMG is *universal*.
- About 50 MB of disk space.

## Step 1 – Download
1. Open the **Releases** page: https://github.com/sitthichat/captureme/releases/latest
2. Download `CaptureME_<version>_universal.dmg`.
3. (Recommended) Verify it: put `SHA256SUMS.txt` in the same folder and run
   ```bash
   cd ~/Downloads && shasum -a 256 -c SHA256SUMS.txt --ignore-missing
   ```
   You should see `CaptureME_..._universal.dmg: OK`.

## Step 2 – Move it to Applications
1. Double-click the `.dmg`; a CaptureME window opens.
2. **Drag the CaptureME icon onto the Applications folder** in that window.
3. When the copy finishes, eject the disk image (Finder sidebar › Eject).

## Step 3 – First launch (Open Anyway)
The app is not signed with an Apple Developer ID, so macOS Gatekeeper blocks it the first time. **It is not malware** – you do this only once.

**Option 1 – System Settings (macOS 15 and later, including 27)**
1. Open *Applications* (or Launchpad) and double-click **CaptureME**.
2. A dialog says *Apple could not verify "CaptureME" is free of malware…* → click **Done** (do *not* click "Move to Trash").
3. Open **System Settings › Privacy & Security**.
4. Scroll to the **Security** section. You'll see *"CaptureME" was blocked to protect your Mac* → click **Open Anyway**.
5. Enter your password / Touch ID, then click **Open Anyway** once more in the confirmation dialog.
6. The app starts – look for the viewfinder icon in the menu bar (there is no Dock icon).

> macOS 14 and earlier: right-click the app › **Open** › **Open** also works (macOS 15 removed this shortcut).

**Option 2 – Terminal (fastest; also fixes "CaptureME is damaged and can't be opened")**
```bash
xattr -dr com.apple.quarantine /Applications/CaptureME.app
open /Applications/CaptureME.app
```

## Step 4 – Allow Screen Recording
macOS requires your permission before any app can read the screen:
1. On first launch CaptureME shows a welcome window with a **Request permission / Open System Settings** button.
2. In **System Settings › Privacy & Security › Screen & System Audio Recording** switch **CaptureME** on.
3. macOS offers to quit the app – choose **Quit & Reopen** (or **Later**), then **open CaptureME again** (or click *Restart app* in the welcome window).
4. Test it: press `⌃⇧2` and drag a region – if the picture isn't black you're done 🎉

Other optional permissions macOS asks for when you use the feature: **Accessibility** (Auto-scroll), **Microphone** (voice), **Camera** (webcam bubble) and **Input Monitoring** (show pressed keys). See [PRIVACY.md](../PRIVACY.md).

## Launch at login (optional)
Menu-bar icon › **Settings… › General › Launch at login**.

## Updating
1. Quit the app (menu-bar icon › Quit CaptureME).
2. Install the new version over the old one in Applications (Step 2).
3. Repeat Step 3 if macOS blocks it again.
4. Because the ad-hoc signature changes with every build, **re-grant Screen Recording**: select CaptureME in the permission list, press **−**, then reopen the app to be asked again – or run
   ```bash
   tccutil reset ScreenCapture com.sitthichat.captureme
   ```
> macOS 15+ may ask monthly to confirm screen recording. Choose *Allow*.

## Troubleshooting
| Symptom | Fix |
|---|---|
| No "Open Anyway" button | Try opening the app once first, then visit Privacy & Security within about an hour. |
| "CaptureME is damaged" | `xattr -dr com.apple.quarantine /Applications/CaptureME.app` |
| Screenshots are black / wallpaper only | Screen Recording not allowed yet, or the app was not restarted. |
| Stopped working after an update | `tccutil reset ScreenCapture com.sitthichat.captureme`, then allow again. |
| Shortcut does nothing | It may clash with another app – change or disable it in Settings › Hotkeys. |
| Can't see the menu-bar icon | The bar may be full or hidden by the notch – quit other menu-bar apps or use the shortcuts. |

## Uninstall
See [PRIVACY.md – Delete all data](../PRIVACY.md#delete-all-data--uninstall).
