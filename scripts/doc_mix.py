"""Documentary mix with REAL recorded sounds: the narration is the reference, the music bed sits ~22 LU under it, and
every sound effect is placed on its word at a level set by its own peak, so no hot sample jumps out.

Why each step is there:
  - The kit's synthesized sounds (tick, pop, chime) make a finished video sound like an app. Real paper foley fixes it:
    paper slides and drops, a rubber stamp, a pen scribble, a typewriter, a tape rip, a film projector, room tone.
  - Mixed with no voice to sit under, the effects get normalised up and the first big hit (a firework on frame 1)
    becomes the loudest thing in the video. Level effects UNDER a narration (or as if one were there), never alone.
  - Levelling samples by average loudness lets pen squeaks and a tape rip jump out. Each sample is set by its loudest
    10 ms AND capped by its true peak (8 dB of crest allowed).
  - A hit only feels on the frame when the sample's PEAK lands on it, not its start ("align": "peak" below).
  - Room tone goes in after the master gain, at about -48 LUFS: felt, not heard. Normalised with the rest, it pumps
    up into hiss.

usage:
  python3 scripts/doc_mix.py silent.mp4 --cues cues.json --out final.mp4
         [--voice vo.wav --vo-at 0.10] [--music bed.mp3 --music-under 22] [--room room.wav --room-lufs -48]
         [--words words.json | page.html] [--lufs -14] [--stems]
  silent.mp4  the picture (render.mjs with --no-sfx, or any video); its video stream is copied, never re-encoded.
  --stems     also writes <out>_vo.wav, <out>_music.wav, <out>_sfx.wav at the final gain (they sum to the mix), so an
              edit can drop the narrator under a different voice-over.

cues.json — a list; paths are relative to the cues file:
  { "src": "sfx/paper_slide.mp3", "t": 0.25, "peak": -27, "len": 0.8, "fade": 0.2 }
  { "src": "sfx/stamp.mp3", "t": "here's", "dt": -0.04, "peak": -19, "ss": 3.22, "align": "peak" }
  { "src": "sfx/typewriter.mp3", "t": "every", "peak": -33, "repeat": 14, "every": 0.11, "step_db": -0.5 }
  t      seconds, or a spoken word ("moon#2" = its 2nd time) looked up in --words; dt shifts it.
  peak   the level (dBFS) of the sample's loudest 10 ms before the master gain, where the voice sits at -16 LUFS.
         Tested values: paper -26..-28 · pen and marker -23..-31 · stamp -19 · sub hit -19..-24 · whoosh -23..-27 ·
         typewriter -31..-33 · shutter -27..-29 · crackle and projector beds -33..-36.
  len    keep only this much of the sample (s); fade = fade-out at the end of it (s); ss = start this far into the file.
  align  "start" (default) or "peak": move the cue so the sample's loudest moment lands exactly on t.
Needs ffmpeg/ffprobe and numpy.
"""
import argparse
import json
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np

SR = 48000


def run(cmd):
    subprocess.run(cmd, check=True)


def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]))


def pcm(path, ss, ln, rate):
    cmd = ["ffmpeg", "-v", "error"] + (["-ss", str(ss)] if ss else []) + ["-i", str(path)] + (["-t", str(ln)] if ln else []) + \
          ["-ac", "1", "-ar", str(rate), "-f", "s16le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.int16).astype(float) / 32768


@lru_cache(None)
def peak(path, ss, ln):
    """(level of the loudest 10 ms in dBFS, where it is in s, sample true peak in dBFS)"""
    a = pcm(path, ss, ln, 16000)
    env = np.sqrt(np.convolve(a * a, np.ones(160) / 160, "same"))
    tp = np.abs(pcm(path, ss, ln, SR)).max()
    return 20 * np.log10(env.max() + 1e-9), env.argmax() / 16000, 20 * np.log10(tp + 1e-9)


def loud(path):
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    return float(json.loads(m[m.rindex("{"):m.rindex("}") + 1])["input_i"])


def word_time(words, key):
    m = re.match(r"^(.*?)(?:#(\d+))?$", key)
    k, n = m.group(1), int(m.group(2) or 1)
    norm = lambda x: re.sub(r"[^\w%]", "", str(x).lower().replace("’", "").replace("'", ""))
    c = 0
    for o in words:
        if norm(o.get("w", o.get("word"))) == norm(k):
            c += 1
            if c == n:
                return float(o.get("s", o.get("start")))
    sys.exit(f"cue word '{key}' is not in the words file")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("video")
    ap.add_argument("--cues", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice")
    ap.add_argument("--vo-at", type=float, default=0.0)
    ap.add_argument("--music")
    ap.add_argument("--music-under", type=float, default=22, help="LU under the narration (18–24 for documentary)")
    ap.add_argument("--room")
    ap.add_argument("--room-lufs", type=float, default=-48)
    ap.add_argument("--words")
    ap.add_argument("--lufs", type=float, default=-14)
    ap.add_argument("--stems", action="store_true")
    a = ap.parse_args()

    out = Path(a.out)
    tmp = out.parent / (out.stem + "_parts")
    tmp.mkdir(parents=True, exist_ok=True)
    D = dur(a.video)
    base = Path(a.cues).resolve().parent
    raw = json.loads(Path(a.cues).read_text())
    words = None
    if a.words:   # a words.json, or a page holding <script type="application/json" id="words">
        txt = Path(a.words).read_text()
        if a.words.endswith((".html", ".htm")):
            m = re.search(r'<script type="application/json" id="words">(.*?)</script>', txt, re.S)
            if not m:
                sys.exit(f'no <script type="application/json" id="words"> in {a.words}')
            txt = m.group(1)
        words = json.loads(txt)
    if words and not isinstance(words, list):
        words = words["words"]
    if not a.voice:
        print("  ! no narration: the effects get mastered on their own. Keep their peaks where they'd sit under a voice,"
              " or the loudest hit becomes the loudest thing in the video.")

    stems = []
    # 1 · narration at -16 LUFS, placed at --vo-at
    if a.voice:
        g = -16 - loud(a.voice)
        ms = int(a.vo_at * 1000)
        run(["ffmpeg", "-v", "error", "-y", "-i", a.voice, "-af",
             f"aresample={SR},aformat=channel_layouts=stereo,volume={g:.2f}dB,adelay={ms}|{ms},apad=whole_dur={D},atrim=0:{D}", str(tmp / "vo.wav")])
        stems.append("vo")
    # 2 · music bed, --music-under LU under the narration, with the make-room-for-vocals EQ (cut where speech lives)
    if a.music:
        g = (-16 - a.music_under) - loud(a.music)
        run(["ffmpeg", "-v", "error", "-y", "-stream_loop", "-1", "-i", a.music, "-af",
             f"aresample={SR},aformat=channel_layouts=stereo,atrim=0:{D},volume={g:.2f}dB,equalizer=f=2168.5:t=q:w=0.3:g=-11.5,"
             f"lowpass=f=2500,afade=t=in:d=0.4,afade=t=out:st={max(0, D - 0.7):.2f}:d=0.7", str(tmp / "music.wav")])
        stems.append("music")
    # 3 · effects, each set by its own peak
    cues = []
    for c in raw:
        t = c["t"]
        if isinstance(t, str):
            if not words:
                sys.exit(f"cue time '{t}' is a word: pass --words words.json")
            t = word_time(words, t)
        t += c.get("dt", 0)
        for i in range(int(c.get("repeat", 1))):
            cues.append(dict(c, t=t + i * c.get("every", 0), peak=c["peak"] + i * c.get("step_db", 0)))
    args, parts, labels = [], [], []
    for i, c in enumerate(cues):
        p = (base / c["src"]).resolve()
        if not p.exists():
            sys.exit(f"missing sound: {p}")
        ss, ln, fo = c.get("ss", 0), c.get("len"), c.get("fade", 0)
        pk, at, tp = peak(str(p), ss, ln)
        g = min(c["peak"] - pk, (c["peak"] + 8) - tp)
        start = c["t"] - (at if c.get("align") == "peak" else 0)
        trim = max(0.0, -start)   # a cue that starts before 0 loses its head, not its timing
        args += (["-ss", str(ss)] if ss else []) + ["-i", str(p)]
        ch = f"[{i}:a]aresample={SR},aformat=channel_layouts=stereo"
        if ln:
            ch += f",atrim=0:{ln}" + (f",afade=t=out:st={max(0, ln - fo):.3f}:d={fo}" if fo else "")
        if trim:
            ch += f",atrim=start={trim:.3f},asetpts=PTS-STARTPTS"
        ms = int(round(max(0.0, start) * 1000))
        ch += f",volume={g:.2f}dB,adelay={ms}|{ms}[c{i}]"
        parts.append(ch)
        labels.append(f"[c{i}]")
    if cues:
        run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex",
             ";".join(parts) + ";" + "".join(labels) + f"amix=inputs={len(labels)}:normalize=0:duration=longest,apad=whole_dur={D},atrim=0:{D}[s]",
             "-map", "[s]", str(tmp / "sfx.wav")])
        stems.append("sfx")
    if not stems:
        sys.exit("nothing to mix")
    # 4 · one gain for everything to the target loudness; stems at that gain; room tone after it; a safety limiter
    ins = sum((["-i", str(tmp / f"{s}.wav")] for s in stems), [])
    run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", "".join(f"[{i}]" for i in range(len(stems))) +
         f"amix=inputs={len(stems)}:normalize=0[m]", "-map", "[m]", str(tmp / "sum.wav")])
    gain = a.lufs - loud(tmp / "sum.wav")
    if a.stems:
        for s in stems:
            run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp / f"{s}.wav"), "-af", f"volume={gain:.2f}dB", str(out.with_name(out.stem + f"_{s}.wav"))])
    fc = f"[1:a]volume={gain:.2f}dB[a1]"
    ins = ["-i", a.video, "-i", str(tmp / "sum.wav")]
    if a.room:
        rg = a.room_lufs - loud(a.room)
        ins += ["-stream_loop", "-1", "-i", a.room]
        fc += (f";[2:a]aresample={SR},aformat=channel_layouts=stereo,atrim=0:{D},volume={rg:.2f}dB,afade=t=in:d=0.2,"
               f"afade=t=out:st={max(0, D - 0.4):.2f}:d=0.4[rt];[a1][rt]amix=inputs=2:normalize=0:duration=first[a2]")
    else:
        fc += ";[a1]anull[a2]"
    fc += ";[a2]alimiter=limit=0.78:attack=1:release=50:level=false[a]"
    run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy",
         "-c:a", "aac", "-b:a", "256k", "-t", f"{D:.3f}", "-movflags", "+faststart", str(out)])
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(out), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    js = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
    print(f"wrote {out} · {len(cues)} cues · {float(js['input_i']):.1f} LUFS · {float(js['input_tp']):.1f} dBTP")


if __name__ == "__main__":
    main()
