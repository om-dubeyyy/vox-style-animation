"""Word-level timings for a narration → words.json, the one timing file that drives the whole video.

Every annotation, cut and sound then looks its time up by word (VOX.wordmap in the page, the same words.json in the
mix), so a re-recorded line re-times everything with one re-run and nothing is re-timed by hand.

usage:
  python3 scripts/words.py vo.wav [--out words.json] [--model small] [--lang en] [--offset 0.10]
                           [--fix "cloud=Claude,walk=Vox"] [--inject videos/x/index.html]
  --offset  where the narration starts on the video's timeline (the mix places it there too).
  --fix     misheard words → the right spelling (matched case-insensitively, punctuation kept).
  --inject  writes the list into <script type="application/json" id="words">…</script> in that page, so the page
            needs no fetch: const w = VOX.wordmap("#words");
Needs: pip install faster-whisper (runs offline; the first run downloads the model, "small" is about 0.5 GB).
Whisper tends to pull a word's start back into the silence before it, so starts are snapped to the end of that
silence: annotations land on the sound, not on the breath before it. Check names by eye; Whisper mishears them.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def silences(path, db=-42, d=0.08):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", f"silencedetect=n={db}dB:d={d}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    return list(zip(st, en))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("audio")
    ap.add_argument("--out")
    ap.add_argument("--model", default="small")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--offset", type=float, default=0.0)
    ap.add_argument("--fix", default="")
    ap.add_argument("--inject")
    a = ap.parse_args()
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("needs faster-whisper: pip install faster-whisper")
    fix = dict(kv.split("=", 1) for kv in a.fix.split(",") if "=" in kv)
    fix = {k.lower(): v for k, v in fix.items()}
    model = WhisperModel(a.model, device="cpu", compute_type="int8")
    # decode with ffmpeg (16 kHz mono float), not faster-whisper's own PyAV loader, which breaks on some installs
    import numpy as np
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", a.audio, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    segs, _ = model.transcribe(np.frombuffer(pcm, np.float32).copy(), language=a.lang, word_timestamps=True, vad_filter=False, beam_size=5)
    words = []
    for s in segs:
        for x in s.words:
            w = x.word.strip()
            core = re.sub(r"[^\w'’%-]", "", w).lower()
            if core in fix:
                w = re.sub(re.escape(core), lambda m: fix[core], w, count=1, flags=re.I)
            words.append({"w": w, "s": round(x.start, 3), "e": round(x.end, 3)})
    sil = silences(a.audio)
    for x in words:   # snap starts out of the silence they sit in
        for s0, s1 in sil:
            if s0 - 0.02 <= x["s"] < s1 - 0.03:
                x["s"] = round(s1 - 0.02, 3)
    for x in words:
        x["s"] = round(x["s"] + a.offset, 3)
        x["e"] = round(x["e"] + a.offset, 3)
    out = Path(a.out or Path(a.audio).with_suffix(".words.json"))
    out.write_text(json.dumps(words, ensure_ascii=False, indent=0))
    print(f"{len(words)} words → {out}")
    print(" ".join(f"{x['w']}@{x['s']:.2f}" for x in words))
    if a.inject:
        page = Path(a.inject)
        html = page.read_text()
        tag = f'<script type="application/json" id="words">{json.dumps(words, ensure_ascii=False)}</script>'
        new, k = re.subn(r'<script type="application/json" id="words">.*?</script>', lambda m: tag, html, flags=re.S)
        if not k:
            new, k = re.subn(r"(<body[^>]*>)", lambda m: m.group(1) + "\n" + tag, html, count=1)
        page.write_text(new)
        print(f"injected into {page}")


if __name__ == "__main__":
    main()
