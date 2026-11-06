#!/usr/bin/env python3
"""Generate tray.png next to this script (44x44 monochrome template icon: viewfinder corners + dot)."""
import zlib, struct, math, os
S, N = 4, 44          # supersample, output size
W = N * S
def arm(x, y):
    L, R, T, B, t, a = 7.0, 37.0, 9.0, 35.0, 3.0, 9.0
    # corner boxes: horizontal + vertical arms for each corner
    rects = [
        (L, T, L + a, T + t), (L, T, L + t, T + a),
        (R - a, T, R, T + t), (R - t, T, R, T + a),
        (L, B - t, L + a, B), (L, B - a, L + t, B),
        (R - a, B - t, R, B), (R - t, B - a, R, B),
    ]
    for x0, y0, x1, y1 in rects:
        if x0 <= x <= x1 and y0 <= y <= y1: return True
    cx, cy = 22.0, 22.0
    return math.hypot(x - cx, y - cy) <= 4.6
rows = []
for oy in range(N):
    row = bytearray([0])
    for ox in range(N):
        c = 0
        for sy in range(S):
            for sx in range(S):
                if arm(ox + (sx + .5) / S, oy + (sy + .5) / S): c += 1
        row += bytes([0, 0, 0, round(255 * c / (S * S))])
    rows.append(bytes(row))
raw = b"".join(rows)
def chunk(t, d):
    c = struct.pack(">I", len(d)) + t + d
    return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", N, N, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
out = os.path.join(os.path.dirname(__file__), "tray.png")
open(out, "wb").write(png); print("wrote", out)
