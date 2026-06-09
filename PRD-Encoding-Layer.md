---
title: "PRD — Tsumugu Encoding Layer: the SRS memory page (consumes two dictionaries + the example set; owns etymology / mnemonic / why-it's-tricky / related + the FSRS click-through)"
type: prd
status: draft
created: 2026-06-09
updated: 2026-06-09
license: Apache-2.0
owner: Wedge (primary user/learner)
sibling_prd: "PRD-Dictionary.md — owns the two definition layers, the example-sentence store, their generation, the leveling/defining-vocabulary verifier, packaging/licensing, and the toggle's data (referenced here, never redefined)"
design_target: "personal/mockups/mockup-3-encoding.html (熱鬧 — locked layout; two known fidelity caveats reconciled in §0)"
languages:
  - zh-Hant (Traditional Mandarin, Taiwan) — primary / proving pack
  - vi (Vietnamese) — via the Hán-Việt bridge
links:
  - "[[PRD]] (§5.5 encoding-layer pages, §2 criterion 8, §2.8 pull SRS, §5.2 status model)"
  - "[[PRD-Dictionary]] (sibling — supplies the two definitions + example-sentence store + leveling verifier + toggle data; Contract §D)"
  - "[[PRD-Voice-Notes]] (Serena/Qwen3-TTS batch audio; word-audio@1 + voice-notes@1 manifest precedent)"
  - "../tsumugu-wiki/ARCHITECTURE.md (encoding = atom twin; word: audit key; linter invariants #4/#5; D2 etymology ownership)"
tags:
  - prd
  - tsumugu
  - encoding-layer
  - srs
  - memory
  - comprehensible-input
---

# PRD — Tsumugu Encoding Layer

**The encoding-layer page is the per-word *memory* surface Tsumugu opens when you click a due word in pull-SRS review. It is a retrieval surface first and a reference second: its one job is to make a word *stick*. It CONSUMES the two definitions and the everyday example set the Dictionary PRD produces, and it OWNS the retention layer on top — etymology / character story, mnemonic, "why it's tricky" (your flag note), related words, the FSRS review click-through, and the page's batch generation + offline rendering. One batch-generated, versioned artifact, rendered identically in the app and as the Quartz wiki twin. No paid API in the loop; everything is pre-baked and read offline.**

> **Sibling split (Contract §D), stated once.** The **Dictionary PRD** owns the two definition layers (English; leveled monolingual 簡明中文), the example-sentence store, the sourcing/generation of those, the **leveling / defining-vocabulary verifier** that produces the per-definition "leveled" verdict, storage/packaging/licensing, and the toggle's data. This **Encoding PRD** owns the *page that assembles them into a memory artifact* plus the encoding-only content (etymology / mnemonic / why-tricky / related), the **grounding + selection-criteria gates**, and the SRS click-through. Where this doc names `definitions:{en,zh}` or the example object shape, it is **stating the shared contract** (Contract §E), not redefining the Dictionary PRD's internals. The schema lives in `@tsumugu/engine` and both PRDs cite it. We reference each other; we do not redefine each other.

---

## 0. Decision log (decisions + overrides, on the record)

- **✅ Design target locked = `personal/mockups/mockup-3-encoding.html`** (word 熱鬧). A fixed two-column work area: a **300px pull-SRS rail** on the left + the **encoding page** on the right. Page order: header (term · zhuyin+pinyin reading · POS · TOCFL · term audio · SRS status pill · flag note) → two-card **Definition** section with an `English | 簡明中文` **default selector** → numbered `例句 · Example sentences` list (translation + per-row audio) → bottom row of **Character story** (etymology) + **Why it's tricky · related**. Mockups 1 (reader) and 2 (synced video) are the approved design language. **Two known mockup-fidelity caveats are reconciled below (the character-story grounding marker, and the 簡明中文 leveling caption); the rendered DOM will match the mockup *as amended*, not the current mockup byte-for-byte (§2.2).**
- **✅ OVERRIDE of Contract §A on the encoding page — both definition cards are co-present; the control sets a persisted *default*, not visibility.** Contract §A reads "the reader + encoding page show ONE at a time; the user sets a default and toggles instantly." We **override that for the encoding page only**: the locked mockup ships **both cards co-present** (`.defgrid`, mockup lines 174-185 — `.defcard.en` and `.defcard.zh` both visible), because on a full page there is room for both and **co-presence aids contrast / elaborative encoding** (English ↔ 簡明中文 side by side is itself a hook). On the encoding page the `English | 簡明中文` control therefore sets a persisted **default pin** (which card leads / is marked `default`), it does **not** hide the other card. **The reader hover keeps one-at-a-time** (default card + inline flip to the other) — a glance surface has no room for two full cards, and §5.7 keeps hover lightweight. **This split must be ratified in three places:** (1) the Contract amended to "both stored; encoding page renders both with a default pin; reader hover shows one at a time"; (2) **PRD-Dictionary §5.6 aligned to the same split** (its reader-hover wording — default + inline flip — already matches; its encoding-page wording must say *both cards*); (3) the control is **captioned "default selector / pin," not "toggle,"** on the encoding page so a user never expects a card to disappear. The mockup's own caption ("two dictionaries — switch your default anytime") already reads as a default-selector. See §12 Q1.
- **✅ The page is a *retrieval surface first, a reference second.*** A static always-visible gloss turns every visit into passive re-study — the weakest form of learning. In **study mode** the page renders meaning **reveal-on-demand** (term + one i+1 example shown first; both definition cards behind a reveal), reusing the reader's existing **guess-first** mechanism (`AppSettings.guessFirst`, `apps/web/src/state.ts:47`). **Reference mode** (both cards open) is the non-study default. The default per entry-point is an open question (§12 Q2).
- **✅ TWO definitions, both stored, one *default*, instant offline switch** (Contract §A, overridden per above). Replaces today's single `DictEntry.gloss` / `PrebakedEntry.gloss` string (`DictEntry.gloss` is `types.ts:125`; `PrebakedEntry.gloss` is `types.ts:280`). The mockup ships **both cards co-present** (`.defgrid`); the control sets the persisted **default** (it does not hide the other card). The 簡明中文 card is **monolingual + level-capped**, OpenCC-guarded; **its caption names the resolved cap, not a hard-coded "A2"** (see the leveling-caption caveat below). The definition *data* and its leveling verdict are owned by the Dictionary PRD; we consume `definitions:{en,zh}`.
- **✅ 3–6 everyday example sentences per word, each `{text, translation, reading?, audio?}`** (Contract §B) — AI-generated in batch, simple/common/usable, recycling the learner's known words. Replaces `PrebakedEntry.examples?: string[]` (`types.ts:285`). The mockup shows **four numbered rows** (target-word emphasized, EN translation, per-row 🔊). This everyday-usage set is **distinct from** the single "vivid personal example" already in the encoding spec — both exist. The example *store* is owned by the Dictionary PRD; we consume `ExampleSentence[]` and enforce its acceptance criteria at the page (§5.3). **Lock the count at 3–6 with the mockup's 4 as the prove-out instance, pending §12 Q3.**
- **✅ The two encoding surfaces get UNIFIED.** Today the batch-authored Markdown twin (rich etymology/mnemonic) is **never read by the app** — `apps/web/src/encoding/encoding.ts` re-renders a `ResolvedHover` from the prebaked glossary, so agent-authored prose is invisible in-app. We fix this: the app reads **one consumed artifact** (`encoding-page@1` JSON) so mnemonics/etymology surface offline, with `mergeHover` as the graceful fallback for words that have no artifact yet. The Markdown twin stays the human/Quartz-published view, derived from the same source.
- **✅ Every element earns its place by serving a named memory principle** (retrieval, desirable difficulty / i+1, elaborative encoding, dual coding, encoding variability, provenance). Anything that serves none is cut — "encode, don't pad" (`scripts/gen/prompts/encoding-page.md`). The page maps each section to its principle (§5.1).
- **✅ Etymology/mnemonic are GROUNDED or LABELED, never asserted as fact — INCLUDING the mockup's own character story.** A wrong mnemonic encodes a falsehood the learner must later unlearn (the top LLM-wiki risk). Each etymology/mnemonic carries a `grounding` tag (`sourced` | `mnemonic-device` | `speculative`) + optional `confidence`; un-cited and device-only content renders a visible "memory device, possibly non-historical" marker. **The locked mockup's character story (`熱 rè … + 鬧 nào noisy (鬥 fight around 市 market) → …`) is an *unsourced folk decomposition* — exactly the failure mode this rule names.** It is **re-graded `grounding: "mnemonic-device"` and the shipped renderer adds the visible marker** (so the rendered DOM differs from the current mockup glyph-for-glyph; §2.2). We do **not** use 鬥+市 as the canonical "grounding done right" payoff example — §5.4 picks a payoff that is either genuinely sourced (and cited) or clearly tagged. We prefer **true elaboration** (real collocations, real related words, real contrast pairs) over invented hooks. The linter rejects an un-tagged character story.
- **✅ Quality is MEASURED today; this PRD MAKES it BLOCKING.** Generated example sentences and the 簡明中文 definition are scored by the project's existing CI metric — **but that metric is currently reported-only, not enforced**: `cmdVerify` blocks solely on `missingGlossary.length > 0 || (openccChanged && !--fix)` (`cli.ts`); `meetsTarget` is printed, never gates the exit, and `verifyContent` scores the *passage* (`content.tokens`), not standalone example/definition strings. So a **blocking CI branch + a per-string CI scorer** are **NEW work this PRD adds** (§5.5, §6.6). **Sourced-from-your-reading sentences are preferred over synthetic** (provenance + episodic hook); synthetic ones must pass the new CI + OpenCC gates.
- **✅ The leveling / defining-vocabulary VERDICT is the Dictionary PRD's; this page CONSUMES it.** Per Contract §D, PRD-Dictionary §5.3 / Phase D2 owns the leveling verifier (`scripts/gen/lib/level-check.ts`: segment → decomposition-aware band check → repair loop → escalate/label). **This Encoding PRD does not re-run that check.** It treats a definition lacking a "leveled" verdict (or carrying an above-cap flag) as a **load-time acceptance failure** — the renderer blocks/drops it. Encoding-owned gates are the **grounding lint** and the **selection-criteria checks** only (§5.5).
- **✅ SRS stays pull-based, client-side, FSRS via `ts-fsrs`.** `getDue(store.all(lang), clock)` → click → `#/encoding/<word>` → grade with `reviewSrs` on the rail. The encoding page is **read-only w.r.t. SRS** — it reads `entry.srs.state` for the status pill but never grades, never schedules, never nags (Contract §C). The FSRS module lives in `packages/engine/src/srs/fsrs.ts`.
- **✅ Back-compat by versioned schema** (Contract §E). New fields ride `prepared-content@2` + a new `encoding-page@1`, **porting** the `word-store@1|@2` precedent (`types.ts:261,268,270`). **The prepared-content parser does NOT yet tolerate versions:** `isPreparedContent` (`content/prepared.ts:47`) does strict equality `x.schema !== PREPARED_CONTENT_SCHEMA` against the `@1` literal, and `PreparedContent.schema` is a single string literal (`types.ts:300`). So **rewriting `isPreparedContent` to an accept-list (`@1 | @2`) and widening the type to a union is net-new work BEFORE `@2` exists** — not an inherited tolerance. Forward-compat caveat: a `@2` file will not load in an app built before this change. `mergeHover` gains a back-compat path that lifts a legacy single `gloss` into `definitions.en` and legacy `string[]` examples into `[{text, translation: ""}]`.
- **✅ Wiki twin reconciled to its schema.** `buildEncodingPage` must emit the `word: <NFC term>` audit field (`ARCHITECTURE.md` §3 / §4 invariant #4) and the filename must be **Unicode-NFC-normalized** with a reject-and-`slug:`-override rule (`ARCHITECTURE.md` lines 121-122), not bare `slugify(word)` (`cli.ts:324`). **(Note: for single CJK terms `slugify` already returns the term unchanged — `slugify('熱鬧')='熱鬧' — so the real gaps are (a) `slugify` does not NFC-normalize and (b) it silently strips filesystem-hostile chars, e.g. `slugify('C++')='C'`, instead of rejecting and requiring an explicit `slug:`.)** The twin exists **iff** its atom has `encoding: true` (invariant #4: `encoding/{t}.md` ⟺ `words/{t}.md encoding:true` AND `word == term`); twin↔atom 1:1 becomes a CI gate; D2 (invariant #5) keeps etymology owned by the encoding/atom layer (the bundle `vocab.md` must not re-explain it).
- **✅ Encoding content feeds Anki.** Pre-baked encoding content assembles into `AnkiNote{front,back}` (front = an i+1 sentence with the target as the one unknown; back = minimal gloss/reading + `[sound:…]`), so due words can be drilled outside Tsumugu. The exporter exists (`packages/engine/src/anki/exporter.ts`); the note-assembly bridge is new here. **The note guid must be keyed on the stable term (not on `front+back`)** — the exporter currently hashes `front + "\x1f" + back` (`guidFor`, exporter), so regenerating a sentence/definition would change the guid and orphan the learner's review history. The bridge supplies a stable seed (§6, §3).
- **No paid API in the core loop.** All generation is batch (Claude Code / Grok Build run scripts that WRITE files); the app only READS files (Contract §C).

---

## 1. Problem

Clicking a due SRS word should open a page **built to make the word stick** — etymology, a grounded mnemonic, the specific confusion you flagged, related words, and several usable example sentences with audio — in two languages you can switch between instantly, fully offline. Today the encoding layer is half-built and split in two:

1. **The data model can't carry it.** `DictEntry.gloss` (`types.ts:125`) and `PrebakedEntry.gloss` (`types.ts:280`) are each a *single string*. There is no second definition anywhere (zero hits for `definitions|簡明|defZh` in source). `AppSettings.explanationLang: "target"|"en"` (`state.ts:35`, default `"target"` at `state.ts:78`) is a label **with nothing to switch to** — there is one stored definition, documented as "monolingual-leveled default, *or* L2 toggle," i.e. one slot meant to hold *either*, not both.
2. **Examples are the wrong shape and nearly empty.** `PrebakedEntry.examples?: string[]` (`types.ts:285`) — plain strings, **no translation, reading, audio, or count target.** The content-prep prompt asks for "1–2 examples" (`content-prep.md:17`); the encoding surface shows a single "Vivid example." The everyday-usage set the mockup shows (four simple, translated, audio-bearing, known-word-recycling sentences) **does not exist** as a type, store, generator, or renderer. And `cmdWiki` passes **no examples** into `buildEncodingPage` (`wikiInputFromStore(entry, dict)`, only two args, `cli.ts:320`), so even string examples never reach the page.
3. **The two encoding surfaces are disconnected.** The batch-generated Markdown twin (`buildEncodingPage`, `scripts/gen/lib/wiki.ts:104`) holds the rich agent-authored etymology/mnemonic. The in-app view (`apps/web/src/encoding/encoding.ts`) **never reads it** — it reconstructs a thin page from `mergeHover`'s single `explanation`/`examples` strings. The best content is invisible where the user actually clicks.
4. **The page fights memory by default.** An always-visible gloss makes the page pure re-study. Nothing currently renders the page in a recall-first mode, and `senses?: Sense[]` exists on `DictEntry` (`types.ts:127`; the `Sense` interface is `types.ts:115`) but `mergeHover` drops it — the "concise gloss + senses" half of Contract §A.1 has a field but no pipeline.
5. **The wiki twin diverges from its own schema.** Filenames go through `slugify(word)` (`cli.ts:324`) which is **not Unicode-NFC-normalized** and silently strips filesystem-hostile chars (`ARCHITECTURE.md` lines 121-122 require NFC + an explicit reject-with-`slug:` rule); the `word:` audit field required by `ARCHITECTURE.md` §3 + linter invariant #4 is never emitted; twin↔atom 1:1 (#4) and D2 etymology-ownership (#5) are spec-only.

We close all five so that one batch-generated, versioned, offline artifact powers a retention-effective page in both the app and the wiki.

---

## 2. Goals & success criteria (concrete, checkable)

**Data model + back-compat (engine, data-free):**

1. The engine carries `definitions: { en?: Definition; zh?: Definition }` and `examples: ExampleSentence[]` where `ExampleSentence = { text; translation; reading?; audio?; source?; sense? }`, on a versioned `prepared-content@2` + a new `encoding-page@1`. **The prepared-content parser is rewritten from strict schema-equality to an accept-list (`@1 | @2`)** (mirroring the word-store loader, which prepared-content does NOT yet have) so **a `prepared-content@1` file still parses** (missing fields absent). `mergeHover` lifts a legacy `gloss` into `definitions.en` and `string[]` examples into `[{text, translation: ""}]` so old packs render. *Checkable: bind to the parser rewrite — a strict-`@1` fixture and a `@2` fixture both pass the upgraded `isPreparedContent`; a unit test asserts both `mergeHover` lifts.*

**The page (consumes the Dictionary PRD's data; owns the memory layer):**

2. Opening `#/encoding/<word>` renders **synchronously from a single pre-baked artifact** — no live call, no second fetch after the file read — in this order: **term · reading (zhuyin + pinyin) · POS · TOCFL · term audio · SRS status pill · flag note**; then **two definition cards** (English | 簡明中文) co-present with a persisted **default pin** and an instant offline switch; then the **numbered example set** (3–6, target-word highlighted, EN translation, per-row 🔊); then **two bottom cells** — character story (etymology, **with the grounding marker the renderer adds**) and "why it's tricky · related." *Checkable (load-bearing): a test double on the File System Access port shows **zero network requests** after the artifact read, and the rendered DOM matches `mockup-3-encoding.html` section order **as amended in §0** (character-story marker present; 簡明中文 caption = resolved cap). Non-gating target: p50 cold render < 150 ms on the reference machine (§9).*
3. **The app reads the batch-generated encoding artifact**, so agent-authored etymology/mnemonic/related appear in-app (not just in the Markdown twin). *Checkable: a generated `encoding-page@1` field for 熱鬧 (e.g. the character story) shows in the app view, verified by test.*
4. **Both definitions render as two co-present cards**; the default selector sets the **persisted default pin** (it does not hide the other card); the 簡明中文 card shows its **resolved-cap** caption (not a hard-coded "A2") and a "default" pin on the active card. *Checkable: the default persists across reload; both cards always present; the caption text equals the cap the definition was leveled under.*
5. **Study mode is recall-first:** both definition cards are reveal-on-demand (reusing `guessFirst`), term + one i+1 example shown first; reference mode shows both cards open. *Checkable: with `guessFirst` on, the definitions are hidden until reveal.*
6. **3–6 example sentences** render as a numbered list, each with the **target word highlighted, an English translation, and its own live audio control** (Serena mp3 when present, **Web Speech fallback when absent** — the 🔊 is always functional, never a dead glyph); the everyday-usage set is distinct from the single vivid example. *Checkable: row count 3–6; each row has all three affordances; with `audio` absent, clicking 🔊 still speaks via Web Speech.*
7. The bottom row renders **Character story** (per-character breakdown → composed mnemonic, **carrying its grounding marker**) and **Why it's tricky · related**, where the tricky note disambiguates the *flagged confusable* and related links carry typed affordances (`↔` antonym, `⚠` confusable). The warned term matches the header flag note **end-to-end** (the flag note is read from the resolved word entry — `entry.flagNote`, `WordEntry.flagNote` at `types.ts:235`). *Checkable: header flag ⇄ tricky cell ⇄ related `⚠` reference the same term.*

**Generation & grounding (agent-run batch; no API in the loop):**

8. `pnpm gen encoding --lang <id> --store ws.json [--srs|--flagged|--words a,b]` writes, per selected word: (a) the **Markdown twin** (etymology/mnemonic/why-tricky/related skeleton + `word:` audit field + NFC-normalized filename), and (b) a per-word **`encoding-page@1`** JSON the app consumes; then prints `encoding-page.md` for the agent to fill. *Checkable: running it on a store with a due 熱鬧 produces both files at the contract paths; the twin passes wiki linter invariants #4/#5.*
9. **Every etymology/mnemonic carries `grounding` (+ optional `confidence`)**; speculative/device content renders with a visible marker; zero etymology ships as bare authoritative fact. *Checkable: the schema requires the field; the renderer shows the marker; the linter rejects an un-tagged character story (including the re-graded mockup story, which now carries `mnemonic-device`).*
10. **NEW blocking CI branch + per-string CI scorer.** Example sentences and the 簡明中文 definition are scored as standalone strings (a per-string scorer that does not exist today) and `cmdVerify` exits non-zero when one scores below the 0.95 target (the target word allowed as the one permitted unknown so the headword does not penalize the sentence). They also pass **OpenCC (Taiwan-idiom)**; Simplified is rejected, naming the offender; sentences recycle the learner's known-word set where possible. *Checkable: `gen verify` exits non-zero on an over-CI or Simplified-bearing example/definition; a unit test asserts the new blocking branch fires; the run reports the known-word-recycling ratio.*
11. **The leveling verdict is consumed, not produced here.** The page treats a 簡明中文 definition that lacks the Dictionary PRD's "leveled" verdict (or carries an above-cap flag) as a **load-time acceptance failure** (the card is blocked/dropped, naming the offending word from the upstream verdict). *Checkable: a definition arriving without a "leveled" verdict does not render; the renderer surfaces the upstream offending-word reason. (The verifier that produces the verdict is PRD-Dictionary Phase D2.)*

**SRS click-through (unchanged contract):**

12. From review, clicking a due word (or "Open encoding page") routes to `#/encoding/<word>`; grading happens **only** on the rail via `reviewSrs`; the encoding page never grades. *Checkable: opening the page does not advance FSRS state.*

**Wiki twin (reconciled to its schema):**

13. The twin lives at `{lang}/encoding/{NFC term}.md`, carries `word: <term>`, exists **iff** its atom has `encoding: true`, and the twin↔atom 1:1 map passes the linter (invariants #4/#5). *Checkable: linter green on the 熱鬧 twin + atom.*

**Integration:**

14. The same pre-baked encoding content feeds **Anki export** (front = sentence with the target word; back = minimal gloss/reading/audio), with the **note guid keyed on the stable term** (lang + NFC term [+ sense index]) so regenerating the sentence/back **updates the same note** instead of orphaning history. *Checkable: an exported `.apkg` carries the encoding word with a sentence card + embedded audio; re-exporting after regenerating the sentence keeps the same guid (verified by test).*

---

## 3. Scope

### In scope (v1)

- **Engine data model**: `Definition`, `definitions:{en,zh}`, `ExampleSentence`, the `encoding-page@1` artifact (`EncodingPageDoc`), `prepared-content@2`, **the parser rewrite to an `@1|@2` accept-list** + the `mergeHover` lifts (legacy `gloss`, legacy `string[]` examples, and `senses` finally flowing into `definitions.en.senses`). Types only — engine stays data-free.
- **The page (app)**: rewrite `apps/web/src/encoding/encoding.ts` to consume `encoding-page@1` (with `mergeHover` as the fallback for un-generated words); two co-present definition cards + persisted **default pin** + instant offline switch; numbered example set with per-row audio (Web Speech fallback); etymology (with grounding marker) + why-it's-tricky + related cells; recall-first study mode (reuse `guessFirst`); header per mockup §2.
- **The page's own content**: etymology / character story, mnemonic (grounding-tagged), "why it's tricky" (seeded from `flagNote`), related (typed `↔`/`⚠` links), and the single vivid personal example (distinct from the everyday set).
- **The reader hover** gains the same definition data **one-at-a-time** (default card + inline flip), and richer examples (consume-side only; the popup already exists, `reader.ts`).
- **Generation**: a `gen encoding` command that writes the Markdown twin **and** the `encoding-page@1` JSON; `encoding-page.md` prompt changes (two definitions, 3–6 recycled sentences, grounding tags); `buildEncodingPage` fixes (emit `word:`, NFC filename + reject-and-`slug:` rule); pass examples through `wikiInputFromStore` (the third arg, currently never passed).
- **Gates (encoding-owned)**: the **new blocking per-string CI branch** in `gen verify` (examples + 簡明中文 definition through OpenCC + the new CI scorer); the **grounding lint** on etymology/mnemonic; the §5.3 **selection-criteria checks**. The leveling/defining-vocabulary verdict is **consumed** from PRD-Dictionary, not produced here.
- **Audio**: per-sentence + term-level Serena/Qwen3-TTS via the existing batch path + a `word-audio@1`-style manifest (consume-side rendering of 🔊; Web Speech fallback so the control is always live).
- **Wiki twin reconciliation**: NFC filenames + reject-and-`slug:` rule, `word:` field, twin↔atom linter gate.
- **Anki bridge** for encoding content (note assembly from the artifact), **with a term-keyed guid** (not `front+back`).
- **Study mode** (reveal-on-demand) reusing `guessFirst`.

### Out of scope (v1) — owned elsewhere or deferred

- **Sourcing the English dictionary data; the defining-vocabulary generator that writes the leveled 簡明中文 definitions; the leveling/defining-vocabulary VERIFIER (`level-check.ts`) that produces the "leveled" verdict; the example-sentence store's storage/packaging/licensing; the toggle's data.** Owned by the **Dictionary PRD** (Contract §D, PRD-Dictionary §5.3 / Phase D2). This PRD consumes their outputs/verdicts and specifies the *grounding + selection gates* + the *render*, not those generators/verifiers.
- **TTS generation.** Owned by the **Voice-Notes PRD**; we only reference produced audio (Serena via Qwen3-TTS; Web Speech fallback).
- **Live/real-time LLM lookups, a scheduler/notifications, server backend** (all forbidden by Contract §C / PRD §3).
- **Images / pitch-accent visualization** as a second dual-coding code (audio is the v1 second code; visual is a later enhancement).
- **vi-specific defining vocabulary** beyond reusing the Hán-Việt bridge box (vi leveling data is rough; vi ships with English + the bridge for v1, deferred to §12 Q8).

---

## 4. Users & use cases

**Primary: Wedge** — intermediate+ zh-Hant (Taiwan), beginner vi; learns by comprehensible input; uses pull SRS + Anki; runs his own agents for batch generation. Also any learner; the engine + page are language-agnostic, the data is private.

- **U1 — Review → encode (the core loop).** Open pull-SRS → due word `熱鬧 now` → click → the encoding page opens with both definitions, four usable sentences (audio each), the character story (marked as a memory device), and the exact confusion he flagged (`confuses with 鬧鐘`). He reads, sets 簡明中文 as default to test his monolingual comprehension, plays a sentence, returns to the rail, grades **Good 6d**. *The page makes the word stick; the rail schedules it.*
- **U2 — Study-mode retrieval.** With study mode on, the page shows term + one i+1 sentence with the meaning hidden; he attempts recall, reveals, then reads the elaboration. *Forces retrieval before re-reading.*
- **U3 — Set the default.** He sets 簡明中文 as his default once; every word page leads with the leveled monolingual card (English still co-present, pinned non-default), and the reader hover now leads with the monolingual card, English one tap away — instant + offline.
- **U4 — Deep dive from the reader.** Clicking "Deep dive" in the reader hover popup (`reader.ts:469-481`) opens the same encoding page for any word, not only SRS-due ones.
- **U5 — Disambiguating a flagged confusable.** He flagged 熱鬧 as "confuses with 鬧鐘"; the tricky cell speaks directly to that, and the related row warns `鬧鐘 ⚠`. *His own confusion is the page's content.*
- **U6 — Batch generation.** He runs `pnpm gen encoding --srs --store …`; an agent fills the etymology/mnemonic/why-tricky and the example set; `gen verify` blocks on OpenCC + the new CI scorer + grounding + selection criteria (and refuses a definition missing the Dictionary PRD's leveling verdict); he promotes on confirm. The app picks up the new `encoding-page@1` files; the wiki twin publishes via Quartz.
- **U7 — Export to Anki.** Sends the word (sentence + audio + minimal back) to Anki for shadowing/drilling away from Tsumugu; re-runs next month with a regenerated sentence and the **same card updates** (term-keyed guid).
- **U8 — vi via Chinese.** A vi word's page shows the Hán-Việt bridge box (`hover.bridge`) tying known Chinese to the new word.

---

## 5. Core design

### 5.1 The page model (every element serves a named memory principle)

One page, two renderers (app DOM + Markdown twin), **one source** (`encoding-page@1` per word). The page is organized so each element forces a memory principle; anything that serves none is cut.

| Memory principle | Where it lives on the page |
|---|---|
| **Retrieval practice** (strongest lever) | Study mode: term + one i+1 example shown, meaning revealed on demand (reuses `guessFirst`). The page can be consumed recall-first. |
| **Desirable difficulty / i+1** | Example sentences are CI-gated to ~95% known so the retrieval attempt is hard enough to matter, easy enough to succeed. |
| **Elaborative encoding** | The two **co-present** definitions (English ↔ 簡明中文 contrast), the character-story breakdown, the contrast pair in "why it's tricky," and typed related links — *true* hooks, not invented ones. |
| **Dual coding** | Audio at term scope and per example sentence (Serena; Web Speech fallback); reading shown as zhuyin **and** pinyin. |
| **Encoding variability** | 3–6 sentences in *different contexts/senses* — variety, not paraphrase (see §5.3 #5 for what "variety" means for a single-sense word). |
| **Provenance / episodic hook** | Sourced sentences show which reading/episode they came from; grounded etymology cites; everything generated is labeled. |

**Section order (the mockup's contract):**

1. **Header** (mockup §2): term `熱鬧` (serif, 52px) · reading line `ㄖㄜˋ ㄋㄠˋ · rènào` (**zhuyin + pinyin**, `·`-separated) · POS/level `adjective · TOCFL B1` · term audio 🔊 · right-aligned **status pill** ("Learning ②" from `entry.srs.state` + reps) and **flag note** ("⚑ confuses with 鬧鐘" from `entry.flagNote`, `WordEntry.flagNote` at `types.ts:235`).
2. **Definition** (§5.2): two **co-present** cards (`.defgrid`), persisted default pin, instant offline switch.
3. **例句 · Example sentences** (§5.3): numbered 3–6, target-word `<em>`-highlighted, EN translation, per-row 🔊 (live via Web Speech when no mp3).
4. **Bottom row** (§5.4): **Character story** (etymology, with grounding marker) cell + **Why it's tricky · related** cell.

**Layout (matches mockup-3):** left 300px pull-SRS rail; right page = header → Definition → 例句 → bottom row. A "read" serif family (Kaiti/STKaiti/BiauKai/PingFang TC) for all CJK glyphs; Inter/system sans for chrome.

**Study vs reference mode.** Default reference mode shows both definition cards open. Study mode (driven by `guessFirst`) hides both definition cards behind a reveal and leads with term + one i+1 example — recall-first.

### 5.2 The two-dictionary cards (consume-side; data + leveling verdict owned by the Dictionary PRD)

The page reads `entry.definitions: { en?: Definition; zh?: Definition }` (resolved through `mergeHover`, §6.3). It renders **both cards co-present** (`.defgrid`, per the §0 override of Contract §A); the **default selector** sets the persisted default pin, it does **not** hide the other card:

- **English card** (`.en`): `gloss` (concise) + `senses[]` (the half of Contract §A.1 that today's dead `Sense[]` field — `DictEntry.senses` at `types.ts:127` — finally feeds) + an "explanation" line. Carries the **"default" pin** when English is the user's default.
- **簡明中文 card** (`.zh`, accent-tinted): leveled **monolingual** `gloss` + explanation (serif), sub-labeled with the **resolved cap it was leveled under** ("簡明中文 · leveled, monolingual · {cap}", where `{cap}` is the band the Dictionary PRD's verifier used — **not a hard-coded "A2"**; see the leveling-caption caveat below). OpenCC-guarded Traditional.

The **default selector** (pill, two segments `English | 簡明中文`) sets the persisted **default** — we repurpose `AppSettings.explanationLang` from a label with nothing to switch to into a real selector over `definitions.en` vs `definitions.zh` (so it finally has two data fields to choose between, fixing the `state.ts:35` gap). **Value migration (back-compat):** the current default is `"target"` (`state.ts:78`), not `"en"`; on read, `"target" → "zh"` and `"en" → "en"`, so a user who set a preference before this change does not silently get the wrong card. The first-run default (English vs 簡明中文, per-language) is §12 Q1. **First-paint precedence:** once the user has ever set the default, `AppSettings.explanationLang` wins; `EncodingPageDoc.defaultDefinition` is only a generation-time fallback hint consulted on first paint before any preference exists. The switch is **instant + fully offline** because both definitions are pre-baked. The reader hover uses the **same default but one-at-a-time** (default card + inline flip; §5.7). The legacy single `gloss` maps to `definitions.en.gloss` on read, so old data still renders.

> **Leveling-caption caveat (mockup fidelity vs the gate).** The locked mockup captions the 簡明中文 card "uses only A2 words," but its own definition text — `（形容）人多、又吵又有活力…像夜市、廟會、過年的街上那種氣氛` — contains 活力 / 廟會 / 氣氛 / 形容, which read above A2. The exemplar would fail an A2 gate. **Resolution: the cap is the headword's own band (B1 here), not a fixed A2 floor** — so the caption renders the **resolved cap** the Dictionary PRD's verifier used, and the mockup's "A2" caption is amended to that resolved cap before Phase 0 is declared done. This forces deciding §12 Q5 (fixed band vs known-words set) and reconciling with PRD-Dictionary §12 Q1 now, because the mockup currently asserts A2 while the header word is B1.

> **Defining-vocabulary discipline (verdict owned by the Dictionary PRD; trusted at render).** The 簡明中文 definition is only as useful as it is comprehensible: a monolingual definition containing unknown words breaks the comprehensible-input contract and is worse than an L1 gloss. The page *displays* it and **refuses to render a definition that lacks the Dictionary PRD's "leveled" verdict** (criterion 11). The defining set may **grow with the learner** (his known-words list *is* the defining vocabulary), which Tsumugu can do and a static dictionary cannot — that policy lives in the Dictionary PRD's verifier (§12 Q5).

### 5.3 The everyday example set — SELECTION CRITERIA (consume-side shape + binding acceptance)

Each word carries `examples: ExampleSentence[]`, `3 ≤ len ≤ 6`, rendered as a numbered list. The Dictionary PRD's generator must satisfy these criteria; the page **renders only sentences that pass** (a row missing a translation, or below the CI floor, does not render):

```ts
interface ExampleSentence {
  text: string;          // zh-Hant, OpenCC-guarded; target word emphasizable
  translation: string;   // English
  reading?: string;      // optional zhuyin/pinyin for the sentence
  audio?: string;        // optional per-sentence Serena mp3 (manifest-relative); 🔊 falls back to Web Speech when absent
  source?: string;       // provenance: which reading/episode it came from (or "synthetic")
  sense?: string;        // which sense this example illustrates (multi-sense words)
}
```

1. **Count: 3–6, capped low.** More sentences ≠ more retention past i+1. A single perfectly pitched sentence beats five padded ones. Cap 6, floor 3 (the mockup ships 4; lock the band pending §12 Q3).
2. **Difficulty ladder anchored to i+1.** Each sentence is ~95–98% known vocabulary for *this* learner, with the **target word as the only (or near-only) unknown**. We score each sentence with the **new per-string CI scorer** against the project's 0.95 target (§0, §5.5) — the target word is the one permitted unknown so the headword does not penalize the sentence. Order easiest-first: the first sentence recycles the most known words; later sentences add richer/more variable context.
3. **Recycle known words deliberately.** Prefer sentences built from words the learner already knows (per the word store's status data). This keeps each sentence at i+1 **and** gives spaced re-exposure to known words — itself retrieval practice. This is the advantage a generic dictionary cannot have.
4. **Simple / common / usable, everyday register.** Night-market / New-Year / restaurant register, as in the mockup — concrete, high-frequency, sayable. No literary or rare collocations in this set (those belong to the dictionary's sense examples).
5. **Variety of context, not paraphrase** — *and what "variety" means is type-dependent.* **Multi-sense words** get **one example per major sense**, sense-labeled. **Single-sense words** (like 熱鬧) get genuinely different **situations / collocations** — variety is **not** expected to vary the grammatical role. The four mockup rows (night-market / New-Year / restaurant / mealtime) satisfy this as distinct situations even though all use 熱鬧 predicatively; that is acceptable. The selection lint rejects only near-identical *text* (same situation reworded), not a repeated grammatical frame across distinct situations. (If we want the exemplar to *demonstrate* structural variety, add one structurally different row — e.g. attributive `熱鬧的場面` or verbal `大家一起熱鬧一下` — and re-render; optional.)
6. **Ordering:** (a) most frequent/prototypical sense first; (b) within a sense, most-known-word-recycling first; (c) **sourced sentences (from the learner's real corpus) ahead of synthetic** — provenance adds an episodic hook and lets him verify. Show the source where one exists.
7. **Each row carries** target-word highlighting (`<em>` accent-underline), an English translation, and its own **live** audio control. The 🔊 renders on every row to match the mockup; when `audio` is absent it **falls back to Web Speech**, so the affordance is always a working control, never a dead glyph (whether v1 ships any Serena mp3 for the exemplar is §12 Q9). In mockup row 1, `夜市` **and** `熱鬧` are both emphasized; rows 2–4 emphasize `熱鬧` only.

The page **renders** the set; it does **not** generate it (Contract §D). It **enforces** these as load-time acceptance criteria on the artifact it loads.

### 5.4 Etymology / mnemonic / "why it's tricky" / related (OWNED here) — GROUNDING RULES

This is the retention layer the Encoding PRD owns outright. The grounding rules are non-negotiable because a confidently fabricated etymology encodes a falsehood the learner must later unlearn. In the `encoding-page@1` artifact:

```ts
interface Etymology {
  parts: { char: string; reading?: string; gloss?: string; note?: string }[];
  payoff: string;                                  // the composed whole-word phrase (bolded in render)
  grounding: "sourced" | "mnemonic-device" | "speculative";
  confidence?: number;                             // 0..1; < 0.7 renders a low-confidence marker
  source?: string;                                 // citation when grounding == "sourced"
}
interface Mnemonic { text: string; grounding: "mnemonic-device" | "speculative"; confidence?: number; }
interface Tricky { text: string; confusable?: string; }   // confusable == header flag term
interface RelatedLink { word: string; relation?: "antonym" | "confusable" | "neighbour"; }
```

- **Character story** (mockup §5 cell 1): per-character breakdown (reading + gloss + radical/component note) composed into one whole-word mnemonic, payoff phrase **bolded**. It MUST carry a `grounding` tag:
  - `sourced` — from a real etymological reference; cite it.
  - `mnemonic-device` — a memory image **not** claimed to be historical; renders with a visible "memory device, not necessarily the real origin" marker.
  - `speculative` — best-guess origin with `confidence < 0.7`; renders a low-confidence marker.
  - **Never auto-emit a character story as bare fact.** The generator defaults un-cited origins to `mnemonic-device`/`speculative`; the linter rejects an etymology section with no `grounding` tag. **The locked mockup's own story is the worked example of this rule: `熱 rè … + 鬧 nào noisy (鬥 fight around 市 market) → …` is an unsourced folk decomposition, so it ships re-graded `grounding: "mnemonic-device"` with the visible marker** (which is why the rendered DOM differs from the current mockup; §2.2). We do **not** present 鬥+市 as the canonical "grounding done right" payoff. A correct *sourced* payoff example, when one exists, looks like: `熱 rè "hot" (灬 the fire radical) — attested phono-semantic; source: <字源 ref>` rendered without a marker; an un-cited compositional reading renders **with** the marker.
- **Prefer true elaboration over invented hooks.** Real collocations, real same-radical/same-sound neighbours, real contrast pairs carry the same encoding benefit without the unlearning tax. Mnemonics are **opt-in scaffolding, clearly separated from factual definition/usage** so the learner always knows "this is a trick, not a fact." Mnemonics are personal where possible (reuse a passage the learner just read) — personal salience aids encoding.
- **Why it's tricky** (mockup §5 cell 2, yellow): a contrastive note that disambiguates from the flagged confusable. Seeded from `entry.flagNote` (`Your flag: *…*`, already in `buildEncodingPage`, `wiki.ts:135`; read from `WordEntry.flagNote`, `types.ts:235`, exactly as `cmdWiki` already does at `cli.ts:322`). Consistent **end-to-end**: header flag (`鬧鐘`) ⇄ tricky cell ⇄ related-link `鬧鐘 ⚠`. Mockup body: `熱鬧 = good festive noise. 鬧鐘 = an annoying alarm. Same 鬧, opposite feeling.`
- **Related** (typed links): `↔` antonym/contrast (`安靜 ↔`), `⚠` confusable (`鬧鐘 ⚠`, matching the flag), plain pill for neighbours (`夜市`). Sourced from `entry.related` (`WordEntry.related: WordRef[]`, `types.ts:253`) + agent additions; rendered as mauve serif pills (app) / `[[wikilinks]]` (twin), each a nav link to another encoding page.
- **Vivid personal example** (one) stays distinct from the everyday-usage set of §5.3.

### 5.5 OpenCC + grounding + selection gates (encoding-owned) and the consumed leveling verdict

Run at generation time (via `gen verify`, never in the app). **The leveling/defining-vocabulary check is NOT run here — it is the Dictionary PRD's verifier (`level-check.ts`); the encoding gates consume its verdict.**

1. **OpenCC (Taiwan-idiom, cn→twp).** Both the 簡明中文 definition and every example `text` pass the existing OpenCC guard (`gen verify` already runs OpenCC on prepared content; `verify.ts`, `cli.ts`). Simplified leakage (a known generation failure mode) is rejected/auto-fixed with `--fix`. OpenCC is **already blocking** today.
2. **NEW blocking per-string CI gate.** Today CI is **measured and printed only** — `cmdVerify`'s `blocked` boolean is `missingGlossary.length > 0 || (openccChanged && !--fix)`; `meetsTarget` never gates the exit, and `verifyContent` scores the passage (`content.tokens`), not example/definition strings. This PRD **adds** (a) a **per-string CI scorer** over each `examples[].text` and `definitions.zh` (the target word counted as the one permitted unknown), and (b) a **new blocking branch** folding `!meetsTarget` into the exit condition for the encoding/definition path. Below-target → `gen verify` exits non-zero, naming the offender.
3. **Leveling verdict (consumed, not produced).** The encoding gate **checks for the presence of the Dictionary PRD's "leveled" verdict** on `definitions.zh` and fails the artifact if it is missing or flags an above-cap word — surfacing the upstream offending word. It does **not** segment-and-band-check itself; that is PRD-Dictionary Phase D2.
4. **Grounding lint (encoding-owned).** An etymology/mnemonic section lacking a `grounding` tag is rejected; `mnemonic-device`/`speculative` content must render its marker.
5. **Selection-criteria checks (§5.3, encoding-owned):** count 3–6; each row has a translation; situation variety (no two examples with near-identical *text*; multi-sense words covered one-per-sense); the known-word-recycling ratio is reported.

Gates 1, 2, 4, 5 are **blocking** in `gen verify`. (Gate 2 is the new blocking logic; gate 1 already blocks; gates 4–5 are new encoding-owned blocks.) Transcripts stay raw and faithful; the encoding page is squarely in the synthesized ~0.95-CI layer and inherits this verification.

### 5.6 SRS click-through (OWNED here; unchanged contract, wired to the new page)

- **Rail (left, 300px, pull-based):** header `Review` + due count (`12 due`); subtitle `pull-based · no schedule, no nags`; the due queue (done items dimmed with green ✓ + `+Nd`; the active item accent-highlighted with `now`; pending `·`); a 2×2 FSRS grade grid (`Again <10m` / `Hard 2d` / `Good 6d` / `Easy 15d`) with predicted intervals as `<small>`; footer pinning `FSRS · ts-fsrs · client-side` and `clicking a due word opens this encoding page`.
- **Engine wiring (real):** the rail builds its queue from `getDue(store.all(lang), clock)` (`packages/engine/src/srs/fsrs.ts`, imported into `cli.ts` from `@tsumugu/engine`; review uses `app.clock`). A grade calls `reviewSrs(state, rating, clock)` → persists → `index++`. The card term and an explicit "Open encoding page" button set `location.hash = "#/encoding/<word>"` (`review.ts:22-27,105`; `main.ts:100-117`). **The encoding page never grades** — it is read-only w.r.t. SRS, reading `entry.srs.state` for the status pill only. Pull-based, no scheduler, no nags (Contract §C).

### 5.7 Relationship to hover + wiki (the two-surfaces fix — one source, two/three renderers)

- **Hover (reader popup) stays the lightweight, ONE-at-a-time surface.** Consume-side only. `mergeHover` is extended to resolve `definitions` + the richer `examples` (§6.3); the popup shows the **default** definition card (English or 簡明中文) with an **inline flip** to the other — it does **not** show both full cards, because a glance surface has no room and §0's co-presence override applies to the *encoding page only*. It keeps showing the resolved `reading`/`examples`/`explanation`/`bridge` and offers a "Deep dive" link into the encoding page (`reader.ts:469-481`). The same persisted default governs which card leads. (This matches PRD-Dictionary §5.6's reader-hover wording — default + inline flip — which §0 aligns the *encoding-page* wording to.)
- **App encoding view** is rewritten to read the **`encoding-page@1`** artifact (not just `ResolvedHover`), so the agent-authored character story/mnemonic/related actually render in-app — fixing the two-surfaces split — with `mergeHover` as the graceful fallback for words lacking an artifact (preserving today's behavior for un-generated words). It renders **both** definition cards.
- **Wiki twin (Markdown, Quartz)** is the human-readable derivation of the same artifact, generated by `buildEncodingPage`, reconciled to `ARCHITECTURE.md`: filename = **NFC-normalized CJK term** (with the reject-and-`slug:`-override rule for filesystem-hostile terms), frontmatter carries `word: <term>` (audit key, invariant #4), exists **iff** atom has `encoding: true`, links its atom by bare term `[[熱鬧]]`. D2 (invariant #5) keeps etymology owned by encoding/atoms (the bundle `vocab.md` must not re-explain it). The twin is the *publishable human view*; the `encoding-page@1` JSON is the *app-consumed view*; both derive from the same agent-filled source.

---

## 6. Architecture (open-core, client-side, the file boundary, schema evolution)

### 6.1 Layer map (where files live, who writes them)

- **`@tsumugu/engine` (PUBLIC, data-free).** New **types only**: `Definition`, `ExampleSentence`, `Etymology`, `Mnemonic`, `Tricky`, `RelatedLink`, `EncodingPageDoc`; `prepared-content@2`. **The parser rewrite** (`isPreparedContent` strict-equality → `@1|@2` accept-list; `PreparedContent.schema` widened to a union). `mergeHover` extension + lifts. **No dictionary data, no personal data, no keys.**
- **`scripts/gen` (agent-run, repo-shipped).** `gen encoding` writes the Markdown twin + the `encoding-page@1` JSON; `encoding-page.md` prompt; `gen verify` gains the **new blocking per-string CI branch**, the grounding lint, the selection-criteria checks, and the **leveling-verdict presence check** (consuming the Dictionary PRD's verdict). Runs under Claude Code / Grok Build — **no metered API**.
- **`apps/web` (client-side, offline).** `encoding/encoding.ts` rewritten to consume `encoding-page@1`; reader hover consumes `definitions`/`examples` one-at-a-time; the default selector persists to `AppSettings`. Reads files via the **File System Access API** (existing). **No network at runtime.**
- **Private packs / vault.** The actual `encoding-page@1` JSONs, definition data, example audio mp3s, and the Markdown twins live in the **personal layer / vault** (gitignored), written into `wiki/Inbox/…` and promoted to the Quartz wiki on explicit confirm. Whether the `*.encoding.json` co-locates with the `.md` twin or stays packs-only is §12 Q11. zh definition data licensing is the Dictionary PRD's concern.

**The file boundary (Contract §C):** an **agent runs scripts that WRITE files** (`encoding-page@1` JSON, twin `.md`, per-sentence mp3s); the **app CONSUMES files** (instant, offline). No paid LLM API in the loop; the page is fully pre-baked.

### 6.2 Schema evolution (versioned, back-compat — Contract §E)

**Porting** the existing `word-store@1|@2` pattern (`types.ts:261` union, `:268`/`:270` consts; `load()` accepts both) and the audio-manifest precedents (`word-audio@1`, `voice-notes@1`, `transcript-cues@1`). **Net-new caveat:** prepared-content does NOT yet have dual-version acceptance — `isPreparedContent` (`content/prepared.ts:47`) is strict equality against the `@1` literal and `PreparedContent.schema` (`types.ts:300`) is a single literal, so a `@2` file is rejected by today's parser (forward-incompat for un-upgraded builds). The parser must gain `@1|@2` acceptance **before** any `@2` is written.

**New engine types:**
```ts
interface Definition { gloss: string; senses?: Sense[]; explanation?: string; levelCap?: string; leveledVerdict?: "leveled" | "above-cap"; offendingWord?: string; }
// definitions: { en?: Definition; zh?: Definition }  — zh = leveled monolingual, OpenCC-guarded;
//   leveledVerdict/offendingWord are SET BY the Dictionary PRD's verifier and CONSUMED here.

interface ExampleSentence { text: string; translation: string; reading?: string; audio?: string; source?: string; sense?: string; }

// The app-consumed per-word artifact:
const ENCODING_PAGE_SCHEMA = "tsumugu/encoding-page@1" as const;
interface EncodingPageDoc {
  schema: typeof ENCODING_PAGE_SCHEMA;
  lang: string;
  term: string;                       // NFC CJK; == the wiki twin's `word:` audit key
  reading?: { zhuyin?: string; pinyin?: string };   // header shows both
  pos?: string; level?: string;       // e.g. "TOCFL-B1"  (== the resolved leveling cap)
  audio?: string;                     // term-level mp3 (manifest-relative); 🔊 → Web Speech fallback
  // consumed (Dictionary PRD owns the data + the leveling verdict):
  definitions?: { en?: Definition; zh?: Definition };
  defaultDefinition?: "en" | "zh";    // generation-time fallback hint ONLY; the app setting wins once ever set
  examples?: ExampleSentence[];       // 3..6
  // owned here:
  etymology?: Etymology;
  mnemonic?: Mnemonic;
  tricky?: Tricky;
  related?: RelatedLink[];
  vividExample?: ExampleSentence;
  bridge?: BridgeInfo;                // vi
  flagNote?: string;                  // from WordEntry.flagNote
  generatedAt?: string;
}
```

**`prepared-content@2`** widens the glossary entry so the reader hover gets the same upgrade:
```ts
interface PrebakedEntry {                                  // @2 additive
  term: string;
  gloss: string;                                           // @1 field — retained for back-compat
  definitions?: { en?: Definition; zh?: Definition };      // @2 (preferred when present)
  examples?: string[] | ExampleSentence[];                 // @2 accepts both; objects preferred
  // …reading/pos/level/explanation/bridge unchanged
}
```

**Back-compat rules (each enforced by a parser test):**
- `isPreparedContent` is rewritten to accept `@1 | @2` (the word-store precedent ported, which prepared-content lacks today). A `prepared-content@1` file parses under the upgraded loader; absent `definitions` → treated as `{ en: { gloss } }` lifted from the legacy `gloss`. **Older files still load; a `@2` file will not load in an app built before this change.**
- `examples` of `string[]` are accepted and lifted to `{ text, translation: "" }` on read (so the legacy "Vivid example" string still renders).
- `mergeHover` prefers `definitions` when present, else lifts `gloss` → `definitions.en` (§6.3). Single-`gloss`-only packs render with one card.
- `AppSettings.explanationLang` value migration on read: `"target" → "zh"`, `"en" → "en"` (so a previously-stored `"target"` does not select the wrong card).
- `encoding-page@1` follows the same load-older-files discipline; the app view reads it, the Markdown twin is derived from it.

### 6.3 `mergeHover` extension (the resolution seam)

`mergeHover` (`packages/engine/src/content/hover.ts:52`) today resolves exactly one `gloss` (`hover.ts:63`) and drops `senses` entirely. We extend `ResolvedHover` (`hover.ts:23`) with `definitions?: { en?; zh? }` and richer `examples`, keeping the **`custom > prebaked > dict`** per-field precedence (`hover.ts:63-69`). Resolution — **both definitions resolve symmetrically across all three layers** so a packaged dict entry or a custom override can supply either (matching the Dictionary PRD's ownership of the definition store, and avoiding the asymmetry where `zh` could never be overridden):
- `definitions.en` ← `pick(custom.definitions?.en, prebaked.definitions?.en, dict.definitions?.en)`, falling back to a **lift** of any legacy single `gloss` (custom→prebaked→dict) so old data still produces an English card.
- `definitions.zh` ← `pick(custom.definitions?.zh, prebaked.definitions?.zh, dict.definitions?.zh)` — **symmetric** with `en`. (If the Dictionary PRD confirms its store feeds only the prebaked layer for v1, this still works; we resolve from whichever layer supplies it and let a custom edit win.)
- `examples` ← `custom > prebaked > dict`, now `ExampleSentence[]` (`string[]` lifted).
- `senses` finally flows into `definitions.en.senses` (fixing the dead-field gap — `DictEntry.senses`, `types.ts:127`).

The app encoding view and reader popup both render off this resolved object **plus** the `encoding-page@1` extras (etymology/mnemonic), so prose authored in batch is visible offline.

> **Cross-PRD note (definitions.zh home).** Make both definitions resolvable `custom > prebaked > dict` symmetrically. If the Dictionary PRD's store feeds the **prebaked** layer rather than the **dict** layer for v1, that is fine — but the two PRDs must agree on *which layer the definition data lands in*, so they don't disagree on where definition data lives (the inconsistency the Contract exists to prevent). Carry this as a confirmation item with PRD-Dictionary (§12 Q5 / its §5.6).

### 6.4 `gen encoding` command (where files live, who writes them)

Extends the existing `cmdWiki(opts, encoding=true)` (`cli.ts:302-331`):

```
pnpm gen encoding --lang zh-Hant --store personal/word-store.json \
  [--srs | --flagged | --words 熱鬧,香氣] \
  [--out-dir wiki/Inbox] [--pack-module packs/private/index.ts] [--agent claude|grok]
```

- **Word selection** unchanged: `selectWords` (`cli.ts:94-99`) — explicit `--words`, `--flagged` (`store.flagged`), or `--srs` → `getDue(...)`. The encoding set stays driven by the **due list** + the **flag queue**.
- **Per word, it writes TWO artifacts** (the fix for the surfaces split):
  1. **Markdown twin** at `{out-dir}/{lang}/encoding/{NFC term}.md` — **NFC-normalize** the term and apply the reject-and-`slug:` rule for filesystem-hostile terms (replacing the bare `slugify(word)` at `cli.ts:324`; note single CJK terms are unchanged by `slugify`, so the fix is the NFC pass + the reject rule, not a different filename source), via `buildEncodingPage` — now emitting `word: <term>` and accepting examples (`wikiInputFromStore(entry, dict, examples)`, the third arg currently never passed, `cli.ts:320`).
  2. **`encoding-page@1` JSON** at `{out-dir}/{lang}/encoding/{NFC term}.encoding.json` (the app-consumed artifact; co-location vs packs-only is §12 Q11), skeleton with empty `definitions`/`examples`/etymology/mnemonic/tricky/related for the agent to fill.
- Then prints `encoding-page.md` + a run-context block (lang, agent, the two output paths, the flag note, related words, **the resolved level cap** for the leveling verdict, the known-words set for sentence recycling) for the agent to fill, mirroring `cmdPrep`/`cmdTranscript`.
- **`gen verify`** then runs on the filled artifact: OpenCC guard on `definitions.zh` + every `examples[].text`; the **new blocking per-string CI gate** on examples + `definitions.zh`; the **leveling-verdict presence check** on `definitions.zh` (consuming the Dictionary PRD's verdict); the **grounding lint** on etymology/mnemonic; the **selection-criteria checks**. Blocking on failure (extends the existing `blocked` condition in `cmdVerify`, which today covers only missing-glossary + OpenCC).
- **Audio (optional):** a follow-on `gen word-audio`-style pass renders Serena/Qwen3-TTS mp3s for the term + each example, writing a `word-audio@1`-style manifest the app resolves (reusing `scripts/gen/lib/wordAudio.ts` + the voice-notes worker; no new TTS decision). Absent audio → Web Speech.

### 6.5 Prompt changes (`scripts/gen/prompts/encoding-page.md`)

Today the prompt asks for one "Vivid example" and unstructured prose (`encoding-page.md:16`). Changes:
- **Two definitions.** Add explicit instructions to write `definitions.en` (concise gloss + `senses`) **and** `definitions.zh` — leveled monolingual Traditional Chinese using **only words at/below the resolved level cap from the run context** (defining-vocabulary discipline; cite the cap). "A monolingual definition with unknown words is worse than an L1 gloss." (The binding leveling *verdict* is produced by the Dictionary PRD's verifier; the prompt aims the agent at the cap, the verifier enforces it.)
- **3–6 example sentences**, each `{text, translation}`, **simple/common/usable**, **recycling the learner's known words** (passed in the run context), at i+1 / within the CI target; **prefer sentences from the user's own reading** (provenance); multi-sense words get one per sense; single-sense words get distinct situations. "Variety of context, not paraphrase volume."
- **Etymology grounded or labeled.** Keep the existing "ground etymology; a wrong mnemonic is worse than none" rule (`encoding-page.md:22`) and require the `grounding` tag (`sourced`/`mnemonic-device`/`speculative`) + optional `confidence`: default un-cited origins to `mnemonic-device`/`speculative` and write "memory device, possibly non-historical."
- **Output target is the `encoding.json` skeleton** (fill `definitions`/`examples`/etymology/mnemonic/tricky/related) plus the Markdown twin prose — both written by the agent, both gated by `gen verify`.

### 6.6 Quality measurement (how we know it sticks)

- **CI: currently MEASURED, made BLOCKING here.** The project's CI metric (the same adjusted/decomposition-aware scorer used on summaries/explainers as a redo *convention*) is **reported-only today** — it does not gate `gen verify`'s exit, and it scores passages, not strings. This PRD adds (a) a **per-string scorer** over examples + `definitions.zh` and (b) a **blocking branch** so below-target items fail the run and are regenerated. Stop treating "the gate that already governs summaries/explainers" as an existing enforced block — it is a convention until this work lands.
- **Grounding lint, selection-criteria checks** as in §5.5 (encoding-owned). The **leveling verdict** is consumed from the Dictionary PRD.
- **Retention signal (observational, v2 seed):** FSRS `stability`/`lapses` on words that have a full encoding page vs. bare entries, surfaced in review stats. Not a v1 gate; a v2 feedback loop.

---

## 7. Technical foundations (real files / types / commands)

- **Types to evolve** (`packages/engine/src/types.ts`): `Sense` interface (l.115) and `DictEntry.senses` (l.127, finally fed); `DictEntry.gloss` (l.125 → `definitions`); `PrebakedEntry` (l.278), `PrebakedEntry.gloss` (l.280), `PrebakedEntry.examples` (l.285 → objects + `definitions`); `SrsState` (l.175, drives the status pill); **`WordEntry.flagNote` (l.235) and `WordEntry.related` (l.253)** — both on `WordEntry`, **not** `SrsState`; they feed why-tricky/related and are read exactly as `cmdWiki` reads `entry.flagNote` at `cli.ts:322`. `BridgeInfo` (l.151 area, vi box). Schema consts: `PREPARED_CONTENT_SCHEMA` (l.317 → `@2`, **and the `isPreparedContent` rewrite at `content/prepared.ts:47`**), new `ENCODING_PAGE_SCHEMA`. Back-compat precedent: `WORD_STORE_SCHEMA`/`_V1` (l.268-270) — the loader prepared-content must be brought up to.
- **Resolution seam:** `packages/engine/src/content/hover.ts` `mergeHover` (l.52), `ResolvedHover` (l.23) — extend for `definitions` + `ExampleSentence[]`; keep `custom > prebaked > dict` (l.63-69), now symmetric for `definitions.zh`.
- **Generation:** `scripts/gen/cli.ts` `cmdWiki(opts, encoding=true)` (l.302), `selectWords` (l.94), `wikiInputFromStore` (l.145/used at l.320, pass the examples third arg), `cmdVerify` (extend the `blocked` condition + add the per-string CI scorer + grounding + selection + leveling-verdict-presence gates). `scripts/gen/lib/verify.ts` `verifyContent` (today scores `content.tokens` only; add per-string scoring). `scripts/gen/lib/wiki.ts` `buildEncodingPage` (l.104, emit `word:`; flag-note seed at l.135), NFC filename + reject rule at the `cli.ts:324` write site. `scripts/gen/lib/io.ts` `slugify` (l.26 — keeps `\p{Letter}`/`\p{Number}`, so CJK passes unchanged; add NFC + reject-hostile). Prompt `scripts/gen/prompts/encoding-page.md`. Example shape `examples/wiki/encoding/`.
- **App:** `apps/web/src/encoding/encoding.ts` (`mountEncoding` — rewrite to consume `encoding-page@1`); routing `apps/web/src/main.ts:100-117`; review click-through `apps/web/src/review/review.ts:22-27,105`; reader popup + Deep-dive `apps/web/src/reader/reader.ts:469-481`; settings `apps/web/src/state.ts:35` (`explanationLang` → real selector, default `"target"` at l.78 with the `"target"→"zh"` read migration), `guessFirst` (l.47, study mode).
- **SRS:** `packages/engine/src/srs/fsrs.ts` `getDue` / `reviewSrs` / `ratingValue` / `systemClock` (rail only; page read-only; no scheduler in the module by design; imported into `cli.ts` from `@tsumugu/engine`).
- **Audio:** `scripts/gen/lib/wordAudio.ts` (`WORD_AUDIO_SCHEMA`, `WORD_AUDIO_DIR`) + the voice-notes worker — precedent for per-sentence/term mp3 manifests; Serena/Qwen3-TTS per `PRD-Voice-Notes.md`; `AudioPort`/Web Speech fallback (`packages/engine/src/ports.ts`, `apps/web/src/host/webAudio.ts`).
- **Anki:** `packages/engine/src/anki/exporter.ts` (`AnkiNote{front,back}` + `[sound:…]` media; `guidFor` hashes `front + "\x1f" + back` — **the bridge must pass a stable term-keyed seed instead**); host buffer copy `apps/web/src/host/anki.ts`. No note-assembly bridge exists yet — this PRD adds one.
- **Wiki contract:** `../tsumugu-wiki/ARCHITECTURE.md` §1/§3/§4 (atom twin under `{lang}/encoding/{NFC term}.md`, lines 120-122 NFC + reject rule, `word:` audit key, linter invariants **#4** (encoding twin, `word == term`) and **#5** (D2 dedup); #3 = one-atom-per-term/NFC dedup, which the NFC-filename fix also supports).
- **Command:** `pnpm gen encoding …` (the `gen` script = `tsx scripts/gen/cli.ts`); verify: `pnpm gen verify --in <file>`.

---

## 8. Constraints & dependencies

- **Contract §C (hard):** batch generation only — agent writes files, app consumes; **no paid LLM API in the core loop**; engine stays **DOM-free, network-free, data-free**; zh-Hant output passes **OpenCC (Taiwan-idiom)**; **pull-based SRS** (no scheduler); vault writes on **explicit confirm**.
- **Contract §A (amended by this PRD):** both definitions stored; the **encoding page renders both with a default pin** (this PRD's override, §0); the **reader hover shows one at a time** (default + inline flip). PRD-Dictionary §5.6 must be aligned to the same split.
- **Contract §D (relationship) — Dictionary PRD:** supplies `definitions:{en,zh}`, the example-sentence store (`ExampleSentence[]`), the **leveling/defining-vocabulary verifier + verdict** (`level-check.ts`, Phase D2), the toggle's storage, the OpenCC guard, and packaging/licensing. This PRD **blocks on** the Dictionary PRD for those data fields + the leveling verdict; it can ship the page shell + encoding-only content against fixtures first. Neither redefines the other's internals. **Definition-layer home (custom/prebaked/dict) must be agreed with the Dictionary PRD (§6.3 note).**
- **Voice-Notes PRD:** supplies term + per-sentence Serena audio. Audio is optional on the page (renders without it; Web Speech fallback keeps the 🔊 live).
- **Contract §E (data model):** versioned schemas; **older files must still load** — and the prepared-content parser must be **upgraded to the `@1|@2` accept-list it does not yet have** (the word-store precedent ported).
- **Wiki schema dependency:** the twin must satisfy `ARCHITECTURE.md` (NFC filename + reject rule, `word:`, twin↔atom 1:1, D2). Linter invariants #4/#5 are CI gates; `word:` + NFC filename are required before promotion.
- **Personal/private layer:** definition data, example audio, `encoding-page@1` JSONs, twins live in the vault/packs (gitignored). Real-person voice clips are private-study only (PRD-Voice-Notes §9).
- **Leveling-cap data:** the leveling verdict (Dictionary PRD) needs a level cap (TOCFL band) or the learner's known-words set — both already available via the pack leveler + word store; the cap is passed into the encoding run context for the prompt.

---

## 9. Acceptance & test plan

Consolidates the scattered `Checkable:` notes into one verification home (the completeness fix for the previously-missing §9).

| # | Criterion | Test / harness |
|---|---|---|
| A1 | Parser tolerates `@1` + `@2` | Unit: a strict-`@1` fixture and a `@2` fixture both pass the **rewritten** `isPreparedContent`; the rewrite is the task under test (it is strict-equality today). |
| A2 | `mergeHover` lifts | Unit: legacy `gloss` → `definitions.en.gloss`; legacy `string[]` example → `{text, translation:""}`; `senses` → `definitions.en.senses`; `definitions.zh` resolves symmetrically across custom/prebaked/dict. |
| A3 | `explanationLang` migration | Unit: stored `"target"` reads as `zh`, `"en"` as `en`. |
| P1 | Offline, single-artifact render (load-bearing) | App test with a **File System Access port double**: after the artifact read, **zero network requests**; DOM section order == amended mockup. Non-gating: p50 cold render < 150 ms on the reference machine (fixed fixture, warm process, stated as a target not a gate). |
| P2 | Agent-authored content renders in-app | Test: the `encoding-page@1` character story for 熱鬧 appears in the rewritten `mountEncoding` view. |
| P3 | Both cards + default pin | Test: both `.defcard` present; default selector flips the pin and persists across reload; 簡明中文 caption == resolved cap (not "A2"). |
| P4 | Study mode hides definitions | Test: `guessFirst` on → both definition cards behind a reveal; term + one i+1 example shown first. |
| P5 | Example rows | Test: 3–6 rows; each has `<em>` highlight + EN translation + a **live** 🔊 (Web Speech when `audio` absent). |
| P6 | Flag end-to-end | Test: header flag == tricky `confusable` == related `⚠` term. |
| G1 | Grounding required + marked | Lint test: un-tagged etymology rejected; the re-graded mockup story (`mnemonic-device`) renders the marker. |
| G2 | New blocking CI branch | Gen test: `gen verify` exits non-zero on a below-target example or `definitions.zh`; a passing one exits zero; the per-string scorer is exercised. |
| G3 | OpenCC block | Gen test: a Simplified-bearing example/definition is rejected, naming the offender. |
| G4 | Leveling verdict consumed | Test: a `definitions.zh` lacking the "leveled" verdict does not render; the upstream offending word is surfaced. (Verdict production is PRD-Dictionary Phase D2.) |
| W1 | Twin schema | Linter green on the 熱鬧 twin + atom: `word:` present, NFC filename, twin↔atom 1:1 (#4), D2 (#5). |
| I1 | SRS read-only | Test: opening `#/encoding/<word>` does not advance FSRS state; grading only on the rail. |
| I2 | Anki bridge + stable guid | Test: an exported `.apkg` carries the word + sentence card + `[sound:…]`; **re-exporting after regenerating the sentence keeps the same guid** (term-keyed). |

---

## 10. Risks & mitigations

| Risk | Sev | Mitigation |
|------|-----|------------|
| **Fabricated etymology / false character decomposition** (top LLM-wiki risk — encodes a falsehood to unlearn) | High | Never auto-emit origin as fact; `grounding` tag required (`sourced`/`mnemonic-device`/`speculative`) + visible marker; **the mockup's own 鬥+市 story is re-graded `mnemonic-device` and marked**; prefer *true* elaboration over invented hooks; linter rejects un-tagged stories (§5.4). |
| **Dictionary PRD critical-path dependency** (real definitions/examples + the leveling verdict gated on PRD-Dictionary Phase D2 — its hard deliverable) | High | Phases 0–3 ship the page shell + encoding-only content + Anki/wiki against **fixtures** and pass their own (encoding-owned) gates; Phase 4 is the **only** Dictionary-blocked phase; the engine fixtures fix the contract shape so Dictionary slippage delays only the *data swap*, not the page. |
| **CI claimed-but-not-blocking** (treating the redo convention as an enforced gate understates the work) | High | Stated plainly: CI is reported-only today; this PRD **adds** the per-string scorer + the blocking branch (§0, §5.5, §6.6); G2 test asserts the new block fires. |
| **CI drift in generated sentences** (subtly above i+1, off-register, wrong sense, Simplified leak) | High | Run every `examples[].text` + `definitions.zh` through the **new blocking** per-string CI gate + OpenCC in `gen verify`; **prefer sourced-from-reading sentences** over synthetic; provenance in `source`. |
| **Two surfaces stay split** (app never reads the rich twin) | High | The `encoding-page@1` JSON is the single app-consumed artifact; `mountEncoding` rewritten to read it (`mergeHover` fallback for un-generated words); P2 test asserts agent-authored `etymology` renders in-app. |
| **Toggle semantics inconsistent across Contract/mockup/siblings** | High | §0 override picks ONE model (page = both cards + default pin; hover = one-at-a-time); Contract amended; PRD-Dictionary §5.6 aligned; control captioned "default selector," not "toggle." |
| **簡明中文 exemplar fails its own leveling caption** (mockup says "A2" but text is above A2) | Med | Cap = headword's band (B1 here), not a fixed A2 floor; caption renders the **resolved cap**; mockup amended before Phase 0 done; forces §12 Q5 / PRD-Dictionary §12 Q1. |
| **Over-padding / cognitive-load bloat** (6 paraphrase sentences, 3 overlapping definitions, decorative content) | Med | Cap examples at 6, floor 3, require distinct situations/per-sense (`sense` field); "encode, don't pad" lint; progressive disclosure (study mode hides depth); every element serves a named principle or is cut. |
| **Definition leakage defeats retrieval** (always-visible gloss = pure re-study) | Med | Recall-first **study mode** reuses `guessFirst`; both cards reveal-on-demand; term + i+1 example shown first. |
| **簡明中文 definition contains words above the learner's level** | Med | Defining-vocabulary discipline + leveling **verdict produced by the Dictionary PRD's verifier** (names the offending word); this page **refuses to render** a definition lacking the "leveled" verdict (consume-side, criterion 11). |
| **Anki guid instability orphans history** (guid hashes `front+back`, so regenerating a sentence makes a new card) | Med | Key the note guid on the stable term (lang + NFC term [+ sense index]), not `front+back`, so regenerated content **updates** the same note (criterion 14, I2). |
| **Back-compat break** (new fields fail to load old packs) | Med | Versioned `prepared-content@2` + the **net-new `@1|@2` parser accept-list** (prepared-content lacks it today) + `encoding-page@1`; `mergeHover` lift of legacy `gloss`/`string[]`; `explanationLang` value migration; parser tests on a v1 and v2 fixture. |
| **Wiki twin diverges from its schema** (non-NFC slugify, stripped chars, no `word:`) | Med | `buildEncodingPage` emits `word:` + **NFC-normalized** filename + reject-and-`slug:` rule for hostile terms; twin↔atom 1:1 enforced by invariants #4/#5 as a CI gate; run linter pre-promotion. |
| **Unsourced frequency/etymology claims erode trust** (removes the episodic hook) | Low | Cite or label-as-generated everything; show sentence provenance. |
| **Encoding-variability oversold** (benefit clearest for recognition, weaker for pure cued recall) | Low | Frame multiple sentences as "robust, generalizable meaning," not a universal win; keep the count low; for single-sense words "variety" = distinct situations (§5.3 #5). |
| **Audio polyphone misreads** (term rendered out of context: 得/行/了) | Low | Per-sentence audio is in-context (authoritative); stored zhuyin ruby is the ground truth; Web Speech fallback for unrendered items (same posture as `wordAudio.ts`). |

---

## 11. Plan (phased; agent-run where noted; each phase has an exit criterion)

> **Decisions needed before build:** **Q5** (defining-vocabulary cap — the leveling gate's reference; also fixes the mockup caption) and **Q11** (`*.encoding.json` co-located vs packs-only — sets Phase 0's contract path and Phase 6's "what Quartz sees") are **must-answer-before-Phase-0**. **Q3** (lock 3–4 vs 3–6) sets criterion-6's row count and should be answered before Phase 0. **Q8** (vi monolingual deferral) gates Phase 4's vi path. Each phase below names its blocking questions.

- **Phase 0 — Prove the page by hand on 熱鬧.** *(Blocked on Q5, Q11, Q3.)* Hand-author one `encoding-page@1` JSON + its twin matching `mockup-3-encoding.html` **as amended** (both definitions with the **resolved-cap caption**; 3–4 sentences with translations + one audio; **grounded/marked** character story; why-tricky; related). *Exit: the artifact renders the amended mockup's section order in a throwaway view (character-story marker present; caption = resolved cap); content worth keeping; the exemplar's 簡明中文 text actually passes the chosen cap (or the text is revised until it does).*
- **Phase 1 — Engine data model + back-compat (no app change).** Add `Definition`, `ExampleSentence`, `Etymology`/`Mnemonic`/`Tricky`/`RelatedLink`, `EncodingPageDoc`, `prepared-content@2`; **rewrite `isPreparedContent` to the `@1|@2` accept-list and widen `PreparedContent.schema` to a union**; extend `mergeHover` (+ lift legacy `gloss`/`string[]`, feed `senses`, symmetric `zh`); add the `explanationLang` value migration. Pure, DOM-free, in `packages/engine/src`. *Exit: a strict-`@1` fixture and a `@2` fixture both parse under the upgraded loader; the `mergeHover` lifts + the `target→zh` migration are unit-tested; engine still data-free.*
- **Phase 2 — App page rewrite (consume the artifact).** *(Blocked on Q1 for the first-run default; Q2 for study-mode entry default.)* Rewrite `apps/web/src/encoding/encoding.ts` to read `encoding-page@1` (header per mockup §2; **both** definition cards + persisted default pin + instant offline switch; numbered example set with per-row **live** 🔊; etymology **with grounding marker** + why-tricky + related cells; recall-first study mode via `guessFirst`), with `mergeHover` as the fallback for un-generated words. Extend the reader hover to the same default **one-at-a-time** (default + inline flip). *Exit: clicking a due 熱鬧 in review opens the amended mockup's page from the Phase-0 artifact, rendering synchronously with **zero network requests** after the file read (P1); agent-authored character story shows in-app with its marker; the default switch works offline and persists; p50 < 150 ms target observed (non-gating).*
- **Phase 3 — `gen encoding` + prompt + gates (agent-run).** *(Blocked on Q5 for the cap passed into the run context.)* Extend `cmdWiki(encoding=true)` to write the twin (NFC filename + reject rule + `word:`) **and** the `encoding-page@1` JSON; pass the example set into the page (the `wikiInputFromStore` third arg); require `grounding`+`confidence` on etymology/mnemonic; update `encoding-page.md` (two definitions, 3–6 recycled sentences, grounding tags); **add the per-string CI scorer to `verifyContent` and fold `!meetsTarget` into `cmdVerify`'s `blocked` condition** for examples + `definitions.zh`; add the grounding lint, the selection-criteria checks, and the **leveling-verdict presence check** (consume the Dictionary PRD's verdict). *Exit: `pnpm gen encoding --srs` on a real store produces both artifacts + a twin that passes wiki linter invariants #4/#5; `gen verify` **exits non-zero** on an over-CI, Simplified, or un-grounded definition/example, naming the offender (G2/G3); a unit test asserts the new blocking branch fires.*
- **Phase 4 — Consume Dictionary PRD outputs (cross-PRD).** *(Blocked on PRD-Dictionary Phase D2; Q8 for vi.)* Wire `definitions:{en,zh}` + `ExampleSentence[]` + the **leveling verdict** from the Dictionary PRD store into the page; enforce the §5.3 selection criteria + §5.4 grounding + the leveling-verdict presence as load-time acceptance (drop rows/cards that fail). *Exit: 熱鬧 renders both real definitions (with a valid leveling verdict) + 3–6 real CI-passing sentences with translations from store data, not fixtures.*
- **Phase 5 — Audio + Anki bridge.** *(Blocked on Q9 for audio scope; Q10 for note shape.)* Per-sentence + term Serena/Qwen3-TTS via the `wordAudio`/voice-notes path + a `word-audio@1`-style manifest the app resolves; map `definitions`/`examples`/`mnemonic` → `AnkiNote{front,back}` (front = an i+1 sentence with the target as the one unknown; back = definition + reading + `[sound:…]`) **with a term-keyed guid seed**. *Exit: 🔊 plays Serena on the term + each sentence (Web Speech fallback when absent); an exported `.apkg` carries the encoding content + `[sound:…]`; re-export after regenerating the sentence keeps the same guid (I2).*
- **Phase 6 — Wiki twin reconciliation + linter gate.** Confirm twin↔atom 1:1, `word:` audit field, D2 etymology ownership; turn linter invariants #4/#5 into a CI gate; migrate the existing 熱鬧 twin. *Exit: linter green; the twin publishes via Quartz; the `encoding/` dir matches the schema.*
- **Phase 7 — Quality feedback (observational, v2 seed).** Surface FSRS `stability`/`lapses` for fully-encoded words vs. bare entries in review stats. *Exit: review stats show the split; no scheduling behavior added.*

Each phase: plan → approve → build → review (per the house workflow). Phases 0–2 are app/engine; 3–7 are agent-run generation + wiki + integration.

---

## 12. Open questions for Wedge

1. **Default definition + the toggle override (must-answer; sets first-run + ratifies the §0 override).** The encoding page renders **both** cards with a default pin; the reader hover shows **one at a time**. (a) Confirm that asymmetry (the Contract says one-at-a-time for both; §0 overrides it for the page and asks the Contract be amended + PRD-Dictionary §5.6 aligned). (b) Out of the box (before any preference, per-language so vi can differ), should the default card be **English** or **簡明中文**? The mockup pins English.
2. **Study-mode default per entry-point.** Should the encoding page open in **study mode** (meaning hidden, retrieval-first) when reached from review, and in **reference mode** (all visible) when reached via reader "Deep dive" — or one global default?
3. **Example count (must-answer-before-Phase-0; sets criterion-6 row count).** The mockup ships **4**. Lock the target at **3–4** (quality/variety) or keep the full **3–6** band and let the agent fill more when senses warrant (capped at 6)?
4. **Vivid personal example vs. the everyday set.** Keep **both** (one personal vivid + the 3–6 everyday set, as the contract says), or fold the vivid one into the set as "row 1, sourced"?
5. **Defining vocabulary = fixed band or your known-words set? (must-answer-before-Phase-0; also fixes the mockup's "A2" caption + the cap passed to the leveling verifier.)** A fixed TOCFL cap is simple/stable; your *own known-words set* grows with you and avoids circular definitions but makes a definition's validity learner-specific (fine for a personal pack, a question for any shared wiki). The mockup currently captions "A2" while the header word is B1 — resolving this picks the cap and the caption. This is also PRD-Dictionary §12 Q1; answer once for both.
6. **Etymology sourcing.** For `grounding: sourced` we need a real reference. Is there an etymological source you trust for zh (e.g. a specific 字源 dictionary) we should cite, or do we default everything un-cited to `mnemonic-device`/`speculative`? (The mockup's 鬥+市 story is being shipped as `mnemonic-device` for now.)
7. **Sourced vs synthetic examples.** Prefer pulling example sentences from your **own reading corpus** (provenance, episodic hook) when available, falling back to synthetic — or are clean synthetic i+1 sentences fine as the primary source?
8. **vi 簡明中文 analogue.** Defer the vi monolingual-definition gate (rough leveling data) and ship vi with English + the Hán-Việt bridge box only for v1?
9. **Audio scope for v1.** Generate Serena audio for **every** example sentence + term up front (storage, batch time), or render on demand per word you actually study? (The 🔊 is live via Web Speech regardless; this is about pre-baking Serena.) For the Phase-0 exemplar 熱鬧, do we cut at least one real Serena row?
10. **Anki note shape.** Front = sentence-with-target (sentence-mining style, one unknown), back = definition + reading + `[sound:]`, guid keyed on the term — confirm that's the card you want for encoding words, vs. word→definition.
11. **`encoding-page@1` location vs the twin (must-answer-before-Phase-0; sets the contract path Phase 0 writes to).** Co-locate the app-consumed `*.encoding.json` next to the `*.md` twin under `{lang}/encoding/`, or keep JSON in the personal/packs layer and publish only the `.md` to the public wiki? (Affects what Quartz sees.)
12. **Definition-layer home (confirm with PRD-Dictionary).** Should the Dictionary PRD's definition store feed the **prebaked** layer or the **dict** layer? `mergeHover` resolves `definitions.zh` symmetrically either way, but both PRDs must name the same home so they don't disagree on where definition data lives.