# AGENTS.md — Tsumugu engine

You are a coding agent working on the Tsumugu engine. This file is your operating
manual: the one loop, the hard rules, how to add a language, how to generate content,
how to run and verify, and the lines you must not cross. Read it first, then act.

**Source of truth is [`PRD.md`](./PRD.md).** This file is the build guide. When this
file and the code disagree, the code wins — fix the doc and flag it.

This engine is **tool-agnostic** (any coding agent: Claude Code, Grok Build, Codex,
Cursor, others) and **human-language-agnostic** (any language plugs in as a pack).
Both senses are spelled out below — hold them.

**First moves (cold start).** Run `pnpm install`, then `pnpm test && pnpm
validate:phase0` to confirm a green baseline. Read [`STATUS.md`](./STATUS.md) for the
active phase and **PRD §12** for open questions, then pick up the current phase from
the **Phases** list below.

---

## The one loop

Real foreign text is segmented; every word is colored by how well the user knows it
(`new · l1 · l2 · l3 · l4 · known · ignored`); hover shows a definition plus a
**pre-baked** AI explanation; unknown words and idioms become durable wiki pages; due
words come back through a pull-based SRS. The engine is language-agnostic — a language
plugs in as a **pack**. First packs: Traditional Mandarin (zh-Hant) + Vietnamese (vi),
joined by a Hán-Việt bridge.

The load-bearing seam: **batch scripts write files; the app consumes them.** The
generation CLI is a deterministic harness — **no LLM runs inside it.** Each command
segments / scores / OpenCC-guards / validates, then *briefs you* with a prompt + a
context block; **you** (any agent) write the language-model content; the command
consumes your result. Unknown words are pre-resolved at generation time, so the
reader's hover is instant and offline.

```
source text ──gen prep──▶ skeleton + prompt ──you (any agent)──▶ filled content
                                                                       │
                                            gen verify (CI + OpenCC) ◀──┘
                                                                       │
                                          user confirms ──▶ reader consumes (offline)
```

---

## Hard rules — never break these

An agent that violates one of these has made a wrong change, even if it compiles and
tests pass.

1. **Pure client-side.** Web app. **No backend / server in the core reading loop.**
   No accounts, no cloud. (No browser extension — see the **Reconciled** note in
   Architecture.)
2. **No paid LLM API in the core.** All LLM generation is **batch scripts the user
   runs via their own agent**. Scripts read inputs + the word store and **write
   files** (prepared content, wiki/encoding pages, bridge entries); the app only
   **consumes** them. A live API stays at most an optional, off-by-default add-on —
   never in the core loop.
3. **Open-core / data-free.** This engine repo is language-agnostic and **data-free**:
   **no dictionaries, no personal vocab, no API keys.** Packs, dictionaries, and the
   word store live in the user's **private folder / vault**; the wiki is a **separate
   public Quartz repo**. `.gitignore` blocks `/packs/private/`, `/personal/`,
   `/data/`, `/vocab/`, `*.local.*`, and secrets — do not commit anything under them
   (see `.gitignore` for the full block list).
4. **OpenCC guard (pack-gated).** For any pack whose `scriptNormalizer` performs
   Simplified→Traditional (zh-Hant), generated/imported output passes Taiwan-idiom
   normalization (`cn→twp`) and **hard-fails if any Simplified character remains**.
   Packs without such a normalizer skip this step — the CLI prints "OpenCC guard
   skipped" and still checks CI + glossary coverage.
5. **Pull-based SRS.** No scheduler, no notifications. Due words are served **only**
   when the user opens review.
6. **Confirmed writes only.** Vault / local-file writes happen at the host boundary,
   gated behind the user's **explicit confirm** (`VaultIO.writeText`).
7. **Engine is DOM-free + network-free.** The core touches the outside world **only**
   through the four ports (`VaultIO`, `BinaryIO`, `AudioPort`, `Clock`). Anything
   platform-specific → a host behind a port. Anything language-specific → a pack.
8. **Surface open questions, don't guess.** See **PRD §12**. Flag a rule rather than
   silently working around it.

---

## "Any agent, any language" — stated concretely

- **Tool-agnostic.** Any coding agent can drive this repo: AGENTS.md exposes only
  commands, file paths, and explicit constraints, and the prompts in
  [`scripts/gen/prompts/`](./scripts/gen/prompts/) are **model-neutral** — there is one
  shared, task-scoped prompt set, with no per-agent branching. Claude Code, Grok Build,
  Codex, Cursor, or any other harness produces the same baked output. Never write "ask
  Claude to…"; write "run your agent against the printed prompt." (`--agent <name>` is
  a free-text provenance tag recorded in the run-context block for your own
  bookkeeping; it does **not** change the prompt or behavior, and any value is
  accepted.)
- **Human-language-agnostic.** Any language is supported by implementing one
  `LanguagePack`. **Required:** `segmenter`, `dictionaryProvider`, `phoneticLayer`,
  `levelingModel`. **Optional:** `scriptNormalizer`, `ttsVoice`, `bridge` — omit
  `scriptNormalizer` for any language with no script-normalization need (most non-CJK
  languages); it is mandatory ONLY for Simplified-bearing scripts (zh-Hant). Once the
  pack is registered, the reader, CI scorer, store, SRS, and the gen CLI work
  **unchanged** — pass `--lang <id>` on every gen command (see the runbook). An agent
  adds a language by following "Add a language pack" below — without ever putting data
  into the public engine.

---

## Run / build / verify

Package manager is **pnpm** (`pnpm@11.5.1`). Root scripts:

| Command | Does |
|---|---|
| `pnpm install` | Install the workspace. |
| `pnpm dev` | Run the reader (`@tsumugu/web`, Vite). |
| `pnpm typecheck` | `tsc -b --pretty` — strict TS across the workspace. |
| `pnpm test` | `vitest run` — full suite (`pnpm test:watch` to watch). |
| `pnpm build` | Build `packages/*`; `pnpm --filter @tsumugu/web build` builds the reader. |
| `pnpm gen <cmd>` | The batch generation CLI (`tsx scripts/gen/cli.ts`). |
| `pnpm validate:phase0` | Phase 0 end-to-end checks. |

**Verify any change** (run all four; "done" is machine-checkable — run all four):

```
pnpm typecheck
pnpm test
pnpm validate:phase0
pnpm --filter @tsumugu/web build
```

Audited test counts live in [`STATUS.md`](./STATUS.md); intent + open questions in
**PRD §12**.

---

## Architecture map + the file boundary

**Three homes** (see [`docs/03-architecture.md`](./docs/03-architecture.md)):

| Home | Visibility | Holds |
|---|---|---|
| **engine** (this repo) | public, Apache-2.0 | language-agnostic core, demo pack, web reader, gen CLI, docs |
| **wiki** (`tsumugu-wiki`) | public | published Quartz llm-wiki (word / idiom / encoding pages) |
| **personal** (`personal/`, `packs/private/`) | private, gitignored | real packs, dictionaries, word store, status, flags, custom entries, generated content, audio |

**Repo layout:**

- `packages/engine/` — **data-free core**; depends on ports only, never DOM/network.
- `packages/demo-pack/` — generic pack so the public repo runs with **zero licensed
  data** (the worked reference).
- `apps/web/` — Vite, framework-free reader (`state.ts`, `host/`, `packs/`, `reader/`,
  `review/`, `encoding/`, `voice/`, `styleguide/`).
- `scripts/gen/` — the batch CLI (`cli.ts`), pure logic in `lib/`, prompts in
  `prompts/`, local TTS worker in `voice/`.
- `examples/` — Phase 0 proof.
- `packs/private/`, `personal/`, `wiki/` — gitignored / partial.

**The boundary is load-bearing:** scripts **write files**, the app **consumes** them.
The gen CLI is a **deterministic harness — no LLM runs inside it.**

**Engine modules** (`packages/engine/src/`): `store/` (CRUD over `WordEntry`,
serialize to vault JSON, promote/demote/flag, metrics) · `status/` (coloring +
intensity, hotkeys 1–4/K/X, known-policy transitions) · `ci/` (coverage scorer,
`DEFAULT_CI_TARGET = 0.95`) · `srs/` (pull-based FSRS wrapper, no scheduler) ·
`content/` (prepared-content consumer; merges `custom > prebaked > dict` for hover) ·
`anki/` (deterministic `.apkg`, sql.js + fflate, no network) · `bridge/` (Hán-Việt
registry, cached/correctable) · `crossref/` (external-vocab import + reconcile;
clock-aware resolver = the demote-on-reimport fix).

**Three contract files lock every shape:**

- `packages/engine/src/types.ts` — JSON domain types (`WordStatus` scale, `Token`,
  `DictEntry`, `PreparedContent` + `PrebakedEntry`, `CiReport`, …).
- `packages/engine/src/pack.ts` — the `LanguagePack` interface + `PackRegistry`.
- `packages/engine/src/ports.ts` — the four ports.

**Engine runtime deps (only these, all permissive + data-free):** `ts-fsrs` (SRS),
`sql.js` + `fflate` (Anki `.apkg`). No dictionary data, no keys — so "no API in the
core" and "data-free" are **verifiable by reading the dependency list**.

> **Reconciled:** an earlier phase listed a Chromium browser extension. It was
> **dropped** — a live page has no pre-baked layer, so an overlay degrades to the
> plain dictionary the browser packs already provide. The replacement path is
> **Web Clipper → Inbox → `gen prep` → reader** (`docs/03-architecture.md`).

---

## Phases — runnable workflows (PRD §11)

Each phase: **plan → approve → build → review.**

0. **Prove the loop by hand** — one zh + one vi source; hand-run a generation script.
1. **Engine + reader + both packs** — pluggable segmentation (jieba-wasm zh / JS
   tokenizer vi), packaged dicts + custom layer, word store (File System Access),
   coloring, hover (pre-baked), grading + hotkeys, guess-first, built-in pull SRS
   (`ts-fsrs`), Anki export. Offline, $0.
2. **Generation scripts** — batch content prep (CI ~0.95, pre-baked unknowns, OpenCC),
   directed + autonomous, verification re-score.
3. **Wiki + encoding-layer pages + Web Clipper intake** — Inbox → clean/tag/commentary
   → Wiki; click an SRS word → its AI encoding page; publish via Quartz.
4. **Hán-Việt bridge + cross-seeding** — AI-generated as-you-go, cached, seeded from
   the known-Mandarin SRS export.
5. **External-vocab cross-reference** — import + reconcile known words from the SRS
   export (Anki adapter pending — interface stub only).
6. **~~Browser extension~~** — **dropped** (see the reconciled note above); replaced by
   Web Clipper → Inbox → reader.
7. **Transcripts + AI commentary** (text-first).
8. **Voice** — per PRD §9.

---

## The pack interface

A pack teaches the engine one language. The engine calls **only** through
`LanguagePack` (`packages/engine/src/pack.ts`):

```ts
export interface LanguagePack {
  id: string;                                  // "zh-Hant", "vi", "demo"
  name: string;                                // human-facing
  direction?: "ltr" | "rtl";                   // default "ltr"
  segmenter(text: string): Token[] | Promise<Token[]>;
  dictionaryProvider(word: string):            // merge custom > base; custom wins
    DictEntry | undefined | Promise<DictEntry | undefined>;
  phoneticLayer: PhoneticLayer;                // Zhuyin / Pinyin / Latin+tones / …
  levelingModel(word: string):                 // difficulty/frequency band
    Level | undefined | Promise<Level | undefined>;
  scriptNormalizer?(text: string):             // optional; zh-Hant MUST be OpenCC S→T
    string | Promise<string>;
  ttsVoice?: TtsVoiceSpec;                      // default Web Speech voice
  bridge?: BridgeProvider;                      // optional cross-language bridge
}
```

Supporting types in the same file: `TtsVoiceSpec` (`lang` BCP-47, optional
`voiceURI`/`rate`/`pitch`), `BridgeProvider` (`bridgeLang` + `lookup(word) →
BridgeInfo`), and `PackRegistry` (`register`/`get`/`require`/`has`/`list`/`ids`).

**Three kinds of pack:** **demo** (`packages/demo-pack`, public — whitespace seg + toy
dict, the worked reference) · **private** (`packs/private/`, gitignored — real
zh-Hant: jieba-wasm + CC-CEDICT + TOCFL + Zhuyin + OpenCC; real vi: longest-match
tokenizer + kaikki + IPA + tones + bridge) · **browser** (`apps/web/src/packs`,
public — public algorithms with the licensed dictionary loaded **at runtime** from a
vault file, keeping the shipped bundle data-free).

**The pattern that keeps data out of the public bundle:** public algorithms live in
code; licensed data loads at runtime. Never inline a dictionary.

### Add a language pack (runbook)

1. **Copy the reference.** Start from `packages/demo-pack/src/index.ts` (the minimal,
   working pack).
2. **Implement the seams** for your language. Required: `segmenter`,
   `dictionaryProvider`, `phoneticLayer`, `levelingModel`. Optional: `scriptNormalizer`
   (mandatory OpenCC only for zh-Hant and any Simplified-bearing script; omit it for
   languages that need no normalization), `ttsVoice`, and `bridge`. **Pass `--lang
   <id>` on every gen command** — the CLI errors if it is missing.
3. **Keep the data private.** Algorithms in code; load licensed dictionaries at
   runtime from the vault. Real packs live in `packs/private/` (gitignored) and build
   their data via, e.g., `pnpm exec tsx packs/private/fetch-data.ts`.
4. **Register it.** `registry.register(myPack)`. For the gen CLI, point at it with
   `--pack-module path/to/index.ts` (or `--pack <id>` for a registered pack).
5. **Verify.** Run the four verify commands, then drive a real source through
   `pnpm gen prep … && pnpm gen verify --in …` and confirm the OpenCC guard and CI
   pass. See [`PACK-AUTHORING.md`](./PACK-AUTHORING.md) for the full guide.

---

## The four ports

The engine reaches the outside world only here (`packages/engine/src/ports.ts`). Same
core logic runs in the browser host (File System Access + Web Speech), the node host
(`fs`), and the test host (in-memory) with no change.

- **`VaultIO`** — text persistence over a user-granted folder. `readText` /
  `writeText` (+ optional `readBytes` / `list` / `exists`). **`writeText` is the
  enforcement point for "confirmed writes only"** — the host gates it behind the
  user's explicit confirm.
- **`BinaryIO`** — binary read/write (e.g. `.apkg` export).
- **`AudioPort`** — `speak(text, voice?)` / `stop?()` (web app implements via Web
  Speech API).
- **`Clock`** — `now(): Date`. The **only** thing in the engine that touches
  `new Date`; tests inject a fixed clock. `systemClock` is the real one.

---

## Generation workflows — `pnpm gen <cmd>`

A deterministic harness; each command writes a skeleton/file, then prints the
**model-neutral agent prompt(s)** + a run-context block for **you** to fill. Common
flags: `--lang` (required on every content/audio command), `--in`, `--store`,
`--target` (default `0.95`), `--out`, `--pack` / `--pack-module`, `--agent <name>`
(free-text provenance tag; no effect on output).

| Subcommand | Purpose |
|---|---|
| `prep` | Source text → a `PreparedContent` skeleton (segment, find unknowns vs the store, pre-fill empty glossary slots). `--mode directed --words …` or autonomous. Writes `Inbox/<lang>/<slug>.prepared.json`. |
| `transcript` | Same for SRT/VTT/YouTube/plain: extracts timestamped cues, embeds an 11-char YouTube id, writes a `.cues.json` sidecar; prints prep + commentary prompts. |
| `verify` | Re-score CI, run the OpenCC guard, list missing glosses. `--fix` writes normalized content back. **Hard-blocks** on missing glosses or un-applied Simplified. |
| `auto` | Autonomous mode: brief the agent to build the next passage from the user's gaps + due words (`--limit`, default 8). |
| `wiki` | Wiki-page skeletons for selected / `--flagged` / `--srs` / learning words → `wiki/Inbox/<lang>/`. |
| `encoding` | Encoding-page skeletons (memory/mnemonic/"why it's tricky") → `…/encoding/` (shares the `wiki` path, routed via `encoding:true`). |
| `bridge` | Brief the agent to resolve Hán-Việt entries; `--cache results.json` writes them into the `BridgeRegistry` JSON + cross-seeds from known Hanzi. |
| `crossref` | Import an external vocab source (SRS export JSON, SRS SQLite `--source srs-db`) and reconcile vs the store. The Anki adapter is the interface stub — **not yet wired**. `--apply` (`never-demote` default, `--overwrite` → `newest-wins`); `--from-lang` relabels e.g. `zh`→`zh-Hant`. |
| `writeback` | `writeback --store ws.json --db srs-core.db` (both **required inputs**) — push Tsumugu's grades back toward the SRS snapshot DB. **Dry-run by default; `--apply` writes a COPY** (`--out copy.db`), never the live SRS; `--in-place --yes` overwrites the snapshot only. |
| `voice-notes` | Render per-cue audio via the local TTS worker → mp3 + `voice-notes.json` manifest; `--cues`, `--slow`, `--limit`, `--force`, `--dry-run`, `--voice <name>`, `--model <id>`. |
| `word-audio` | Render per-word audio for the hover 🔊 (`--words all\|glossary`, `--voice <name>`, `--model <id>`), with over-long-take retry. |
| `section-audio` | Render per-section summary audio from cue `sections[].summary` (`--voice <name>`, `--model <id>`). |
| `help` | Print usage. |

**Supporting structure:** pure logic in `scripts/gen/lib/` · prompts in
`scripts/gen/prompts/` · local Python TTS worker in
`scripts/gen/voice/synthesize_qwen3_mlx.py` (resolved venv via `TSUMUGU_VOICE_PYTHON`;
requires `ffmpeg` on PATH). All three audio commands (`voice-notes`, `word-audio`,
`section-audio`) accept `--voice <name> --model <id> --out <dir>`; run `pnpm gen help`
for the full per-command flag list.

**A typical session:**

```
pnpm gen prep --lang zh-Hant --in source.txt --store ws.json --target 0.95 \
  --out source.prepared.json
#   → fill the empty glossary slots from the printed prompt, with your agent
#   (without --out, prep writes Inbox/<lang>/<slug>.prepared.json and prints the path)
pnpm gen verify --in source.prepared.json --fix
#   → "✓ verified — ready to read."
```

### The six prompts (`scripts/gen/prompts/`, model-neutral)

- **`content-prep.md`** — turn a source into a `tsumugu/prepared-content@1` file with
  every likely-unknown word **pre-resolved** (gloss, reading, pos, level, 1–2
  examples, leveled monolingual `explanation`); aim for `ciTarget` coverage, recycle
  directed targets ≥3×, apply the OpenCC guard, add `bridge` boxes for
  Sino-Vietnamese, ground — don't fabricate. Hands off to `verify.md`.
- **`transcript-commentary.md`** — companion commentary on the *hard* sections of a
  transcript (colloquial/slang/idiom/cultural/particle/register); leveled monolingual;
  optionally enrich `explanation` fields; don't re-segment or re-time; flag
  uncertainty (auto-captions mishear). Runs alongside `content-prep.md`.
- **`wiki-page.md`** — one durable, canonical wiki page per word/idiom (Karpathy
  llm-wiki style); strict frontmatter contract; body sections (meaning, etymology,
  related wikilinks, reading examples, usage, [vi] Hán-Việt box); link to related
  pages rather than copying their content.
- **`encoding-page.md`** — a memory-encoding page for an SRS word (`type: encoding`):
  etymology/character story, vivid mnemonic, semantic associations, "why it's tricky"
  (answers the user's flag note), vivid example, [vi] bridge. Encode, don't pad;
  ground etymology, flag speculation.
- **`bridge.md`** — produce a `BridgeInfo` connecting a Sino-Vietnamese word to its
  Chinese etymon (only genuine Sino-Vietnamese; morpheme alignment; 0–1 confidence;
  cross-seed when the etymon ∈ known Hanzi; Traditional etymon; cache into
  `BridgeRegistry`).
- **`verify.md`** — pre-read verification: OpenCC guard (scan all token text +
  glossary keys + string fields, convert, **hard-fail if Simplified remains**), CI
  re-score (`l4/known/ignored` = known), coverage-of-unknowns (every unknown token
  needs a glossary entry), recycle ≥3× in directed mode, bridge sanity. Output a
  corrected file + report; it leaves `Inbox/` only on the user's confirm.

---

## Boundaries

- ✅ **Always** — route all platform IO through ports · keep generation in batch
  scripts that write files · pass the OpenCC guard on output from any
  Simplified→Traditional (zh-Hant) pack · keep algorithms public and data private ·
  co-locate tests (`*.test.ts` beside source) ·
  version JSON schemas (`tsumugu/word-store@2`, `tsumugu/prepared-content@1`,
  `tsumugu/transcript-cues@1`; older versions still load).
- ⚠️ **Ask first** — schema changes to baked files · adding a new port · touching the
  word store · changing a default recorded in [`DECISIONS.md`](./DECISIONS.md).
- 🚫 **Never** — add a backend to the core · call a paid LLM in the core loop · commit
  dictionaries / personal vocab / keys to the public engine · write to vault/disk
  without explicit confirm · let an LLM run inside the gen CLI · leave Simplified in
  output from a zh-Hant (Simplified→Traditional) pack.

---

## Conventions

- **TypeScript, ESM, strict** — `verbatimModuleSyntax`, `noUncheckedIndexedAccess`,
  project references. `"type": "module"`. Vitest (tests), Vite (web app), `tsx` (node
  scripts). pnpm `11.5.1`, Apache-2.0.
- **Engine stays DOM-/network-/data-free** — platform-specific → host behind a port;
  language-specific → a pack.
- **Tests co-located** (`*.test.ts` beside source) across engine, web app, CLI lib,
  and private packs.
- **JSON schemas are versioned**; older versions still load.
- **Defaults are reversible** — [`DECISIONS.md`](./DECISIONS.md) records each PRD §12
  resolution; flag any you want to change.

---

## Where to look

- **What + why (source of truth):** [`PRD.md`](./PRD.md) (§6 architecture, §11 phases,
  §12 open questions).
- **Current state, audited test counts:** [`STATUS.md`](./STATUS.md).
- **Architecture, ports, the file boundary:**
  [`docs/03-architecture.md`](./docs/03-architecture.md).
- **The reading loop:** [`docs/04-the-loop.md`](./docs/04-the-loop.md).
- **Extending the engine + verify recipe:**
  [`docs/06-extending.md`](./docs/06-extending.md).
- **Authoring a language pack:** [`PACK-AUTHORING.md`](./PACK-AUTHORING.md).
- **Decisions log:** [`DECISIONS.md`](./DECISIONS.md).
- **Docs index:** [`docs/README.md`](./docs/README.md).

Each unit of work: **plan → approve → build → review.**
