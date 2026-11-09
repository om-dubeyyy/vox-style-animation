# QA: check before you post

Render stills at the key moments first (fast), then the full video:

```
node scripts/render.mjs videos/my-video/index.html --stills 0.5,2,4.5,8,12   # PNGs in videos/my-video/stills/
node scripts/render.mjs videos/my-video/index.html --scale 0.5 --from 4 --to 9   # quick half-size draft of one section
node scripts/render.mjs videos/my-video/index.html --voice vo.wav --gif       # final + preview GIF
```

Look at every still at **phone size** (about 360 px wide) and at full size. Claude Code can read the PNGs and check them for you (see PROMPTS.md, "Review my render").

## Picture

- [ ] No pure white or pure black anywhere large. Paper is #D9D4CF–#F3F2F3 (or your chosen tone); dark scenes are #131313–#231C18.
- [ ] Every photo is tinted (lifted blacks, slightly muted). No photo has a pure-black hole.
- [ ] Cards are rotated ±1.5–3°, and not all the same way. Back cards up to ±6°.
- [ ] Borders are 2.4–5% of the card width. Shadows are soft and darker at the contact edge.
- [ ] Per shot: cut-outs **or** cards, not a random mix.
- [ ] One colour object per frame; everything else greyscale or muted. Accents: three at most, each with one job.
- [ ] Three type voices at most. Titles are 2–5 words.
- [ ] Text is readable at 360 px wide, **while it moves**.
- [ ] Nothing important sits in the top ~12% or bottom ~20% of a 9:16 frame (UI overlays on Reels and TikTok).
- [ ] Grain and dust are visible only if you look for them. Paper texture is felt, not seen.
- [ ] Frame 1 already shows the claim, readable. No near-empty paper while things slide in.
- [ ] Solid highlight boxes don't touch the line above. On tight headlines (line-height under ~1.0) give the boxed word its own line box (`display: inline-block; line-height: 1; margin-top: .16em`).
- [ ] Any picture the story needs is a real one. Compare with `--query noimg`: if the grey "?" version tells the story just as well, the pictures aren't doing their job.
- [ ] Shown at 4K anywhere? Render the master with `--scale 2`, so nothing is upscaled later.

## Motion

- [ ] Collage motion is on twos (`onTwos: true`). The voice and any face cam are untouched.
- [ ] In each shot, **one thing** moves at a time (plus the slow push).
- [ ] But nothing held is dead still: photos breathe inside their cards (`breathe`), cards float 2–3 px (`float`), a scrap drifts past the lens. The paper and camera stay still.
- [ ] Holds push at +1–3 %/s; emphasis +4–6 %/s; hooks +15 %/s or more.
- [ ] Every annotation lands **on its word** (check against the transcript).
- [ ] No dissolves. Transitions are cuts, curve cuts, whips, tears or wipes.
- [ ] Collage sections change something every ~1 s. Long holds only on the payoff.
- [ ] Hand-drawn lines draw on (0.17–0.45 s) and then hold; boil only if it's part of the idea.

## Sound

- [ ] The voice is clear and even. Music is 18–24 dB under it and ducks while it talks.
- [ ] SFX are on key actions only, 6–12 dB under the voice. Not a whoosh on every cut.
- [ ] Each whoosh peaks on the fastest frame. Landings get a click or thud only when something visibly stops.
- [ ] No digital silence (room tone is on). With real room tone, about −48 LUFS, added after the master gain; check the waveform between hits for hiss pumping.
- [ ] For a final: recorded foley, not the kit's synthesized placeholders.
- [ ] Each hit's **peak** lands on its frame (`"align": "peak"` in doc_mix).
- [ ] Listen to the loudest moment: no effect is louder than the voice. Effects are never mastered on their own.
- [ ] The master is about −14 LUFS and the true peak is under −1 dBTP. The renderer does this; check with `ffmpeg -i out.mp4 -af ebur128 -f null -`.

## Truth and rights

- [ ] Every fact checked against a primary source. Write the sources in `SOURCES.md`.
- [ ] Every image's licence is known and written down. No Texturelabs files or commercial fonts committed to a public repo.
- [ ] Borrowed footage is labelled on screen ("Archive · NASA"), or, where the channel bans on-screen chips, every source and every CC BY-SA photographer is credited in the caption.
- [ ] Maps: disputed borders checked.
- [ ] No fake documents presented as real. A typed "fact sheet" card is fine; a forged letter, receipt or headline is not.
- [ ] Not using the Vox logo. If the creator wants the word "Vox" on screen as a style cue, it's set in a free font and the piece says "Vox-style" somewhere; the creator knows the trademark risk.

## The 18 amateur tells

Re-read the list at the bottom of [LOOK_BOOK.md](LOOK_BOOK.md). If a still shows any of them, fix it before rendering the final.
