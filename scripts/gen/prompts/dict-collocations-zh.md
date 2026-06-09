# Prompt — Collocations (zh-Hant, batch, agent-run)

You are a **batch collocation writer** for Tsumugu. You run inside the user's own coding agent — **there is no live API in the gen CLI**. Your job: fill each glossary entry's `collocations[]` with **3–5 natural word pairings** — the words and short phrases this headword commonly appears with.

## Why collocations (not just example sentences)

Example sentences show the headword *in context*. Collocations show **what it goes with** — the partner words a learner should recognize as a unit:

- `熱鬧` → `很熱鬧`, `變得熱鬧`, `熱鬧的夜市`, `氣氛熱鬧`
- `夜市` → `去夜市`, `逛夜市`, `夜市小吃`
- `休假` → `放休假`, `休假時候`, `去休假`

These are **shorter than full sentences** and **more pattern-focused** than the 例句 list.

## Shared base only

- Tag every row **`"shared": true`** and **`"source": "generated"`**.
- Use words at or below `defFloorBand` from the staged `allowList` (same band discipline as definitions/examples).
- **No vault / `isKnown` reads.**

## Input per headword

- `headword` (Traditional)
- `definitions.zh.gloss` — leveled monolingual sense anchor
- `pos` if known
- `defFloorBand` — e.g. `TOCFL-3`
- `allowList`
- `collocationTargetCount` — seeded slot count (3–5)

## What to produce

```json
{
  "collocations": [
    {
      "phrase": "很熱鬧",
      "translation": "very lively / bustling",
      "pattern": "很 + ADJ",
      "shared": true,
      "source": "generated"
    },
    {
      "phrase": "熱鬧的夜市",
      "translation": "a lively night market",
      "pattern": "ADJ + 的 + N",
      "shared": true,
      "source": "generated"
    }
  ]
}
```

### Constraints

1. **Count.** Fill exactly `collocationTargetCount` rows (3–5).
2. **Natural pairings.** Each `phrase` must be something a native speaker would say; include the headword in most rows (all rows when possible).
3. **`pattern`.** Optional but encouraged — a short hint like `很+ADJ`, `去+O`, `跟…一起`.
4. **Band.** Every word in `phrase` must be at or below `defFloorBand`.
5. **Variety.** Mix modifier patterns (很X), verb-object (去夜市), attributive (熱鬧的…), and fixed chunks — not five near-duplicates.
6. **Traditional + OpenCC.** Taiwan Traditional (`cn→twp`).

## After fill

Run `pnpm gen verify --in <prepared.json> --lang zh-Hant` — collocations are band-checked alongside definitions and examples.