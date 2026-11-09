#!/usr/bin/env python3
"""Generate every texture the kit uses, in code. No downloads, no licence questions, same files every run (seeded).

    python3 scripts/make_textures.py            # writes kit/textures/*

paper.png         2048² seamless, neutral grey centred on 50%: fibres, mottling, tooth, a few specks.
                  Blend with `overlay` or `soft-light` at 0.35–0.6 over any paper colour.
paper_cream.jpg   The same paper already coloured (#EFE8DA family). Use as a plain background.
grain_0..7.png    512² seamless film grain tiles. The kit swaps them 12× a second (grain that "lives").
dust_0..11.png    1920² transparent PNGs: specks, lint, the odd hairline scratch. One per 12 fps frame.
crumple.png       2048² crumpled-paper shading (neutral grey). Overlay on cards/posters at 0.3–0.5.
tape_0..2.png     Masking-tape strips with torn ends, semi-transparent. Stick cards down with them.
halftone.png      256² dot screen tile (45°). Multiply over photos at 0.15–0.3 for a printed look.
riso_speckle.png  512² seamless cream specks on transparent. Use as background-image on flat chart fills (bars,
                  strips) so they print like risograph ink, not like a vector fill (@chrismoran__ DaDh).
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "kit", "textures")
rng = np.random.default_rng(1969)


def fft_noise(n, beta, seed):
    """Seamless (periodic) 1/f^beta noise, normalised to mean 0, std 1."""
    r = np.random.default_rng(seed)
    w = r.normal(size=(n, n))
    f = np.fft.fft2(w)
    ky = np.fft.fftfreq(n)[:, None]
    kx = np.fft.fftfreq(n)[None, :]
    k = np.sqrt(kx * kx + ky * ky)
    k[0, 0] = 1
    f *= 1 / k ** beta
    f[0, 0] = 0
    a = np.real(np.fft.ifft2(f))
    return (a - a.mean()) / (a.std() + 1e-9)


def band(n, lo, hi, seed):
    """Seamless band-passed noise: features between n/hi and n/lo px."""
    r = np.random.default_rng(seed)
    f = np.fft.fft2(r.normal(size=(n, n)))
    ky = np.fft.fftfreq(n)[:, None] * n
    kx = np.fft.fftfreq(n)[None, :] * n
    k = np.sqrt(kx * kx + ky * ky)
    f *= ((k >= lo) & (k <= hi)).astype(float)
    a = np.real(np.fft.ifft2(f))
    return (a - a.mean()) / (a.std() + 1e-9)


def wrap_line(d, n, pts, fill, width=1):
    """Draw a polyline on a torus so strokes cross the edges seamlessly."""
    for ox in (-n, 0, n):
        for oy in (-n, 0, n):
            d.line([(x + ox, y + oy) for x, y in pts], fill=fill, width=width)


def paper(n=2048):
    g = 128 + fft_noise(n, 1.8, 1) * 6 + band(n, 40, 160, 2) * 1.4 + rng.normal(0, 3.0, (n, n))
    fib = Image.new("L", (n, n), 128)
    d = ImageDraw.Draw(fib)
    for _ in range(9000):  # fibres: short, thin, slightly curved, lighter or darker than the sheet
        x, y = rng.uniform(0, n), rng.uniform(0, n)
        a, ln = rng.uniform(0, np.pi), rng.uniform(5, 30)
        pts = []
        for i in range(5):
            a += rng.normal(0, 0.15)
            pts.append((x, y))
            x, y = x + np.cos(a) * ln / 4, y + np.sin(a) * ln / 4
        wrap_line(d, n, pts, 128 + int(rng.choice([-1, 1]) * rng.uniform(5, 13)))
    g += np.asarray(fib.filter(ImageFilter.GaussianBlur(0.55)), np.float32) - 128
    for _ in range(160):  # print specks / inclusions
        x, y, r = int(rng.uniform(4, n - 4)), int(rng.uniform(4, n - 4)), rng.uniform(0.6, 2.0)
        yy, xx = np.ogrid[y - 3:y + 4, x - 3:x + 4]
        m = (xx - x) ** 2 + (yy - y) ** 2 <= r * r
        g[y - 3:y + 4, x - 3:x + 4][m] -= rng.uniform(18, 40)
    return np.clip(g, 0, 255).astype(np.uint8)


def colour_paper(gray, base=(239, 232, 218)):
    t = (gray.astype(np.float32) - 128) / 128  # -1..1
    lo = fft_noise(gray.shape[0], 2.2, 7)[..., None] * np.array([2.5, 2.0, 0.5])  # faint yellowing drift
    rgb = np.array(base, np.float32)[None, None, :] * (1 + t[..., None] * 0.55) + lo
    return np.clip(rgb, 0, 255).astype(np.uint8)


def grain(n=512, seed=0):
    r = np.random.default_rng(100 + seed)
    a = r.normal(0, 1, (n, n))
    k2 = np.fft.fftfreq(n)[:, None] ** 2 + np.fft.fftfreq(n)[None, :] ** 2
    a = np.real(np.fft.ifft2(np.fft.fft2(a) * np.exp(-2 * np.pi ** 2 * 0.65 ** 2 * k2)))  # soft clumps (σ 0.65 px), still seamless
    a = (a - a.mean()) / a.std()
    return np.clip(128 + a * 34, 0, 255).astype(np.uint8)


def dust(n=1920, seed=0):
    r = np.random.default_rng(500 + seed)
    im = Image.new("LA", (n, n), (255, 0))
    d = ImageDraw.Draw(im)
    for _ in range(int(r.integers(10, 22))):
        x, y, rad = r.uniform(0, n), r.uniform(0, n), r.uniform(0.7, 2.8)
        tone = int(r.choice([30, 240]))  # dark specks (on the print) and light ones (on the film)
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(tone, int(r.uniform(120, 230))))
    for _ in range(int(r.integers(0, 3))):
        x, y, a = r.uniform(0, n), r.uniform(0, n), r.uniform(0, 2 * np.pi)
        pts = []
        for _ in range(int(r.integers(8, 20))):
            pts.append((x, y))
            a += r.normal(0, 0.45)
            x, y = x + np.cos(a) * 4, y + np.sin(a) * 4
        d.line(pts, fill=(int(r.choice([40, 230])), int(r.uniform(90, 170))), width=1)
    if r.random() < 0.2:
        x = r.uniform(0, n)
        d.line([(x, 0), (x + r.normal(0, 8), n)], fill=(235, int(r.uniform(40, 90))), width=1)
    return im.filter(ImageFilter.GaussianBlur(0.45))


def crumple(n=2048):
    """Crumpled paper: Voronoi creases lit from the top-left, plus soft folds."""
    pts = rng.uniform(0, n, (70, 2))
    yy, xx = np.mgrid[0:n:2, 0:n:2].astype(np.float32)
    dmin = np.full(xx.shape, 1e9, np.float32)
    d2 = np.full(xx.shape, 1e9, np.float32)
    owner = np.zeros(xx.shape, np.int32)
    for i, (px, py) in enumerate(pts):
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                dist = np.hypot(xx - px - ox, yy - py - oy)
                closer = dist < dmin
                d2 = np.where(closer, dmin, np.minimum(d2, dist))
                owner = np.where(closer, i, owner)
                dmin = np.minimum(dmin, dist)
    gx, gy = rng.normal(0, 1, len(pts)), rng.normal(0, 1, len(pts))  # each facet is a tilted plane: a gentle gradient
    facet = rng.normal(0, 1, len(pts))[owner] * 3 + (gx[owner] * (xx - pts[owner, 0]) + gy[owner] * (yy - pts[owner, 1])) * 0.03
    crease = np.exp(-((d2 - dmin) / 1.6) ** 2) * 10   # thin ridge where facets meet
    sign = np.where(rng.random(len(pts))[owner] > 0.5, 1, -1)
    h = 128 + np.clip(facet, -14, 14) + crease * sign
    img = Image.fromarray(np.clip(h, 0, 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(1.0)), np.float32) + fft_noise(n, 1.8, 11) * 4
    return np.clip(a, 0, 255).astype(np.uint8)


def tape(seed):
    r = np.random.default_rng(900 + seed)
    w, h = 420, 120
    a = np.full((h, w), 1.0, np.float32)
    for side in (0, 1):  # torn, zig-zag ends
        xs = np.cumsum(r.normal(0, 2.2, h))
        xs = xs - xs.mean() + 12
        for y in range(h):
            e = int(np.clip(xs[y] + r.normal(0, 1.5), 2, 26))
            if side == 0:
                a[y, :e] = 0
            else:
                a[y, w - e:] = 0
    tone = 128 + band(512, 8, 80, 950 + seed)[:h, :w] * 6
    rgb = np.stack([235 + tone * 0, 225 + tone * 0, 196 + tone * 0], -1) + (tone - 128)[..., None]
    alpha = a * (0.78 + band(512, 10, 120, 960 + seed)[:h, :w] * 0.04)
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA").filter(ImageFilter.GaussianBlur(0.4))


def halftone(n=256, cell=8):
    """Dot screen at 45°, white background, mid-grey dots, seamless."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    u = (xx + yy) / np.sqrt(2)
    v = (xx - yy) / np.sqrt(2)
    c = cell / np.sqrt(2) * 2
    du = (u % c) - c / 2
    dv = (v % c) - c / 2
    dist = np.hypot(du, dv)
    a = np.clip((dist - c * 0.28) * 1.8, 0, 1)
    return (a * 255).astype(np.uint8)


def riso_speckle(n=512, seed=7, color=(239, 232, 218)):
    """Cream flecks of 1–4 px on transparent, seamless, clumped by low-frequency noise (~15% coverage). The kit shows
    it at background-size 256px, so each fleck lands at 0.5–2 px: ink texture, not noise."""
    r = np.random.default_rng(seed)
    a = np.zeros((n, n), np.float32)
    m = fft_noise(n, 2.2, seed + 1)
    m = (m - m.min()) / (m.max() - m.min())
    for _ in range(int(n * n * 0.019)):
        y, x = int(r.integers(0, n)), int(r.integers(0, n))
        sz = int(r.choice([1, 2, 3, 4], p=[0.25, 0.35, 0.28, 0.12]))
        v = r.uniform(0.35, 1.0) * min(1.0, 0.35 + 0.9 * m[y, x])
        a[np.ix_([(y + i) % n for i in range(sz)], [(x + j) % n for j in range(sz)])] = v
    rgba = np.zeros((n, n, 4), np.uint8)
    rgba[..., :3] = color
    rgba[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def main():
    os.makedirs(OUT, exist_ok=True)
    g = paper()
    Image.fromarray(g, "L").save(f"{OUT}/paper.png", optimize=True)
    Image.fromarray(colour_paper(g)[:1920, :1920]).save(f"{OUT}/paper_cream.jpg", quality=90)
    for i in range(8):
        Image.fromarray(grain(seed=i), "L").save(f"{OUT}/grain_{i}.png", optimize=True)
    for i in range(12):
        dust(seed=i).save(f"{OUT}/dust_{i}.png", optimize=True)
    Image.fromarray(crumple(), "L").save(f"{OUT}/crumple.png", optimize=True)
    for i in range(3):
        tape(i).save(f"{OUT}/tape_{i}.png", optimize=True)
    Image.fromarray(halftone(), "L").save(f"{OUT}/halftone.png", optimize=True)
    riso_speckle().save(f"{OUT}/riso_speckle.png", optimize=True)
    tot = 0
    for f in sorted(os.listdir(OUT)):
        s = os.path.getsize(f"{OUT}/{f}")
        tot += s
        print(f"  {f:22} {s / 1e3:7.0f} KB")
    print(f"kit/textures: {tot / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
