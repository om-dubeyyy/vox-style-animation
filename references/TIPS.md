# Tips from finished videos

What a short documentary in this look needs beyond the look book's rules. Each tip is a mistake a first cut tends to make. Read it before a short hook or a debunk.

## Picture

1. **Paper still, objects alive.** "Only one thing moves" means one *main* move at a time. Everything else on screen still breathes: the photo pushes inside its card, the card floats 2–3 px, a scrap drifts past the lens. A card that sits dead still between its entrance and its exit is the most common "slideshow" tell. → `breathe()`, `float()`, `scrap()`, `ghost()` (LOOK_BOOK §10).
2. **Real footage inside the cards beats stills.** Moving pictures in a taped, tinted, tilted card read as a documentary at once. Play the clip on the 12 fps grid like the rest of the collage. → `footage()`.
3. **Open on the claim, from frame 1.** Near-empty paper while things slide in wastes the hook. The claim should be readable in the first frame.
4. **Build the piece in the pure look first.** Don't mix other styles into it (a window-light collage, a tutorial UI). Make the explainer on its own, end to end (picture, then narration, then mix), and only then package it.
5. **16:9 for a documentary piece.** It looks like the real thing, and it sits uncropped in a 16:9 band inside a 9:16 video.
6. **Hand it real pictures; don't let it guess.** The same page with grey "?" boxes (`?noimg`) looks cheap at once. If the "?" version tells the story just as well, the pictures aren't doing their job.
7. **The word "Vox" vs the Vox logo.** If you want the wordmark look, set the word in a free serif behind the subject and label the piece "Vox-style" somewhere. Never the logo file; it implies endorsement.
8. **Render the master at 2× if it will ever be shown at 4K.** Enlarging a 1080p master later softens every edge. `render.mjs --scale 2` draws everything natively at 3840×2160.

## Timing

9. **Every cue on a word.** One words file (`scripts/words.py`) drives the page (`VOX.wordmap`) and the mix (`doc_mix.py --words`), so a re-recorded line re-times everything with one run and nothing is re-timed by hand. The red pen strikes on "Not", the zoom cut lands just *before* "Here's", the bars rise on the number, the highlighter hits the payoff.

## Sound

10. **The kit's synthesized sounds are placeholders.** For a final, use recorded foley. Paper, pen, stamp, typewriter, projector and room tone are what make it sound like a desk, not an app.
11. **Mix effects under a voice, never as the whole mix.** Narration first; effects about 13 LU under; music about 22 LU under; set each sample by its own peak and cap its true peak; land the peak on the frame; room tone last. → `scripts/doc_mix.py` (SOUND.md).
12. **Narration for a documentary runs about 150–165 wpm,** slower than someone talking to camera (210–225). Write the script with a direction per line ("dry, sure", "land it, warm"). Speed a slow read up with rubberband, not atempo. → `scripts/narration.py`.

## A 10–12 s debunk, shot by shot

The five beats of SCRIPT.md §7, as they come together in a 12 s, 16:9 piece.

| Time (s) | Beat | Picture | Sound |
|---|---|---|---|
| 0–4.0 | The claim | Dark layered ground (#1E1B18); a ghost of the source document at ~9%; a huge cream serif word behind a taped footage card (breathing, floating); a torn halftone scrap drifting past; the claim in white, word by word | paper slide; one topic sound, kept small |
| 4.0–4.9 | "Not really." | A red pen strikes the key word on "Not"; a red note drops on "really" and floats | pen scribble on "Not"; paper quick-move + a paper landing |
| 4.9 | (cut) | `zoomCut`: the claim zooms 1.16× and blurs into the cut; the data arrives from the same zoom | fast whoosh + sub hit, both peaking on the cut |
| 4.9–8.3 | The data | "Here's the data" stamped; a typed fact sheet; bars rising on their words; highlighter on the key term, pen underline on the turn | rubber stamp on "Here's"; paper scroll; one typewriter click per bar; marker; pen |
| 8.3–8.6 | (into the concession) | `holePush`: the page tears around the chart and the camera pushes through | tape rip + a low wind peaking as the hole fills the frame |
| 8.6–10.8 | The concession | A satellite or archive bed at ~30%, pulling out slowly; three footage cards drop with shutters; a source strip with risograph speckle; the thing everyone blames as a small cut-out with a glow, pen circle, hand label and arrow | projector run low; shutters; marker |
| 10.8–12.3 | The payoff | A photo card with footage drops in; a count rolls to the number that reframes it; the payoff line with the highlighter on its key words | paper slide + landing; typewriter clicks on the count; marker |

## Truth on screen

- Every number has a primary source. Credit it on screen, or in the post caption where the channel bans on-screen chips.
- Leave out claims the data doesn't support, even popular ones, and any number with no source.
- Be exact about what a share means. A share of a *year* is not the share on the worst night; never shorten it into a claim it doesn't make.
- Maps of disputed areas: a satellite crop with no borders drawn avoids the problem (ASSETS.md).

## Delivery tricks

- **Stems:** narration, music and effects at the final gain (`doc_mix.py --stems`), so an edit can mute the narrator under a different voice-over.
- **Theme variants from one page:** a `?theme=` switch with CSS variables gives several looks of the same timeline, with the same timing and sound.
- **Solid highlight boxes on tight headlines:** at line-height below ~1.0 a filled box behind a word reaches into the line above. Give the boxed word its own line box (`display: inline-block; line-height: 1; margin-top: .16em`), or open the leading on that line.
- **Alpha layers for an editor:** render the overlay page twice, on black and on white. alpha = 1 − (white − black) luma, colour = black render ÷ alpha. Encode ProRes 4444 with alpha.
- **"From this → to this":** build the "before" as the *same* video made badly (PROMPTS.md §9), start it on the claim, and hard-cut to the real one with a whoosh and a sub hit.
