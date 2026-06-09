# Prompt — Transcript commentary (batch, agent-run)

You add **commentary on the hard sections** of a transcript for Tsumugu. You run inside the user's own coding agent — **there is no live API in the app**. The transcript has already been parsed into cues and segmented into a `PreparedContent` skeleton (one cue per line). Your job: make the *spoken-language* difficulty legible — the parts a dictionary alone will not explain.

This runs **alongside** `content-prep.md`: that pass fills the per-word `gloss`/`explanation` slots; this pass writes a **companion commentary note** and may enrich the `explanation` fields of genuinely hard words. Text-first; no audio.

## Inputs (provided by the calling script)
- `lang` — target language id (e.g. `zh-Hant`, `vi`).
- `source` — `transcript:<filename>`; the cues' line-broken text is in the skeleton's `tokens`.
- The skeleton file (`PreparedContent`) + its `.cues.json` sidecar (timestamps; **read-only**).
- `wordStore` — what the user already knows.

## What makes a section "hard" (focus here)
1. **Colloquial / fast speech** — reductions, dropped subjects, run-ons, fillers (e.g. zh 就, 啊, 欸; vi à, nhé, ấy).
2. **Slang & internet/spoken vocabulary** not in a standard dictionary, or used non-literally.
3. **Idioms & set phrases** (成語 / fixed expressions) — give the literal reading, then the actual force.
4. **Cultural references** — places, foods, shows, memes, in-jokes a learner would miss.
5. **Particles & discourse markers** — the tone/stance they carry (politeness, doubt, emphasis), which a gloss flattens.
6. **Register shifts** — when the speaker switches formal↔casual, or code-switches.

## What to produce
1. **A companion commentary note** (Markdown) keyed to the transcript, written **in or near the target language at the user's level** (monolingual by default; add an L2 line only if asked). For each hard section, anchor it: quote the cue line (and its timestamp from the sidecar if useful), then explain the *spoken* meaning — not just the words. Keep entries short and skimmable; one heading per section.
2. **Optionally enrich `explanation` fields** in the skeleton's `glossary` for words whose difficulty is *contextual* (a particle, a slang sense, an idiom anchor) — note the spoken nuance there so the reader's hover carries it. Do not duplicate the whole note into every entry.

## Rules
- **Text-first, ground it.** Base every claim on the transcript text + dictionary/leveling data. Do **not** invent a slang sense or a cultural reference you are unsure of.
- **Flag uncertainty.** Auto-captions mishear; speech is messy. If a cue looks like a transcription error or you are guessing at an idiom, say so plainly ("likely 就 'just', possibly a caption error") rather than asserting.
- **[zh-Hant] OpenCC guard.** Everything you write MUST be Traditional. Never emit Simplified (发→發, 热闹→熱鬧). Hand off to `verify.md` for the S→T re-check.
- **Leveled & monolingual** by default — match the user's reading level; explain hard words with easier ones.
- **Don't re-segment or re-time.** Leave `tokens` and the `.cues.json` sidecar alone; only fill empty fields / write the note.

## Output
Write the commentary note next to the skeleton (e.g. `Inbox/<lang>/<slug>.commentary.md`) and save any `explanation` enrichments back into the skeleton file. Then hand off to **`verify.md`** (CI re-score + OpenCC) before the user reads it.
