---
title: "PRD — Tsumugu Private Dictionary (consolidated): curated, voiced, Traditional-Chinese prototype of the shared dictionary corpus"
type: prd
status: draft
created: 2026-06-09
updated: 2026-06-09
license: "Apache-2.0 — ENGINE CODE. DATA (definitions, entries, audio) is clean-authored (open data + framework + Wedge's words) → SHAREABLE with the public dict; kept private-by-choice for this curated set; never bundled in the public engine."
languages:
  - zh-Hant (Traditional Mandarin, Taiwan) — the private prototype's only language; the public dict adds Simplified + EN + VI
posture: "PRIVATE-BY-CHOICE · OFFLINE-FIRST · PERSONAL (primary user: Wedge). A CURATED set of only the words he's actively learning. Entries authored CLEAN — from the functional-component framework (first principles learned from the Outlier Masterclass course) + open data + Wedge's own analysis. Entries are shareable with the public Tsumugu-dictionary — ONE shared corpus."
model: "ONE clean pipeline → ONE shared corpus. PRIVATE = curated / voiced / zh-Hant subset, tested FIRST. PUBLIC = full set ([[Tsumugu-dictionary]], parked PRD), grown from this prototype's lessons."
supersedes:
  - "PRD-Dictionary.md            (word-level: EN gloss + leveled 簡明中文 + examples)"
  - "PRD-Character-Structure.md   (functional components / etymology layer)"
  - "PRD-Tsumugu-Dictionary-App.md (Expert-tier character dictionary app)"
siblings_not_consolidated:
  - "[[PRD]]                  — the Tsumugu engine"
  - "[[PRD-Encoding-Layer]]   — SRS memory page (CONSUMES this dictionary)"
  - "[[PRD-Voice-Notes]]      — Qwen3-TTS / Serena pipeline (REUSED here for audio)"
framework_source:
  - "The functional-component framework (form/meaning/sound/empty + meaning trees) is FIRST PRINCIPLES Wedge learned from the Outlier Masterclass COURSE he owns (`personal/references/outlier/` holds the course lessons — NOT a dictionary). Wedge has NO access to the Outlier dictionary (iOS-only), so there is nothing to derive from it. The framework is public, non-copyrightable methodology (Outlier also publishes it free). Entries are authored from the framework + open data + Wedge's own analysis. Only courtesy line: don't republish the course's own prose verbatim."
tags: [prd, tsumugu, dictionary, private, offline, traditional-chinese, functional-components, shared-corpus, serena, voice, consolidated, prototype]
---

# PRD — Tsumugu Private Dictionary (consolidated)

**Wedge's personal, offline-first Traditional-Chinese dictionary — a CURATED "preened-notes" set covering ONLY the words he's actively working on (his learning frontier), NOT comprehensive (he already knows ~1,500 words). It is the PROTOTYPE of one shared dictionary corpus: every entry is authored CLEAN — from the Outlier *framework* (form / meaning / sound / empty + meaning trees), open data, and Wedge's own analysis — so the same entries flow to the public, full [[Tsumugu-dictionary]]. (The framework is first principles Wedge learned from the Outlier Masterclass *course*; he has no access to the iOS-only Outlier *dictionary*, so nothing is copied or derived from it.) Each entry has three layers on one record: (1) a WORD layer — two stored definitions (concise English gloss + leveled monolingual 簡明中文, toggleable) plus example sentences; (2) a CHARACTER-STRUCTURE layer — typed functional components, meaning trees, system links; (3) an EXPERT render — FORM → COMPONENTS → MEANING TREE(S) → evolution / ancient forms, every readable section voiced by Serena (Qwen3-TTS). Batch-generated, verified by measurement, consumed offline. Engine code is public and data-free; the curated data + audio stay private BY CHOICE (the entries themselves are clean and publishable). Wedge tests this private surface first, then folds the lessons into the public PRD.**

> **This PRD consolidates and supersedes three prior PRDs** — `PRD-Dictionary` (word layer), `PRD-Character-Structure` (component layer), `PRD-Tsumugu-Dictionary-App` (Expert app) — retained read-only until archived (§12). The SRS memory page (`PRD-Encoding-Layer`) and TTS pipeline (`PRD-Voice-Notes`) remain separate siblings: this dictionary *feeds* the former and *reuses* the latter.

---

## 0. Decision log (decisions + reasoning + what's ruled out)

- **✅ ONE clean pipeline, ONE shared corpus.** Private and public share entries, language (register / wording), and logic (framework / schema / renderer / generation / verification / voice). Every entry is authored from the framework + open data + Wedge's own words — nothing copied — so it flows freely between the curated private surface and the full public surface. **The framework is first principles Wedge learned from the Outlier Masterclass course (public methodology); the course is study material, not a dictionary — Wedge has no access to the iOS-only Outlier dictionary.**
- **✅ Prototype-first.** Wedge tests THIS private surface (offline, Serena-voiced, his active words) first, then folds what works — entry format, voice quality, generation prompts, verification — into the public [[Tsumugu-dictionary]] PRD. Private is private BY CHOICE (his study tool), not by legal necessity.
- **✅ CURATED, not comprehensive — "preened notes," active words only.** Entries exist ONLY for words Wedge is currently learning (his frontier / SRS queue). He already knows ~1,500 words — those get no entry. Words enter when he starts learning them and graduate / prune once known (no stale or duplicate entries). The FULL set is the public [[Tsumugu-dictionary]]. **Consequence:** the corpus is small (tens–low-hundreds of active entries), so deep per-entry analysis + full Serena voicing is cheap and hand-verifiable, and mass-batch generation + SQLite-at-scale are NOT needed.
- **✅ One entry, three layers.** Word layer (definitions + examples), character-structure layer (functional components + meaning trees), Expert render (evolution + ancient forms + voice). A multi-character headword assembles per-character structure entries; word-level definitions are not duplicated per character.
- **✅ Two definitions per word, both stored, one shown.** Concise English gloss (·-joined synonyms + optional one-sentence explanation; CC-CEDICT/kaikki senses populated) AND a leveled monolingual Traditional-Chinese definition written with a defining vocabulary at/below a target TOCFL band. Instant offline toggle (`AppSettings.dictDefault: "en" | "zh"`).
- **✅ "Leveled" is a MEASURED band, never a prompt.** Generate → segment → band-ceiling check (`checkDefLevel`, decomposition-aware vs the TOCFL band allow-list) → repair (≤3) → guard circularity/emptiness/wrong-sense → OpenCC `cn→twp` → stamp the achieved band. Ladder = TOCFL 華語八千詞; the computed level index ships private (TOCFL has no open license). Correctness is a separate human + round-trip-proxy gate.
- **✅ Functional Component Framework as the character model.** Four roles — form / meaning / sound / empty — typed per character (a role is relative: 力 is form in 男, meaning in 努, sound in 历). Empty splits into **distinguishing-mark** vs **corruption** (§5.3). Decomposition STOPS at functional components — never folk-decompose (部: 咅/阝 functional; 立/口 not). Kills the `鬧 = 鬥+市` folk error.
- **✅ Meaning trees match the methodology exactly** (§5.3): node kinds `original` / `sound-loan (〇)` / `derived` with **derivation depth** (→ ⇒ ⇛ ⭆ = 1–4); a `basicModern` flag; a `nowWritten` pointer (必→䪡); an `early-usage` kind when no original meaning is recoverable (~<2%); **character-meaning and component-meaning trees kept separate**; **multiple readings each own a tree** (長 cháng/zhǎng).
- **✅ Expert depth by default** (the `expert-details.jpg` 造 contract): Essentials (FORM, COMPONENTS, MEANINGS, STROKE) PLUS Expert (evolution, ancient forms, comparisons, OC/MC phonology). One schema, one renderer.
- **✅ Grounding is mandatory + visible.** Every form claim / component role / Expert assertion carries `grounding: "sourced" | "authored" | "mnemonic-device" | "speculative"` + an OPEN `source` citation. Folk stories (e.g. 射 "body drawing a bow") allowed only tagged `mnemonic-device`.
- **✅ Fully voiced via Serena (Qwen3-TTS).** Per-section MP3s (FORM, each component, meanings, Expert prose, example sentences). Qwen3-TTS is Apache-2.0, open-weights, self-hosted; Traditional Taiwan Mandarin (Serena). Reuse [[PRD-Voice-Notes]]; Web Speech fallback.
- **✅ Batch-only, verified, no API in the loop.** Agent fills the schema via staged prompts using OPEN inputs; `gen verify` gates grounding, component typing, OpenCC, band, schema completeness.
- **✅ Open-core hygiene.** Public engine = types + resolver + renderer (data-free, Apache-2.0, shared with the public dict). Curated entries/audio gitignored (private by choice); Outlier PDFs gitignored (personal reference).
- **🚫 Ruled out: Simplified output in the private prototype.** zh-Hant only here; OpenCC `cn→twp` guard fails on Simplified leakage. (Simplified + EN + VI are the public dict's breadth.)
- **🔁 Corrected framing:** earlier docs called entries "Outlier-derived." Wrong — Wedge has no access to the Outlier dictionary (iOS-only); he learned the *framework* (first principles) from the Outlier Masterclass course. Entries are authored from that framework + open data + his own analysis → clean and shareable from the start. The private surface stays unpublished by choice; the entries are publishable.

---

## 1. Problem

Wedge learns zh-Hant by immersion + SRS and wants real, voiced character understanding inside Tsumugu, offline — for the words he's actually working on. Today the pieces are scattered and partly contradictory:

1. **The word model can only explain a word one way.** `DictEntry.gloss` is a single overloaded string; no field holds both an English gloss and a leveled Chinese definition; `Sense` is never populated; examples are bare `string[]`. The `English | 簡明中文` toggle has nothing to flip.
2. **No reliable character structure.** The encoding pipeline produces folk decomposition (`鬧 = 鬥+市`) — a corrupted-component misread. No functional-component model, no per-character canon, no system links.
3. **No Expert character page, and nothing voiced.**
4. **Three overlapping PRDs** describe one product with diverging types.
5. **No clean, shareable source of truth.** Earlier framing made the character analysis "Outlier-derived," which would have walled it off from any public use. Authoring clean from the start removes that wall.

A monolingual Chinese dictionary leveled to a learner band does not exist off the shelf; neither does a free dictionary that explains characters by functional components from credible, *open* analysis. This builds both — starting small and private, designed to scale public.

---

## 2. Goals & success criteria (concrete, checkable)

**Word layer:**

1. One entry stores BOTH `definitions.en` and `definitions.zh` + structured `examples[]` under `tsumugu/prepared-content@2`; every `@1` file still loads via a normalizing reader. *Check: `@1`/`@2` fixtures round-trip; `@1` upgrade fills `definitions.en.gloss` from legacy `gloss`.*
2. ≥95% of generated `definitions.zh` use only vocabulary at/below band N as measured by `checkDefLevel`; residual repaired/escalated/queued. Correctness is a separate gate. *Check: `gen verify` reports `defLevelViolations` + `achievedLevel`.*
3. Zero `definitions.zh` contains Simplified (OpenCC `cn→twp`); none circular or empty after stripping the headword. *Check: Simplified-seeded fixture caught; circularity/emptiness tests.*
4. Each word has 3–6 examples `{text, translation, reading?, audio?, source, level, highlightSpans}`, headword present + highlighted, band-checked. *Check: verifier reports count/headword/level.*
5. `AppSettings.dictDefault` is one persisted key read by hover + encoding page; toggle is an instant offline render switch. *Check: switch persists; no network; one key across surfaces.*

**Character-structure + Expert layer:**

6. Every entry is `tridict/char@1`-shaped (schema shared with the public dict, §5.3) with FORM, ≥1 typed component, and a meaning tree; `gen verify` fails on missing role, empty `formExplanation`, folk story without `mnemonic-device`, or a corrupted component asserted as meaning-bearing. *Check: 鬧 typed correctly, not 鬥+市; 射's 身 = `empty/corruption`.*
7. Multi-character assembly: `resolveStructure("熱鬧")` → `[熱, 鬧]` + composed summary.
8. Expert block present for target chars: evolution, ancient forms, comparisons, OC/MC — each grounded or `speculative`. *Check: 造 matches `expert-details.jpg`; linter rejects untagged Expert prose.*
9. Meaning trees encode original/sound-loan/derived + depth, `basicModern`, `nowWritten`, early-usage; char- vs component-meaning trees separate; multiple readings each own a tree. *Check: 長 cháng + zhǎng; 必 `nowWritten: 䪡`; 恢 early-usage.*

**Sourcing / shareability (the new gate):**

10. **Every entry cites OPEN sources per claim; no Outlier PDF is in the agent context; no Outlier path in the repo.** Entries are clean → flow unchanged to the public dict. *Check: provenance manifest per entry lists open sources only; grep finds no Outlier path; an entry exported to the public corpus needs no relicensing.*

**Voice + integration + hygiene:**

11. Every readable section has a Serena MP3 ref when generated; 🔊 plays it; Web Speech fallback. *Check: FORM + components + meanings + Expert + sentences voiced for pilot chars.*
12. Reader hover (single char) → entry; encoding page imports `formExplanation` + components + compressed `expert.evolution`. *Check: 熱鬧 → tap 鬧 → entry; encoding story structure-backed.*
13. Public engine carries types + resolver + renderer only; zero data files, zero Outlier paths. *Check: `git check-ignore` on data/PDFs; grep clean.*

---

## 3. Scope

### In scope

- **Coverage = active words only.** Entries only for words Wedge is currently learning (frontier / SRS-driven); the ~1,500 known words excluded. Small, pruned corpus.
- The **word layer**: two definition layers, example store + generation, the `@2` schema + normalizing reader, the `dictDefault` toggle, hover + encoding consumption, three-regime license quarantine.
- The **character-structure layer**: role typing (+ empty subtypes), meaning trees (corrected schema), system links, per-char store + word assembly, grounding/corruption flags.
- The **Expert render**: FORM → COMPONENTS → MEANING TREE(S) → STROKE → Expert, study/pipelining modes, `#/dict/:char` surface + browse/search.
- **Voice**: Serena (Qwen3-TTS) per-section audio + manifest.
- **Clean generation + verification**: staged agent prompts on OPEN sources + Wedge's authorship; `gen verify`; human review queue; per-entry open-source provenance.

### Out of scope

- **Comprehensive / full coverage** — the public [[Tsumugu-dictionary]]. The private set stays pruned to the active frontier.
- **Publishing this surface** — private by choice. (Entries themselves may flow to the public set.)
- **Simplified, EN, VI** — public dict's breadth.
- **The SRS memory page / TTS engine internals** — [[PRD-Encoding-Layer]] / [[PRD-Voice-Notes]].
- **Using Outlier PDFs as a generation input** — they're personal reference only.
- Japanese kanji, Cantonese, live API generation, automated PDF OCR.

---

## 4. Users & use cases

**Primary (only): Wedge** — intermediate+ zh-Hant; immersion + SRS; wants predictive ability + long-term recall without folk radicals, offline, voiced, for his active words. (Uses the Outlier PDFs as personal study reading.)

1. **Deep lookup while reading.** Unknown char → entry → FORM + typed COMPONENTS + hear Serena → predictive guess.
2. **Word meaning two ways.** Hover → default definition (EN or 簡明中文) + reading + first example, offline. Encoding page → both definitions + full 例句.
3. **Sound-series study.** `#/dict/series/戠` → 識, 職, 織 … pattern once.
4. **Expert pass.** 造's evolution + ancient forms; compare 告; the sound-loan that disconnects "create" from 辶.
5. **Pipeline study (Lesson 12).** Reveal FORM+COMPONENTS → MEANINGS → Expert, spaced.
6. **Build + correct.** `pnpm gen dict --chars 造,識,鬧 --tier expert` (open sources) → verify → `gen dict-voice` → promote; override a field in `custom`.
7. **Graduate.** When a word is known, prune/graduate it out of the active set (no stale entries).

---

## 5. Core design

### 5.1 One entry, three layers
A single per-character record (`tridict/char@1`, NFC-keyed) carries the character-structure + Expert layers and links to the word layer (`prepared-content@2`) for multi-character headwords. Hover renders a compact projection; the encoding page and dict app render the full object; one source of truth — and that record is the SAME shape the public dict uses, so it transfers without transformation.

### 5.2 Word layer (`tsumugu/prepared-content@2`)

```ts
interface EnDefinition { gloss: string; explanation?: string; senses?: Sense[]; }
interface MonoDefinition { gloss: string; illustration?: string;
  level: string; achievedLevel?: string; levelEscalated?: boolean; monolingual: true;
  source?: "generated" | (string & {}); }
interface Definitions { en?: EnDefinition; zh?: MonoDefinition; }
interface ExampleSentence { text: string; translation: string; reading?: string; audio?: string;
  source?: "tatoeba" | "generated" | (string & {}); level?: string;
  shared?: boolean; highlightSpans?: { start: number; end: number }[]; }
```

- **English**: sourced (CC-CEDICT primary; kaikki supplement); populate `Sense[]`.
- **簡明中文**: authored from scratch on a non-BY-SA/non-BY-ND meaning anchor + the TOCFL allow-list; band-verified; OpenCC `cn→twp`; never seeded from MoEDict (BY-ND) or CEDICT/kaikki text (BY-SA) — input firewall.
- **Examples**: 3–6; Tatoeba-mine-first where clean (license-routed), LLM fallback; shared base + optional per-learner vault overlay.
- **Toggle**: `AppSettings.dictDefault`; instant offline. **Precedence**: `custom > prebaked > dict`, per field, with `sources[]`.

### 5.3 Character-structure + Expert layer (`tridict/char@1`) — schema shared with the public dict

```ts
type ComponentRole = "form" | "meaning" | "sound" | "empty";
type EmptyType = "distinguishing-mark" | "corruption";
type MeaningKind = "original" | "sound-loan" | "derived" | "early-usage";

interface Component {
  glyph: string; role: ComponentRole; function: string;   // role IN THIS character
  soundHint?: string; meaningLabel?: string;
  emptyType?: EmptyType; corruptionNote?: string;
  grounding: "sourced" | "authored" | "mnemonic-device" | "speculative"; source: string; // OPEN source
}
interface MeaningNode {
  sense: string; kind: MeaningKind;
  derivationDepth?: number;   // → 1, ⇒ 2, ⇛ 3, ⭆ 4
  basicModern?: boolean; nowWritten?: string;
  children?: MeaningNode[];
}
interface Reading {
  reading: string; zhuyin?: string; tone?: number; hanViet?: string;  // hanViet ready for the public VI bridge
  characterMeanings: MeaningNode[]; componentMeanings?: MeaningNode[];
}
interface CharEntry {
  schema: "tridict/char@1"; char: string;
  formExplanation: string; formAudio?: string;
  components: Component[]; readings: Reading[];
  strokeCount?: number; strokeOrder?: string[];
  expert: { evolution: string; ancientForms?: {label:string; glyph?:string; imageRef?:string; note?:string}[];
            comparisons?: {char:string; note:string}[];
            phonology?: {oldChinese?:string; middleChinese?:string; mandarin:string};
            citations?: string[]; audio?: string;
            grounding: "sourced"|"authored"|"mnemonic-device"|"speculative"; source?: string };
  systemLinks: { char:string; relation:"same-sound-component"|"same-meaning-component"|"same-form-component"|"compare"|"radical-category"; note?:string }[];
  words?: { term:string; reading?:string; gloss?:string }[];
  provenance: { sources: string[]; generatedAt: string };   // OPEN sources only
}
```

**Pedagogy mapping (framework Units I–III → fields):** Unit I (6 levels; form/sound/meaning; surface vs deep) → ship ≥ level 4, `formExplanation`, deep-structure COMPONENTS. Unit II (form/meaning/sound/sound-series/empty+corruption) → `components[].role`, `emptyType`, sound series. Unit III (meaning trees; pipelining) → `readings[].*Meanings`, study modes.

**Anti-folk rule:** decomposition stops at functional components; corruption + distinguishing marks flagged; folk stories only as `mnemonic-device`.

### 5.4 Generation pipeline (staged, batch, CLEAN inputs)

`G0 Index` → `G1 Deep structure` → `G2 Meanings` → `G3 Expert` → `G4 System` → `G5 Word layer` → `G6 Verify` → `G7 Voice`.

**Sourcing (G1–G4): OPEN sources only** — Wiktionary glyph-origin (CC-BY-SA), 說文解字 (PD), CHISE/IDS + make-me-a-hanzi, 漢語多功能字庫 (CUHK), 小學堂 (Academia Sinica), Dong Chinese — plus Wedge's own analysis. The functional-component *framework* (learned from the Outlier Masterclass course) shapes HOW components are typed; the FACTS come from the open sources. Each claim cites its open source + `grounding`. Output authored in Tsumugu's register (Traditional Taiwan), so entries are clean and shareable with the public dict.

### 5.5 Voice (Serena / Qwen3-TTS)
Per-entry `audio/` (`form.mp3`, `comp-01.mp3`, `meanings.mp3`, `expert.mp3`, `sent-01.mp3`, …) + `manifest.json` (`dict-audio@1`, voice: Serena). Qwen3-TTS (Apache-2.0, self-hosted, Traditional Taiwan Mandarin); reuse [[PRD-Voice-Notes]]; CLI `gen dict-voice --char 造`; Web Speech fallback. Small corpus → voicing everything is cheap.

### 5.6 App surface + study modes
`#/dict/:char`: header → tabs DICT/STROKE/CHARS/WORDS/SENTS → DICT body FORM → COMPONENTS (role badges, tap → component) → MEANINGS (tree) → EXPERT. Study modes (Lesson 12): Reference / Pipeline-1 (FORM+COMPONENTS) / Pipeline-2 (+MEANINGS) / Pipeline-3 (+Expert); `AppSettings.dictStudyMode`; default Pipeline-1 from SRS review.

---

## 6. Architecture

| Layer | Location | License |
|---|---|---|
| Types + validators + resolver + renderer | `packages/engine/src/dict/` | Apache-2.0, data-free — **shared with the public dict** |
| App UI | `apps/web/src/dict/` | Apache-2.0 |
| Generation + verify | `scripts/gen/dict/`, prompts | agent-run, OPEN inputs |
| Voice | `scripts/gen/dict-voice/` | Serena batch |
| Entry + word data | `packs/private/zh-hant/data/dict/<char>/` | clean-authored; private by choice; shareable |
| Outlier Masterclass course | `personal/references/outlier/pdfs/` | Wedge's study material (course lessons, not a dictionary); gitignored |

**Consumption:** `VaultIO.readText` + `readBytes`; lazy-load + LRU. **Scale:** small curated corpus — flat JSON per entry suffices; SQLite-at-scale not expected. Entries export to the public corpus unchanged (same schema).

---

## 7. Legal & reference posture

- **The framework is first principles, not a dictionary.** Wedge learned the functional-component framework (form/meaning/sound/empty + meaning trees) from the Outlier Masterclass *course* he owns. He has **no access to the Outlier dictionary** (iOS-only), so there is nothing to "derive" from. The framework itself is public, non-copyrightable methodology (Outlier also publishes it free). Entries are authored from that framework + open data + Wedge's own analysis → **clean and shareable** with the public [[Tsumugu-dictionary]].
- **Only courtesy line:** don't republish the *course's own prose / worked-example text* verbatim. Applying a framework (ideas, public) to open facts and writing in our own words is standard scholarship — facts aren't copyrightable. *(Not legal advice.)*
- **Open sources** (framework application): Wiktionary (CC-BY-SA), Shuowen (PD), CHISE/IDS + make-me-a-hanzi, CUHK 漢語多功能字庫, 小學堂, Dong Chinese — cited per entry; `grounding` tagged.
- **Word-layer data**: three-regime quarantine — from-scratch monolingual ZH (our license) · CC-BY-SA bilingual (CC-CEDICT/kaikki, attributed, separate asset, never fed into mono generation) · CC-BY Tatoeba (sentence-granular). MoEDict (BY-ND) reference-only, never paraphrased.
- **Ancient-form images**: vault-local or Unicode/open; no copyrighted rubbings.
- **Private by CHOICE, not necessity.** This curated/voiced set stays personal because it's Wedge's study tool — its entries are publishable and flow to the public full dictionary.

---

## 8. Plan (phased)

| Phase | Deliverable | Exit |
|---|---|---|
| **D0** | Shared schema (`tridict/char@1` + `prepared-content@2`) + normalizing `@1` reader + validators + fixtures 造/識/鬧 | parse + verify green; `@1` upgrades; schema is the one the public dict will reuse |
| **D1** | Word layer: definitions.en/zh + band verifier + examples; `dictDefault` toggle | 10 active words pass band + OpenCC; toggle offline |
| **D2** | Character-structure G1–G4 from OPEN sources + anti-folk verify | 10 active chars typed correctly; 鬧 not folk; 射 corruption flagged; provenance = open sources |
| **D3** | Expert block + app shell `#/dict/:char` | offline render matches `expert-details` order |
| **D4** | Serena voice + 🔊 | FORM + Expert voiced for pilot chars |
| **D5** | STROKE/CHARS/WORDS/SENTS tabs; reader/encoding links; pipelining | reader → dict → encoding end-to-end |
| **D6** | Curation lifecycle (pull active set from SRS; graduate/prune) **+ export-to-public proof** | corpus stays pruned; a sample exports cleanly into the public corpus shape |
| **→** | **Feed lessons into the public [[Tsumugu-dictionary]] PRD** | format/voice/pipeline learnings written back |

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| AI invents false etymology | grounding lint; Expert needs citation or `speculative`; human review on verify-fail |
| Course prose reproduced verbatim | author entries in our own words from open facts; framework = ideas (public), not text |
| Open-data analysis is shallow/inconsistent | Wedge's authorship fills gaps; mark `authored`/`speculative`; small set is hand-verifiable |
| Folk decomposition returns | anti-folk verify; stop-at-functional; corruption flag required |
| OC/MC errors | label phonology generated; `confidence`; no UI assertion without marker |
| Band metric ≠ correctness | separate spot-review + round-trip proxy |
| Entries don't transfer cleanly to public | shared schema from D0; export proof in D6 |

---

## 10. Open questions

1. **Active-set population**: auto-pull from the word-store / SRS queue, or curate by hand?
2. **Chinese UI copy**: Expert prose in English, 繁中, or bilingual toggle?
3. **Ancient forms**: Unicode-only v1, or store open/PD image assets?
4. **Cursive lessons**: STROKE tab v1 or defer?
5. **Shared engine package**: formally extract the data-free engine/renderer (+ voice worker) as a package both this and the public [[Tsumugu-dictionary]] depend on?
6. **Archive the 3 superseded PRDs** now, or after D0? (§12)

---

## 11. Relationship map

```
   Outlier Masterclass COURSE ──(taught Wedge the framework; he owns the course, NOT the iOS-only dictionary)──┐
                                                                                 ▼
   framework (form/meaning/sound/empty) + OPEN data + Wedge's authorship
                          │
                          ▼
              ONE CLEAN PIPELINE  →  ONE SHARED CORPUS  (tridict/char@1 + prepared-content@2)
                          │
            ┌─────────────┴──────────────┐
            ▼                            ▼
   PRIVATE surface (this PRD)     PUBLIC surface ([[Tsumugu-dictionary]])
   tsumugu/ · zh-Hant subset      tsumugu-wiki/ (Quartz) · FULL set
   curated active words           EN / ZH(S+T) / VI · AdSense
   offline · Serena-voiced        Qwen-voiced (EN/ZH) · PARKED PRD
            │   test first → fold lessons into the public PRD →   ▲
            └────────────────────────────────────────────────────┘
   Shared: entries · language · logic · engine code.   Feeds [[PRD-Encoding-Layer]]; reuses [[PRD-Voice-Notes]].
```

## 12. Supersession
Supersedes `PRD-Dictionary.md`, `PRD-Character-Structure.md`, `PRD-Tsumugu-Dictionary-App.md` — retained read-only until Wedge confirms archival (Open Q6); Claude will not delete them without explicit "proceed." `PRD.md`, `PRD-Encoding-Layer.md`, `PRD-Voice-Notes.md` unaffected.
