# The loop — how it comes together

The parts in [the architecture guide](./03-architecture.md) are not a pile of features. They form a cycle: reading produces signals, generation answers them, and what you learn compounds into durable memory. This guide walks the loop once, end to end, and then traces the side-paths that branch off it.

---

## The core loop, in one picture

```
   a source                you read                    what compounds
  (article /            ┌──────────────┐
   transcript /         │   READER     │  status coloring
   prompt)              │  (offline)   │  instant hover (baked)
       │                │              │  grade 1–4 / K / X
       ▼                │              │  flag (f)
 ┌───────────┐          └──────┬───────┘
 │ gen prep  │ skeleton        │ grades + flags
 │ /transcript│───────┐        ▼
 └───────────┘        │   ┌──────────┐
       │              │   │  WORD    │  one JSON, in your vault,
   agent fills        │   │  STORE   │  keyed (language, word)
   glosses +          │   └────┬─────┘
   explanations       │        │ flagged / due / known words
       ▼              │        ▼
 ┌───────────┐        │   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │ gen verify│ ✓ ─────┘   │ gen wiki │   │  pull    │   │  Anki    │
 │ (CI+OpenCC)│           │ encoding │   │  SRS     │   │  export  │
 └───────────┘           │  bridge  │   │ (review) │   │ (.apkg)  │
   ready to read         └────┬─────┘   └──────────┘   └──────────┘
                              ▼
                         WIKI (Quartz) ── published, durable, cross-linked
```

The left column is **generation** (your agent, batch, $0). The middle is the **reader** (client-side, offline). The right is what **compounds** — the store, the wiki, the SRS, Anki. The arrow from flags back to generation is the engine of the whole thing: you never look a word up twice for nothing.

## Stage by stage

### 1. A source comes in

Anything textual: a clipped article (via Obsidian Web Clipper → Inbox), a video transcript (SRT / VTT / YouTube / plain), or a directed prompt ("≈300 characters on night markets, these 8 target words, TOCFL A2"). For video, `gen transcript` parses the format, dedups and strips tags, and writes a `.cues.json` sidecar of timestamped lines so the reading can sync to the player later.

### 2. Prep — build the skeleton

```
pnpm gen prep --lang zh-Hant --in source.txt --store ws.json --target 0.95
```

The command segments the text with the pack, checks each word against your store, and builds a `PreparedContent` skeleton with an **empty glossary slot for every word you don't yet know**. It prints the `content-prep.md` prompt and a context block. Two modes: **directed** (you name the topic and target words) and **autonomous** (`gen auto` picks the next passage from your gaps and due words).

### 3. Fill — the agent does the language-model work

Your coding agent (Claude Code / Grok Build) reads the skeleton and the prompt and fills each empty slot: gloss, reading, part of speech, level, a leveled monolingual explanation, and example sentences drawn from the source. This is the only step where a language model writes, and it happens in batch, outside the app. The result is **pre-baked** — every answer the reader will ever need is now in the file.

### 4. Verify — guard correctness

```
pnpm gen verify --in source.prepared.json --fix
```

Verification re-scores CI coverage against the store, runs the **OpenCC guard** (Simplified→Traditional, Taiwan-idiom) over all zh-Hant output, and checks that no gloss is missing. It blocks on a problem unless `--fix` is given, in which case it normalizes in place. When it prints "✓ verified — ready to read," the file is reader-ready. (For a transcript, CI reflects the source's real difficulty and is reported, not gated.)

### 5. Read — the reader, offline

You open the prepared file in the reader. It segments and renders the text, colors every word by status, and shows the baked gloss + explanation the moment you hover — no network, no delay. You grade words with `1 2 3 4 K X`, navigate by keyboard to the next unknown, reveal guess-first, and **flag** (`f`) anything you want clarified. If the reading carries cues, the synced panel highlights the playing line in the video; if it carries a voice manifest, you can play, slow, shadow, and loop the audio. Every grade and flag writes straight to the word store.

### 6. The store updates

The word store — one JSON in your vault, keyed (language, word) — absorbs the grades and flags. Because it lives in the vault, it syncs across your machines on the rails you already use. It carries status, first/last-seen, flags, your custom dictionary overrides, SRS state, and external references. Status changes are clock-stamped, so a later reconciliation can tell which source is newer.

### 7. Compound — wiki, SRS, Anki

The store now drives everything that makes a lookup permanent:

- **Wiki + encoding pages.** `gen wiki ... --flagged` and `gen encoding ... --srs` build page skeletons for the words you flagged or are actively memorizing; the agent fills them; you promote them into the Quartz wiki, where they cross-link by shared characters and themes and publish to a static, offline-viewable site.
- **Pull SRS.** Open review and FSRS serves what's due — no schedule, no nag. Click a word and its encoding page opens.
- **Anki.** Export an `.apkg`, built in the browser, for your own deck — optionally with the baked audio.

### 8. Back to the top

The words you flagged are answered in the next `gen` run; the words you graded shift what generation considers known and recycles. Reading feeds generation; generation feeds reading. The loop tightens every pass.

## The side-paths

The core loop is reading. Three branches hang off the store.

### Cross-language: the Hán-Việt bridge

```
pnpm gen bridge --lang vi --store ws.json --bridge-lang zh-Hant --words ...
```

For Vietnamese, the agent resolves each Sino-Vietnamese word to its Hanzi, Hán-Việt reading, morpheme breakdown, and meaning. The command caches the result (confidence-flagged, correctable) into the bridge registry and runs **cross-seeding**: it intersects the bridge's Hanzi with the Hanzi you already know (seeded from your Chinese SRS export) and raises your Vietnamese known-coverage. Your Chinese does real work toward Vietnamese, and the reader can show the bridge in the hover popup and explain in Chinese rather than English.

### Reconciliation: pulling in what you already know

```
pnpm gen crossref --source srs-db --in export.db --store ws.json --apply
```

Tsumugu does not assume it is your only record. `gen crossref` imports an external source — your SRS export (JSON or directly from its SQLite, the richer path), or Anki — and reconciles it against the store: a unified per-word view, a conflict report, and a gated merge. The merge is **never-demote** by default and clock-aware, so re-importing can't silently knock a word back down (the resolver that fixes this is the engine's `resolveStatusUpdate`). The reverse, `gen writeback`, pushes Tsumugu's grades back toward the SRS export — dry-run by default, writing only a modified *copy*, touching only words where Tsumugu's timestamp is strictly newer. The original is left byte-identical unless you explicitly force in-place.

### Voice: pre-baked audio

```
pnpm gen voice-notes  --in source.prepared.cues.json
pnpm gen word-audio   --in source.prepared.json --words all
pnpm gen section-audio --in source.prepared.cues.json
```

Audio follows the same pre-bake discipline as text. A local open-source TTS worker renders one clip per cue, per word, and per section summary in batch (voice *Serena*), encodes to mp3, and writes a manifest. The reader discovers the manifest beside the reading and plays clips back — for listening, shadowing, the segment-loop practice bar, and Anki cards with audio. Missing clips fall back to Web Speech. Nothing here calls a cloud API.

## The metalayer — the loop laid over video

The synced-transcript reader (the cue path above) is the seed of a larger surface: a **metalayer** that carries Tsumugu's word-layer onto any video you watch, local or streaming, in the spirit of asbplayer. The same status colors, instant hover, per-line audio, sentence looping, and one-tap mining into SRS and Anki — laid over the video instead of a static page. It runs client-side at $0; your vocabulary, lookups, and SRS stay local. The reader already does the synced-player half; the metalayer grows it from "a reader with a synced player" into "the reader's intelligence over anything you watch."

## Where files live, and who writes them

A quick map of the file boundary that makes "no API in the core" hold:

| File | Written by | Read by |
|------|-----------|---------|
| `*.prepared.json` | `gen prep`/`transcript` (skeleton) + your agent (fill) | the reader |
| `*.cues.json` | `gen transcript` | the reader's synced panel |
| `*.voice-notes.json` + mp3s | `gen voice-notes` + the TTS worker | the reader's voice player |
| the word-store JSON | the reader (grades/flags) + `gen crossref` | everything |
| wiki / encoding `.md` | `gen wiki`/`encoding` (skeleton) + your agent (fill) | Quartz → the published site |
| the bridge registry | `gen bridge` | the reader (vi hover) + cross-seeding |

Scripts and agents *write* files; the app *reads* them. That single rule is the whole reason the reading loop is free, offline, and verifiable.

---

Next: [Feature tour →](./05-features.md)
