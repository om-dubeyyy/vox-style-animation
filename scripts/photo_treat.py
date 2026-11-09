"""Photo treatment for the Vox look, as one ffmpeg chain: a still (or a clip) becomes a shot that feels filmed.
Fringe blur (soft edges, subject sharp) + film dust (12 fps) + a vignette toward the subject + a slow push (1.00 → 1.06),
and an optional tint (blacks → #1C1C1C, whites a touch brighter). The recipe @chrismoran__ shows: edge blur, dust,
vignette, push 108 → 115 %. Use the MP4 as a full-screen shot, or drop it into a page as <video>.

    python3 scripts/photo_treat.py IN.jpg OUT.mp4 --dur 3 --focus 0.49,0.42
    python3 scripts/photo_treat.py IN.mp4 OUT.mov --ss 6 --dur 2.5 --prores      # a clip, ProRes for your NLE
    options: --size 1080x1920 · --push 1.00,1.06 · --fringe 14 (blur px) · --sharp 0.34 (sharp radius, × width)
             --dust 0.15 · --grain 7 · --vignette 0.35 (farthest corner −35%, 0 = off) · --tint · --fps 30

The push is rendered at 2× and scaled down, so it doesn't stair-step. The fringe blur and the vignette stay put in the
frame (a lens, not the photo). Dust comes from kit/textures/dust_*.png (scripts/make_textures.py) and changes 12 times a second.
Needs kit/textures/dust_*.png (python3 scripts/make_textures.py). Check the licence of every photo you treat (references/ASSETS.md).
"""
import argparse
import math
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
DUST = HERE.parent / "kit" / "textures" / "dust_%d.png"
FF = "ffmpeg"


def pair(s, cast=float):
    a, b = s.replace("x", ",").split(",")
    return cast(a), cast(b)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--dur", type=float, default=3.0)
    ap.add_argument("--ss", type=float, default=0.0, help="start time when the source is a clip")
    ap.add_argument("--size", default="1080x1920")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--focus", default="0.5,0.45", help="subject point, 0–1 of the output frame")
    ap.add_argument("--push", default="1.00,1.06")
    ap.add_argument("--fringe", type=float, default=14.0, help="edge blur sigma in output px (0 = off)")
    ap.add_argument("--sharp", type=float, default=0.34, help="radius that stays sharp, × output width")
    ap.add_argument("--dust", type=float, default=0.15, help="dust strength 0–0.25")
    ap.add_argument("--grain", type=float, default=7.0)
    ap.add_argument("--vignette", type=float, default=0.35, help="how much the farthest corner darkens, 0–1")
    ap.add_argument("--tint", action="store_true")
    ap.add_argument("--prores", action="store_true", help="ProRes 422 HQ .mov instead of H.264")
    a = ap.parse_args()

    W, H = pair(a.size, int)
    fx, fy = pair(a.focus)
    z0, z1 = pair(a.push)
    W2, H2 = W * 2, H * 2
    N = max(2, round(a.dur * a.fps))
    still = Path(a.src).suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff")
    if not (DUST.parent / "dust_0.png").exists() and a.dust > 0:
        sys.exit("missing kit/textures/dust_*.png: run python3 scripts/make_textures.py once")

    def radial(path, w, h, cx, cy, r0, r1, expr):   # a still grey mask: t = 0 inside r0, 1 at r1, shaped by expr(t)
        t = f"clip((hypot(X-{cx:.1f},Y-{cy:.1f})-{r0:.1f})/{r1 - r0:.1f},0,1)"
        subprocess.run([FF, "-v", "error", "-y", "-f", "lavfi", "-i", f"color=black:s={w}x{h}:d=1",
                        "-vf", f"format=gray,geq=lum='{expr(t)}'", "-frames:v", "1", str(path)], check=True)

    with tempfile.TemporaryDirectory() as tmp:
        mask, vmask = Path(tmp) / "mask.png", Path(tmp) / "vignette.png"
        if a.fringe > 0:   # alpha of the blurred copy: 0 inside the sharp radius, eased up to 1 at the corners
            radial(mask, W2, H2, fx * W2, fy * H2, a.sharp * W2, (a.sharp + 0.55) * W2, lambda t: f"255*pow({t},1.6)")
        if a.vignette > 0:  # multiply: 1 around the subject, (1 - vignette) at the farthest corner, smooth between
            far = max(math.hypot(x - fx * W, y - fy * H) for x in (0, W) for y in (0, H))
            radial(vmask, W, H, fx * W, fy * H, 0.22 * W, far, lambda t: f"255*(1-{a.vignette}*pow({t},1.8))")

        inputs = (["-loop", "1", "-framerate", str(a.fps), "-t", f"{a.dur}", "-i", a.src] if still
                  else ["-ss", f"{a.ss}", "-t", f"{a.dur}", "-i", a.src])
        # 1. cover the 2× frame around the focus, 2. push: rescale every frame, crop so the focus point stays put
        z = f"({z0}+{z1 - z0}*n/{N - 1})"
        chain = [f"[0:v]fps={a.fps},scale={W2}:{H2}:force_original_aspect_ratio=increase:flags=lanczos,"
                 f"crop={W2}:{H2}:(iw-{W2})*{fx}:(ih-{H2})*{fy},setsar=1,"
                 f"scale=w='2*trunc({W2}*{z}/2)':h='2*trunc({H2}*{z}/2)':eval=frame:flags=bicubic,"
                 f"crop={W2}:{H2}:x='(iw-{W2})*{fx}':y='(ih-{H2})*{fy}',format=gbrp"
                 + (",colorlevels=rimax=0.95:gimax=0.95:bimax=0.95:romin=0.11:gomin=0.11:bomin=0.11,hue=s=0.9"
                    if a.tint else "") + "[pushed]"]
        idx = 1
        if a.fringe > 0:
            inputs += ["-loop", "1", "-framerate", str(a.fps), "-t", f"{a.dur}", "-i", str(mask)]
            chain += [f"[pushed]split[sh][bl]", f"[bl]gblur=sigma={a.fringe * 2:.1f}[blb]",
                      f"[{idx}:v]format=gray[m]", "[blb][m]alphamerge[blm]", "[sh][blm]overlay=format=gbrp[fr]"]
            idx += 1
        else:
            chain += ["[pushed]null[fr]"]
        chain += [f"[fr]scale={W}:{H}:flags=lanczos,setsar=1,format=gbrp"
                  + (f",noise=c0s={a.grain}:c1s={a.grain}:c2s={a.grain}:allf=t" if a.grain > 0 else "") + "[v1]"]
        last = "[v1]"
        if a.vignette > 0:
            inputs += ["-loop", "1", "-framerate", str(a.fps), "-t", f"{a.dur}", "-i", str(vmask)]
            chain += [f"[{idx}:v]format=gbrp[vm]", f"{last}[vm]blend=all_mode=multiply:shortest=1[v2]"]
            last, idx = "[v2]", idx + 1
        if a.dust > 0:
            inputs += ["-framerate", "12", "-stream_loop", "-1", "-start_number", "0", "-i", str(DUST)]
            chain += [f"[{idx}:v]fps={a.fps},scale={max(W, H)}:{max(W, H)},crop={W}:{H},format=rgba,"
                      f"colorchannelmixer=aa={min(1.0, a.dust * 4):.2f},trim=end_frame={N},setpts=PTS-STARTPTS[d]",
                      f"{last}format=rgba[vb]", "[vb][d]overlay=format=auto:shortest=1,format=gbrp[v3]"]
            last = "[v3]"
        pix = "yuv422p10le" if a.prores else "yuv420p"
        chain += [f"{last}scale=out_color_matrix=bt709:out_range=tv,format={pix}[out]"]
        tags = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
        enc = (["-c:v", "prores_ks", "-profile:v", "3"] if a.prores
               else ["-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart"])
        cmd = [FF, "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chain), "-map", "[out]",
               "-frames:v", str(N), "-r", str(a.fps), "-an", *enc, *tags, a.out]
        subprocess.run(cmd, check=True)
    print(f"{a.out}: {W}×{H}, {N} frames at {a.fps} fps, push {z0:.2f}→{z1:.2f}, fringe {a.fringe:g}, "
          f"dust {a.dust:g}, vignette {a.vignette:g}{', tint' if a.tint else ''}")


if __name__ == "__main__":
    main()
