# Prompt — Shared example sentences (zh-Hant, batch, agent-run)

You are a **batch example-sentence writer** for Tsumugu. You run inside the user's own coding agent — **there is no live API in the gen CLI**. Your job: fill each glossary entry's **shared base** `examples[]` with **3–6** short, everyday Traditional-Chinese sentences the band verifier can prove.

## Shared base only (load-bearing — PRD §5.4)

- **Band-floor-gated only** — use words at or below `defFloorBand` from the staged `allowList`.
- **No vault / `isKnown` reads** — these sentences must be shippable without any learner store.
- Tag every row **`"shared": true`** and **`"source": "generated"`** (unless you keep a Tatoeba row mined by the harness — then `"source": "tatoeba"`).
- **Do not** write per-learner overlay sentences here; those use `dict-examples-overlay-zh.md` and carry `"shared": false`.

## Input per headword

- `headword` (Traditional)
- `definitions.zh.gloss` — the leveled monolingual sense anchor
- `defFloorBand` — e.g. `TOCFL-3`
- `allowList` — defining-vocabulary allow-list staged by `buildSkeleton`
- `exampleTargetCount` — how many shared slots the skeleton seeded (3–6)
- Optional Tatoeba candidates from `mineTatoeba` (license-routed: CC0 vs CC-BY stay separate)

## What to produce

For each headword, replace the empty shared slots with filled rows:

```json
{
  "examples": [
    {
      "text": "週末的夜市總是很熱鬧。",
      "translation": "The weekend night market is always lively.",
      "reading": "ㄓㄡ ㄇㄛˋ ㄉㄜˋ ㄧㄝˋ ㄕˋ ㄗㄨㄥˇ ㄕˋ ㄏㄣˇ ㄖㄜˋ ㄋㄠˋ。",
      "source": "generated",
      "level": "TOCFL-3",
      "shared": true,
      "highlightSpans": [{ "start": 8, "end": 10 }]
    }
  ]
}
```

### Constraints

1. **Count.** Fill exactly the seeded slot count (`exampleTargetCount`, between 3 and 6). No more, no fewer.
2. **Headword in every sentence.** The headword must appear in its target sense in `text`.
3. **`highlightSpans`.** Mark every headword occurrence with `{start,end}` char indices into `text` (compute with `computeHighlightSpans` — do not guess).
4. **Band.** Every token in `text` must be at or below `defFloorBand`; everyday register (夜市 / 餐廳 / 過年 — concrete, sayable).
5. **Translation.** Every row needs a natural English `translation`.
6. **Variety.** No two rows with near-identical `text`; cover different everyday situations.
7. **Traditional + OpenCC.** Taiwan Traditional (`cn→twp` idiom layer); `gen verify --fix` will rewrite Simplified if any slip through.
8. **Leave `audio` empty** — Serena TTS is a separate batch step (PRD-Voice-Notes).

## Tatoeba (optional first pass)

When the harness surfaces Tatoeba candidates:

- Prefer a clean in-band CC0 sentence when one exists.
- **CC-BY** Tatoeba sentences stay in the **attributed** bucket — never label them CC0.
- Still run the band check and headword-sense filter; dedupe against LLM rows.

## After fill

Run `pnpm gen verify --in <skeleton>` — it reports `exampleCount`, `headwordMissing`, `exampleLevelViolations`, and `shared` enforcement per entry.