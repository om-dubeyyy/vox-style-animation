# Look book: why some "Vox-style" videos look expensive and most look like templates

This is the core of the skill. It comes from two passes:

1. **Measured.** Nine Instagram reels in the style were studied frame by frame. Paper colours were sampled from pixels, cut rates were counted, and motion cadence was found by diffing frames. Push speeds were measured in %/s, and loudness was measured with EBU R128. These reels are by @chrismoran__ (tutorials with 474K–1.44M plays), @mr.pynk, @ashokreddyai and @wadhwa.ai. They are listed in [REFERENCES.md](REFERENCES.md).
2. **Sourced.** Fifty-one articles, interviews and tutorials were read. They include interviews with Vox staff (Joss Fong, Joe Posner, Phil Edwards, Sam Ellis), how-to videos that recreate the look, sound-design guides and licence pages.

Tags: **(M)** measured in the reels · **(E)** estimated from frames (not pixel-measured) · **(S)** stated by a source or shown on screen · **(P)** practice; it works, but no source states it.

> Vox has never published its own specs. Every number here comes from the reels we measured or from people imitating the look. The aim is not to copy Vox. It is to learn the craft rules that make paper collage read as *editorial* and not as a *template*.

---

## The one idea underneath

**It should look made by hand, on purpose.** Each rule below adds a small physical imperfection or takes away a digital perfection. Pure white, pure black, perfectly smooth 60 fps, everything moving at once and dissolves all read as "software". Paper, lifted blacks, motion on twos, one thing moving at a time and hard cuts read as "a person made this".

Vox's own art director put it bluntly: *"You don't want it to look perfect because that might make it look more like an ad than an editorial piece"* (S).

And the rule above all rules: **the picture must carry the argument.** Joss Fong: you "can't rely on some sort of decoration" (S). A beautiful collage over a weak point is still a weak video.

---

## 1. Paper, never a screen

| Rule | Numbers | Kit |
|---|---|---|
| No pure white background | Light paper measured at **#D9D4CF–#F3F2F3**; warm sets #D6D0C5, #CAC2B4 (M) | `--vx-paper: #EFE8DA` |
| No pure black background | Dark grounds at **#131313–#231C18**, never #000 (M) | `scene(t0, t1, { dark: true })` → #1C1A17 |
| Pick one paper temperature (warm or cool) and keep it for the whole video | (M) | set `paper` once in `VOX.init` |
| Texture you *feel*, not see | High-pass luma std **1–4/255** on paper at 720p. Heavier (12–18) only on "object" surfaces such as cork or a cutting mat (M) | `texture: 0.55` (paper.png on overlay) |
| The paper is static, or it flickers in steps like a scanned page. It never crawls. | Frame diffs 0.00–0.09 in @chrismoran__ (static); 0.3–6.9 every ~2nd frame in @ashokreddyai (step flicker) (M) | grain/dust swap on the 12 fps grid (`fxFps: 12`) |
| Layer the background: a ghost scan or document at 5–10% plus a tint, never a flat solid | (S, @chrismoran__ "layered backgrounds", 1.44M plays) | a faint `doc()` or `card()` behind, with `el.style.opacity = 0.08` |
| Light falls on the sheet | Soft top-left lift, darker edges (P). Optional single hard window shadow across every scene (S, @wadhwa.ai style key) | `.vx-paper::after`; `init({ window: 0.18 })` |

## 2. Photos become objects

| Rule | Numbers | Kit |
|---|---|---|
| Lift the blacks and calm the colour of every photo | Tint: map black → dark grey, map white → a touch above paper (S, shown in AE; the exact hex isn't shown, ours is ≈#1C1C1C) | `#vx-tint` filter on every photo: black lift 0.11, saturation 0.88 |
| Border on photo cards | **2.4–5% of the card's width**, white or cream (M) | `card({ border: 0.04 })` |
| Rotate cards a little, and not all the same way | **±1.5° to ±3°**; back cards in a stack up to ±6°; never 0° on every card and never more than 8° (M) | `card({ rot: -2.5 })` |
| Shadows: soft, offset down, ~30% darker at the edge, fading over ~5% of the frame width | ~50 px blur at 1080 (M). Contact shadow + ambient shadow (P) | `.vx-card` uses three shadow layers |
| Choose the shadow per layer type | Paper cards get one. Hard cut-outs on dark grounds often get none (M) | `shadow: "flat" \| "card" \| "lifted"` |
| Two image modes, never mixed in one shot | Cut-out objects (hard edge or sticker outline) **or** bordered photo cards (M) | `cutout()` vs `card()` |
| Sticker outline on cut-outs | **~0.8–1.1% of frame width** (6–8 px at 720), white or red-orange around #B44D3A (M/E) | `cutout({ outline: 9 })` |
| Greyscale or halftone everything, with ONE colour object per frame | (M, several reels) | `card({ bw: true, halftone: 0.22 })` |
| Torn edges only on paper (strips, tags, notes). Photos keep clean edges | (M) | `card({ torn: "tb" })`, `note()` |
| Tape as a label or a fixing | (M) | `card({ tape: ["tl", "br"] })` |
| Photo treatment for a held still | Edge blur (subject sharp) → film dust → vignette → slow push 108 → 115% (S, @chrismoran__) | `scripts/photo_treat.py`, or `init({ fringe: 3 })` + `push()` |

## 3. Depth without 3D

| Rule | Numbers | Kit |
|---|---|---|
| 3–5 layers per shot | Background (scan or texture) · mid (cards) · subject · annotation · caption (E) | `group()` per layer |
| Parallax is barely there | Apparent zoom **+0.4 to +1.0 %/s** (M). "Should be really subtle" (S) | `parallax(layers, t0, t1, { dx: -60, zoom: 0.06 })` |
| Fill behind a cut-out before you move it | Paint or clone the hole first; unfilled holes are the giveaway (S) | ASSETS.md → LaMa (Apache-2.0) |
| A hand placing an object is the cheapest "made by hand" cue | (M, two reels) | film your hand, cut it out |

## 4. Motion: on twos, one thing at a time

| Rule | Numbers | Kit |
|---|---|---|
| **Collage motion at 12 fps ("on twos")** inside a 24/30 fps video. The voice and any face cam stay at full rate. | A 2-frame hold measured in three @chrismoran__ reels; "Posterize Time… 12" shown on screen (M, S). Smooth 30 fps collage reads as a slideshow (M) | `init({ onTwos: true })` (default) steps every helper's ease |
| Slow push on a held image | **+1 to +3 %/s** (M, four reels) | `push(el, t0, t1, { to: 1.06 })` |
| Push for emphasis | **+4 to +6 %/s** (M) | `push(..., { to: 1.15 })` over ~3 s |
| Hook and ending zooms | **+15 %/s or more**, usually across a cut (M) | `curveCut()` / `camera()` |
| Pull-outs to reveal context | **−3 to −7 %/s** (M) | `push(..., { from: 1.2, to: 1 })` |
| Entrance timing | Type mask reveal **0.33–0.42 s**; arrow or circle draw-on **0.17–0.25 s**; photo slide-in **~0.67 s** (M) | defaults: `wipe` 0.4, `arrow` 0.25, `circle` 0.3, `rise` 0.75 |
| Easing | Strong ease-out on entrances. Camera slow-fast-slow at ~70% influence (S). A very steep middle for match zooms (AE influence 97% shown) (S) | `EASE.land`, `EASE.camera`, `EASE.cut` |
| **Only one thing moves** | In the strongest shots the paper does not move at all (diff 0) while an arrow draws (M) | stagger your calls; don't animate everything at t |
| Key to the words, not a timer | Numbered badges pop **0.33 s** apart, exactly on "one… two… three" (M) | take times from the voice-over transcript |
| Hand-drawn lines draw on, then hold | Global wiggle is rare in the best reels (M). If you boil, use 4–12 redraws/s at displacement 5–10 (S) | `circle()` holds; `boil(el, t0, t1, { fps: 8 })` is opt-in |
| The paper holds still while one thing moves | Paper frame-diff 0 during element moves (M). Only the lens (grain, dust) lives | `drift: 0` by default; `init({ drift: 1 })` adds a 1–2 px handheld feel (P) if you want it |

## 5. Annotation: show the viewer where to look

| Rule | Numbers | Kit |
|---|---|---|
| Yellow highlighter swept over the exact phrase as the voice reaches it | Multiply, ragged edge, 0.3–0.6 s left to right (S/P) | `highlight(mark, t)` |
| Or a solid box with the word knocked out | Red **#F42B00** box, white word (M). Lime band on multiply (M) | `highlight(mark, t, { box: true })` |
| Red pen circle that overshoots its start | Brush red **#B92E34**; the measured red brush *arrow* is ~1.1% of frame width (M) | `circle(target, t)` (8 px), `arrow()` (~1% of width) |
| Arrows and circles draw on; they never fade in | (M) | `arrow()`, `circle()` |
| Numbered badges | Red disc **#D44146**, ~14% of frame width, white serif numeral, hard pop on the word (M) | `badge(parent, "1", x, y, t)` |
| Caption box | Black at **~62%** opacity, rounded, **3.8%** of frame height, at **78–82%** of frame height; condensed caps; 1–3 words (M) | `caption(parent, "TEXT", t0, t1)`: default 76% on 9:16, to stay clear of the Reels/TikTok UI |
| Credit chips | "From Vox", "ORIGINAL", "Archive": label which footage is borrowed and which is yours (M) | `label(..., { style: "paper" })` |

## 6. Type: three voices at most

| Rule | Numbers | Kit |
|---|---|---|
| A display serif · condensed caps or mono for labels · one handwritten accent | (M, all strong reels) | Instrument Serif · Anton / JetBrains Mono · Caveat (all OFL, bundled) |
| On-screen titles are short | 2–5 words (S) | — |
| Test legibility in motion, not just in stills | (S) | render a draft; QA.md |
| Vox's website faces (Harriet, Balto) are commercial; the video faces are unpublished | (S) | use the bundled free faces |

## 7. Colour: neutral frame, 1–3 accents, each with a job

- Measured accent sets (M): red #B92E34 + orange #F07239 + cyan #39AED4 · red-orange #F42B00 alone · yellow #F1C633 + blue #2B54A9 + red · yellow #FDF100 + pink #E64371.
- One reel's on-screen style key: *"three accents only… use colour only to carry information"* (S).
- Default kit roles: yellow = highlight · red = pen marks, pins, alarm · blue = maps and water. Everything else is paper and ink.

## 8. Edit: fast, physical cuts

| Rule | Numbers |
|---|---|
| Cut rate in collage segments | **8–13 cuts per 10 s** (shots of 0.75–1.25 s). Explainer or tool segments 4–5 per 10 s (M) |
| Cut on content (the word, the beat), not on a grid | (S) |
| Transitions are physical: a hard cut at peak velocity, a paper tear, a page peel, a push through a torn hole. **Never a dissolve** | (M, S) |
| "Cut the curve": cut on the fastest frame of one eased move | ~0.6 s, travel ~12% of the frame, optional 8–10 px blur (S) → `curveCut()` |
| Text match cut: 12+ pages with the same word, centred, ~8 frames each and shortening, with a camera click on every cut | (S) |

## 9. Sound is half the look

| Rule | Numbers |
|---|---|
| Voice pace | **~210–225 wpm** in the strongest reels (M) |
| A continuous low bed under the voice | **11–16 dB under the speech median** (M); documentary music **18–24 dB** under the voice (S) |
| Deliver loud and even | Reels measured −14.1 to −14.6 LUFS (likely Instagram normalisation), LRA 1.3–3.6 LU (M); YouTube ~−14 LUFS (S) |
| SFX follow the action and the words | Paper on entrances, marker on highlights, keys on type-ons, a click on landings; whoosh peak on the fastest frame; leave ~80 ms for a separate impact (S) |
| Don't put a whoosh on every cut | Same sweep on every cut = amateur (S) |
| Never digital silence | Room tone at about −42 dB (P) → `init({ roomTone: -42 })` |

Full detail: [SOUND.md](SOUND.md).

---

## The 16 amateur tells (check every render against these)

1. A flat background (#000, #FFF or one flat colour) behind everything. Swap @chrismoran__'s layered background for black and it "instantly loses that editorial feel".
2. Pure #000 inside photos. Untinted blacks punch holes in the paper.
3. Perfectly smooth 30/60 fps collage motion. It looks like a slideshow or a template. (@chrismoran__ calls on twos "that organic choppy feel".)
4. "iMovie slideshow" moves: one flat image with a uniform Ken Burns zoom and no layers.
5. Everything animating at once.
6. Uniform timing: every element in with the same duration and delay, whatever the voice says.
7. Every card square to the frame, or every card tilted the same way.
8. The same drop shadow on everything, or no shadow anywhere.
9. Too many fonts, or default system sans everywhere.
10. Rainbow accents: four or more saturated colours with no meaning.
11. Dissolves and crossfades.
12. Grain as a heavy, smooth, every-frame noise filter.
13. Generated text inside AI images. Keep text out of the image and add it in the edit.
14. Captions that fight the art: big, bright, full-width boxes.
15. Glossy 3D renders or clean vector characters mixed into a paper collage.
16. No provenance: borrowed footage with no "archive / from X" chip.
