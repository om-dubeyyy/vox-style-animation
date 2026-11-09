#!/usr/bin/env python3
"""Synthesise the kit's sound effects in code. Ours to give away (MIT, like the repo); same files every run (seeded).

    python3 scripts/make_sfx.py          # writes kit/sfx/*.wav (48 kHz, 16-bit, stereo)

The Vox look is half sound: paper that slides, markers that squeak, keys that clack, a low hit under a title, and
a quiet room tone so the mix is never digital silence. Every animation helper in kit/vox.js can drop one of these
on its own timeline (VOX.sfx), and scripts/render.mjs mixes them in automatically.

Want recorded sounds instead? references/SOUND.md lists free, licence-clean libraries.
"""
import os
import wave

import numpy as np
from scipy import signal

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "kit", "sfx")
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(round(d * SR))) / SR


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], "bandpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "lowpass", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "highpass", fs=SR, output="sos"), x)


def env(n, a, d, curve=3.0):
    """Attack a s then exponential-ish decay over the rest."""
    na = max(1, int(a * SR))
    e = np.ones(n)
    e[:na] = np.linspace(0, 1, na) ** 1.5
    rest = n - na
    if rest > 0:
        e[na:] = np.exp(-curve * np.linspace(0, 1, rest) * (rest / SR) / max(d, 1e-3))
    return e


def bell(n, peak=0.5, width=0.35):
    x = np.linspace(0, 1, n)
    return np.exp(-((x - peak) / width) ** 2 * 4)


def noise(d):
    return rng.normal(0, 1, int(round(d * SR)))


def stereo(x, pan=0.0, width=0.0):
    """pan -1..1 (constant power); width adds a few ms of decorrelation for air."""
    l = x * np.cos((pan + 1) * np.pi / 4)
    r = x * np.sin((pan + 1) * np.pi / 4)
    if width:
        k = int(width * SR)
        r = np.concatenate([np.zeros(k), r[:-k]]) * 0.92 + r * 0.08
    return np.stack([l, r], 1)


def pan_sweep(x, a, b):
    p = np.linspace(a, b, len(x))
    return np.stack([x * np.cos((p + 1) * np.pi / 4), x * np.sin((p + 1) * np.pi / 4)], 1)


def fade(x, ms=4):
    k = int(ms / 1000 * SR)
    x = x.copy()
    x[:k] *= np.linspace(0, 1, k)[:, None] if x.ndim == 2 else np.linspace(0, 1, k)
    x[-k:] *= np.linspace(1, 0, k)[:, None] if x.ndim == 2 else np.linspace(1, 0, k)
    return x


def save(name, x, peak_db=-3.0):
    if x.ndim == 1:
        x = stereo(x)
    x = fade(x)
    x = x / (np.max(np.abs(x)) + 1e-12) * 10 ** (peak_db / 20)
    x = x + rng.uniform(-0.5, 0.5, x.shape) / 32768                       # TPDF-ish dither before 16-bit
    b = (np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b)
    return len(x) / SR


# ---------- the sounds ----------

def paper_slide(d=0.42):
    n = int(round(d * SR))
    grit = np.abs(lp(noise(d), 60)) * 3 + 0.4          # uneven friction
    x = bp(noise(d), 900, 6500) * grit * bell(n, 0.45, 0.45)
    land = lp(noise(0.06), 400) * env(int(0.06 * SR), 0.002, 0.03) * 0.8   # small landing tap
    x[-len(land):] += land
    return pan_sweep(x, -0.35, 0.15)


def paper_rustle(d=0.55):
    n = int(round(d * SR))
    x = np.zeros(n)
    for _ in range(60):                                 # crinkles: tiny bursts at random
        k = int(rng.uniform(0, n - 800))
        L = int(rng.uniform(80, 700))
        x[k:k + L] += bp(noise(L / SR), 1500, 9000) * env(L, 0.0005, L / SR / 3) * rng.uniform(0.2, 1)
    x += bp(noise(d), 600, 4000) * 0.15
    return stereo(x * bell(n, 0.5, 0.6), 0, 0.006)


def card_drop():
    d = 0.22
    t = t_(d)
    body = np.sin(2 * np.pi * (95 - 30 * t / d) * t) * env(len(t), 0.002, 0.05)
    slap = bp(noise(d), 700, 5000) * env(len(t), 0.0008, 0.012)
    return stereo(body * 0.9 + slap * 0.6, 0, 0.004)


def whoosh(d=0.55, f0=350, f1=3200, pan=(-0.6, 0.6)):
    n = int(round(d * SR))
    x = noise(d)
    out = np.zeros(n)
    blk = 256                                           # time-varying band-pass, block by block
    zi = None
    for i in range(0, n, blk):
        ph = i / n
        fc = f0 * (f1 / f0) ** np.sin(np.pi * ph) if ph < 1 else f0
        sos = signal.butter(2, [fc * 0.6, min(fc * 1.6, SR / 2 - 100)], "bandpass", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        y, zi = signal.sosfilt(sos, x[i:i + blk], zi=zi)
        out[i:i + blk] = y
    out *= bell(n, 0.55, 0.42) ** 1.4
    return pan_sweep(out, *pan)


def pen_scribble(d=0.7):
    n = int(round(d * SR))
    t = t_(d)
    rate = 7 + np.cumsum(rng.normal(0, 0.02, n))      # stroke rhythm drifts
    strokes = (0.55 + 0.45 * np.sin(2 * np.pi * np.cumsum(rate) / SR)) ** 2
    x = bp(noise(d), 2200, 7500) * strokes * env(n, 0.03, d * 0.9, 1.2)
    x += bp(noise(d), 400, 1200) * 0.12 * strokes
    return stereo(x, 0.1, 0.003)


def highlighter(d=0.45):
    n = int(round(d * SR))
    x = bp(noise(d), 1300, 5200) * bell(n, 0.45, 0.5)
    t = t_(d)
    squeak = np.sin(2 * np.pi * (2100 + 160 * np.sin(2 * np.pi * 3 * t)) * t) * 0.05 * bell(n, 0.5, 0.3)
    return pan_sweep(x + squeak, -0.25, 0.3)


def type_key(seed=0):
    r = np.random.default_rng(300 + seed)
    d = 0.11
    n = int(round(d * SR))
    click = hp(r.normal(0, 1, n), 2500) * env(n, 0.0003, 0.004)
    body = bp(r.normal(0, 1, n), 700 + r.uniform(-120, 120), 1800) * env(n, 0.0006, 0.018) * 0.8
    t = t_(d)
    thunk = np.sin(2 * np.pi * 160 * t) * env(n, 0.001, 0.02) * 0.5
    return stereo(click + body + thunk, r.uniform(-0.2, 0.2))


def bell_ding(d=1.6):
    t = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, a, k in
            ((2093, 1, 2.6), (2093 * 2.76, 0.35, 5), (2093 * 5.4, 0.12, 9), (2093 * 0.5, 0.08, 3)))
    return stereo(x, 0.15, 0.008)


def pop():
    d = 0.09
    t = t_(d)
    f = 720 * np.exp(-t * 18) + 260
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.0015, 0.03)
    return stereo(x + hp(noise(d), 4000) * env(len(t), 0.0003, 0.003) * 0.2)


def tick():
    d = 0.03
    x = bp(noise(d), 2500, 9000) * env(int(d * SR), 0.0002, 0.003)
    return stereo(x + np.sin(2 * np.pi * 3100 * t_(d)) * env(int(d * SR), 0.0002, 0.004) * 0.4)


def stamp():
    d = 0.35
    t = t_(d)
    thud = np.sin(2 * np.pi * (70 + 40 * np.exp(-t * 30)) * t) * env(len(t), 0.001, 0.08)
    slap = bp(noise(d), 500, 6000) * env(len(t), 0.0005, 0.02)
    return stereo(thud + slap * 0.7, 0, 0.004)


def riser(d=2.2):
    n = int(round(d * SR))
    t = t_(d)
    ramp = (t / d) ** 2.2
    tone = sum(np.sin(2 * np.pi * np.cumsum(f0 * (1 + 1.5 * ramp)) / SR) for f0 in (110, 165, 220.5))
    air = bp(noise(d), 800, 8000) * ramp * 0.6
    x = (tone * 0.25 + air) * ramp
    x[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return stereo(x, 0, 0.012)


def sub_hit(d=1.8):
    t = t_(d)
    f = 48 + 60 * np.exp(-t * 14)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)
    x += lp(noise(d), 1800) * np.exp(-t * 30) * 0.5
    x += bp(noise(d), 200, 2000) * np.exp(-t * 3) * 0.06   # a little tail of "room"
    return stereo(np.tanh(x * 1.6), 0, 0.01)


def shutter():
    d = 0.18
    n = int(round(d * SR))
    x = np.zeros(n)
    for k, g in ((0, 1), (int(0.075 * SR), 0.8)):
        L = int(0.03 * SR)
        x[k:k + L] += bp(noise(0.03), 1200, 9000) * env(L, 0.0003, 0.006) * g
        x[k:k + L] += np.sin(2 * np.pi * 420 * t_(0.03)) * env(L, 0.0005, 0.008) * 0.4 * g
    return stereo(x, 0.05, 0.003)


def tape_rip(d=0.5):
    n = int(round(d * SR))
    crack = (rng.random(n) < 0.02).astype(float) * rng.uniform(0.3, 1, n)
    x = bp(lp(crack, 9000) + noise(d) * 0.15, 900, 8000) * bell(n, 0.35, 0.5)
    return pan_sweep(x, 0.3, -0.3)


def map_ping(d=1.2):
    t = t_(d)
    x = (np.sin(2 * np.pi * 880 * t) + 0.5 * np.sin(2 * np.pi * 1320 * t)) * env(len(t), 0.003, 0.35)
    return stereo(x, 0, 0.01)


def projector(d=4.0):
    n = int(round(d * SR))
    x = bp(noise(d), 300, 3000) * 0.15
    for k in np.arange(0, n, SR // 24):                 # 24 clacks a second, slightly uneven
        k = int(k + rng.normal(0, 30))
        L = int(0.012 * SR)
        if 0 <= k < n - L:
            x[k:k + L] += bp(noise(0.012), 600, 5000) * env(L, 0.0005, 0.004) * rng.uniform(0.5, 1)
    hum = np.sin(2 * np.pi * 60 * t_(d)) * 0.05
    return stereo(x + hum, 0, 0.01)


def room_tone(d=8.0):
    pink = lp(noise(d), 1200) + lp(noise(d), 200) * 2
    return stereo(pink, 0, 0.02)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [("paper_slide", paper_slide()), ("paper_rustle", paper_rustle()), ("card_drop", card_drop()),
            ("whoosh", whoosh()), ("whoosh_fast", whoosh(0.28, 500, 4500, (-0.4, 0.5))),
            ("whoosh_low", whoosh(0.9, 120, 900, (0.5, -0.5))),
            ("pen_scribble", pen_scribble()), ("highlighter", highlighter()),
            *[(f"type_key_{i}", type_key(i)) for i in range(6)], ("bell_ding", bell_ding()),
            ("pop", pop()), ("tick", tick()), ("stamp", stamp()), ("riser", riser()), ("sub_hit", sub_hit()),
            ("shutter", shutter()), ("tape_rip", tape_rip()), ("map_ping", map_ping()),
            ("projector_loop", projector()), ("room_tone", room_tone())]
    peaks = {"room_tone": -30.0, "projector_loop": -12.0, "riser": -6.0}
    for name, x in jobs:
        d = save(name, x, peaks.get(name, -3.0))
        print(f"  {name:16} {d:5.2f} s")
    print(f"kit/sfx: {len(jobs)} files")


if __name__ == "__main__":
    main()
