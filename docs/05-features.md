# Feature tour

What Tsumugu actually does today, surface by surface. This is the "what's there" view; for the audited, dated record of each item read [`STATUS.md`](../STATUS.md).

---

## The reader

The core surface. A static, offline web app that turns a prepared file into a gradable reading.

- **Segmentation + status coloring.** The pack segments the text; every word is colored by status (new strongest → fading → known/ignored uncolored). Coloring is always on.
- **Instant offline hover.** The popup shows gloss, reading, audio, examples, and the pre-baked AI explanation, plus a wiki link — with no network call. Lookups merge `custom > prebaked > dict`. By default the card is quiet: it opens on **Shift-hover** or keyboard word-navigation, so moving the mouse doesn't pop a card on every word. A "deep dive ↗" opens the word's encoding page.
- **Grading.** Set status with the buttons or the hotkeys `1 2 3 4 K X`; the word recolors and persists instantly. **Guess-first** reveal lets you test yourself before seeing the answer.
- **Keyboard sweep.** Move to the next/previous highlighted word and jump to the next unknown without the mouse.
- **Flag-for-clarification.** `f` flags a word for the next batch run.
- **Phonetics + tone coloring (zh).** A toggle renders Zhuyin **ruby above each character** (aligned to the pre-baked reading, with a graceful fallback when unaligned), and a separate optional toggle colors the four tones + neutral. The neutral-tone dot sits leading, matching Taiwan MoE convention. Toggles persist across reloads.
- **Custom entries.** Your own corrected gloss/reading/note for any word overrides the packaged data and the pre-baked glossary.

## Review (pull SRS) + encoding pages

- **Pull-based review.** Open review and FSRS (`ts-fsrs`) serves what's due. The queue is built once on open; there is no scheduler, notification, or nag.
- **Encoding-layer pages.** Clicking a word in review (or the hover "deep dive") opens an AI-written page tuned for memory: etymology / character story, mnemonics, semantic associations, vivid examples, the bridge, and "why it's tricky." Deeper than the dictionary entry, aimed at retention.

## Synced transcript reader

The reading rides a video.

- **Cue sync.** With a `.cues.json` sidecar, the reader highlights the currently-playing line in *its own text* (no code runs on the video site). A YouTube id binds the sanctioned IFrame player; offline, it falls back to a local scrubber. Netflix readings ride the scrubber path.
- **Section summaries.** "Now talking about…" section lines read in leveled **Traditional Chinese** (English on the 譯 toggle), each playable in Serena's voice, and themselves hoverable + gradable like the body text.
- **Navigation.** Click a line, or `↑ / ↓` (and `, / .`), to select a sentence — selection drives the highlight and the audio/practice targets without moving the video. Click-to-play plays just that one line in the video and stops at its end.
- **Layout.** With a video, the player sits in a sticky column beside the scrolling transcript, with a draggable splitter (clamped 20–80%); the transport row wraps so it never overflows into the text.

## Voice

Audio is pre-baked by a local open-source TTS engine (reference: Qwen3-TTS 1.7B, voice *Serena*, via `mlx-audio`) and played back in the reader. The engine stays untouched; generated audio lives under the gitignored `personal/`. Web Speech is the fallback whenever a clip is missing.

- **Per-cue audio.** `gen voice-notes` renders one mp3 per transcript line. The reader plays a cue (🔊), chains every line consecutively (⏩), or stops.
- **Slow playback.** A 🐢 toggle plays at a pitch-corrected 0.85× (reader-side, uniform on every cue).
- **Shadowing mode (跟讀).** Plays a line, holds the highlight, and waits — **Space** advances, **Esc** exits. A pure state machine.
- **Practice bar (🌊).** An Audacity-style waveform under the active cue (wavesurfer.js, lazy-loaded). It follows the active sentence; drag-select a slice, loop it (🔁), and slow it to drill shadowing in context. `[` / `]` nudge the loop edges.
- **Per-word audio.** The hover 🔊 plays the word in Serena's voice via a batch-rendered, hash-named, deduped clip (`gen word-audio`), falling back to Web Speech. A runaway-clip guard re-rolls any take that exceeds a length cap, so a bare word can't hallucinate a six-second clip.
- **Section audio + commentary loop.** Each section summary is playable; a 🔄 loops the active section's clip.
- **Video A/B loop (🆎).** A sentence-tick timeline (the IFrame exposes no audio samples, so it's clock-driven) with draggable A/B handles that snap to cue boundaries — select-by-sentence looping with no zoom. A 🔂 loops the single selected sentence in the video.
- **Audio-source toggle (🎙️).** Flip what a click / Space / arrow plays: the video clip (default) or Serena's voice for that line with the video parked and paused, so only one source ever sounds.
- **Anki with audio.** The sentence-deck builder writes `[sound:cue-NNNN.mp3]` onto card backs; the exporter carries a media map (deterministic; byte-identical to a media-free export when empty).

## Anki export

Deterministic `.apkg` export built entirely client-side (sql.js + fflate) — no network. Export your graded words, optionally with the pre-baked audio. For users who prefer their own SRS, this is the bridge out.

## Cross-language: the Hán-Việt bridge

- **Bridge entries.** Each Sino-Vietnamese word resolves to its Hanzi, Hán-Việt reading, morpheme breakdown, and meaning — agent-generated, cached, confidence-flagged, and correctable.
- **Cross-seeding.** Your known Hanzi (seeded from your Chinese SRS export) intersect the bridge to lift your Vietnamese known-coverage automatically. The vi hover popup shows the bridge box.

## Reconciliation with your existing vocabulary

- **Import + reconcile.** `gen crossref` pulls in your SRS export (JSON, or directly from its SQLite — the richer path, including unknowns and provenance) or Anki, and reconciles against the store: a unified view plus a conflict report.
- **Safe merge.** The default is **never-demote** and clock-aware, so a re-import can't silently knock a word down (this fixed a confirmed data-loss bug). 
- **Reverse writeback.** `gen writeback` pushes Tsumugu's grades back toward the SRS export — dry-run by default, copy-only, never-clobber, pushing only where Tsumugu's timestamp is strictly newer. The original DB stays byte-identical unless you force in-place.

## The wiki

A compounding, published memory. General word, idiom, and encoding pages in an Obsidian vault, published via Quartz to a static, offline-viewable site, fed by Web Clipper → Inbox → an agent clean/tag step → the wiki. Pages cross-link by shared characters and themes. The directory schema (Atoms + Source-Bundles + Meta, enforced by a build-time linter that forbids duplicate atoms and broken links) lives in the wiki repo's `ARCHITECTURE.md`. Your word status is published; your raw transcripts and Q&A stay private.

## Generation toolchain

The agent-run batch CLI (`pnpm gen`), covered in full in [the architecture guide](./03-architecture.md#the-generation-cli-scriptsgen) and [the loop](./04-the-loop.md): `prep`, `transcript`, `verify`, `auto`, `wiki`, `encoding`, `bridge`, `crossref`, `writeback`, `voice-notes`, `word-audio`, `section-audio`. Every command is a deterministic harness that briefs your agent and consumes its output — no language model runs inside the tool.

## Correctness guards

- **OpenCC guard** on all zh-Hant output (Taiwan-idiom `cn→twp`), asserted in tests.
- **Verification pass** (`gen verify`) that re-scores CI and checks glosses; `--fix` normalizes.
- **CI is measured, never guessed**, on adjusted decomposition-aware counts.
- **Confidence + correction** on bridge entries.

## What's deliberately absent

No Chromium extension (dropped — it fights the pre-baked design), no scheduler or notifications (review is pull-only), no server / accounts / cloud, and no paid LLM API in the reading loop. The reasoning is in [the architecture guide](./03-architecture.md#what-we-chose-not-to-build).

---

Next: [Extending Tsumugu →](./06-extending.md)
