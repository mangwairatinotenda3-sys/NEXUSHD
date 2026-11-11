from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

BG = (7, 4, 15)
C1 = (192, 132, 252)
C2 = (91, 15, 214)
MARK = [(12,52),(12,12),(24,12),(40,38),(40,12),(52,12),(52,52),(40,52),(24,26),(24,52)]
SS = 4

def font(name, size):
    for p in (f"/usr/share/fonts/opentype/inter/{name}.otf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

_g = Image.new("RGB", (128, 128))
_gp = _g.load()
for y in range(128):
    for x in range(128):
        t = (x + y) / 254
        _gp[x, y] = tuple(int(C1[i] + (C2[i] - C1[i]) * t) for i in range(3))

def mark_layer(px):
    n = px * SS
    mask = Image.new("L", (n, n), 0)
    pts = [((x - 12) / 40 * n, (y - 12) / 40 * n) for x, y in MARK]
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    out = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    out.paste(_g.resize((n, n), Image.BICUBIC), (0, 0), mask)
    return out.resize((px, px), Image.LANCZOS)

def canvas(size, frac, bg=BG):
    img = Image.new("RGBA", (size, size), (bg + (255,)) if bg else (0, 0, 0, 0))
    m = int(size * frac)
    img.alpha_composite(mark_layer(m), ((size - m) // 2, (size - m) // 2))
    return img

def save(img, path, flat=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    (img.convert("RGB") if flat else img).save(path)
    print("wrote", path, img.size)

# Android icon + splash
save(canvas(1024, 0.56), "assets/icon-only.png", True)
save(canvas(1024, 0.44, bg=None), "assets/icon-foreground.png")
save(Image.new("RGB", (1024, 1024), BG), "assets/icon-background.png")
save(canvas(2732, 0.22), "assets/splash.png", True)
save(canvas(2732, 0.22), "assets/splash-dark.png", True)

# Web icons
save(canvas(180, 0.58), "public/apple-touch-icon.png", True)
save(canvas(192, 0.58), "public/icon-192.png", True)
save(canvas(512, 0.58), "public/icon-512.png", True)
save(canvas(48, 0.7), "public/favicon-48.png", True)

# Link preview image 1200x630
W, H = 1200, 630
og = Image.new("RGBA", (W, H), BG + (255,))
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((-100, 60, 700, 760), fill=(124, 58, 237, 150))
ImageDraw.Draw(glow).ellipse((700, -200, 1300, 300), fill=(91, 15, 214, 90))
og.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
tile = 300
badge = Image.new("RGBA", (tile, tile), (0, 0, 0, 0))
ImageDraw.Draw(badge).rounded_rectangle((0, 0, tile - 1, tile - 1), radius=72,
    fill=BG + (255,), outline=(168, 85, 247, 255), width=4)
badge.alpha_composite(mark_layer(170), ((tile - 170) // 2, (tile - 170) // 2))
og.alpha_composite(badge, (110, (H - tile) // 2))
d = ImageDraw.Draw(og)
d.text((470, 215), "NexusHD", font=font("Inter-ExtraBold", 110), fill=(255, 255, 255))
d.text((474, 350), "Stream · Download · Enjoy", font=font("Inter-Medium", 40), fill=(196, 170, 245))
d.text((474, 410), "Movies and series, trailers and offline downloads",
       font=font("Inter-Regular", 28), fill=(150, 135, 185))
save(og, "public/og-image.png", True)
