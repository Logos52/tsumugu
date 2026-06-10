---
title: "PRD — Tsumugu Wiki & Reader UX: a memory-first learning surface across the Quartz site and the web reader"
type: prd
status: draft
created: 2026-06-10
updated: 2026-06-10
revision: v1
license: Apache-2.0 (code/templates; wiki content carries its own page-level posture)
surfaces:
  - "tsumugu-wiki (public Quartz site, live at logos52.github.io/tsumugu-wiki) — primary"
  - "apps/web reader — the UX items consolidated from the Improvement Review"
design_ruling: "Wedge, 2026-06-10, on the record: encoding is the priority, not etymological accuracy. 'Sometimes entries can be wrong, but if they make sense and help the reader learn faster, that's the priority… accuracy with the end result, but not the bridge that gets you there.' Encoding pages are judged by the Rules of Memory, not by paleography. Grounded character analysis lives in the dictionary surface ([[PRD-Private-Dictionary-v2]]), not here."
links:
  - "[[PRD]] §5.5 (wiki + encoding pages)"
  - "[[Tsumugu-Improvement-Review]] §4 (reader UX findings)"
  - "[[PRD-Private-Dictionary-v2]] (the truth-surface counterpart)"
  - "personal/references/outlier/pdfs/01-RulesofMemoryTraditional.pdf (the 7 Memory Rules)"
tags: [prd, tsumugu, wiki, quartz, ui-ux, reader, encoding, memory-first]
---

# PRD — Tsumugu Wiki & Reader UX

**Make the two learner-facing surfaces — the public Quartz LLM-wiki and the web reader — feel designed rather than accreted, with one explicit master principle: these are *memory* surfaces. Every page and control is judged by whether it helps encoding and retrieval (the seven Rules of Memory from the Outlier Masterclass Lesson 1: Meaningfulness, Organization, Association, Visualization, Attention, Repetition, Interest), not by whether its stories are paleographically certified. The wiki today is a near-stock Quartz install (default theme, generic footer, default typography) carrying genuinely good content (CI-measured summaries, voiced vocab lists, an encoding page); the reader is powerful but cluttered (the Improvement Review's fourteen UX findings). This PRD turns both into coherent surfaces and wires them together — wiki pages know about the reader, the reader deep-dives into the wiki.**

> **The two-surface contract (resolves a latent fight before it starts).** *Encoding pages and wiki word pages optimize for memory.* A mnemonic story may be historically wrong (鬧 as "fight in a market") and still be the *right* content if it encodes fast — no accuracy gate, no regeneration crusade, no per-claim citations. *The dictionary's character-structure layer optimizes for grounded analysis* — that contract lives in [[PRD-Private-Dictionary-v2]]. The one accuracy rule that binds BOTH surfaces: the **end result** — the word's meaning, reading, and usage in the examples — must be correct. The bridge that gets you there is free.

---

## 0. Decision log

- **✅ Memory-first ruling adopted** (frontmatter quote). Encoding/wiki pages are evaluated against the 7 Memory Rules; etymological correctness is *not* an acceptance criterion there. The earlier framing (this review cycle) that the published 熱鬧 page "violates the anti-folk standard" is **withdrawn** — that page is doing its job.
- **✅ Meaning/reading/usage accuracy stays gated everywhere.** Wrong gloss, wrong zhuyin, broken example = defect on any surface. The existing measured gates (CI scores, OpenCC, band checks where applicable) continue to apply to *those* fields.
- **✅ Stories get a lightweight provenance label, not a gate (Wedge's refinement, 2026-06-10).** An encoding/wiki story may carry a small inline marker — e.g. 「故事」*story / folk* vs 「字源」*grounded* — so the learner can judge for themselves whether they're reading mnemonic or etymology while encoding. Purely informational: no verification gate, no regeneration requirement, no fight. Where the dictionary's character-structure layer later supplies a grounded analysis for the same character, the encoding page may show both, labeled — the story for memory, the analysis one tap away.
- **✅ One design system across wiki + reader.** The reader's visual language (status colors, ruby, Kaiti for target-language definition text per the mockups) becomes a small shared CSS layer the Quartz site adopts, replacing stock Quartz theming. Same learner, same eyes, same semantics.
- **✅ The wiki is a *reading destination*, not a notes dump.** Information architecture is reorganized around the learner loop: Readings (summary + vocab) · Courses · Word atoms · Method. The MOC stays but becomes generated-for-real (see Q1).
- **✅ Quartz stays.** It already publishes, it's offline-viewable HTML, and it reuses the llm-knowledge-base toolchain (PRD §5.5). We customize layout/components/partials — we do not migrate SSGs for UX reasons.
- **✅ Reader UX work = the Improvement Review's items, consolidated and committed** (voice discoverability, "your turn" feedback, audio-source visibility + stop-all, toolbar grouping, accessibility, sidecar metadata, empty states). This PRD is where they get exits and phases.
- **✅ Cross-surface deep links.** Reader hover "deep dive ↗" already opens encoding pages; we add the reverse (wiki page → "read this in context" where a source reading exists) and stable per-word URLs.
- **🚫 Ruled out: accounts, comments, server features** on the wiki. Static stays static.
- **🚫 Ruled out: redesigning the reader's interaction model** (grading keys, hover, guess-first are proven). This is arrangement, feedback, and discoverability — not new interaction paradigms.

---

## 1. Problem

**Wiki (UI/UX):**

1. **Stock-Quartz presentation.** Default theme colors, default `Schibsted Grotesk`/`Source Sans Pro` typography (no CJK-tuned stack — Traditional text renders in fallback system fonts), and a footer that still links to *Quartz's* GitHub and Discord. Nothing signals "this is a Mandarin learning surface."
2. **Vocab pages are flat lists.** A GSM lesson page is a numbered list of 24 `**word** (pinyin) — gloss ![[mp3]]` lines: no zhuyin option, no status awareness, no EN|簡明中文 duality (which the dictionary work now stores), no play-all/slow controls, no grouping by anything (MR#2 Organization is unserved); the inline `![[mp3]]` embeds render as bulky default audio elements.
3. **Word atoms are nearly absent.** Two pages exist (夜市, the 熱鬧 encoding page) against a vocab corpus of hundreds of taught words; there's no per-word URL for most vocabulary, so links, backlinks, and the graph (MR#3 Association) have almost nothing to bite on.
4. **CJK search is untested/weak.** Quartz's flexsearch defaults are latin-tuned; looking up 熱鬧 or rè nào or "renao" from the search box is the single most common dictionary gesture and currently an afterthought.
5. **Dual-location drift.** `tsumugu/wiki/` (seed) and the `tsumugu-wiki` repo (live, source of truth per STATUS) both hold content; nothing detects divergence — exactly Wedge's #1 stated pain (stale/duplicate knowledge).
6. **The MOC's "live counts" are a promise, not a mechanism** — the index table claims counts/CI come from frontmatter; there's no generator script committed in the wiki repo that proves it stays true as readings accumulate.

**Reader (UX — verified against the Improvement Review, still standing):**

7. Voice features are powerful but invisible: a lone 🔊 checkbox, surfaces that appear "magically" (practice bar, waveforms), no indicator of which audio source owns the speakers, no asset metadata ("Serena, 1,010 cues"), silent fallbacks.
8. Shadowing's "your turn" state has zero explicit feedback; Space is overloaded; icon-only buttons; waveforms lack ARIA; the toolbar is a long flat row that wraps awkwardly in immersion sessions.

---

## 2. Goals & success criteria (concrete, checkable)

**Shared foundation:**

1. **A shared learner design system** (small CSS layer + tokens): status colors, target-language type stack (Kaiti-class display for definition text, e.g. `"Kaiti TC", "DFKai-SB", "BiauKai", serif` with a webfont fallback decision — Q2), ruby styles, audio-pill component. Adopted by both Quartz (custom theme) and the reader. *Check: the same word rendered on wiki and reader is visually recognizable as the same system; stock Quartz footer/branding gone.*
2. **The 7 Memory Rules are the page-design rubric.** Each wiki page type (vocab, encoding, summary) documents which rule each section serves; review of a page = walking the rubric, not fact-checking stories. *Check: a `meta/` page states the rubric; templates in `scripts/gen/prompts/` reference it.*
2b. **Story labels render.** Encoding-page etymology/story sections carry the 「故事」/「字源」 marker per the decision log; the encoding-page template emits it; existing pages get the label opportunistically (no backfill crusade). *Check: the 熱鬧 page shows 「故事」 on its character story; the template includes the marker.*

**Wiki:**

3. **Per-word atom pages at scale.** Every taught vocab item gets (or links to) a canonical per-word page (generated, wiki-page template) with: word, reading (zhuyin + pinyin), both definitions when available (`definitions.en` / `definitions.zh` from the dictionary work), 2–3 examples, audio, related-words links, and "appears in" backlinks to readings/lessons. *Check: picking 5 random GSM lesson words, each resolves to a page with working audio + ≥1 association link; graph view shows clusters.*
4. **Vocab lesson pages upgraded:** compact custom audio player (not raw embeds), play-all + slow toggle, zhuyin|pinyin toggle, EN|中文 gloss toggle where `definitions.zh` exists, words grouped/sectioned (theme or lesson-dialogue order) to serve MR#2. *Check: one GSM lesson page demonstrates all toggles offline.*
5. **CJK-capable search:** headword, pinyin (with/without tones), and zhuyin all find the word page. *Check: 熱鬧 / renao / rè nào / ㄖㄜˋㄋㄠˋ each hit in the search box.*
6. **MOC generated for real:** a committed script in the wiki repo regenerates the index tables from frontmatter; CI (or a pre-push hook) fails when the MOC is stale. *Check: add a dummy reading → script regenerates row → removing it cleans up.*
7. **Drift guard:** one direction of truth (live repo) + a sync/check script that reports any file in `tsumugu/wiki/` newer than its twin. *Check: deliberately touch a seed file → checker flags it.*
8. **Mobile + offline pass:** vocab/encoding pages usable at 380px (audio pills tappable, tables reflow); `npx quartz build` output opens offline with audio working via relative paths. *Check: manual device pass recorded; offline open of a voiced page plays.*

**Reader (consolidated from the review; the seven committed items):**

9. **Shadowing "your turn" is visible** — label + distinct cue styling + `aria-live`. 10. **Voice onboarding/empty states** — "Voice notes: Serena (1,010 cues)" indicator; "no voice assets — generate with `gen voice-notes`" hint. 11. **Audio-source pill + Stop-all** — one transport element reflecting who owns the speakers. 12. **Toolbar grouping / immersion collapse** — voice controls grouped; video chrome collapsible when shadowing. 13. **Accessibility pass** — ARIA on waveform hosts, visible labels or tooltips+labels on icon buttons, `prefers-reduced-motion`, documented Space behavior + a `?` hotkey legend. 14. **Sidecar metadata surfaced** (voice, generatedAt, coverage). 15. **Practice-bar/waveform appearance is announced, not magic** (one-time hint, consistent reveal).
*Check for 9–15: each maps to a test or a recorded manual check; no regression in the 731-test suite.*

---

## 3. Scope

### In scope
- Quartz customization: theme/tokens, layout components, footer/branding, CJK type stack, audio player partial, search config.
- Generators: per-word atom pages, MOC regeneration, drift checker (all batch scripts in the existing `scripts/gen` + wiki-repo toolchain; agent-run where prose is needed).
- The seven reader UX commitments (items 9–15).
- Cross-surface linking (reader ↔ wiki) and stable word URLs.

### Out of scope
- Truth-graded character analysis (→ [[PRD-Private-Dictionary-v2]]); no accuracy gate on mnemonics here, per the ruling.
- New reader features (new audio flavors, new study modes) — seams come from [[PRD-Engine-Improvements]].
- The public trilingual dictionary site (→ its own parked PRD); this wiki remains the personal/learning wiki even though it may later host that project.
- Comments, analytics beyond a privacy-respecting counter (Q4), accounts, server rendering.

---

## 4. Users & use cases

**Primary: Wedge** (daily: reads a summary, encodes vocab, shadows in the reader). Secondary: any learner who lands on the public wiki; future users of the public engine who follow docs links into the wiki.

1. **Encode after reading:** finish a reading in the reader → vocab page → play-all with slow repeats → click a hard word → its atom page → association links pull in two known words (MR#3) → back to SRS.
2. **Search-first lookup:** type "renao" on the wiki from a phone → word atom in one hop → hear it, see both definitions, jump to the reading where it appeared.
3. **Shadow without confusion:** in the reader, the source pill says 🔊 Serena; 跟讀 shows "你的回合 — Your turn"; Stop-all kills everything with one press.
4. **Maintain without drift:** add a reading via the pipeline; the MOC regenerates; the drift checker stays quiet; nothing is hand-edited twice.

---

## 5. Design

### 5.1 The Memory-Rules rubric (page anatomy)
Each section of each page type declares its rule. Encoding page (the existing shape, kept): story/etymology → **MR#1 Meaningfulness** (a *plausible* story beats no story; truth optional); fixed section order across all pages → **MR#2 Organization**; related/confusable links + "your flag" callouts → **MR#3 Association** (personal collisions like 熱鬧/鬧鐘 are the highest-value content on the page); vivid scene + (later) ancient-form or scene imagery → **MR#4 Visualization**; one-word-one-page, minimal chrome → **MR#5 Attention**; audio + SRS links + recycled examples → **MR#6 Repetition**; personal/funny examples over textbook ones → **MR#7 Interest**. The rubric is the review checklist for generated pages — *"does each section pull its mnemonic weight"*, never *"is the story certified."*

### 5.2 Word-atom generation
`gen wiki --atoms` walks the taught-vocab corpus (GSM lesson lists + readings' new-word lists + the word store), emits one page per word from the existing `wiki-page.md` template extended with: `definitions.en/zh` when the dictionary data has them, audio refs from existing word-audio manifests (reuse, don't re-render), and an auto-built "appears in" section from reverse lookup of lesson/reading sources. Idempotent + incremental like every other gen command. Atom pages are *additive* — lesson pages link to them; nothing breaks if an atom is missing.

### 5.3 Quartz customization points
- `quartz.config.ts` theme: learner palette (reader's status hues as accents), CJK-aware `typography` (Q2 decides webfont vs system stack), real `baseUrl` branding, footer → Tsumugu links.
- `quartz.layout.ts`: keep Explorer/Graph/Backlinks (they serve MR#3); add a compact language-toggle component (zhuyin|pinyin, EN|中文) implemented as a tiny client script + CSS classes on generated spans — same toggle semantics as the reader.
- Audio: a remark/rehype-level transform (or generation-time emit) converting `![[audio/x.mp3]]` into the shared audio-pill markup with play/slow; play-all = a page-level script iterating pills.
- Search: feed flexsearch a per-page index field containing headword + pinyin (toneless + toned) + zhuyin from frontmatter, so CJK lookup works without tokenizer surgery.

### 5.4 Reader UX changes (the committed seven)
All ride existing seams (and get easier after [[PRD-Engine-Improvements]] E2–E3): the source pill reads the same precedence state the frame loop already computes; "your turn" hooks the shadowing reducer's `waiting` phase; grouping is toolbar markup + CSS; metadata comes from manifests already parsed. None of these touch the engine.

---

## 6. Risks & mitigations

| Risk | Sev | Mitigation |
|------|-----|------------|
| Atom-page generation floods the wiki with thin pages | Med | Atoms require ≥ gloss+reading+audio to emit; thin candidates queue for the next fill batch instead of publishing empty shells |
| CJK webfonts blow page weight | Med | Q2: prefer system Kaiti stack + subsetted webfont only for the definition-text class; measure |
| Quartz upgrades fight customizations | Med | Keep changes in config/layout/components + one CSS file; no core-quartz patches; record the delta in the wiki README |
| Two-surface contract drifts (someone "fixes" mnemonics for accuracy) | Low | The ruling is quoted in this PRD's frontmatter and the rubric page; dictionary PRD owns truth |
| Reader UX changes regress the keyboard flow | Med | Hotkey legend + tests for every existing binding before/after; no binding changes without a decision-log entry |
| Drift checker nags instead of helping | Low | One direction only (seed→live), advisory output, no hard CI gate on content |

---

## 7. Plan (phased)

| Phase | Deliverable | Exit |
|---|---|---|
| **W0 — Design system + branding** | Shared CSS tokens; Quartz theme/footer/typography; rubric page | Criteria 1–2; stock branding gone |
| **W1 — Vocab page upgrade** | Audio pills + play-all/slow + toggles on one GSM lesson, then all | Criterion 4 |
| **W2 — Word atoms** | `gen wiki --atoms` + backlink sections; graph becomes useful | Criterion 3 |
| **W3 — Search + MOC + drift** | CJK search fields; MOC generator; drift checker | Criteria 5–7 |
| **W4 — Mobile/offline pass** | 380px + offline-HTML fixes | Criterion 8 |
| **R1 — Reader feedback** | "Your turn" + source pill + stop-all | Criteria 9, 11 |
| **R2 — Reader discoverability** | Voice indicator/empty states; metadata; appearance hints | Criteria 10, 14, 15 |
| **R3 — Reader arrangement + a11y** | Toolbar grouping/immersion collapse; ARIA/labels/legend | Criteria 12–13 |

W and R tracks are independent; R1 is the highest daily-impact item and can start immediately.

---

## 8. Open questions

1. **MOC generator home** — wiki repo script or `gen wiki --moc` in the engine repo (which already owns generation)? Lean engine repo, emitting into the wiki checkout.
2. **CJK typography** — system Kaiti stack only, or subset a webfont (e.g. a Noto serif/Kai subset) for definition text? (Weight vs consistency across devices.)
3. **Word-atom URL scheme** — `zh-Hant/words/熱鬧` (readable, current style) vs slugged ASCII? Quartz handles unicode paths; confirm GitHub Pages + offline-file-open both do.
4. **Analytics** — none today (`analytics: null`); add a privacy-respecting counter to learn whether anyone else reads the wiki, or stay dark?
5. **Vocab-page grouping key** for MR#2 — dialogue order, semantic clusters, or POS? (Pick per content type; courses likely dialogue order.)
6. **Does the 譯/toggle state persist on the wiki** (localStorage) to mirror reader settings, or stay per-page-load?
