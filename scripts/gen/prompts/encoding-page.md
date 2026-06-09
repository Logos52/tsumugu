# Prompt — Encoding-layer page (batch, agent-run)

Generate a **memory-encoding** page for an SRS word (Encoding PRD §5.5 / §6.5). Deeper than the dictionary: built to make the word *stick*. Opens when the user clicks the word in review. See `examples/encoding/` for the JSON shape.

## Inputs (from run context)
- `term`, `lang`, dictionary entry, the user's **flag note** (why they flagged it / what's confusing), their **known words** list (recycle these in examples), and the **resolved level cap** for 簡明中文 definitions.

## Output targets (fill BOTH)
1. **`encoding-page@1` JSON** (`*.encoding.json`) — the app-consumed artifact. Fill `definitions`, `examples`, `etymology`, `mnemonic`, `tricky`, `related`.
2. **Markdown twin** (`*.md`) — the Quartz-published human view. Keep prose in sync with the JSON.

## Definitions (two cards)
Write **both** definition layers in the JSON `definitions` object:

- **`definitions.en`**: concise English `gloss` + optional `senses[]` + `explanation`.
- **`definitions.zh`**: leveled **monolingual Traditional Chinese** `gloss` + `explanation`, using **only words at/below the resolved level cap** from run context. Set `levelCap` to that cap. A monolingual definition with unknown words is worse than an L1 gloss.

The Dictionary PRD leveling verifier will set `leveledVerdict: "leveled"`; aim your draft at the cap so it passes.

## Example sentences (3–6)
Fill `examples: ExampleSentence[]` with **3–6** rows, each `{ text, translation }`:

- **Simple / common / usable** — everyday register (night market, restaurant, New Year…).
- **Recycle the learner's known words** (from run context) so each sentence stays at i+1 (~95% CI).
- **Prefer sentences from the user's own reading** when available (`source` field); synthetic is fine if CI-clean.
- **Variety of context, not paraphrase** — distinct situations; multi-sense words get one example per sense (`sense` field).
- Order easiest-first (most known-word recycling in row 1).
- Optional: `reading`, `audio`, `source`, `sense`.

## Etymology / mnemonic (grounding required)
In the JSON:

- **`etymology`**: per-character `parts[]`, composed `payoff`, and a **`grounding`** tag: `sourced` | `mnemonic-device` | `speculative`. Add `confidence` (0..1) and `source` when sourced. Default un-cited origins to `mnemonic-device` or `speculative` — never assert folk decomposition as fact.
- **`mnemonic`** (optional): `{ text, grounding, confidence? }` with the same grounding discipline.

The Markdown twin mirrors this in **Etymology / character story** and **Mnemonic** sections.

## Why it's tricky + related
- **`tricky`**: contrastive note addressing the user's **flag note**; set `confusable` to the flagged term.
- **`related`**: typed links — `antonym`, `confusable`, `neighbour`.

## Body sections (Markdown twin)
1. **Definitions** — English + 簡明中文 (mirror JSON).
2. **Etymology / character story** — grounded or labeled.
3. **Mnemonic** — vivid, concrete image; personal where possible.
4. **Semantic associations** — synonyms, opposites, neighbours.
5. **Why it's tricky** — address the flag note directly.
6. **例句 · Example sentences** — numbered list with EN translations.
7. **[vi] The bridge** — how known Chinese unlocks this word.

## Rules
- **Encode, don't pad.** Every line should aid retention.
- **[zh-Hant] OpenCC**: Traditional only (Taiwan s2twp register).
- **Ground etymology**; a wrong mnemonic is worse than none.
- After filling, run `pnpm gen verify --encoding --in <path>.encoding.json` (OpenCC + per-string CI + grounding + selection + leveling gates).