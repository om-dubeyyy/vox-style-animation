# Script and shot list

The look can't save a weak story. Joe Posner: *"You can't bell and whistle your way out of getting an incredible story"* (S). Write first. Then animate.

## 1. Start from a question

A good Vox question can be answered, isn't yes/no, has a long and surprising answer, **and has something to show** (S). Before animating, test it:

- Can you say the answer in one sentence?
- Is there one picture, document, map or number that *proves* it? That is your "Rosetta stone" (S).
- Will the viewer learn something they'd repeat to a friend?

Examples: "How did the Moon landing run on 4 KB of RAM?" · "Why are all world maps wrong?" · "Why is Monaco's race in the middle of a city?"

## 2. Collect the archive, then write around it

List every visual you *have* (photos, documents, maps, numbers, clips). Write the script so each line points at one of them. A line with no visual is a line to cut or rewrite (S, Phil Edwards).

## 3. Structure (for a 30–90 s vertical)

| Beat | Time | Job |
|---|---|---|
| Hook | 0–3 s | The surprising claim plus the strongest image. Big type, one marker swipe. |
| Context | 3–12 s | The one fact the viewer needs. Usually a document, a date or a map. |
| Turn | 12–25 s | The "but": the detail that makes it interesting. A circle, a comparison, a counter. |
| Proof | 25–45 s | Show how we know: the source, the number, the photo. |
| Payoff | last 3–5 s | One line that lands, over the best image. Hold it. |

For 5–15 min YouTube pieces, Vox repeats the context, turn and proof loop. It aims for **one memorable moment per episode** and leaves "space for pacing and breathers" (S).

## 4. Write for the ear

- Short sentences. One idea each.
- About **210–225 words per minute** for reels (M). For long-form, slower is fine.
- Say the number, then show it. Say "this" while the circle draws.
- No more than about 20 words per 10-second scene (S, AI workflow guidance).

## 5. The shot list (the bridge between the script and the code)

One row per spoken phrase. This is what you hand to Claude, or follow yourself.

| # | Words (from the transcript) | t in → t out | Visual | Moves (ONE main thing) | Annotation | SFX |
|---|---|---|---|---|---|---|
| 1 | "How did the Moon landing run on" | 0.0 → 1.6 | Title on paper | words rise on twos | — | sub_hit |
| 2 | "four kilobytes of RAM?" | 1.6 → 2.6 | same | — | highlight "4 KB of RAM" at 1.75 | marker |
| 3 | "This is the rocket" | 2.6 → 4.5 | Saturn V photo card, −2.5°, taped | drop in, slow push +1.5%/s | arrow + "363 ft" label | card_drop, pop |

Rules for the shot list:
- Take times from a **word-level transcript** of the voice-over (Whisper with `word_timestamps=True`, or any captioning tool). Annotations land on the word, not a guess.
- **One main motion per row.** Supporting motion (a slow push, the drift) is fine underneath.
- Change something every **0.75–1.25 s** in collage sections (M). Holds of **5–6 s** only on a payoff image (S).
- Mark the cut type per scene change: hard cut, `curveCut`, `whip`, `paperWipe`. No dissolves.
- Note the source and licence of every image in the row.

## 6. One recurring visual idea

Vox doesn't use one house look. Each video gets **one visual idea** that repeats: construction paper for one, a paper clock that becomes a pie chart for another, protest-poster style for a third (S). Pick yours before animating:

- "Everything is a document on a desk"
- "Everything happens on one map; we fly between places"
- "Every number is a stack of paper"
- "Every scene is a page torn out of a 1969 magazine"

Write it at the top of the shot list. Every scene should obey it.
