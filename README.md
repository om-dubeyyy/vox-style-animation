# vox-style-animation

**Make Vox-style explainer animations that look professional, not like a template.**
It is a Claude Code skill and a standalone kit: paper collage, photo cards, a highlighter, pen circles, maps and curve cuts, written in HTML + GSAP and rendered to MP4 with the sound already designed in.

![Before and after: the same scene with the pro details off and on](media/before-after.gif)

*Same timeline, same assets. Left: every "pro" detail switched off (`?plain`). Right: the kit's defaults.*

---

## Why most "Vox-style" videos look cheap

I studied 9 reels about this style frame by frame (the strongest have 474K–1.44M plays): sampled the paper colours, counted cuts, measured push speed in %/s, diffed frames for cadence and measured loudness. I also read 51 interviews, tutorials and guides, including interviews with Vox's own team. The difference between "editorial" and "template" is about 40 small things, and none of them is the effect itself:

- **Paper, never a screen.** Backgrounds sit between #D9D4CF and #F3F2F3, never #FFFFFF. Dark scenes sit at #131313–#231C18, never #000.
- **Photos become objects.** Blacks are lifted and colour is calmed. Borders are 2.4–5% of the card width, cards are rotated ±1.5–3°, and shadows are soft.
- **Motion on twos.** Collage motion runs at 12 fps inside a 30 fps video. Perfectly smooth motion reads as a slideshow.
- **One thing moves at a time.** In the best shots the paper holds dead still while the arrow draws.
- **Pushes have a speed limit.** Holds push at +1–3 %/s, emphasis at +4–6 %/s, hooks at +15 %/s or more.
- **Annotations land on the word,** not on a timer.
- **Physical cuts.** Cut on the fastest frame, tear, whip. Never a dissolve.
- **Sound is half of it.** Paper, marker, keys and landings; music 18–24 dB under the voice; room tone; −14 LUFS.

Every rule, with its numbers and where each one came from, is in **[references/LOOK_BOOK.md](references/LOOK_BOOK.md)**, together with the 16 amateur tells. Read it even if you never touch the code. It works the same in After Effects, Premiere, CapCut or Remotion.

![Demo: Apollo 11 explainer](media/demo.gif)

## What's inside

| | |
|---|---|
| `SKILL.md` | The Claude Code skill: workflow, rules, non-negotiables |
| `references/LOOK_BOOK.md` | **What makes it look pro**: measured numbers, sources, amateur tells |
| `references/SCRIPT.md` | Question → archive → script → shot list |
| `references/SOUND.md` | The mix, which sound goes with which move, free libraries |
| `references/ASSETS.md` | Public-domain archives, cut-out tools, fonts, maps, **licence traps** |
| `references/QA.md` | The checklist to run before you post |
| `references/PROMPTS.md` | Copy-paste prompts for Claude Code |
| `references/API.md` | Every kit function |
| `kit/vox.js`, `kit/vox.css` | The animation kit: 40+ helpers, all seek-safe, on twos by default |
| `kit/textures/` | Paper, grain, dust, crumple, tape and halftone, **generated in code** (MIT) |
| `kit/sfx/` | 25 sound effects, **synthesised in code** (MIT): paper, marker, pen, keys, whooshes, hits |
| `kit/fonts/` | Six free fonts (OFL): serif, quote serif, sans, condensed, mono, handwriting |
| `scripts/render.mjs` | Frame-exact renderer (headless Chromium → ffmpeg) with automatic SFX mix, music ducking and loudness |
| `scripts/map.mjs` | Animatable maps from Natural Earth (public domain): highlight countries, pins, routes |
| `scripts/photo_treat.py` | Turns a still into a filmed shot: fringe blur, dust, vignette, push, tint |
| `scripts/make_textures.py`, `make_sfx.py` | Regenerate the textures and sounds |
| `templates/starter/` | A 10-second starter with no images (`npm run new -- name` copies it) |
| `examples/apollo/` | The 25-second demo above (NASA photos, sources cited) |

## Install

You need [Node 18+](https://nodejs.org), [ffmpeg 4.4+](https://ffmpeg.org/download.html) (`brew install ffmpeg` on a Mac, `winget install ffmpeg` on Windows) and, for the skill, [Claude Code](https://claude.com/claude-code).

**As a Claude Code skill** (recommended):

```bash
git clone https://github.com/YOUR-USERNAME/vox-style-animation ~/.claude/skills/vox-style-animation
cd ~/.claude/skills/vox-style-animation
npm install
npx playwright install chromium
```

Then, in Claude Code: *"Use the vox-style-animation skill to make a 45-second vertical explainer on [topic]."* More prompts are in [PROMPTS.md](references/PROMPTS.md).

**Standalone:** clone it anywhere, run the same two install commands, and use the kit directly.

## Quick start

```bash
npm run new -- my-first-video                      # creates videos/my-first-video/ from the starter, paths already set
npm run preview                                    # leave it running; open http://localhost:8080/videos/my-first-video/
# in a second terminal:
node scripts/render.mjs videos/my-first-video/index.html --stills 2,5,8   # PNGs to check frames
node scripts/render.mjs videos/my-first-video/index.html --gif            # the MP4 (+ GIF), sound mixed in
```

The demo is at http://localhost:8080/examples/apollo/. In the preview: Space plays and pauses, ←/→ steps one frame (hold Shift for 1 s), and "♪" turns on sound. If the page is blank, open the browser console: the kit names the helper and the target it couldn't find.

A scene looks like this:

```js
const V = VOX.init({ width: 1080, height: 1920, fps: 30, duration: 12 });
const s = V.scene(0, 6);
const title = V.text(s, "How the Moon landing ran on <mark>4 KB of RAM</mark>", { x: 88, y: 240, w: 920, size: 120 });
V.words(title, 0.6);                                  // word by word, on twos
V.highlight(title.querySelector("mark"), 1.75);       // the marker lands on the word (and squeaks)
const photo = V.card(s, "assets/launch.jpg", { x: 262, y: 800, w: 556, h: 803, rot: -2.5, tape: ["t"] });
V.enter(photo, 2.25, "drop");                         // drops onto the desk, thud on landing
V.push(photo, 2.25, 6, { to: 1.045 });                // +1.5 %/s
V.arrow(s, [700, 1676], [620, 1290], 3.35);           // hand-drawn, draws on in 0.3 s
```

Every helper drops its own sound cue on the timeline. `render.mjs` mixes the cues with your voice-over (`--voice`) and music (`--music`, ducked under the voice), adds room tone and sets the master to −14 LUFS.

## Use it in other tools

The look book is tool-agnostic. The kit is plain browser JS, so it also works inside [HyperFrames](https://github.com/heygen-com/hyperframes) compositions or any headless-Chrome renderer. The textures and sounds are plain PNG and WAV files you can drop into After Effects, Premiere, DaVinci or CapCut.

## Credits

- Built by **Ishan Dubey** ([@original.ishan](https://www.instagram.com/original.ishan/)) with Claude Code.
- The measured references are listed in [REFERENCES.md](references/REFERENCES.md). Special thanks to **@chrismoran__**, whose tutorials are the clearest public teaching of this look. Go follow him.
- Demo photos: NASA (public domain in the US; no NASA endorsement implied). Demo map: Natural Earth (public domain). Fonts: SIL OFL. See [NOTICE.md](NOTICE.md).

MIT licence. Use it, fork it, ship videos with it. A credit or a tag is appreciated, not required.

*Not affiliated with, endorsed by, or connected to Vox Media. "Vox" is a trademark of Vox Media, LLC. "Vox-style" describes a widely imitated editorial collage look. This repo contains no Vox footage, logos or assets.*
