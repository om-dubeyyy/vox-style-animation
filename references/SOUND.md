# Sound

Vox staff list sound design as a core pillar, next to narration, animation and data. Sound effects "follow the expert's words" (S). Most amateur Vox-style videos have a voice and a stock track and nothing else. That gap is the cheapest place to look more professional.

## The mix, top to bottom

| Layer | Level | Notes |
|---|---|---|
| Voice-over | the reference (0 dB) | Compressed and even. Strong reels run about **210–225 wpm** (M). Record in a quiet, soft room; you can't fix a roomy voice later. |
| SFX | **6–12 dB under the voice peaks** | Short and on the action. Paper, marker, keys, clicks. |
| Music | **18–24 dB under the voice** for documentary or history; 15–20 dB for sparse emotional pieces; duck a further **3–6 dB** while the voice talks (S) | The renderer does this: `--music-db -22` plus a sidechain duck. |
| Room tone | about **−42 dB** | So there is never digital silence between lines. `init({ roomTone: -42 })` |
| Master | **−14 LUFS integrated, −1 dBTP** | The renderer runs `loudnorm`. The measured reels sit at −14.1 to −14.6 LUFS with LRA 1.3–3.6 LU. |

If you mix by hand, this "music under voice" chain works well. It lowers the music, cuts it where speech lives (~2.2 kHz) and rolls off the top:

```
ffmpeg -i voice.wav -i music.wav -filter_complex "[1:a]volume=-20dB,equalizer=f=2168.5:t=q:w=0.3:g=-11.5,lowpass=f=2500[m];[0:a][m]amix=inputs=2:normalize=0:duration=first[a]" -map "[a]" mix.wav
```

## Which sound goes with which move (the kit does this for you)

| Visual | Sound | Kit default |
|---|---|---|
| Card slides or rises in | paper slide | `enter(el, t, "rise")` → `paper_slide` at the start |
| Card dropped onto the desk | soft thud on the *landing* frame | `drop` → `card_drop` at 92% of the move |
| Label or number pops | small pop | `pop` → `pop` |
| Stamp | thud + slap at impact | `stamp` → `stamp` |
| Archival photo slides in fast | camera shutter or projector | `archive` → `shutter` |
| Text types on | one key per character, slightly uneven rhythm | `type()` → `type_key_0..5` |
| Highlighter | felt-marker swipe | `highlight()` → `highlighter` |
| Circle, arrow, underline | pen scribble | `circle()`, `arrow()` → `pen_scribble` |
| Counter rolls | ticks, fading | `count()` → `tick` |
| Map pin | soft ping | `pin()` → `map_ping` |
| Route draws | low whoosh | `route()` → `whoosh_low` |
| Curve cut | fast whoosh peaking on the cut | `curveCut()` → `whoosh_fast` 0.14 s before the cut |
| Whip pan | whoosh | `whip()` → `whoosh` |
| Paper wipe | paper slide + air | `paperWipe()` |
| Title or reveal | sub hit; a riser into it | add `sfx("sub_hit", t)`, `sfx("riser", t - 2.2)` |
| Archival section | projector loop under it | `sfx("projector_loop", t, { gain: -24, loop: true, until: t + 6 })` |

Turn any of them off with `{ sfx: false }`, or change the level with `{ gain: -14 }`.

## Craft rules for SFX (sources in REFERENCES.md)

- **Whoosh peaks at the fastest frame** of the move or on the cut. Short, medium and long variants exist for a reason: ~180 ms for a small card crossing 10% of the screen, ~0.5 s for a title, ~1.1 s for a fly-by (S).
- **Build a whoosh from layers**: air + a texture (paper, canvas, brush) + an optional tone, plus a landing click *only when something visibly stops*. Leave ~80 ms between the whoosh and a separate impact (S).
- **Don't**: the same sweep on every cut; big sounds on small gestures; stereo sweeps that collapse badly in mono (phones); tails that run into the next line (S).
- SFX on **key** actions, not every movement. If four things land in a second, give one of them the sound.
- Music changes roughly every **20 s** in Vox explainers, cut to the beat (S, unverified claim; treat as a starting point).
- A stripped-down edit with **no** music is a valid choice. A Vox showrunner praised exactly that (S).

## The bundled sounds

`kit/sfx/` holds 25 sounds **synthesised in code** by `scripts/make_sfx.py`. Nothing is sampled, so they are covered by this repo's MIT licence; use them anywhere. Regenerate them with `python3 scripts/make_sfx.py` (numpy + scipy).

paper_slide · paper_rustle · card_drop · whoosh · whoosh_fast · whoosh_low · pen_scribble · highlighter · type_key_0–5 · bell_ding · pop · tick · stamp · riser · sub_hit · shutter · tape_rip · map_ping · projector_loop · room_tone

They are good, clean placeholders. For a richer mix, swap in recorded sounds with `sfx("my_sound", t, { src: "sounds/real-paper.wav" })`.

## Free sound and music libraries (check each item's licence)

| Source | Licence | Watch out for |
|---|---|---|
| [Freesound](https://freesound.org) | Each sound is CC0, CC BY (credit needed) or CC BY-NC (no commercial use) | Filter by licence; keep a credits file |
| [Pixabay audio](https://pixabay.com/sound-effects/) | Free use, no attribution | Can't resell the sounds unchanged |
| [Mixkit](https://mixkit.co/free-sound-effects/) | Free licence, commercial OK, no attribution | Some items are "Restricted" (non-commercial) |
| Sonniss GDC Game Audio Bundle | Royalty-free, no attribution (per the bundle licence) | Read the licence file in the download |
| YouTube Audio Library / Instagram's in-app music | Free for those platforms | Platform-only; don't export elsewhere |

Never use a commercial song you don't have a licence for. One Vox music video would have cost **$20,000** to license (S).
