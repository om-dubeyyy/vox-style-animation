---
name: vox-style-animation
description: Make Vox-style editorial explainer animations (paper collage, photo cards, highlighter, pen circles, maps, curve cuts) that look professional, as code — HTML + GSAP rendered to MP4 with synced sound. Use for any "Vox style", "Johnny Harris style", paper-cutout or editorial collage video, explainer animation, or to audit/fix one that looks cheap.
---

# Vox-style animation

You make short explainer videos in the editorial collage look: paper backgrounds, tinted photo cards with borders and shadows, a yellow highlighter on the key phrase, red pen circles and arrows, maps with pins, collage motion on twos, and physical cuts, all with sound designed in. The kit is in `kit/`, the renderer in `scripts/`, and the craft rules in `references/`.

**The rule above all rules: the picture must carry the argument.** Decoration over a weak point is still a weak video. The second rule: **it should look made by hand, on purpose.** Every default in the kit adds a small physical imperfection or removes a digital perfection.

## Before you build: read these

1. `references/LOOK_BOOK.md`: what makes it look pro, with measured numbers and the 18 amateur tells. **Always read it.**
2. `references/SCRIPT.md`: question → archive → script → shot list. Read it when you are writing or timing.
3. `references/API.md`: every kit call. Read it before writing the page.
4. `references/TIPS.md`: tips from finished videos (picture, timing, sound, truth, delivery) and a 10–12 s debunk shot by shot. **Read it before a short hook or a debunk.**
5. `references/SOUND.md` (recorded foley, the documentary mix, narration), `references/ASSETS.md` (licences!), `references/QA.md` as needed.

## Workflow

1. **Question and script.** One answerable, surprising question with something to show. Hook → context → turn → proof → payoff (a 10 s debunk: claim → "not really" → data → concession → payoff, SCRIPT.md §7). About 215 wpm when a creator talks; about 150–165 wpm for a documentary narrator, with a direction on each line. Cite every fact in `SOURCES.md`, and never invent numbers, quotes or documents; leave out claims the data doesn't carry.
2. **Archive first.** Find the images and **real footage** before you finish the script: NASA, the Library of Congress, Smithsonian Open Access, Wikimedia, Pexels (check each licence; contact-sheet every clip for watermarks and burned-in text). Footage inside the cards reads as documentary; stills alone read as a slideshow. Record file, URL, licence and credit. Never commit Texturelabs files or commercial fonts. No Vox logos or footage. Never let the model guess the pictures (`--query noimg` shows how cheap that looks).
3. **Shot list.** One row per spoken phrase, with times from a **word-level transcript** of the voice-over: `python3 $SKILL/scripts/words.py vo.wav --inject <page>`, then `const w = V.wordmap("#words")` in the page and the same words in the mix, so a re-recorded line re-times everything. One main motion per row. Pick **one recurring visual idea** for the whole video. Name the cut at every scene change (hard cut, `curveCut`, `zoomCut`, `holePush`, `whip`, `paperWipe`; never a dissolve).
4. **Build.** Work **inside this skill's folder** (the one with this SKILL.md; call it `$SKILL`, usually `~/.claude/skills/vox-style-animation`). Run `cd $SKILL && npm run new -- <name>`; it creates `videos/<name>/index.html` with every path set. For a project elsewhere, run `node $SKILL/scripts/new.mjs <name> --dir <folder>`. Don't copy pages by hand: the `../../kit` paths only work two levels below the skill folder. Put images in `videos/<name>/assets/` and log them in its `SOURCES.md`. Keep the defaults unless there's a reason:
   - paper, not white; tinted photos; cards ±1.5–3°, with 4% borders and soft shadows;
   - `onTwos: true` (12 fps collage motion); the paper holds still (`drift: 0`), **but the objects breathe**: `breathe()` on every held photo, `float()` 2–3 px on cards and cut-outs, one or two `scrap()`s past the lens, a `ghost()` of the real document behind (LOOK_BOOK §10);
   - the claim readable in frame 1; real clips in cards with `footage()`;
   - pushes at +1–3 %/s on holds, +4–6 %/s for emphasis;
   - annotations on their words; three type voices; 1–3 accents, each with one job;
   - on 9:16, nothing important in the top 12% or the bottom 20% (the platform UI covers it).
   `examples/apollo/index.html` shows almost every helper. For maps, use `node $SKILL/scripts/map.mjs …`. To pre-treat a still or clip, use `python3 $SKILL/scripts/photo_treat.py`.
5. **Check stills first.** Run `node $SKILL/scripts/render.mjs videos/<name>/index.html --stills t1,t2,…` at every scene change and annotation. **Open the PNGs and look at them.** Go through `references/QA.md` and fix every problem. If the render stops with a page error, the message names the helper and the target that's missing.
6. **Render.** For drafts, `node $SKILL/scripts/render.mjs videos/<name>/index.html --voice vo.wav [--music bed.mp3] --gif` mixes the kit's synthesized cues in (music −22 dB and ducked, room tone, −14 LUFS). **For a final, use recorded foley:** render with `--no-sfx`, then `python3 $SKILL/scripts/doc_mix.py silent.mp4 --cues cues.json --words <page> --voice vo.wav --music … --room $SKILL/kit/sfx/cc0/room_tone_office.mp3 --out final.mp4 --stems` (narration as reference, every sample set by its peak and peak-aligned on its word; SOUND.md). Never master effects on their own. If the video will ever be shown at 4K, render with `--scale 2` (a native 3840×2160 master).
7. **Final check.** Pull frames from the MP4 at the transitions. Confirm the loudness with `ffmpeg -i out.mp4 -af ebur128 -f null -`. Then report what you made and its sources and licences.

## Setup (once per machine)

```
npm install                      # gsap, playwright, d3-geo, topojson-client, world-atlas
npx playwright install chromium  # the renderer's browser
# optional, to regenerate the textures and sounds: pip install numpy scipy pillow
# optional, for words.py and doc_mix.py: pip install faster-whisper numpy
# optional, for narration.py's voice-preserving speed-up: an ffmpeg with rubberband (macOS: brew install ffmpeg-full)
```

You need Node 18+ and ffmpeg 4.4+ on the PATH. The kit is plain browser JavaScript; there is no build step. For the browser preview, run `npm run preview`, leave it running, and open `http://localhost:8080/videos/<name>/`.

## Non-negotiables

- Real facts only, with sources. A typed "fact sheet" card is fine. A forged letter, receipt or headline presented as real is not.
- Every image's licence is known. Borrowed footage gets an on-screen chip ("Archive · NASA"), or a caption credit where the channel bans on-screen chips.
- Don't use the Vox logo or footage. "Vox-style" describes a look; the logo implies endorsement. If the user wants the word "Vox" on screen as a style cue (many Vox-style reels do), set it in a bundled free serif, keep a "Vox-style" label somewhere, and tell them the trademark risk; it's their call.
- Check disputed borders on maps.
- Keep text out of AI-generated images; add all text in the page.
- Maps of India (and other disputed areas): Natural Earth's borders are de-facto, not official. See ASSETS.md before you publish.

*Not affiliated with, endorsed by, or connected to Vox Media. "Vox" is a trademark of Vox Media, LLC.*

## When the user's video "looks cheap"

Grab stills and walk the 18 amateur tells in LOOK_BOOK.md. The usual fixes, in order of impact:
1. Paper background and photo tint.
2. Motion on twos, with one thing moving at a time.
3. Annotations keyed to the words.
4. Card rotation, border and shadow.
5. Objects dead still between entrance and exit: add `breathe`, `float`, a `scrap`.
6. Sound: recorded foley on key actions, peak-aligned, under the voice; music 18–24 dB under the voice.
7. Replace dissolves with cuts.
