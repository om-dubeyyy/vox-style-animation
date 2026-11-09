# Sound

Vox staff list sound design as a core pillar, next to narration, animation and data. Sound effects "follow the expert's words" (S). Most amateur Vox-style videos have a voice and a stock track and nothing else. That gap is the cheapest place to look more professional.

## The mix, top to bottom

| Layer | Level | Notes |
|---|---|---|
| Voice-over | the reference (0 dB) | Compressed and even. Strong reels run about **210–225 wpm** (M). Record in a quiet, soft room; you can't fix a roomy voice later. |
| SFX | **6–12 dB under the voice peaks**; about 13 LU under the narration overall (P) | Short and on the action. Paper, marker, keys, clicks. Set each sample by its own loudest 10 ms and cap its true peak (`scripts/doc_mix.py`). |
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

Treat them as **placeholders**. In a finished video the synthesized ticks, pop and chime sound like an app; recorded foley fixes it. For a final, use recorded sounds: `sfx("my_sound", t, { src: "sounds/real-paper.wav" })` in the page, or turn the kit's cues off (`{ sfx: false }`, `render.mjs --no-sfx`) and mix with `scripts/doc_mix.py` (below).

## Free sound and music libraries (check each item's licence)

| Source | Licence | Watch out for |
|---|---|---|
| [Freesound](https://freesound.org) | Each sound is CC0, CC BY (credit needed) or CC BY-NC (no commercial use) | Filter by licence; keep a credits file |
| [Pixabay audio](https://pixabay.com/sound-effects/) | Free use, no attribution | Can't resell the sounds unchanged |
| [Mixkit](https://mixkit.co/free-sound-effects/) | Free licence, commercial OK, no attribution | Some items are "Restricted" (non-commercial) |
| Sonniss GDC Game Audio Bundle | Royalty-free, no attribution (per the bundle licence) | Read the licence file in the download |
| YouTube Audio Library / Instagram's in-app music | Free for those platforms | Platform-only; don't export elsewhere |

Never use a commercial song you don't have a licence for. One Vox music video would have cost **$20,000** to license (S).

## Recorded foley that works

A tested set for a 12 s Vox-style doc, with the level each sample's loudest 10 ms was set to (dBFS, before the master gain, with the narration at −16 LUFS). More in [TIPS.md](TIPS.md).

| Job | Sample | Level | Notes |
|---|---|---|---|
| A card or print slides in | Mixkit 1530 paper slide | −27 | peak 0.36 s into the file |
| A note is dropped… | Mixkit 2380 paper quick movement | −28 | peak 0.29 s |
| …and lands | Mixkit 386 newspaper falling | −26 | peak 0.16 s |
| A fact sheet slides in | Mixkit 2383 paper scroll office | −28 | |
| Pen strike, circle, underline | Mixkit 2369 writing scribble on paper | −23 to −31 | peak 0.15 s; trim to 0.25–0.4 s |
| Highlighter | Mixkit 2998 pen marker line | −24 to −31 | trim to 0.45–0.55 s |
| Type-on, bar values, a count | Mixkit 1125 typewriter soft click | −31 to −33 | one per word/bar, 0.06–0.12 s apart, each a touch quieter |
| An archive print slaps down | Mixkit 1133 shutter camera click | −27 to −29 | |
| "Here's the data" stamped | **bundled** `kit/sfx/cc0/rubber_stamp.mp3` | −19 | clean hits at 3.22, 6.19, 9.14 s: `"ss": 3.22` |
| The page tears | Mixkit 3102 duct tape rip | −21 | the rip is 1.3–2.0 s in: `"ss": 1.35` |
| Push through the hole | Mixkit 1468 swoosh wind cinematic | −27 | peak 0.31 s, on the moment the hole fills the frame |
| A curve or zoom cut | Mixkit 3115 swoosh fast + 2299 bass hit short | −23 / −19 | peaks 0.116 s / 0.085 s: both peak **on** the cut |
| Archive section bed | **bundled** `kit/sfx/cc0/film_projector_start.mp3` | −33 to −36 | steady 2–9 s: `"ss": 3.0` |
| A topic sound (fireworks, fire) | Mixkit 2994 / 3104 fireworks, 1330 campfire crackle | −25 / −29 / −36 | keep topic sounds small; they are not the subject of the mix |
| Room tone | **bundled** `kit/sfx/cc0/room_tone_office.mp3` | −48 LUFS | after the master gain |
| Music bed (no track) | **bundled** `kit/sfx/cc0/pad_deep_pulses.mp3` | 22–23 LU under the voice | with the make-room-for-vocals EQ |

Mixkit's free licence covers use in your videos but not redistribution, so those aren't bundled: download them from [mixkit.co](https://mixkit.co/free-sound-effects/) by name (the preview file for an ID is at `assets.mixkit.co/active_storage/sfx/<id>/<id>-preview.mp3`). The four bundled ones are CC0 from Freesound (`kit/sfx/cc0/SOURCES.md`). Two whooshes are plenty for 12 s.

## The real-foley mix: `scripts/doc_mix.py`

```
node scripts/render.mjs videos/x/index.html --no-sfx --out videos/x/silent.mp4
python3 scripts/doc_mix.py videos/x/silent.mp4 --cues videos/x/cues.json --words videos/x/index.html \
        --voice vo.wav --vo-at 0.10 --music kit/sfx/cc0/pad_deep_pulses.mp3 --room kit/sfx/cc0/room_tone_office.mp3 \
        --out videos/x/final.mp4 --stems
```

Cues are a JSON list (`examples/object-life/cues.json` is a working one): a sample, a time **or a spoken word** (`"t": "here's"`, `"moon#2"`), a level, and `"align": "peak"` to land the sample's loudest moment on that time. What it does, and why (each step fixes a common mistake):

- **The narration is the reference.** It sits at −16 LUFS; music goes 22 LU under it with the make-room EQ; every effect is set by its own peak. One gain then brings the sum to −14 LUFS, and a limiter catches the peaks.
- **Peak AND true peak.** Levelling by average loudness let pen squeaks and a tape rip jump out. Each sample is set by its loudest 10 ms and capped at 8 dB above that by its true peak.
- **Peaks land on the frame.** A stamp, a sub hit or a whoosh only feels "on" the moment when its peak is on it, not its start.
- **Room tone last,** at about −48 LUFS. Normalised with the rest, it pumped up into hiss in the gaps.
- **Never an effects-only master.** With no voice to sit under, the effects get normalised up and the first big hit (a firework on frame 1) becomes the loudest thing in the video. If the video has no narration, still set the effects where they'd sit under one, and listen to the loudest moment.
- **Stems** (`--stems`): narration, music and effects at the final gain, so an edit can drop the narrator under a different voice-over.

## Narration

- **Pace:** a documentary narrator reads at about **150–165 wpm**, slower than a creator talking to camera (210–225).
- **Script it with a direction per line** ("a real question, slightly sceptical" · "dry, sure" · "land it, warm"), one take, ~0.2–0.3 s between lines, 0.3 s of silence at both ends, WAV, no music.
- **A scratch voice first** (any local TTS) lets you time and mix the whole piece before the real read arrives. Because every cue is looked up by word, the real read re-times everything with one run of `scripts/words.py`.
- **Assemble line takes** with `scripts/narration.py`: it keeps the speech, cuts pauses inside lines to 0.18 s, sets the beat between lines, and speeds a slow read up with rubberband (pitch and formants kept). A slow 115 wpm read lands near 154 wpm at 1.33×. Plain `atempo` is fine up to about 1.15×.
