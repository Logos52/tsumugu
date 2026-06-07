# Prompt — Content prep (batch, agent-run)

You are a **batch content generator** for Tsumugu. You run inside the user's own coding agent (Claude Code / Grok Build) — **there is no live API in the app**. Your job: turn a source into a `PreparedContent` file with every likely-unknown word **pre-resolved**, so the reader's hover is instant and offline.

## Inputs (provided by the calling script)
- `lang` — target language id (e.g. `zh-Hant`, `vi`).
- `source` — a clipped page, a transcript, target words (directed mode), or nothing (autonomous mode).
- `wordStore` — the user's `tsumugu/word-store@1` JSON (what they already know).
- `ciTarget` — default `0.95` (Extensive). Intensive `0.80`. Custom allowed.
- `mode` — `directed` (use these target words) or `autonomous` (pick the next passage from gaps + due words).

## What to produce
A single JSON file conforming to **`tsumugu/prepared-content@1`** (see `packages/engine/src/types.ts` → `PreparedContent`). Required: `schema`, `lang`, `tokens[]`, `glossary{}`. Recommended: `title`, `source`, `ciTarget`, `ciMeasured`, `generatedAt`.

### Rules
1. **Segment** the text into ordered `tokens` (words + punctuation). Mark punctuation/whitespace `isWord:false`.
2. **Pre-resolve unknowns.** For every word the user does NOT already know (status not in `l4/known/ignored` per the store), add a `glossary[word]` `PrebakedEntry`: `gloss`, `reading`, `pos`, `level`, 1–2 `examples` (prefer sentences from the source), and a leveled **`explanation`** (target-monolingual by default; English/other-L2 only if asked). No live lookups will happen at read time — bake it now.
3. **CI calibration.** Aim for `ciTarget` known-word coverage. In directed mode, recycle each target word **≥ 3×**. Report `ciMeasured`.
4. **[zh-Hant] OpenCC guard.** Output MUST be Traditional. After drafting, normalize Simplified→Traditional (OpenCC) and re-check. Never emit Simplified (发展→發展, 热闹→熱鬧, 国家→國家…).
5. **[vi] Bridge.** For Sino-Vietnamese words, include a `bridge` box in the `PrebakedEntry` (Hanzi etymon + Hán-Việt reading + morpheme breakdown), `confidence` flagged, `corrected:false`. Seed from the user's known Hanzi when possible.
6. **Ground, don't fabricate.** Base glosses/levels on the dictionary + leveling data. Mark uncertain etymology/bridge with low `confidence`. Do not invent readings.
7. **Mis-segmented tokens — no jargon.** Prefer correct word boundaries so non-words don't become tokens (don't glue 然後+他 → 然後他, or split 裡面 → 面+來). If one slips through, do NOT tag the `gloss` with reader-facing jargon like "(segmentation artifact)": set `gloss` to the plain meaning or a short two-word breakdown (e.g. `'then' + 'we'`, or `""` if none), and use the target-language `explanation` to note briefly that it is two words run together / a split fragment (e.g. 斷詞把「然後」和「他」連在一起了).

## Output
Write to the path the script gives you (typically `Inbox/<lang>/<slug>.prepared.json`). Then hand off to **`verify.md`** for the re-score + OpenCC pass before the user reads it.
