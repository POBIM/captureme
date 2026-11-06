#!/usr/bin/env python3
"""Generate scripts/dmg-background.png (660x400) – dark gradient with an arrow between the
app icon and the Applications shortcut. Pure stdlib (no Pillow)."""
import struct, zlib, os

W, H = 660, 400
px = bytearray()
cx_l, cx_r, cy = 250, 410, 190  # arrow from app icon to Applications

def in_arrow(x, y):
    # shaft
    if cx_l + 20 <= x <= cx_r - 28 and abs(y - cy) <= 4:
        return True
    # head (triangle)
    hx0, hx1 = cx_r - 30, cx_r
    if hx0 <= x <= hx1:
        half = 22 * (hx1 - x) / (hx1 - hx0)
        return abs(y - cy) <= half
    return False

for y in range(H):
    px.append(0)  # filter: none
    for x in range(W):
        t = y / H
        r = int(40 - 14 * t); g = int(40 - 14 * t); b = int(46 - 14 * t)
        # soft vignette
        d = ((x - W / 2) ** 2 / (W / 2) ** 2 + (y - H / 2) ** 2 / (H / 2) ** 2)
        k = max(0.0, d - 0.35) * 14
        r, g, b = max(0, int(r - k)), max(0, int(g - k)), max(0, int(b - k))
        if in_arrow(x, y):
            r, g, b = 220, 38, 38
        px += bytes((r, g, b))

def chunk(tag, data):
    c = struct.pack(">I", len(data)) + tag + data
    return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(px), 9)) + chunk(b"IEND", b"")
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dmg-background.png")
open(out, "wb").write(png)
print("wrote", out)
