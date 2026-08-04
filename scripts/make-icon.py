"""Build the 1024x1024 macOS app-icon master from the source artwork.

    python3 scripts/make-icon.py            # assets/ -> assets/icon-master.png
    bun tauri icon assets/icon-master.png   # -> src-tauri/icons/*
    python3 -c "from PIL import Image; Image.open('assets/icon-master.png') \
        .resize((256, 256), Image.LANCZOS).save('static/favicon.png')"

The source is a full-bleed square: a black blackletter M on #f8f8f8, touching the
left and right edges. macOS wants a squircle inset in a transparent canvas
(Apple's grid: an 824x824 shape centred in 1024x1024), so we lift the glyph off
its background and re-seat it on a generated squircle. Requires Pillow.
"""

from PIL import Image, ImageDraw

SRC = "assets/moneta-icon.jpg"
OUT = "assets/icon-master.png"

CANVAS = 1024
SHAPE = 824  # Apple's macOS icon grid: content square inside the 1024 canvas
MARGIN = (CANVAS - SHAPE) // 2
N = 5.0  # superellipse exponent — Apple's corner is a squircle, not an arc
GLYPH_FRACTION = 0.62  # glyph width as a fraction of the shape square
PAPER = (248, 248, 248)
SS = 4  # supersampling factor for the squircle edge


def squircle_mask(size: int, n: float) -> Image.Image:
    """Antialiased superellipse mask, |x|^n + |y|^n = 1, drawn by scanline."""
    big = size * SS
    m = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(m)
    a = big / 2.0
    for py in range(big):
        y = (py + 0.5 - a) / a
        t = 1.0 - abs(y) ** n
        if t <= 0:
            continue
        x = t ** (1.0 / n)
        d.line([(a - x * a, py), (a + x * a, py)], fill=255)
    return m.resize((size, size), Image.LANCZOS)


def glyph_alpha(path: str) -> Image.Image:
    """Alpha channel of the ink: dark pixels opaque, paper transparent."""
    lum = Image.open(path).convert("L")
    bg = PAPER[0]
    alpha = lum.point(lambda v: min(255, round((bg - v) * 255 / bg)) if v < bg else 0)
    return alpha.crop(alpha.getbbox())


icon = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))

# The paper squircle, plus a hairline edge so the light icon stays defined
# against a white Dock or Finder background.
mask = squircle_mask(SHAPE, N)
plate = Image.new("RGBA", (SHAPE, SHAPE), PAPER + (255,))
plate.putalpha(mask)
icon.paste(plate, (MARGIN, MARGIN), plate)

# A hairline edge, so the light icon stays defined against a white Dock or
# Finder background: the squircle ring, i.e. the mask minus an eroded copy.
inner = squircle_mask(SHAPE - 6, N)
ring = Image.new("L", (SHAPE, SHAPE), 0)
ring.paste(mask, (0, 0))
sub = Image.new("L", (SHAPE, SHAPE), 0)
sub.paste(inner, (3, 3))
ring = Image.composite(Image.new("L", (SHAPE, SHAPE), 0), ring, sub)
ring = ring.point(lambda v: int(v * 0.10))
hairline = Image.new("RGBA", (SHAPE, SHAPE), (0, 0, 0, 255))
hairline.putalpha(ring)
icon.alpha_composite(hairline, (MARGIN, MARGIN))

# The M, scaled to sit inside the squircle with breathing room.
alpha = glyph_alpha(SRC)
gw, gh = alpha.size
scale = (SHAPE * GLYPH_FRACTION) / max(gw, gh)
tw, th = round(gw * scale), round(gh * scale)
alpha = alpha.resize((tw, th), Image.LANCZOS)
ink = Image.new("RGBA", (tw, th), (10, 10, 10, 255))
ink.putalpha(alpha)
icon.alpha_composite(ink, ((CANVAS - tw) // 2, (CANVAS - th) // 2))

icon.save(OUT)
print(f"wrote {OUT} {icon.size} glyph={tw}x{th}")
