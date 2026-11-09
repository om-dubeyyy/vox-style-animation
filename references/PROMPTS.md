# Prompts for Claude Code

Paste these into Claude Code with this skill installed. Swap the parts in [brackets].

## 1. From a topic to a finished video

```
Use the vox-style-animation skill. Make a [45]-second vertical explainer: "[How did the Moon landing run on 4 KB of RAM?]".
1. Research it and write a script at ~215 wpm with a hook, context, turn, proof and payoff. Cite every fact in SOURCES.md.
2. Find public-domain or CC0 images for each beat (NASA, Library of Congress, Smithsonian Open Access, Wikimedia with a
   licence check). Save them to videos/<name>/assets/ and list each licence in its SOURCES.md.
3. Write the shot list (references/SCRIPT.md format). One main motion per row, one recurring visual idea.
4. Run `npm run new -- <name>` in the skill folder and build videos/<name>/index.html with the kit. Render stills at every scene change, check them against references/QA.md,
   fix, then render the MP4 with a GIF preview.
```

## 2. Animate to my voice-over

```
Use the vox-style-animation skill. My voice-over is vo.wav and my script is script.txt. Run scripts/words.py on vo.wav
(--inject the page), then build the shot list so every highlight, circle, badge, card and cut lands on its word via
V.wordmap("#words"). Use the photos and clips in assets/. Render with --no-sfx, then mix with scripts/doc_mix.py:
the narration as the reference, recorded foley set by peak and peak-aligned on the words, [bed.mp3] 22 LU under.
```

## 3. Restyle something I already made

```
Here is my explainer (videos/<name>/index.html, or these frames). Audit it against references/LOOK_BOOK.md and the 18 amateur
tells. List each problem with the frame time and the fix, then apply the fixes and re-render stills so I can compare.
```

## 4. A single effect

```
Using the vox-style-animation kit, make a 6-second 1080×1920 clip: a newspaper-style document card on paper, the phrase
"[the exact words]" gets the yellow highlighter on beat 1.2 s, then a red pen circle around "[number]" at 2.6 s,
a slow push the whole time (+2%/s), and a curve cut out to [next image] at 5.2 s.
```

## 5. A map

```
Make a map scene with scripts/map.mjs: [Mercator] map fitted to [France, Germany, Poland], highlight [Poland], pins at
[Warsaw, Berlin] with labels, a dashed route Berlin → Warsaw drawn over 1.6 s, slow push in. Check borders. 1080×1920, 6 s.
```

## 6. Review my render (fresh eyes)

```
Render stills of my-video at 0.5 s intervals (--stills). Look at every still at phone size. Grade it 1–10 on each part of
references/QA.md (picture, motion, sound, truth and rights) and list the top 5 fixes with frame times. Be harsh. Then fix them.
```

## 7. Turn a reference reel into a spec

```
Here are frames from a reel I like ([paths]). Measure what you can: paper hex (sample pixels), card rotation, border
as % of width, shadow, cut rate, push speed in %/s, type voices, accents. Write a "locked style key" (palette, type,
textures, motion rules, transitions, sound) that I can reuse for every video, in the format of references/LOOK_BOOK.md.
```

## Prompting tips

- Give Claude **the voice-over first**. Timing from words beats timing from guesses.
- **Hand it your own pictures and clips.** Without them it has to guess, and a guessed video looks cheap at once (try `--query noimg` to see it).
- Ask for **stills before the full render**. It's 30× faster to fix a still.
- Name the **one recurring visual idea** ("everything is a document on a desk").
- Say **which accent means what** ("yellow = the key phrase, red = numbers we question").
- Keep generated images free of text. Add all text in the page.

## 8. A 10-second debunk hook

```
Use the vox-style-animation skill. Make a 10–12 s, 16:9 Vox-style explainer, rendered at --scale 2:
"[The claim everyone repeats?] Not really. Here's the data."
- Real numbers only, each with its primary source in SOURCES.md. Leave out any claim the data doesn't carry.
- Use only the images and clips in ./assets. Don't generate or guess any.
- Five beats (references/SCRIPT.md §7). The claim readable in frame 1.
- Object life on every held card (breathe, float), one or two scraps, a ghost of the real document, a zoomCut before
  "Here's", a holePush into the sources. Paper and camera still.
- Write a narration script with a direction per line at ~155 wpm. Time everything from its words (scripts/words.py).
- Mix with scripts/doc_mix.py: recorded foley, peak-aligned, under the narration; stems on.
- Show me 5 stills before you render.
```

## 9. An honest before/after

```
Make the "before" for my video: the same video (same topic, footage and story) built badly, using LOOK_BOOK's amateur
tells on purpose: flat white background, a cheap red serif "VOX" with a hard shadow, rainbow Arial and a Comic Sans
kicker, untinted square photos with one heavy shadow, everything fading in at once, uniform smooth zooms, a bright
caption bar, a crossfade into a glossy rainbow chart. It must still read as a Vox attempt. Start it on the claim.
Then render the real one with --query noimg too, for a "don't let it guess" comparison.
```
