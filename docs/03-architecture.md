# Architecture — the parts

How Tsumugu is built. This guide names every major part, says what it does, and shows the boundaries between them. For the *vocabulary* behind these parts read [Core concepts](./02-concepts.md); for how they chain into one flow read [The loop](./04-the-loop.md).

---

## The three homes

Tsumugu lives in two public repositories and one private folder.

| Home | Visibility | What it holds |
|------|-----------|---------------|
| **engine** (this repo) | public, Apache-2.0 | the language-agnostic core, the demo pack, the web reader, the generation CLI, the docs |
| **wiki** ([`tsumugu-wiki`](https://github.com/Logos52/tsumugu-wiki)) | public | the published Quartz llm-wiki — general word, idiom, and encoding pages |
| **personal** (`personal/`, `packs/private/`) | private, local | the zh/vi packs, dictionaries, word store, status, flags, custom entries, generated content, audio |

The private folder is gitignored inside the engine repo and synced through your vault. The split is about avoiding the redistribution of licensed dictionary data and keeping things organized — the design itself is open.

## Repository layout (the engine)

A pnpm + TypeScript monorepo. Strict ESM, project references, Vitest for tests, Vite for the web app, `tsx` for Node scripts.

```
tsumugu/
├── packages/
│   ├── engine/         the language-agnostic, data-free core
│   └── demo-pack/      a generic pack so the public repo runs with zero licensed data
├── apps/
│   └── web/            the client-side offline reader (Vite, framework-free DOM)
├── scripts/
│   └── gen/            the batch generation CLI (run by your agent)
├── examples/           the Phase 0 "prove the loop by hand" artifacts
├── packs/private/      the real zh-Hant + vi packs (gitignored)
├── personal/           your vault layer: store, flags, generated content, audio (gitignored)
└── wiki/               seed content + Quartz notes (the live site is the separate repo)
```

Root scripts: `pnpm test`, `pnpm typecheck`, `pnpm dev` (the reader), `pnpm gen <cmd>` (the CLI), `pnpm validate:phase0`.

## The engine (`packages/engine`)

The core. **DOM-free, network-free, data-free.** It defines the domain types and the algorithms, and reaches the outside world only through ports. Everything here is JSON-serializable and fully offline.

### Contracts

Three files lock the shape of everything:

- **`src/types.ts`** — the JSON domain types: the `WordStatus` scale (`new · l1 · l2 · l3 · l4 · known · ignored`), `Token`, `DictEntry`, `PhoneticLayer`, `Level`, `BridgeInfo`, `SrsState`, `WordEntry` (the store record), `PreparedContent` + `PrebakedEntry` (the pre-baked reading file), `CiReport`, `ProgressMetrics`, and `ExternalVocabRecord` + `ReconciliationReport`.
- **`src/pack.ts`** — the `LanguagePack` interface (segmenter, dictionaryProvider, phoneticLayer, levelingModel, scriptNormalizer, ttsVoice, optional bridge) and `PackRegistry`, the in-process registry that holds the loaded packs.
- **`src/ports.ts`** — the IO abstraction: `VaultIO` (text + optional bytes/list over a granted folder), `BinaryIO` (for the Anki `.apkg`), `AudioPort` (text-to-speech), and `Clock` (a deterministic time source; the only thing that touches `new Date`).

### Modules

| Module | Role |
|--------|------|
| `store/` | the word store: CRUD over `WordEntry` records, serialize to/from the vault JSON, promote/demote/flag, metrics |
| `status/` | status coloring + intensity, the hotkey bindings (1–4/K/X), the known-policy transitions |
| `ci/` | the comprehensible-input scorer: coverage %, unknown words, target-recycle checks; `DEFAULT_CI_TARGET = 0.95` |
| `srs/` | the pull-based FSRS wrapper: state serialization, single-card review, due-selection — no scheduler |
| `content/` | the prepared-content consumer: parse + validate the baked file, resolve a word offline, merge `custom > prebaked > dict` for hover |
| `anki/` | deterministic `.apkg` export (sql.js + fflate), built client-side, no network; optional media map for audio cards |
| `bridge/` | the Hán-Việt bridge registry (cached, correctable) and the cross-seeding rule |
| `crossref/` | external-vocab import + reconcile + the clock-aware status-update resolver (the fix for demote-on-reimport) |

The engine's only runtime dependencies are permissively licensed and data-free: `ts-fsrs` (SRS), `sql.js` + `fflate` (Anki). No dictionary dumps, no keys.

## Packs

Three kinds of pack, by where they run and what data they carry:

- **Demo pack** (`packages/demo-pack`, public) — whitespace segmentation and a toy two-word dictionary. Its only job is to let the public engine clone and run with zero licensed data. It is also the worked reference for the `LanguagePack` interface.
- **Private packs** (`packs/private/`, gitignored) — the real ones. **zh-Hant**: jieba-wasm segmentation + 122k CC-CEDICT + official TOCFL leveling (14.8k words, frequency fallback) + pinyin→Zhuyin + OpenCC. **vi**: a longest-match tokenizer + a 39k kaikki dictionary + IPA + tones + the Hán-Việt bridge hook. Built with `pnpm exec tsx packs/private/fetch-data.ts`, plugged in via `--pack-module packs/private/index.ts`.
- **Browser packs** (`apps/web/src/packs`, public) — public-algorithm implementations (tone parsing, OpenCC) that give the reader real tone coloring, Taiwan-idiom normalization, and zh-TW/vi-VN voices, with the licensed dictionary supplied at runtime from a vault-loaded file. This keeps licensed data out of the shipped bundle while still letting the reader do real lookups.

## The web app (`apps/web`)

The reader. A client-side, framework-free Vite app that consumes `@tsumugu/engine` and renders the reading surface. `AppState` (`state.ts`) is the single source of truth — the word store, the active pack, the loaded content, settings, and metrics.

| Module | Role |
|--------|------|
| `reader/` | the reading view: token-by-token rendering, status coloring, the offline hover popup, grading by button + hotkey, flagging, keyboard navigation, the Zhuyin ruby, and the synced-transcript panel (cue highlight, YouTube IFrame or local scrubber) |
| `review/` | the pull-SRS review view: builds the due queue once on open, walks it, stops when empty |
| `encoding/` | the memory-encoding page view, opened from review or the hover "deep dive" |
| `voice/` | the voice integration: manifest parsing, the cue player, shadowing, the waveform practice bar, word and section audio, the A/B loop, and the Anki-with-audio deck builder |
| `packs/` | the browser packs (above) |
| `host/` | the browser implementations of the engine ports: the File System Access vault, an HTTP/dev vault, Web Speech audio, the Anki download |
| `ui/` | minimal DOM helpers and class names |

The reader is a thin DOM layer over engine logic. Wherever something is real work — coloring, CI, hover merge, SRS, Anki — the engine does it and the app renders the result.

## The generation CLI (`scripts/gen`)

The batch toolchain, run by your agent (`pnpm gen <cmd>`). It is a **deterministic harness**: no language model is called from inside it. Each command segments, scores, OpenCC-guards, validates, and *briefs the agent* with a prompt and a context block; the agent does the actual writing and the command consumes the result.

| Command | What it does |
|---------|--------------|
| `prep` | source text → a `PreparedContent` skeleton (segment, find unknowns vs the store, pre-fill empty glossary slots); directed or autonomous mode |
| `transcript` | same, for SRT/VTT/YouTube/plain transcripts — extracts timestamped cues, embeds a YouTube id, writes a `.cues.json` sidecar |
| `verify` | re-score CI, run the OpenCC guard, check for missing glosses; `--fix` normalizes in place |
| `auto` | autonomous mode: brief the agent to generate the next passage from your gaps + due words |
| `wiki` | generate wiki-page skeletons for selected/flagged/SRS words |
| `encoding` | generate encoding-layer page skeletons (memory, mnemonics, "why it's tricky") |
| `bridge` | resolve Hán-Việt bridge entries for selected words, then cache them + run cross-seeding |
| `crossref` | import an external vocab source (SRS export JSON, SRS SQLite, Anki) and reconcile against the store |
| `writeback` | push Tsumugu's grades back toward the SRS export — dry-run by default, copy-only, never-clobber |
| `voice-notes` | render per-cue audio with a local TTS worker, encode to mp3, build the manifest |
| `word-audio` | render per-word audio for the hover 🔊 |
| `section-audio` | render per-section summary audio |

Supporting pieces: `scripts/gen/lib/` holds the pure logic (skeleton building, verification, target selection, the SRS SQLite reader and writeback, the voice/word/section manifest logic). `scripts/gen/prompts/` holds the agent prompts (`content-prep.md`, `transcript-commentary.md`, `wiki-page.md`, `encoding-page.md`, `bridge.md`, `verify.md`). `scripts/gen/voice/` holds the local Python TTS worker (`synthesize_qwen3_mlx.py`).

## The wiki (separate repo)

The durable, published memory. An Obsidian vault published via **Quartz v4** to a GitHub-Pages static site ([logos52.github.io/tsumugu-wiki](https://logos52.github.io/tsumugu-wiki)), which also opens offline as HTML. It carries general word, idiom, and **encoding-layer** pages, fed by Obsidian Web Clipper → Inbox → an agent clean/tag/commentary step → the wiki.

The directory schema is its own spec — **Atoms + Source-Bundles + Meta, bound by a frontmatter contract** — with one canonical atom page per word, an encoding twin for words you're memorizing, a per-source reading bundle, and a build-time linter that enforces no duplicate atoms and no broken links. Public pages carry general meaning and your word status; your raw transcripts and Q&A stay in a private, never-built folder. The full schema lives in the wiki repo's `ARCHITECTURE.md`.

## The voice stack (Phase 8)

Audio is pre-baked the same way reading is: a local, open-source TTS engine renders per-cue, per-word, and per-section audio in batch; the reader plays it back. The reference setup is **Qwen3-TTS** (1.7B CustomVoice, voice *Serena*) via `mlx-audio` on Apple Silicon, with **BreezyVoice** as the Taiwan/Zhuyin fallback. The engine stays untouched (no new dependency reaches it); `wavesurfer.js` (the practice-bar waveform) lives only in the reader and is lazy-loaded. Generated audio lives under the gitignored `personal/`. The free browser Web Speech API remains the fallback whenever a clip is missing. The full feature surface is in the [feature tour](./05-features.md#voice).

## The ports model — why the boundaries hold

The architecture's spine is a single discipline: **the engine touches the outside world only through ports.**

```
        ┌────────────────────────────┐
        │          ENGINE            │   pure logic, no DOM / fs / network
        │  store · ci · srs · anki…  │
        └──────────────┬─────────────┘
                       │ ports (interfaces)
        VaultIO · BinaryIO · AudioPort · Clock
                       │
   ┌───────────────────┼───────────────────┐
   │                   │                   │
 web host           node host           test host
 File System        filesystem          in-memory
 Access + Web                            (deterministic)
 Speech
```

Because the engine names only the port, never the implementation, the same core logic runs in the browser, in a Node script, and in a test with no change. It also means the engine *cannot* reach the network or the disk on its own — the guarantees "no API in the core" and "data-free" become things you can verify by reading the dependency list, not promises you have to trust.

## What we chose not to build

- **The Chromium extension (the old Phase 6) was dropped.** Its only unique value is reading arbitrary *live* pages in place, which fights the pre-baked design: a live page has no pre-generated explanations, so an overlay degrades to a plain popup dictionary — which the browser packs already provide inside the web app. The "read this page" case is already served better by Web Clipper → Inbox → `gen prep` → reader, which *adds* the pre-baked layer an extension can't. (See [`DESIGN-HISTORY.md`](../DESIGN-HISTORY.md).)
- **No paid LLM API in the core loop.** A live API stays at most an optional, off-by-default add-on, never a dependency.
- **No scheduler / notifications.** Review is pull-only by design.
- **No server backend, no accounts, no cloud.** The reader is static and local.

---

Next: [The loop — how it comes together →](./04-the-loop.md)
