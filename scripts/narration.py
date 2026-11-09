"""Assemble a documentary narration from separate line takes: tighten pauses, set the beat between lines, and speed it
up without changing the voice.

Why: TTS and first reads often come out slow and dramatic, about 115 wpm. Trimming pauses inside lines to 0.18 s and a
1.33x speed-up gives about 154 wpm, a normal documentary pace, with the pitch and formants kept (rubberband speech
settings). Speech is never cut, only the silence between words.

usage:
  python3 scripts/narration.py l1.mp3 l2.mp3 l3.mp3 --out vo.wav [--tempo 1.2] [--max-pause 0.18]
                               [--gaps 0.24,0.30,0.28,0.30] [--text script.txt]
  --gaps       the pause after each line except the last (one value for all, or one per line). Default 0.26.
  --max-pause  a pause inside a line longer than this is shortened to it. Default 0.18 s.
  --tempo      speed. 1.0 = none. Uses ffmpeg's rubberband filter when your ffmpeg has it (brew install ffmpeg-full),
               otherwise atempo (fine up to about 1.15; above that the voice gets a little phasey).
  --text       a text file with the words spoken, to print the pace in words per minute.
Needs only ffmpeg/ffprobe. Writes <out> plus <out>_tight.wav (before the speed-up).
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path


def pick_ffmpeg():
    """Prefer an ffmpeg with rubberband (Homebrew's ffmpeg-full is keg-only, so it isn't on the PATH by default)."""
    for c in [shutil.which("ffmpeg"), "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg", "/usr/local/opt/ffmpeg-full/bin/ffmpeg"]:
        if c and Path(c).exists():
            f = subprocess.run([c, "-hide_banner", "-filters"], capture_output=True, text=True).stdout
            if " rubberband " in f:
                return c, True
    c = shutil.which("ffmpeg")
    if not c:
        sys.exit("ffmpeg was not found. Install it (brew install ffmpeg) and try again.")
    return c, False


def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]))


def speech_chunks(ff, p, floor_db=-45, min_sil=0.08):
    log = subprocess.run([ff, "-hide_banner", "-i", str(p), "-af", f"silencedetect=n={floor_db}dB:d={min_sil}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", log)]
    en = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", log)]
    total = dur(p)
    chunks, cur = [], 0.0
    for s, e in zip(st, en + [total] * (len(st) - len(en))):
        if s > cur:
            chunks.append((cur, s))
        cur = e
    if cur < total:
        chunks.append((cur, total))
    return [(max(0, a - 0.03), min(total, b + 0.05)) for a, b in chunks if b - a > 0.04]   # a hair of air each side


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("lines", nargs="+", help="the line takes, in order")
    ap.add_argument("--out", required=True)
    ap.add_argument("--tempo", type=float, default=1.0)
    ap.add_argument("--max-pause", type=float, default=0.18)
    ap.add_argument("--gaps", default="0.26")
    ap.add_argument("--text")
    a = ap.parse_args()
    ff, rubber = pick_ffmpeg()
    g = [float(x) for x in a.gaps.split(",")]
    gaps = g * len(a.lines) if len(g) == 1 else g + [g[-1]] * len(a.lines)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    args, parts, labels, n = [], [], [], 0
    for li, p in enumerate(a.lines):
        ch = speech_chunks(ff, p)
        if not ch:
            sys.exit(f"no speech found in {p}")
        for j, (s, e) in enumerate(ch):
            if j < len(ch) - 1:
                gap = max(0.0, min(a.max_pause, ch[j + 1][0] - e))
            else:
                gap = gaps[li] if li < len(a.lines) - 1 else 0.0
            args += ["-i", str(p)]
            parts.append(f"[{n}:a]atrim={s:.3f}:{e:.3f},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=mono,"
                         f"afade=t=in:d=0.01,afade=t=out:st={max(0, e - s - 0.012):.3f}:d=0.012,apad=pad_dur={gap:.3f}[c{n}]")
            labels.append(f"[c{n}]")
            n += 1
    tight = out.with_name(out.stem + "_tight.wav")
    subprocess.run([ff, "-v", "error", "-y", *args, "-filter_complex", ";".join(parts) + ";" + "".join(labels) + f"concat=n={n}:v=0:a=1[a]",
                    "-map", "[a]", str(tight)], check=True)
    if abs(a.tempo - 1) < 1e-3:
        shutil.copyfile(tight, out)
    elif rubber:
        f = f"rubberband=tempo={a.tempo}:pitch=1:window=short:transients=crisp:formant=preserved:pitchq=quality:phase=independent"
        subprocess.run([ff, "-v", "error", "-y", "-i", str(tight), "-af", f, str(out)], check=True)
    else:
        print("  (no rubberband in this ffmpeg: using atempo. brew install ffmpeg-full for the better stretch)")
        subprocess.run([ff, "-v", "error", "-y", "-i", str(tight), "-af", f"atempo={a.tempo}", str(out)], check=True)
    d = dur(out)
    msg = f"{len(a.lines)} lines → {dur(tight):.2f} s tight → ×{a.tempo} → {d:.2f} s  {out}"
    if a.text:
        words = len(re.findall(r"[\w'’%-]+", Path(a.text).read_text()))
        msg += f"  ({words} words, {words / d * 60:.0f} wpm; documentary narration sits around 150–165)"
    print(msg)


if __name__ == "__main__":
    main()
