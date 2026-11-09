# Kit API (`kit/vox.js`)

Start a new video with `npm run new -- <name>` (it writes `videos/<name>/index.html` with the paths below already correct).

All times are in **seconds on the master timeline**, and all sizes are **px in the frame** (1080×1920 unless you change it). Most helpers return the time they finish, so you can chain them: `const t = V.enter(card, 2, "drop"); V.circle(card, t + 0.3);`

```html
<link rel="stylesheet" href="../../kit/vox.css">
<script src="../../node_modules/gsap/dist/gsap.min.js"></script>
<script src="../../kit/vox.js"></script>
<script>
  const V = VOX.init({ width: 1080, height: 1920, fps: 30, duration: 20 });
  // … scenes …
</script>
```

## init(options)

| Option | Default | What it does |
|---|---|---|
| `width`, `height`, `fps`, `duration` | 1080, 1920, 30, 10 | Frame and length. Use 1920×1080 for YouTube. |
| `paper` | `#EFE8DA` | Paper colour. Keep one temperature per video. |
| `texture` | 0.55 | Paper texture strength (overlay). |
| `crumple` | false | Add crumpled-paper creases to the base sheet. |
| `accent`, `red` | `#FFD43B`, `#D7261E` | Highlighter and pen colours. |
| `onTwos` | true | Step every helper's motion at 12 fps. Turn it off for one helper with `{ steps: 0 }`. |
| `grain` | 0.13 | Film grain opacity (overlay, re-randomised 12×/s). |
| `dust` | 0.55 | Dust and specks (12 frames, 12×/s). |
| `vignette` | 0.35 | Corner darkening. |
| `fringe` | 0 | Edge blur in px (lens falloff, centre sharp). 2–4 is plenty. |
| `flicker` | 0.018 | Exposure flicker (max darkening) on the 12 fps grid. |
| `window` | 0 | A diagonal window-light shadow across every scene (0.12–0.2). |
| `drift` | 0 | Camera micro-drift (1 ≈ ±2 px). Off by default: the references hold the paper still. |
| `fxFps` | 12 | How often grain, dust and flicker change per second. |
| `plain` | false | The "template" look for before/after comparisons (also `?plain` in the URL or `--query plain` in the renderer). |
| `noimg` | false | Every photo becomes a grey "?" box and cut-outs vanish: what the video looks like when the pictures are guessed (also `?noimg` / `--query noimg`). |
| `blackLift`, `saturate` | 0.11, 0.88 | The photo tint: blacks lifted to ~#1C1C1C, colour −12%. |
| `boil` | 5 | Displacement for `boil()`. |
| `roomTone` | −42 | Room-tone level in dB (`false` = none). |
| `audio`, `music`, `musicGain`, `voiceGain` | —, —, −22, 0 | Voice-over and music files (relative to the page) for preview and render, and their levels in dB. |

Returns the API (`V`). `V.tl` is the GSAP master timeline, if you want raw tweens: use `fromTo` with `immediateRender: false` so seeking stays exact.

## Structure

| Call | Notes |
|---|---|
| `scene(t0, t1?, { paper, dark })` | A full-frame layer, visible from t0 to t1. `paper: "#E9E1CF"` gives it its own sheet; `dark: true` gives a #1C1A17 ground. |
| `group(parent)` | An empty full-frame layer. Use it for parallax planes and for the `curveCut` wrapper. |

## Things on the page

| Call | Notes |
|---|---|
| `text(parent, html, { x, y, w, size, font, color, align, lh, rot, cls, printed })` | `font`: `serif` · `quote` · `sans` · `cond` · `mono` · `hand`. Wrap words you'll highlight in `<mark>`, underline in `<u>`. `printed: true` roughens the edges like letterpress. |
| `card(parent, src, { x, y, w, h, rot, border, bottom, shadow, bw, halftone, tape, torn, caption, focus, tint })` | A photo on paper. `w`/`h` = the photo; the border adds `border × w` on each side. `shadow`: `card` · `flat` · `lifted`. `tape`: `true` or `["tl","tr","bl","br","t"]`. `torn: "tb"` tears the top and bottom. `bottom: 120` + `caption` = a polaroid. |
| `cutout(parent, png, { x, y, w, outline, outlineColor, rot })` | A transparent PNG with a sticker edge and a tight shadow. |
| `label(parent, text, { x, y, size, style, rot })` | Mono caps in a box. `style`: `""` (ink) · `paper` · `accent` · `red`. |
| `note(parent, html, { x, y, w, size, rot, torn, color })` | A torn scrap of paper with handwriting. |
| `doc(parent, { x, y, w, head: [left, right], html, size, rot, font })` | A typed page. Put `<mark>`, `<u>` and `<span class>` in the html as targets. |
| `svg(parent, markup, { x, y, w, h })` | Inline any SVG (for example a map from `scripts/map.mjs`). |
| `caption(parent, text, t0, t1, { y, size })` | The low caption box: ~62% black, condensed caps. `y` defaults to 0.76 on 9:16 (clear of the Reels UI) and 0.8 on 16:9. |
| `badge(parent, "1", x, y, t, { size, color, pop })` | A numbered red disc that appears on its word (a hard pop like the references; `pop: true` scales it in). |
| `bars(parent, data, t, { x, y, w, h, gap, stagger, dur, valueFmt, riso })` | A bar chart that grows on twos, with counters. `data: [{ value, label, color }]`. Defaults scale with the frame. `riso: true` prints the fills with a risograph speckle (the class `vx-riso` does the same on any flat fill). |
| `ghost(parent, { x, y, w, rot, head, html, size, opacity })` | A faint document behind the action (a `doc` at 7%): the layered background. Put the data's real source text in it. |
| `wordsAt(parent, [[word, t], …], { …text options, rise, dur, sfx })` | A line whose words appear exactly on their spoken words. The spans are on `.spoken` (for `highlight(host.spoken[2], t)`). |

## Motion

| Call | Notes |
|---|---|
| `enter(el, t, how, { dur, ease, steps, sfx, gain })` | `how`: `rise` · `drop` · `left` · `right` · `pop` · `stamp` · `fade` · `archive` (fast blur-in) · `wipe` (mask reveal, 0.4 s) · `cut` (just appears). Each comes with a sound. |
| `exit(el, t, how, { dur, sfx })` | `fade` · `fall` · `left` · `right` · `shrink`. |
| `words(el, t, { stagger, dur, from, sfx })` | Kinetic type, word by word. Default: rise 35% and fade in, 0.07 s apart. |
| `push(el, t0, t1, { from, to, x, y, rotation, origin, ease })` | Slow Ken Burns push. Holds +1–3 %/s, emphasis +4–6 %/s. Runs on the CSS `scale`/`translate` properties, so it **adds** to `enter()` instead of fighting it. |
| `camera(t, dur, { x, y, scale, rotation, origin, steps, sfx }, ease?)` | Moves the whole world; the lens layers stay put. Default ease: slow-fast-slow (`EASE.camera`). |
| `parallax([{ el, depth }], t0, t1, { dx, dy, zoom })` | depth 0 = far wall, 1 = at the lens. Keep it subtle. |
| `float(el, t0, t1, { amp, period, rot })` | Breathing or bobbing on a card or cut-out (uses CSS `translate`, so it stacks with tweens). For held cards: `amp` 2–3, `rot` 0.2–0.6, a different `period` (3–5 s) per object. |
| `breathe(card, t0, t1, { from: 1.08, to: 1.15 })` | The picture pushes inside its card while the card holds still. Use it on every held photo or footage card. |
| `footage(card, "clip/f_%04d.jpg", t0, { n, fps: 12, loop })` | Plays a real clip (a frame sequence, or an array of URLs) inside a photo card, stepped at 12 fps. Frames: `ffmpeg -i clip.mp4 -vf fps=12,scale=960:-2 -q:v 3 clip/f_%04d.jpg`. |
| `scrap(parent, { x, y, w, h, rot, vx, vy, vr, blur, t0, seed, color })` | A blurred torn scrap drifting past the lens (vx/vy px per second). One or two per scene, at the edge; create it last in its scene so it sits on top. |
| `boil(el, t0, t1, { fps })` | Hand-drawn line boil (re-displaced `fps` times a second). |

## Annotation

| Call | Notes |
|---|---|
| `highlight(target, t, { color, dur, box, textColor, sfx })` | The marker sweep, word by word, across lines. `box: true` = solid red box with the word knocked out. |
| `underline(target, t, { color, dur })` · `strike(...)` · `redact(...)` | The same sweep with a pen line, a strike-through or a black redaction bar. |
| `circle(target, t, { color, width, pad, tilt, dur, boil })` | One pen stroke (0.3 s, 8 px) that overshoots its start, then holds. `boil: true` keeps it alive. Measured after the fonts load. |
| `arrow(host, [x1,y1], [x2,y2], t, { bend, head, color, width, dur })` | A hand-drawn curved arrow in `host`'s px (0.25 s, ~1% of the frame width). |
| `spotlight(target, t, t1, { dim, pad })` | Dims everything but the target. |

`target` can be an element, a CSS selector inside the stage, or a list of `.vx-word` spans. A target that doesn't exist throws a clear error (for example `VOX.circle(): target not found`) and the renderer stops instead of writing a broken video.

## Type and numbers

| Call | Notes |
|---|---|
| `type(el, t, { cps, sfx })` | Typewriter, with slightly uneven rhythm and key sounds. |
| `count(el, t, from, to, { dur, fps, decimals, prefix, suffix, format })` | A number that rolls on a 15 fps grid. |

## Maps

| Call | Notes |
|---|---|
| `route(pathEl, t, dur, { dashed })` | Draws a path on. `dashed: true` reveals a dashed line through a mask. |
| `pin(parent, x, y, t, { label, labelOpts, color })` | A dot that drops in and pulses twice, plus an optional label. |

## Transitions

| Call | Notes |
|---|---|
| `curveCut(wrap, a, b, t, { dur, from, to, x, y, origin })` | Cut on the fastest frame of ONE eased zoom. Put `a` and `b` in the same `group`. Returns the cut time. |
| `whip(a, b, t, { dir, dur })` | Whip pan between two scenes with horizontal motion blur. Returns the cut time. Make `b`'s scene start there. |
| `paperWipe(t, { dur, dir, color })` | A torn sheet sweeps across. Returns the time it fully covers the frame: switch scenes then. |
| `flash(t, { amt, dur })` | A short exposure bump. Rarely. |
| `zoomCut(a, b, t, { scale: 1.16, blur: 5, inDur: 0.3, outDur: 0.32, origin, sfx })` | A curve cut between two scenes: `a` zooms and blurs into the cut, `b` arrives from the same zoom and settles. End `a` and start `b` at `t`; put `t` just before the word it introduces. |
| `holePush(a, b, t0, t1, { x, y, zoom: 1.45, seed, rim, sfx })` | The page tears open around (x, y) and the camera pushes through into scene `b`. Start `b` at `t0`; `a` can end at `t1`. |

## Narration timing

`VOX.wordmap(words, { offset })` turns a word list into lookups, so every cue follows the narration. `words` is `[{ w, s, e }]` (what `scripts/words.py` writes) or the id of a `<script type="application/json">` holding it (`--inject` puts it there). It returns `w(word, n = 1)` → the start of the nth time that word is said; `w.after(word, t)` → the first one at or after `t`; `w.end(word, n)`. Matching ignores case and punctuation ("here's" = "heres"). An unknown word throws, so a changed script fails loudly instead of drifting.

```js
const w = V.wordmap("#words", { offset: 0.10 });   // the narration starts 0.10 s into the video
V.strike("#dz", w("not"));
V.zoomCut(s1, s2, w("here's") - 0.06);
V.highlight(mark, w("moon", 2));
```

## Sound

`sfx(name, t, { gain, pan, src, loop, until })` drops a cue on the timeline. `loop: true, until: 18` repeats a bed (such as `projector_loop`) until 18 s. `name` is any file in `kit/sfx/` (without `.wav`), or pass `src` for your own file. `type_key` picks one of 6 variants. Helpers add their own cues; pass `{ sfx: false }` to silence one.

## Utilities

`stepped(ease, dur, fps)` · `bezier(x1, y1, x2, y2)` · `q(t)` (snap to the 12 fps grid) · `EASE.{settle, land, soft, camera, cut, snap}` · `rng(seed)` · `hash(n, salt)` · `el(tag, cls, parent, style)` · `proc(fn(t))`: run your own function of time on every frame (the deterministic way to do anything procedural).

## Preview and render

- Preview: `npm run preview` (a small Node server; leave it running and use a second terminal for renders), then open `http://localhost:8080/videos/<name>/` or `/examples/apollo/`. Space = play/pause, ←/→ = one frame (Shift = 1 s). Click "♪" for sound (needs http, not file://). Add `?t=7.5` to open on a frame.
- Render: `node scripts/render.mjs page.html [--out x.mp4] [--voice vo.wav] [--music bed.mp3] [--stills 1,2.5] [--from 3 --to 9] [--scale 0.5] [--gif] [--no-sfx] [--no-duck] [--crf 18] [--lufs -14] [--query plain|noimg]`. `--scale` below 1 is a draft (fringe blur off). `--scale 2` is a native 2× master (3840×2160 from a 1920×1080 page, every text and shape drawn at that size, fringe on); use it for anything that will be shown at 4K. The renderer stops on any page error.

## Scripts

| Script | What it does |
|---|---|
| `scripts/words.py vo.wav [--inject page.html] [--offset 0.1] [--fix "cloud=Claude"]` | Word timings for the narration (faster-whisper, offline), starts snapped out of silences → `words.json` and the page. |
| `scripts/narration.py l1.mp3 l2.mp3 … --out vo.wav [--tempo 1.2] [--gaps …]` | Assembles line takes: tightens pauses, sets the beat between lines, speeds up with rubberband (voice kept). |
| `scripts/doc_mix.py silent.mp4 --cues cues.json --out final.mp4 [--voice] [--music] [--room] [--words] [--stems]` | The documentary mix with recorded sounds: narration as reference, each effect set by its peak and peak-aligned on its word, music 22 LU under, room tone last. See SOUND.md. |
| `scripts/subjectmask.swift` | Apple Vision cut-outs on macOS (free, offline) → transparent PNGs for `cutout()`. |
| `scripts/map.mjs`, `scripts/photo_treat.py`, `scripts/make_textures.py`, `scripts/make_sfx.py` | Maps, photo pre-treatment, the generated textures and sounds. |
