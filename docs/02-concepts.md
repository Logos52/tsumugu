# Core concepts

The vocabulary that makes the rest of Tsumugu legible. Read this once and the architecture, the loop, and the features all read as variations on these ideas.

---

## Comprehensible input, and the CI target

The learning theory underneath Tsumugu is **comprehensible input**: you acquire a language by understanding messages slightly above your current level. The practical handle on "slightly above" is a coverage number — the fraction of words in a text you already know.

- **Extensive reading** targets roughly **95% known** (the default). You understand the gist and acquire the rest from context.
- **Intensive reading** targets roughly **80% known**, for closer study with more support.

Tsumugu makes this measurable. The engine's **CI scorer** counts word-tokens against your word store and reports coverage, the unknown words, and whether target words recur often enough to stick. Generation calibrates new reading toward the target; verification re-scores it. The number is always **measured, never guessed** — a hard rule the project learned the hard way.

> Coverage is computed on *adjusted, decomposition-aware* counts, so a compound that breaks into known parts isn't mislabeled as unknown. Transcripts are an exception: they stay faithful to the source and carry their CI as reference metadata only, never graded down to fit a target.

## The word-status model

Every word, in every language, has a status that says how well you know it:

```
0 / new  →  1 New  →  2 Recognized  →  3 Familiar  →  4 Learned  →  known ✓
                                                                  →  ignored ✗
```

You set it with the keys `1 2 3 4 K X` (or the on-screen buttons) while reading. The reader colors each word by status: new words are strongest, the color fades as you climb the scale, and `known` / `ignored` carry no fill. Status is stored per **(language, word)** in your word store and cross-linked across languages.

This single model drives almost everything downstream: coloring, the CI score, which words generation recycles, which words become wiki and encoding pages, and which words the SRS serves.

## The three language roles

Any reading involves up to three roles, and a pack declares how they map:

- **Target** — the language you're reading (zh-Hant or vi).
- **Base / explanation** — the language explanations are written in. The default is *target-monolingual* and leveled (Chinese explained in simpler Chinese); an English or other-L2 toggle exists.
- **Bridge** — for Vietnamese, the bridge language is Chinese, via Hán-Việt correspondence (below).

## Batch generation, and pre-baking

This is the idea that lets Tsumugu have rich, AI-written explanations with **no paid API in the reading loop**.

Real-time lookup would mean an API call every time you hover an unknown word. Instead, Tsumugu **pre-bakes**: at generation time, a script segments the source, finds the words you don't yet know (by checking your store), and your coding agent fills in each one — gloss, reading, part of speech, level, a leveled explanation, example sentences. All of that is written into the content file *before* you ever open it.

The consequences:

- **Hover is instant and offline.** The reader reads a baked answer; it never calls out.
- **Generation is batch.** You run a script via Claude Code or Grok Build (subscriptions you already have). No metered, per-token cost sits in the core.
- **The app only consumes files.** Scripts read inputs and the store and *write* files; the reader reads those files. This file boundary is what keeps "no API in the core" enforceable.

The obvious gap — pre-baking can miss a word you happen to hit — is closed by flagging (below).

## Flag-for-clarification

While reading, any word you don't know or want clarified gets a **flag** (the `f` key). Flags collect in the word store. The next batch run reads them (`gen ... --flagged`) and resolves them — into fuller glosses, wiki pages, or encoding pages. Reading and generation form a cycle: reading produces flags; the next generation answers them.

## Pluggable language packs

The engine is **language-agnostic**. A **pack** teaches it one language by implementing a small interface:

| Member | Purpose |
|--------|---------|
| `segmenter` | text → word tokens (zh: jieba; vi: a longest-match tokenizer) |
| `dictionaryProvider` | word → gloss, reading, senses (packaged base + your custom layer) |
| `phoneticLayer` | the reading system (Zhuyin / Pinyin; Latin + tone diacritics) |
| `levelingModel` | word → difficulty band (zh: TOCFL; vi: frequency) |
| `scriptNormalizer` | text → normalized (zh: OpenCC Simplified→Traditional) |
| `ttsVoice` | the voice id for text-to-speech |
| `bridge?` | *optional* cross-language etymon map for cross-seeding |

The public engine ships only a generic **demo pack** (whitespace segmentation, a toy dictionary) so it clones and runs with zero licensed data. The real zh-Hant and vi packs live in the private layer. Authoring a pack is covered in [Extending Tsumugu](./06-extending.md).

## Open-core layering

Tsumugu is split into layers along a hard public/private line. This is the structural rule that keeps the engine shareable and your data yours.

```
┌─────────────────────────────────────────────────────────────┐
│  ENGINE        public, Apache-2.0, language-agnostic, DATA-FREE │  ← this repo
│                reader · word store · pull SRS · CI scorer ·    │
│                Anki export · bridge · crossref · pack interface │
├─────────────────────────────────────────────────────────────┤
│  PACKS         private — zh-Hant + vi: segmenter, dictionary,   │  ← packs/private/
│                phonetics, leveling, OpenCC, bridge data         │     (gitignored)
├─────────────────────────────────────────────────────────────┤
│  PERSONAL      private — your word store, status, flags,        │  ← personal/
│                custom entries, generated content, audio         │     (gitignored, in your vault)
├─────────────────────────────────────────────────────────────┤
│  WIKI          public — general word / encoding pages,          │  ← separate repo
│                published via Quartz to a static site            │     (tsumugu-wiki)
└─────────────────────────────────────────────────────────────┘
```

- The **engine** carries no dictionaries, no personal vocabulary, no keys. It is DOM-free, network-free, and data-free. `.gitignore` blocks the private folders.
- **Packs** and **personal** data stay local — partly to avoid redistributing licensed dictionary data, partly for organization. (The personal layer is private by *organization*, not secrecy; the design is open.)
- The **wiki** is a separate public repository, published with Quartz to a GitHub-Pages site that also opens offline as HTML.

The engine enforces this through **ports**: every bit of platform IO (reading the vault, writing bytes, speaking audio, telling time) goes through a small interface the host fills in. The web app fills them with the File System Access API and Web Speech; Node scripts fill them with the filesystem; tests fill them with memory. Because the engine only ever touches a port, it cannot reach the network or the disk on its own — which is exactly what makes "no API in the core" and "data-free" checkable rather than aspirational.

## The word store, in your vault

The word store is the single source of truth for what you know: a JSON file keyed by (language, word), holding status, first/last-seen, flags, custom dictionary overrides, SRS state, related links, and external references. It lives in **your vault**, so it rides your existing sync and git across machines. The app may cache it for speed, but the vault JSON is canonical.

Each entry can carry a **custom** layer — your own corrected gloss, reading, or note — which takes precedence over the pre-baked glossary, which takes precedence over the packaged dictionary (`custom > prebaked > dict`).

## Pull-based SRS

Tsumugu has a built-in spaced-repetition system using **FSRS** (via `ts-fsrs`), entirely client-side. It is **pull-based**: when you open review, the algorithm picks what's due and serves it. There is no scheduler, no notification, no nag. Clicking a word in review opens its **encoding-layer page** — an AI-written page tuned for memory (etymology, mnemonics, associations, vivid examples, the bridge), deeper than the dictionary entry. For users who prefer their own SRS, everything also exports to **Anki** (`.apkg`, built in the browser).

## The Hán-Việt bridge and cross-seeding

About 40% of Vietnamese is Sino-Vietnamese with regular correspondence to Chinese. The **bridge** is a registry of entries — a Vietnamese word → its Hanzi, Hán-Việt reading, morpheme breakdown, and meaning — generated as-you-go by the agent, **cached**, **confidence-flagged**, and **correctable**. **Cross-seeding** intersects the bridge's Hanzi with the Hanzi you already know (seeded from your Chinese SRS export) and lifts your Vietnamese known-coverage accordingly. The result: your Chinese does real work toward Vietnamese, and explanations can be written in Chinese rather than English.

## Verification and correctness guards

Language models get tone, register, and etymology wrong, and Grok in particular leaks Simplified characters into Traditional output. Tsumugu does not trust generated content blindly:

- **OpenCC guard** — all zh-Hant output passes Simplified→Traditional normalization, specifically Taiwan-idiom (`cn→twp`, so 軟件→軟體, 信息→資訊).
- **Verification pass** — `gen verify` re-scores CI coverage and re-checks for missing glosses; `--fix` normalizes in place.
- **Confidence + correction** — bridge entries carry a confidence score; low-confidence surfaces for review; an entry is marked corrected only after you confirm.
- **Grounding** — prompts are grounded in dictionary and leveling data rather than free invention.

---

Next: [Architecture — the parts →](./03-architecture.md)
