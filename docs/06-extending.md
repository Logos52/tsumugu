# Extending Tsumugu

For builders. How to add a language, run the generation toolchain, work with the ports, and stay inside the hard rules. This is the fuller companion to the [`PACK-AUTHORING.md`](../PACK-AUTHORING.md) reference.

---

## The shape of the work

Three kinds of extension, in rising order of effort:

1. **Generate content** for an existing pack — run the `gen` CLI; no code. Start here.
2. **Add a language pack** — implement one interface, supply data, register it. The engine handles everything language-agnostic.
3. **Add a host or a port implementation** — only if you're targeting a new platform (a different app shell, a server runner).

## Ground rules (do not violate)

These are enforced by the architecture and by review. Breaking one breaks the project's guarantees.

- **Pure client-side core.** No backend or server in the reading loop.
- **No paid LLM API in the core.** Generation is batch scripts your agent runs; the app consumes files. Unknown words are pre-resolved at generation time so hover is instant and offline.
- **OpenCC guard.** All zh-Hant generated output passes Simplified→Traditional (Taiwan-idiom) normalization.
- **Open-core hygiene.** The engine repo stays language-agnostic and **data-free** — no dictionaries, no personal vocab, no keys. Packs, dictionaries, and the word store live in the private layer.
- **Confirmed writes only.** Local-file writes happen at the host boundary, gated behind the user's explicit confirm.
- **Pull SRS.** No scheduler, no notifications.

If a change needs to bend one of these, surface it as an open question rather than working around it silently.

## Authoring a language pack

A pack is one object implementing `LanguagePack` (`packages/engine/src/pack.ts`). The engine calls only through this interface, so once it's implemented, the reader, the CI scorer, the store, the SRS, and the generation CLI all work for your language unchanged.

### The interface

```ts
export interface LanguagePack {
  id: string;            // "zh-Hant", "vi", "demo"
  name: string;          // human-facing
  direction?: "ltr" | "rtl";

  segmenter(text: string): Token[] | Promise<Token[]>;
  dictionaryProvider(word: string): DictEntry | undefined | Promise<DictEntry | undefined>;
  phoneticLayer: PhoneticLayer;
  levelingModel(word: string): Level | undefined | Promise<Level | undefined>;
  scriptNormalizer?(text: string): string | Promise<string>;   // zh-Hant: OpenCC
  ttsVoice?: TtsVoiceSpec;                                      // BCP-47 lang + voice hint
  bridge?: BridgeProvider;                                      // optional cross-language map
}
```

Member by member:

- **`segmenter`** — turn text into ordered `Token`s (words and punctuation, with offsets and an `isWord` flag). Chinese uses jieba-wasm; Vietnamese uses a longest-match tokenizer. A pluggable interface means you can drop in a heavier local NLP service later if accuracy demands it.
- **`dictionaryProvider`** — resolve a word to a `DictEntry` (gloss, reading, senses, optional audio). Merge a **custom/override layer over the packaged base** — the user's own corrections win.
- **`phoneticLayer`** — the reading system (Zhuyin / Pinyin; Latin + tone diacritics).
- **`levelingModel`** — a difficulty/frequency band (Chinese: TOCFL; Vietnamese: frequency). Drives the CI ceiling and generation targeting.
- **`scriptNormalizer`** *(optional, required for zh-Hant)* — normalize text before display/storage. For Traditional Chinese this **must** be OpenCC Simplified→Traditional, Taiwan-idiom (`cn→twp`).
- **`ttsVoice`** *(optional)* — a `TtsVoiceSpec` (BCP-47 `lang` like `zh-TW` / `vi-VN`, plus an optional `voiceURI`, `rate`, `pitch`) for the Web Speech fallback.
- **`bridge`** *(optional)* — a `BridgeProvider` (`bridgeLang` + `lookup(word) → BridgeInfo`) when a known related language can bootstrap this one (Vietnamese → Hán-Việt → Hanzi).

### The reference implementation

`packages/demo-pack/src/index.ts` is the smallest complete pack — whitespace segmentation, a toy dictionary, a trivial phonetic layer. Read it to see the interface satisfied end to end. The real `packs/private/zh-hant/` and `packs/private/vi/` show the production shape (and stay gitignored).

### Steps

1. Implement `LanguagePack` for your language.
2. Provide dictionary data, fetched/transformed at build or run time — **keep it out of the engine repo** and mind its license (don't commit CC-BY-SA data into the Apache-2.0 engine).
3. Register the pack: `registry.register(myPack)`. For the CLI, point at it with `--pack-module path/to/index.ts`. For the reader, the browser-pack layer (`apps/web/src/packs`) supplies public algorithms with the licensed dictionary loaded at runtime from the vault.
4. *(Optional)* add a `bridge` if a known language can cross-seed this one.

### Keep data out of the bundle

The pattern that keeps the engine and the shipped web bundle data-free: **public algorithms in code, licensed data loaded at runtime.** The browser pack carries the tone logic and OpenCC; the actual dictionary is read from a vault file the user supplies. The private pack carries the full data and lives behind `.gitignore`.

## The generation CLI as a toolkit

`pnpm gen <cmd>` is the batch toolchain. Every command is a **deterministic harness** — it segments, scores, guards, validates, and briefs your agent with a prompt + context block; the agent writes the language-model content; the command consumes the result. No model runs inside the tool.

| Command | Use it to |
|---------|-----------|
| `prep` | build a prepared-content skeleton from text (directed or autonomous) |
| `transcript` | the same for SRT/VTT/YouTube/plain, with cue extraction |
| `verify` | re-score CI, run the OpenCC guard, check glosses (`--fix` to normalize) |
| `auto` | brief the agent to generate the next passage from gaps + due words |
| `wiki` / `encoding` | build wiki / memory-encoding page skeletons for selected/flagged/SRS words |
| `bridge` | resolve + cache Hán-Việt entries, then cross-seed |
| `crossref` | import + reconcile an external vocab source (SRS JSON, SRS SQLite, Anki) |
| `writeback` | push grades back toward the SRS export (safe by default) |
| `voice-notes` / `word-audio` / `section-audio` | render pre-baked audio with the local TTS worker |

The pure logic sits in `scripts/gen/lib/`; the agent prompts in `scripts/gen/prompts/`; the local TTS worker in `scripts/gen/voice/`. To change *what the agent is asked*, edit a prompt; to change *how content is built or validated*, edit the lib.

### A typical generation session

```
pnpm gen prep --lang zh-Hant --in source.txt --store ws.json --target 0.95
# → agent fills the empty glossary slots using the printed prompt
pnpm gen verify --in source.prepared.json --fix
# → "✓ verified — ready to read"; open it in the reader
```

## The ports model

The engine reaches the outside world only through four ports (`packages/engine/src/ports.ts`). A new host implements the ones it needs:

- **`VaultIO`** — `readText` / `writeText` over a granted folder, with optional `readBytes` / `list` / `exists`. The host gates `writeText` behind the user's confirm.
- **`BinaryIO`** — `writeBytes` (for the Anki `.apkg`).
- **`AudioPort`** — `speak(text, voice?)` (Web Speech in the browser).
- **`Clock`** — `now()`; `systemClock` is the default, tests inject a fixed one.

The browser host (`apps/web/src/host`) fills these with the File System Access API, an HTTP/dev vault, and Web Speech; Node scripts fill them with `fs`; tests fill them with memory. Because the engine names only the port, the same logic runs in all three with no change — and the engine can't reach the network or disk on its own, which is what makes the open-core guarantees verifiable.

## Conventions

- **TypeScript, ESM, strict** (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`, project references). Vitest, Vite, `tsx`.
- **Engine stays DOM-/network-/data-free.** Anything platform-specific goes in a host behind a port; anything language-specific goes in a pack.
- **Tests are co-located** (`*.test.ts` beside source) across the engine, the web app, the CLI lib, and the private packs.
- **JSON schemas are versioned** (`tsumugu/word-store@2`, `tsumugu/prepared-content@1`, …), and older versions still load.

## Verifying a change

```
pnpm typecheck        # strict TS across the workspace
pnpm test             # the full Vitest suite
pnpm validate:phase0  # the Phase 0 end-to-end checks
pnpm --filter @tsumugu/web build   # the reader builds
```

For the audited test counts and what each suite covers, see [`STATUS.md`](../STATUS.md). For intent and the open questions, see [`PRD.md`](../PRD.md) §12 — surface those rather than guessing.

---

Back to the [documentation index](./README.md).
