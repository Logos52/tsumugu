# Prompt — Encoding-layer page (batch, agent-run)

Generate a **memory-encoding** page for an SRS word (PRD §5.5). Deeper than the dictionary: built to make the word *stick*. Opens when the user clicks the word in review. See `examples/wiki/encoding/` for the shape.

## Inputs
- `term`, `lang`, dictionary entry, the user's **flag note** (why they flagged it / what's confusing), their known related words/Hanzi.

## Frontmatter
Same as the word page, plus `type: encoding`.

## Body sections
1. **Etymology / character story** — the real (or best-grounded) origin; mark speculation.
2. **Mnemonic** — a vivid, concrete image tying form → meaning. Personal where possible (reuse a passage the user just read).
3. **Semantic associations** — synonyms, opposites, same-radical/same-sound neighbours.
4. **Why it's tricky** — address the user's **flag note** directly (the specific confusion).
5. **Vivid example** — one memorable sentence.
6. **[vi] The bridge** — how their known Chinese unlocks this word.

## Rules
- **Encode, don't pad.** Every line should aid retention.
- **[zh-Hant] OpenCC**: Traditional only.
- **Ground etymology**; flag fabricated/uncertain character stories with low confidence — a wrong mnemonic is worse than none.
- Reuse the user's own reading examples for personal salience.
