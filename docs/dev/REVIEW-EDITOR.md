# Editor review (Agent F) — `src/editor/**`, `src/i18n/editor.ts`

Scope: bugs, performance on large Retina images, leaks, undo, shortcuts/IME, HiDPI, export fidelity, dark/light.
Verified with `npm run build` (tsc strict) and a headless-Chrome harness (mocked `invoke`, 3000×2000 and 6000×4000 test images).

## Findings & fixes

| # | Area | Problem | Fix |
|---|------|---------|-----|
| 1 | Perf | Blur / pixelate cache was keyed by `rev`, so **every** change anywhere (selecting, dragging another object, marquee) recomputed every blur/pixelate. Magnifier was never cached. | Per-object cache keyed by a *signature*: the object's own JSON + a hash of the base canvas id and only those objects underneath that intersect the effect region. Recomputed only when the rect/props/underlying pixels change. Focus (blur-outside) layer is independent of its rect, so moving the hole is free. |
| 2 | Perf | `renderBelow` painted the whole 5000 px+ base into a tiny canvas; `pickColor` (eyedropper hover) composited the whole scene per mouse-move. | Base is drawn only for the needed sub-rect; eyedropper samples a 1 px region. |
| 3 | Perf | Panning/zooming a huge image far below 100 % re-sampled the full bitmap each frame. | Lazily built half-size mip chain used only for the interactive view (never for export). |
| 4 | Perf / UI freeze | Export used synchronous `toDataURL` (hundreds of ms – seconds on 24 MP, UI frozen). | `toBlob` + `FileReader` (async), temp canvases freed immediately. |
| 5 | Perf | Pixelate did two JS passes with float colours; large blurs used `ctx.filter` on multi-MP canvases. | Single-pass block average on typed arrays; areas > 2 MP use the box-filter `downBlur`. |
| 6 | Memory leak | Effect cache never evicted deleted objects; temp canvases kept until GC. | `pruneFx()` each frame, `release()` (width=height=0) for temporaries. |
| 7 | Memory leak | Undo stack held up to 200 snapshots, each referencing its own full base bitmap after resize/rotate/padding (GBs for Retina). | Stack trimmed by step count (200) **and** by total distinct base pixels (≈160 MP); unreferenced overlay bitmaps are pruned. |
| 8 | Leak | Background popover leaked a `keydown` capture listener every time it was closed by clicking outside. | All popovers go through `openPopover()` which always removes its listeners. |
| 9 | Correctness | Blur near the image edge faded to transparent (alpha < 255 in export). | Edge pixels are clamp-extended before blurring (test: alpha stays 255). |
| 10 | Correctness | Undo/redo while the crop tool was active left a stale crop draft; undo across a size change did not re-fit the view. | Undo/redo cancels crop first; `fit()` when the base size changes. |
| 11 | IME / shortcuts | Window-level shortcuts could fire during Thai/CJK composition (Esc/Enter/⌘↩, tool letters on `keyCode 229`). | Global handler, text editor and modals ignore `isComposing` / `keyCode 229`; editor box follows `compositionupdate`. Shortcuts use `e.code`, so Thai keyboard layouts still work. |
| 12 | HiDPI | Moving the window to a display with another pixel ratio might not fire `resize`. | `matchMedia(resolution)` listener re-lays out the canvas. |
| 13 | Export fidelity | — | Verified: with no edits the exported canvas is **byte-identical** to the source (3000×2000), crop/pad exports have exact sizes. Redact is snapped outward to whole pixels and always opaque (no anti-aliased leak at the edge). |
| 14 | Dark/light | UI colours were hard-coded dark. | CSS variables + `prefers-color-scheme: light`; checked both. |
| 15 | UX | Toolbar overflowed (hidden scrollbar) once more tools existed. | Toolbar wraps into rows. |

## Known limitations / notes
- The clipboard command only accepts PNG, so **“Copy as JPEG” cannot put a JPEG on the clipboard**. Provided instead: *Save as JPEG…* and *Copy as file path* (saves first). A Rust `copy_image_file`-style command that puts a file reference on the pasteboard would complete this.
- The ⌘V image paste uses the `paste` event and falls back to `navigator.clipboard.read()` (the app has no Edit menu, so WKWebView may not fire `paste`). The fallback was not exercised in headless Chrome.
- File drops: Tauri windows swallow HTML5 file drops (`dragDropEnabled` defaults to true), so the editor also listens to `onDragDropEvent` (paths → asset protocol). Browser `drop` is handled too. Only exercised via the browser path in tests.
- Blur/pixelate of *small text can be reversible*; a Redact tool (solid, opaque) was added and the UI warns + offers “Convert to Redact”. Note history keeps the original capture file on disk – delete the history entry if the original must not survive.
- Rotated objects in a **multi-selection** are resized with a plain bounding-box scale (accurate for multiples of 90°); single objects resize in their own rotated frame.
- Overlay-image bitmaps live for the window's lifetime (small, pruned when old undo steps are dropped).
- Export size is capped at 16384 px per side / 200 MP (browser canvas limit); the user gets an error toast instead of a failed encode.
