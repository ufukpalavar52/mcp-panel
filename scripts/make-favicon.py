#!/usr/bin/env python3
"""
Renders app/icon.svg's mark into app/favicon.ico.

Two icons rather than one because they answer different requests. Modern browsers take the
SVG, which is sharp at any size; `/favicon.ico` is asked for directly by browsers, feed
readers and link unfurlers that never look at the page's <head> at all.

Written out by this script rather than checked in as a binary somebody found: an icon with
no source is one nobody can change. The geometry below is the same as the SVG's, and if one
moves the other has to move with it.

    python3 scripts/make-favicon.py
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

SIZE = 32
SUPERSAMPLE = 8  # Point-sampled at 8x and boxed down; enough antialiasing at this size.

TILE_RADIUS = 7.0
BRAND = (0xEA, 0x58, 0x0C)
MARK = (0xFF, 0xFF, 0xFF)

# The hub sits below the middle. Three arms around a centre are never square with their
# own bounding box — two are low and one is high — so a mark centred on its hub reads as
# sitting too high in the tile.
HUB = (16.0, 17.9)
SPOKES = [(16.0, 10.3), (22.6, 21.7), (9.4, 21.7)]
HUB_RADIUS = 3.2
SPOKE_RADIUS = 2.4
STROKE = 2.2


def inside_tile(x: float, y: float) -> bool:
    """A rounded square: the corners are quarter circles, the rest is the square."""
    near_x = min(max(x, TILE_RADIUS), SIZE - TILE_RADIUS)
    near_y = min(max(y, TILE_RADIUS), SIZE - TILE_RADIUS)

    return math.hypot(x - near_x, y - near_y) <= TILE_RADIUS


def on_mark(x: float, y: float) -> bool:
    """Whether this point is on a dot or on one of the spokes."""
    if math.hypot(x - HUB[0], y - HUB[1]) <= HUB_RADIUS:
        return True

    for end in SPOKES:
        if math.hypot(x - end[0], y - end[1]) <= SPOKE_RADIUS:
            return True
        if _distance_to_segment(x, y, HUB, end) <= STROKE / 2:
            return True

    return False


def _distance_to_segment(x: float, y: float, start, end) -> float:
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = dx * dx + dy * dy

    # Clamped, which is what gives the stroke its round caps for free.
    along = max(0.0, min(1.0, ((x - start[0]) * dx + (y - start[1]) * dy) / length))

    return math.hypot(x - (start[0] + along * dx), y - (start[1] + along * dy))


def render() -> bytes:
    """The icon as RGBA rows, antialiased by averaging the subsamples of each pixel."""
    rows = bytearray()
    step = 1.0 / SUPERSAMPLE

    for pixel_y in range(SIZE):
        rows.append(0)  # PNG filter: none.
        for pixel_x in range(SIZE):
            covered = marked = 0

            for sub_y in range(SUPERSAMPLE):
                for sub_x in range(SUPERSAMPLE):
                    x = pixel_x + (sub_x + 0.5) * step
                    y = pixel_y + (sub_y + 0.5) * step

                    if inside_tile(x, y):
                        covered += 1
                        if on_mark(x, y):
                            marked += 1

            samples = SUPERSAMPLE * SUPERSAMPLE
            alpha = covered / samples

            if covered == 0:
                rows.extend((0, 0, 0, 0))
                continue

            # Blended over the tile, not over nothing: a white mark composited against
            # transparency would fringe grey at every edge.
            weight = marked / covered
            rows.extend(
                bytes(
                    round(brand * (1 - weight) + mark * weight)
                    for brand, mark in zip(BRAND, MARK)
                )
                + bytes((round(alpha * 255),))
            )

    return bytes(rows)


def png(pixels: bytes) -> bytes:
    def chunk(kind: bytes, body: bytes) -> bytes:
        return (
            struct.pack(">I", len(body))
            + kind
            + body
            + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(pixels, 9))
        + chunk(b"IEND", b"")
    )


def ico(image: bytes) -> bytes:
    """An ICO holding one PNG, which every browser that asks for a .ico understands."""
    directory = struct.pack(
        "<BBBBHHII", SIZE, SIZE, 0, 0, 1, 32, len(image), 6 + 16
    )

    return struct.pack("<HHH", 0, 1, 1) + directory + image


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "app" / "favicon.ico"
    out.write_bytes(ico(png(render())))
    print(f"{out} written, {out.stat().st_size} bytes")
