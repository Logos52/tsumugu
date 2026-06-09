# Overview — what Tsumugu is and why it exists

> One open, client-side, cost-free engine for a high-quality graded reader and a compounding LLM-wiki. The reader runs offline; the language-model work runs in batch, executed by your own coding agent. First packs: Traditional Mandarin (Taiwan) and Vietnamese, with a Hán-Việt bridge that uses Chinese to bootstrap Vietnamese.

## The one-paragraph version

Tsumugu turns real foreign text into reading you can actually learn from. A coding agent you already pay for (Claude Code or Grok Build) reads a source — a clipped article, a video transcript, or a prompt — and pre-resolves every word you don't yet know: a gloss, a reading, a leveled explanation, example sentences. It bakes all of that into a content file. The reader opens that file with no server and no connection, segments the text, colors every word by how well you know it, and shows the baked explanation the instant you hover. You grade words as you read. Words you flag feed the next batch run. The words worth remembering become durable, cross-linked wiki pages and spaced-repetition cards, and one language's known words can raise your comprehension of a related one. Generation costs nothing beyond the subscription you already have; reading costs nothing at all.

## The problems it solves

Tsumugu exists because no single tool closes these gaps together. Each gap below maps to a concrete part of the design.

1. **Lookups evaporate.** Popup dictionaries answer one word and leave nothing behind. The next time you meet the word, you look it up again. → Tsumugu keeps a durable, cross-linked **wiki** and a persistent **word store**, so a lookup compounds into something you keep.

2. **Content isn't matched to you.** Generic graded readers don't know *your* words. Nothing recycles what you're actively trying to learn, and nothing is calibrated to the comprehension level where learning actually happens. → Tsumugu **generates reading from your own gaps and due words**, calibrated to a comprehensible-input target, recycling your target words.

3. **Cross-language leverage is wasted.** Roughly 40% of Vietnamese vocabulary is Sino-Vietnamese, with systematic correspondence to Chinese. A learner who knows Chinese is throwing that away by learning Vietnamese through English. → Tsumugu's **Hán-Việt bridge** links Vietnamese words to their Chinese etymons and **cross-seeds** Vietnamese comprehension from what you already know in Chinese.

4. **Vocabulary knowledge is fragmented.** What you know is split across an SRS export, an Anki deck, and your own memory, with no single reconciled view. → Tsumugu's **external-vocab cross-reference** imports and reconciles those sources into one store, with conflicts surfaced and a non-destructive sync.

5. **There's no reusable, publishable foundation — and most tools assume a paid backend.** Per-lookup or per-generation API costs make a personal reading habit expensive, and nothing is open enough to build on. → Tsumugu is **open-core and client-side**, with all generation done in **batch** by an agent you already run. No metered API sits in the loop.

## The answer, stated plainly

Tsumugu is one engine with a pluggable notion of "language." It gives you:

- an **inline reading layer** — segmentation, per-word status coloring, instant offline hover, guess-first grading by hotkey;
- a **durable memory** — a cross-linked wiki and a portable word store that lives in your vault and syncs across machines;
- **batch generation** — repo-shipped scripts and prompts that your agent runs to pre-bake reading, explanations, wiki pages, and bridge entries;
- **cross-language leverage** — the Hán-Việt bridge and cross-seeding;
- **reconciliation** — import and merge your existing vocabulary sources.

The reading loop is free and works on a plane. Generation needs an agent run, not a paid API.

## Principles

These are load-bearing. Most of the architecture exists to keep them true. (See [Core concepts](./02-concepts.md) for the mechanics behind each.)

- **Client-side, offline, $0 marginal cost.** The reader is a static web app with no backend. Generation is batch, run by your agent.
- **No paid API in the core loop.** Language-model work pre-bakes its results into files; the app consumes files. Unknown words are resolved at generation time, so hover is instant and free.
- **Pluggable language packs.** A pack supplies the segmenter, dictionary, phonetics, leveling, script normalizer, voice, and an optional bridge. The engine itself knows nothing about any specific language.
- **Open-core hygiene.** The public engine carries no dictionaries, no personal vocabulary, and no keys. Licensed data and your own data live in a private layer.
- **Pull-based review.** The spaced-repetition system serves due words only when you open review. It never schedules, nags, or notifies.
- **Correctness guards.** All Traditional-Chinese output passes through OpenCC (Simplified→Traditional) normalization; a verification pass re-scores comprehensibility; the bridge carries confidence flags and stays correctable.

## Who it's for

- **The primary user** is an intermediate-plus Chinese learner and beginner Vietnamese learner who wants to learn through real comprehensible input, use Chinese to reach Vietnamese without English, and avoid recurring API costs.
- **Any learner** of any language with a pack can use the reader.
- **Chinese speakers learning Vietnamese** are the showcase for the bridge.
- **Developers** can clone the public engine, run the demo with zero licensed data, and author a pack for a new language.

## The name

紡ぐ — *tsumugu* — means "to spin or weave [thread, words]." The project spins scattered lookups, transcripts, and known words into one woven fabric of reading, memory, and cross-language connection. (The name arrived after 中文Craft → FoldCraft; the history is in [`DESIGN-HISTORY.md`](../DESIGN-HISTORY.md).)

## Status at a glance

Phases 0 through 7 are implemented: the engine, the offline reader, the agent-run generation CLI, the wiki / bridge / cross-reference layers, and transcript ingestion with a synced reader. Phase 8 (voice) has shipped its first milestone — local batch text-to-speech, cue-synced playback, shadowing, a segment-loop practice bar, and Anki-with-audio. A **metalayer** — a watching layer over local and streaming video, in the spirit of asbplayer — is being built on top of the synced-transcript seed. The Chromium extension (the old Phase 6) was deliberately dropped; see [the architecture guide](./03-architecture.md#what-we-chose-not-to-build) for why.

For the audited, criterion-by-criterion state, read [`STATUS.md`](../STATUS.md). For intent and scope, read [`PRD.md`](../PRD.md).

---

Next: [Core concepts →](./02-concepts.md)
