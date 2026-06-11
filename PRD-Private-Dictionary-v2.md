---
title: "PRD — Tsumugu Private Dictionary v2: curated, voiced, Traditional-Chinese prototype of the shared dictionary corpus — re-baselined to the shipped word layer, character-structure layer as the active build"
type: prd
status: draft
created: 2026-06-10
updated: 2026-06-10
revision: "v2 — supersedes PRD-Private-Dictionary.md (2026-06-09, retained read-only). Changes: (1) re-baselined against the code as of 2026-06-10 — the word layer (prepared-content@2, dictDefault, defLevel verifier, CC-CEDICT senses, fill pipeline, encoding page per mockup-3, dict packaging) has SHIPPED and is marked done-with-caveats, so the character-structure layer is now the active build, not phase 3 of 7; (2) the 7 Rules of Memory adopted as explicit design principles; (3) the two-surface contract (memory-first encoding vs grounded dictionary) written down per Wedge's 2026-06-10 ruling; (4) v1's open questions resolved with recommendations; (5) sound-series pages promoted to first-class."
license: "Apache-2.0 — ENGINE CODE. DATA (definitions, entries, audio) is clean-authored (open data + framework + Wedge's words) → SHAREABLE with the public dict; kept private-by-choice for this curated set; never bundled in the public engine."
languages:
  - zh-Hant (Traditional Mandarin, Taiwan) — the private prototype's only language
posture: "PRIVATE-BY-CHOICE · OFFLINE-FIRST · PERSONAL (primary user: Wedge). Curated set of actively-learned words only. Entries authored CLEAN — from the functional-component framework (first principles learned from the Outlier Masterclass course Wedge owns) + open data + Wedge's own analysis. NOT derivative works — there is no Outlier dictionary access (iOS-only) and the course's prose is never republished. One shared corpus with the public [[Tsumugu-dictionary]]."
supersedes:
  - "PRD-Private-Dictionary.md (v1, 2026-06-09) — which itself supersedes PRD-Dictionary.md, PRD-Character-Structure.md, PRD-Tsumugu-Dictionary-App.md"
siblings:
  - "[[PRD]] — the Tsumugu engine"
  - "[[PRD-Encoding-Layer]] — SRS memory page (CONSUMES this dictionary; memory-first surface)"
  - "[[PRD-Voice-Notes]] — Qwen3-TTS / Serena pipeline (REUSED here)"
  - "[[PRD-Wiki-Reader-UX]] — the memory-first wiki surface this dictionary feeds"
  - "PRD-Trilingual-Dictionary-PUBLIC v2 (parked) — the public twin"
tags: [prd, tsumugu, dictionary, private, offline, traditional-chinese, functional-components, memory-rules, shared-corpus, serena, v2]
---

# PRD — Tsumugu Private Dictionary (v2)

**Wedge's personal, offline-first Traditional-Chinese dictionary: a curated set covering only his active learning frontier, serving as the prototype of one shared clean corpus with the future public dictionary. One entry, three layers: (1) WORD — two stored definitions (concise English + band-verified monolingual 簡明中文) plus structured examples — `★ shipped`; (2) CHARACTER-STRUCTURE — typed functional components, meaning trees, system links — `← the active build`; (3) EXPERT render — form → components → meaning trees → evolution, fully Serena-voiced. Batch-generated, verified by measurement where measurement is honest, consumed offline. Everything authored clean from the functional-component framework + open data + Wedge's own analysis: shareable by construction.**

> **What changed since v1 (one paragraph).** v1 (yesterday) designed the word layer in detail; today it exists in the tree: `tsumugu/prepared-content@2` with a normalizing `@1` reader, `Definitions`/`ExampleSentence` types, `AppSettings.dictDefault` with settings migration, the band verifier (`checkDefLevel` in `scripts/gen/lib/defLevel.ts`, with `defLevelData.ts`), CC-CEDICT `Sense[]` population, the fill pipeline (`dictFill.ts`, `dict-mono-zh.md` + example/overlay/collocation prompts, `tatoeba.ts`, `exampleVerify.ts`), dictionary packaging incl. a browser SQLite path (`dictPackaging.ts`, `apps/web/src/packs/sqliteDict.ts`), and the encoding page built to mockup-3 with audio. v2 therefore stops designing that layer, audits it (§2 checks 1–5 become regression criteria), and points the project at the genuinely missing piece: the character-structure + Expert layers (`tridict/char@1` appears nowhere in the code), the curation lifecycle, and the export-to-public proof.

---

## 0. Decision log (carried + new)

**Carried from v1 unchanged (still binding):**
- ✅ ONE clean pipeline, ONE shared corpus; prototype-first; private by choice, not necessity.
- ✅ Curated, not comprehensive — active words only (frontier/SRS); known words get no entry; graduate/prune on learning.
- ✅ One entry, three layers; multi-character headwords assemble per-character entries.
- ✅ Two definitions per word, both stored, one shown (`dictDefault`); leveled = measured band (`checkDefLevel`), never trusted from the prompt; correctness gated separately (spot review + round-trip proxy).
- ✅ Functional Component Framework as the character model: form / meaning / sound / empty (empty = distinguishing-mark | corruption); decomposition stops at functional components; meaning trees with original / sound-loan / derived(+depth) / early-usage; per-reading trees; char- vs component-meaning trees separate.
- ✅ Expert depth by default (the 造 `expert-details.jpg` contract); grounding tags (`sourced | authored | mnemonic-device | speculative`) + open citations on dictionary claims.
- ✅ Fully voiced via Serena (Qwen3-TTS, Apache-2.0, self-hosted); batch-only; no API in the loop; open-core hygiene; OpenCC `cn→twp` guard; zh-Hant only in this prototype.
- ✅ Clean-authored framing: the framework is first principles from the Outlier Masterclass *course* (public methodology, also published free by Outlier); Wedge has **no access to the Outlier dictionary** (iOS-only); nothing is copied or derived. Only courtesy line: don't republish the course's own prose verbatim.

**New in v2:**
- **✅ The two-surface contract (Wedge's 2026-06-10 ruling, on the record).** *"Encoding is the priority… sometimes entries can be wrong, but if they make sense and help the reader learn faster, that's the priority… accuracy with the end result, but not the bridge that gets you there."* Operationalized: the **encoding/wiki surface** is memory-first — mnemonic stories need no grounding and face no accuracy gate ([[PRD-Wiki-Reader-UX]] owns that rubric). The **dictionary surface** (this PRD) stays grounded — because its job is *prediction* (sound-series guessing, component transfer to unseen characters) and prediction only works when the component typing is real. Grounding here is not pedantry; it is MR#1 (Meaningfulness) made load-bearing. The shared hard rule on BOTH surfaces: the end result — meaning, reading, usage — must be correct. A dictionary entry may *include* a folk story, tagged `mnemonic-device`, sitting beside the typed analysis; the tag is a shelf label, not a fight.
- **✅ The 7 Rules of Memory are explicit design principles** (Outlier Lesson 1; Higbee): #1 Meaningfulness, #2 Organization, #3 Association, #4 Visualization, #5 Attention, #6 Repetition, #7 Interest. §5.7 maps each to a feature. The dictionary is a memory tool that happens to be true, not a reference that happens to be studied. **Framing refinement (Wedge, 2026-06-10): entries use, but are not limited to, the Outlier principles** — Form/Sound/Meaning/Empty + the Rules of Effective Memory are the spine; other good mnemonic techniques are welcome alongside them.
- **✅ Example depth raised (Wedge, 2026-06-10): target ≥ 5–6 example sentences per entry** (was 3–6), each Serena-voiced and playable through the **waveform + A/B-loop player** — the sentence-AB-waveform tech already shipped on the encoding page (2026-06-10 commits) is the renderer; entries want a *full story*, Expert-tier by default (reaffirming the 造 contract).
- **✅ Sound-series pages are first-class** (Outlier Lesson 7), not just `systemLinks` rows: `#/dict/series/:component` renders the series (戠 → 識職織…), the shared sound pattern + drift notes, and per-member status coloring. Series study is the framework's highest-leverage prediction trainer (MR#3 at scale).
- **✅ Word-layer phases renumbered to done-with-caveats** (§8). New phase letters start at the character layer. Caveats audited in §2.
- **✅ v1 open questions resolved** (§0.1 below).
- **🚫 Ruled out (v2): auto-OCR of the Outlier PDFs into the pipeline.** They stay personal study reading; the agent context never includes them (unchanged from v1, restated because the fill pipeline now exists and could tempt it).

### 0.1 v1 open questions — resolutions (defaults; flag to change)
1. **Active-set population → auto-pull + manual pin.** Seed from the SRS due/learning queue (`engine/srs` already knows it) via `gen dict --from-srs`; Wedge can pin/unpin words by hand. Pure curation-by-hand doesn't survive contact with a 2,000-word store.
2. **Expert prose language → 繁中 primary with EN on the 譯 toggle**, consistent with `dictDefault` and the immersion stance; section-level toggle, same mechanism as the reader's 譯.
3. **Ancient forms → Unicode + open/PD images where trivially available; no image hunt in v1.** `imageRef` stays in the schema; populate opportunistically.
4. **Cursive lessons → deferred entirely** (STROKE tab ships stroke count/order only). Cursive is a separate skill track, not a dictionary layer.
5. **Shared engine package extraction → not yet.** Keep `packages/engine/src/dict/` inside the monorepo until the public dict's GO decision creates a real second consumer (same call as [[PRD-Engine-Improvements]] §0). The export-to-public *proof* (D-final) doesn't require the package split.
6. **Archive the three superseded PRDs → yes, now, to `personal/archive/`** — *pending Wedge's explicit proceed* (file moves are his call). v1 itself becomes read-only beside them once this v2 is signed off.

---

## 1. Problem (re-baselined)

The word layer is no longer the problem — it shipped. What remains:

1. **No character-structure layer exists.** `tridict/char@1` is in no source file; the encoding pipeline still has no typed-component canon to draw on; nothing in the system can answer "what is 鬧 *made of* and what does each part do" with a grounded answer — which means no prediction training (sound series, component transfer), the core capability the Outlier framework exists to build.
2. **No Expert render, no dictionary app surface** (`#/dict/:char` absent), no per-section dictionary voice.
3. **No curation lifecycle.** Entries (once they exist) need to enter from the SRS frontier and graduate out when known — otherwise this becomes exactly the stale-notes problem Wedge most wants to avoid.
4. **Word-layer caveats need an audit pass** (it shipped fast): real-data verification coverage, the relocated-examples merge path, packaging at the actual corpus size, and which v1 checks exist as tests vs as intentions.
5. **The shared-corpus promise is unproven** — no entry has round-tripped into the public corpus shape.

---

## 2. Goals & success criteria

**Word layer — regression/audit criteria (was: build criteria):**

1. `@1`/`@2` fixtures round-trip; `@1` upgrade fills `definitions.en.gloss` + `examples → [{text}]`; custom-example override beats prebaked (the relocated merge). *Check: existing tests pass; any missing case from v1 §2 gets a test, not a redesign.*
2. Band conformance ≥95% at the chosen floor on the **actual active set**, measured by the shipped verifier; OpenCC-clean; no circular/empty definitions; escalation rate reported. *Check: `gen verify` run over the real curated corpus, numbers recorded in STATUS.*
3. `dictDefault` flips instantly on reader + encoding page, offline. *Check: existing behavior, kept under test.*

**Character-structure layer (the active build):**

4. `tridict/char@1` exists in the engine (types + validator + resolver), with fixtures 造 / 識 / 鬧 / 射 / 長: 鬧 typed without folk decomposition *in the dictionary fields*; 射's 身 = `empty/corruption`; 長 carries two readings each owning a meaning tree; 必's `nowWritten` pattern representable. *Check: fixtures parse + validate; `gen verify --dict` fails on missing role, untyped empty, folk decomposition asserted as analysis, or Expert prose without grounding tag.*
5. `resolveStructure("熱鬧")` assembles per-character entries + a composed summary for the word layer to consume.
6. **Sound-series pages:** `#/dict/series/戠` renders members, shared-sound pattern, drift notes, per-member learner status. *Check: one real series end-to-end with ≥3 members from the active set.*
7. **Prediction is testable (the framework's point):** for a character *not yet* in the corpus but in a covered sound series, the series page supports a "predict before reveal" affordance (guess sound/meaning → reveal). *Check: present on series pages; logged as a study event at most (no new SRS machinery).*

**Expert + voice + app:**

8. Expert block (evolution, ancient forms, comparisons, OC/MC) renders per the 造 contract; every Expert claim grounded or `speculative`. 9. Per-section Serena audio via a `gen dict-voice` command reusing the voice-notes worker; Web Speech fallback. 10. `#/dict/:char` surface with DICT/STROKE/CHARS/WORDS/SENTS tabs + pipelining study modes (Lesson 12): Reference / P1 (form+components) / P2 (+meanings) / P3 (+Expert). *Checks: pilot chars fully voiced; study-mode state persists (`dictStudyMode`).*

**Lifecycle + shared corpus:**

11. `gen dict --from-srs` pulls the active frontier; graduation prunes/archives entries on `known`; the corpus contains **zero** entries for known-graduated words after a cycle. *Check: run against the real store; before/after counts recorded.*
12. **Export proof:** ≥5 entries export into the public-corpus shape unchanged (same schema, open citations intact, no private fields). *Check: a script emits them; the public PRD's schema accepts them; no relicensing step needed.*
13. Open-core hygiene unchanged: engine gains types/resolver/renderer only; data + audio + Outlier PDFs stay gitignored. *Check: `git check-ignore` paths; grep clean.*

---

## 3. Scope

### In scope
- Word-layer **audit** (not redesign): tests for any v1 §2 check not yet covered; real-corpus verify run; packaging sanity at actual size.
- Character-structure layer: schema, validators, fixtures, generation prompts G1–G4 (open sources + Wedge's authorship), anti-folk verify *on dictionary fields*, system links, sound-series pages with prediction affordance.
- Expert render + `#/dict/:char` app surface + pipelining modes.
- Dictionary voice (`gen dict-voice`).
- Curation lifecycle (SRS-driven entry + graduation) and the export-to-public proof.
- The 7-Memory-Rules mapping as acceptance rubric for *presentation* choices (§5.7).

### Out of scope
- Comprehensive coverage; Simplified; EN/VI breadth; publishing this surface (→ public PRD, parked).
- The SRS memory page internals (→ [[PRD-Encoding-Layer]]); the TTS engine (→ [[PRD-Voice-Notes]]); wiki presentation (→ [[PRD-Wiki-Reader-UX]]).
- Outlier PDFs as generation input (personal reference only — restated).
- vi monolingual dictionary; cursive; Japanese/Cantonese; live API anything.

---

## 4. Users & use cases

**Primary (only): Wedge.**

1. **Deep lookup while reading:** unknown char → `#/dict/:char` → FORM + typed components + Serena → a predictive guess at the next character sharing the sound component.
2. **Series study:** open `series/戠`, predict 織 before revealing; the framework's transfer effect in practice.
3. **Pipelined review (Lesson 12):** SRS review opens the entry at P1; reveal deepens to meanings, then Expert, spaced across encounters.
4. **Two-way word meaning:** hover → default definition; encoding page → both cards + 例句 (shipped; regression-guarded).
5. **Author + correct:** `pnpm gen dict --chars 造,識,鬧 --tier expert` → verify → voice → promote; override any field in `custom`; folk story he *likes* gets kept, tagged `mnemonic-device`, beside the analysis.
6. **Graduate:** known words leave the corpus automatically; the dictionary never becomes the stale-notes pile.

---

## 5. Core design

### 5.1–5.6: unchanged from v1
The schemas (`tridict/char@1`, word-layer types), pedagogy mapping (Units I–III → fields), generation stages (G0–G7), voice plan, and app-surface design carry over from v1 verbatim — they were right; they just weren't built. Two amendments:

- **5.3-bis (sound series):** `systemLinks` gains no new fields, but a series *page* is derived by grouping entries on `same-sound-component` links; the series page is a renderer concern (app + wiki), not a schema change. Drift notes live on the component's own entry.
- **5.4-bis (generation order):** G1 (deep structure) for the **active set's characters only** — the curated posture means tens of characters, so each can get the careful treatment; no bulk runs.

### 5.7 The 7 Memory Rules → features (new)

| Rule | Where it lands |
|---|---|
| #1 Meaningfulness | Functional components + real meaning trees (the whole layer); the framework's own justification |
| #2 Organization | Fixed entry anatomy (FORM → COMPONENTS → MEANINGS → EXPERT); series pages organize by sound family |
| #3 Association | `systemLinks`, related/confusable words, Hán-Việt hooks (`hanViet` field, ready for vi), "appears in" links |
| #4 Visualization | Ancient forms (Unicode/open images), component glyph highlighting, stroke order |
| #5 Attention | One-char-one-page; pipelining reveals (P1→P3) prevent wall-of-text skimming |
| #6 Repetition | SRS integration (entry from review), per-section audio for repeat listening, recycled examples |
| #7 Interest | Wedge's own examples + flags ("why it's tricky" personal collisions); folk stories kept when they're *fun*, tagged |

### 5.8 Verification posture (clarified per the ruling)
`gen verify --dict` gates: schema completeness, component-role presence, empty-subtype required when `role==="empty"`, grounding tag on every Expert claim, OpenCC, band checks on any 簡明中文 prose, **and** the anti-folk rule *scoped to analysis fields* (a `components[]` entry asserting folk structure as `sourced`/`authored` fails; the same story under `mnemonic-device` passes). Nothing in the verifier touches the encoding/wiki surface.

---

## 6. Architecture
Unchanged from v1 (engine `packages/engine/src/dict/`, app `apps/web/src/dict/`, generation `scripts/gen/` — note: as plain additions to the existing CLI until [[PRD-Engine-Improvements]] E4 splits commands; data under `packs/private/zh-hant/data/dict/<char>/`; Outlier course PDFs gitignored under `personal/references/outlier/`). Flat JSON per entry; SQLite packaging exists for the *word* dictionary and is not needed for the curated char corpus.

---

## 7. Legal & reference posture
Unchanged from v1 §7, restated in one line each: framework = public methodology (first principles from the course Wedge owns); no Outlier dictionary access exists, so nothing derives from it; course prose never republished; entries authored from open sources (Wiktionary CC-BY-SA, Shuowen PD, CHISE/IDS, make-me-a-hanzi, CUHK 漢語多功能字庫, 小學堂, Dong Chinese) + Wedge's analysis with per-claim citations; word-layer three-regime quarantine (from-scratch mono · BY-SA bilingual · CC-BY Tatoeba) as shipped; MoE text reference-only (BY-ND); private by choice. *(Not legal advice.)*

---

## 8. Plan (re-baselined)

| Phase | Deliverable | Exit |
|---|---|---|
| **★ D0–D1 (word layer)** | *Shipped 2026-06-09/10* — `@2` schema + reader, definitions, band verifier, fill pipeline, packaging, encoding page, `dictDefault` | **Audit pass:** real-corpus verify numbers in STATUS; missing v1 checks become tests; custom-examples merge verified |
| **C1 — Char schema + fixtures** | `tridict/char@1` types/validator/resolver; 造/識/鬧/射/長 fixtures; verify gates | Criterion 4–5 |
| **C2 — Generation G1–G4** | Prompts + fill contract for deep structure/meanings/Expert/system, open sources, active set only | 10 active chars typed; provenance = open sources; anti-folk gate green |
| **C3 — App surface** | `#/dict/:char` + tabs + pipelining modes | Criterion 10; offline render matches the 造 contract |
| **C4 — Series + prediction** | Series pages + predict-before-reveal | Criteria 6–7 |
| **C5 — Voice** | `gen dict-voice`; pilot chars fully voiced | Criterion 9 |
| **C6 — Lifecycle + export proof** | `--from-srs` intake; graduation; 5-entry public-shape export | Criteria 11–12 |
| **→** | Write lessons back into the public PRD (parked) | format/voice/pipeline learnings recorded |

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| AI invents etymology *in dictionary fields* | grounding lint (C1 gate); `speculative` is always available and honest; small corpus = hand-verifiable |
| The two-surface contract erodes (dictionary truth leaks into encoding-page fights, or vice versa) | the ruling is quoted in both PRDs; verifier scope is explicit (§5.8) |
| Word-layer audit finds shipped-but-untested paths | that's the audit's job; fix as tests, not redesigns; timebox it |
| Curation lifecycle deletes something Wedge wanted | graduation = archive move, never delete; reversibility rule applies |
| Series pages too thin at curated scale | series render only when ≥2 members exist in the corpus; otherwise the component entry alone |
| Velocity: C-phases stall behind engine refactors | only E4 (CLI split) interacts; C-work lands as plain CLI additions if E4 hasn't shipped |

---

## 10. Open questions

1. **Floor band final value** — v1 leaned TOCFL-3/4 pending the feasibility numbers; the shipped verifier can now *measure* it on real entries: run the audit, then fix the floor. (Decision becomes data-driven; record in STATUS.)
2. **Predict-before-reveal mechanics** — plain spoiler-reveal vs a logged self-grade? (Lean spoiler-only v1; no new SRS state.)
3. **Where series pages publish** — app-only, or also generated into the wiki as word-atom siblings ([[PRD-Wiki-Reader-UX]] W2 could emit them)?
4. **Archival timing** — move the three superseded PRDs + v1 to `personal/archive/` now? (Needs explicit proceed.)
5. **`hanViet` population** — fill during C2 from open Hán-Việt data (cheap, future-proofs the vi bridge) or leave empty until vi work resumes?
