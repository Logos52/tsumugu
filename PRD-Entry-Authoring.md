---
title: "PRD — Encoding Dictionary entry authoring: how character entries and sound-series pages get written, to the 造/射 bar, student-facing prose only"
type: prd
status: draft
created: 2026-06-10
updated: 2026-06-11
revision: "v1.7 — §0.6.7 over-cut guard (the assembly fact is FORM's own fact — 造 regains "— zào, 'to arrive'"); v1.6 — §0.6 grows moves 7–8 (one home per fact — the row usually wins; no exposition: inferable action, summaries of the visible, restated contrasts stay unwritten) and the binding process rule: the eight moves are author-side checks on every rewrite — a fix that introduces a new clause of the same kind has failed the round. v1.5 added §0.6 Round 5 (show, don't tell, moves 1–6); v1.4 §0.5 condensed register + §2.5 sentence mix; v1.3 Round 3; v1.1 round-2 + adversarial review."
parent: "[[PRD-Private-Dictionary-v2]] — owns the engine schema (tridict/char@1), phases, and curation lifecycle. This PRD owns the CONTENT LAYER: what an entry says, who writes it, and the quality gates it must pass. Every conflict with the parent is recorded in §0.3."
division-of-labor: "Claude Fable authors entry content (§5–§8). A second agent implements rendering, formatting, and the voice pipeline (§6). Wedge spot-reviews and signs off."
demo: "https://logos52.github.io/tsumugu-wiki/static/dict-demo/ · source at tsumugu-wiki/quartz/static/dict-demo/"
siblings:
  - "[[PRD-Private-Dictionary-v2]] — schema, phases, lifecycle"
  - "[[PRD-Encoding-Layer]] — SRS memory page (consumes entries)"
  - "[[PRD-Voice-Notes]] — Serena / Qwen3-TTS pipeline (implementation agent reuses)"
  - "PRD-Trilingual-Dictionary-PUBLIC-v2 (parked) — public twin; same clean corpus; file at ~/Projects/PRD-Trilingual-Dictionary-PUBLIC-v2-2026-06-10.md"
tags: [prd, tsumugu, dictionary, encoding, authoring, content-standard, student-rule, functional-components, stroke-order]
---

# PRD — Encoding Dictionary entry authoring (v1.1)

**Every character gets an entry at the 造/射 bar: a one-line dictionary definition, a functional decomposition that gives each component a concrete identity, a story that snaps those components back together so the student encodes the glyph by watching the pieces fit, a meaning tree, five-to-six voiced graded examples, a related set that prevents real confusions, and an evolution section where history explains the modern form. Rendered prose obeys one rule — every sentence helps the student encode, read, or use the character. Production bookkeeping (grounding, pipeline state, voice infrastructure, attribution, design rationale) lives in metadata and never renders. Stroke order ships once, on component pages. Claude Fable authors the content; a second agent renders, formats, and voices it.**

---

## 0. Decision log

### 0.1 From the demo review (Wedge, 2026-06-10)

- ✅ **造 and 射 set the quality bar.** Their FORM + STORY pairs are the model ("the story and form are excellent — we need content like this for all characters"). The §4 checklist makes that bar enforceable so no entry ships partially filled (the 射 review note: "missing extra content"); §7.5 enforces the checklist's structural minima in CI.
- ✅ **Component-combination is the encoding method.** Break the character into functional components, give each a concrete identity, then recombine them in a story so the student sees how they fit together. §2 specifies it per section.
- 🚫 **Production meta is banned from rendered output** — text, hover, and audio alike. "Honesty layer", "tagged until a source fill lands", "queued for a sourced expert fill", "A memory hook, not history", grounding marks ⓢ/ⓐ/⚠, the voice-infrastructure footer, product self-comparisons. The reasoning is binding; the phrase list is illustrative. §1 states the rule. §7.1's lint enforces the floor.
- 🚫 **The depth buttons (structure / + meanings / + expert), the study-mode button, and the reveal bar are removed.** The entry page renders complete. Staged reveal, if ever wanted, belongs to the SRS/encoding surface ([[PRD-Encoding-Layer]]).
- ✅ **Provenance and grounding survive — in metadata.** Per-claim grounding tags, source citations, and open questions move to the entry's `meta` block, read by producers and CI. The renderer prints nothing from `meta`, by construction. (Amendment 2, §0.3.)
- ✅ **A sitewide "how to read these pages" page carries the methodology** — the 字源/故事 convention, the component color code, the drift-band idea, the stop-at-functional-components lesson. Entries explain only their character. Fable authors the page's prose; the implementation agent builds and links it.
- ✅ **Sound-series content contract is locked; the formatting needs work.** The 告 series content ("this is excellent too") stands as written in §2.8. The visual redesign is the implementation agent's first backlog item: it produces mockups, Wedge decides (§9 Q1).
- ✅ **Division of labor: Claude Fable writes the character entries.** A second agent implements voice notes, formatting, rendering, and audio QA. Wedge reviews. §6 draws the line precisely.
- ✅ **Word pages (熱鬧-class) follow the same student rule.** Their authoring contract activates when the word-page batch starts; this PRD covers character entries, series pages, and component pages.

### 0.2 Round 2 (Wedge, same day)

- ✅ **Every entry carries a plain dictionary definition** ("something simple and minimalistic — the other dictionaries are full of clutter"). One concise English line + one 簡明中文 line in the HEAD; both stored, `dictDefault` picks the shown one (the word layer's convention); the zh line is band-checked by the existing `checkDefLevel` verifier. The MEANINGS tree keeps the full sense structure; the definition answers the lookup question in one glance. §2.1.
- 🚫 **Attribution language is banned from rendered output** (on 造's "verb · the Expert-contract example" tag line). Internal contract names, framework and course names, lesson references — producer vocabulary, the same disease as the grounding marks. The student reads "verb — to make; to build". §7.1.
- ✅ **Stroke order ships at the component level only.** The component inventory is a small closed set (the cited "~200" is the 214 Kangxi radicals; functional-component inventories run ~300–450) and stroke order is compositional: write the components, know the assembly rules, and the full character follows. Component pages own stroke order; character entries link to them; a small exceptions list covers characters that violate compositional ordering (必 is the canonical case). The inventory is seeded from our own corpus — every component appearing in an authored entry gets a page. §2.9. (Amendment 6, §0.3.)

### 0.3 Explicit amendments to [[PRD-Private-Dictionary-v2]]

1. **Entry anatomy** (amends v2 §5.7 MR#2 "FORM → COMPONENTS → MEANINGS → EXPERT", §2 criterion 8, phase C2). The anatomy becomes HEAD / FORM (components folded in as rows) / STORY / MEANINGS / EXAMPLES / RELATED / EVOLUTION. EXPERT is renamed EVOLUTION — the old name advertised a depth tier that no longer exists — and the section is omissible when empty. Expert-tier *depth* stays the default for what EVOLUTION contains when it ships.
2. **Grounding tags are data-only** (amends v2 §0 carried decision 6 and the two-surface contract's "the tag is a shelf label"). Tags (`sourced | authored | mnemonic-device | speculative`) and citations live in `meta` and CI. The only rendered shelf labels are the 字源/故事 section chips and their standing subtitles (§2.3).
3. **Pipelined study modes are dropped from the dictionary surface** (amends v2 §2 criterion 10, §4 use case 3, §5.7 MR#5, and phase C3's exit). C3's exit becomes: tabs + complete render; `dictStudyMode` is not built.
4. **Voice plan sharpened** (amends v2 §2 criterion 9, phase C5). Voice granularity = every `sayText` (each prose section + each example). Acceptance = transcribe-back QA (the `qa_demo_audio.py` pattern); a clip file's existence alone is never a pass. Web Speech stays as a silent runtime fallback; the page never describes it.
5. **Phase C1 gains scope:** the `char-author@1` → `tridict/char@1` merge (§5).
6. **Stroke order moves to component pages** (amends v2 §0.1.4 "STROKE tab ships stroke count/order only"). Character entries may keep a stroke *count*; stroke *order* lives on component pages (§2.9).
7. **Render-language policy carried, restated** (v2 §0.1.2 decided Expert prose; we extend the same ruling to all sections): 繁中-primary with EN on the 譯 toggle is the standing default. The demo rendered EN-primary as a prototype artifact. Artifacts are authored so either policy renders (§5); flag to change.

### 0.4 Round 3 (Wedge, 2026-06-11)

Wedge re-flagged four demo lines verbatim — 射's "Wrong as history (the 字源 card just told you why), excellent as a hook.", 射's "You get to choose which one does the remembering — that's the whole design.", 射's "reading it as 'body' is exactly the folk trap this dictionary exists to flag", and 造's "(A memory hook, not history — the real link is sound, not logic.)". All four were already §1 fixtures and are already absent from the Batch 0 artifacts; the re-flag upgrades the rationale and it is binding:

- 🚫 **Meta is a distraction, not merely low signal.** A sentence in this register doesn't just spend attention and buy nothing — it pulls the student's attention off the character mid-encoding. The cost is negative, not zero ("everything I flagged is not just low signal but a distraction to the student").
- 🚫 **This register never appears in the dictionary, in any phrasing** ("please don't ever say things like this in the dictionary"). The ban applies at authoring time, in every voice and language, on every student-facing surface — not as a lint cleanup after the fact.
- 🚫 **The uncertainty budget on student surfaces is zero** (same day, separate session; supersedes v1.1's §3 one-sentence budget). Epistemic hedging — "uncertain", "unclear", "historically unverified" — is the same distraction wearing scholarly clothes. FORM states the surface reading declaratively; a component with no claimed role renders bare (no chip, no color, no comment); everything about the open question lives in `meta.openQuestions`. §3 is rewritten to match; 鬧 ships this way.

### 0.5 Round 4 (Wedge, 2026-06-11) — the condensed register

- ✅ **Conciseness and clarity are the prose standard; length is an output, never a target.** The register model is the condensed-reference register of Wedge's course-condensation documents: every sentence carries one load-bearing fact, stated once, in concrete words — complete sentences, never telegraphic, one reading per sentence. A section shrinks whenever fewer words are clearer; an entry runs long only when the character needs it.
- ✅ **The deletion test extends to clause level** (§1). Delete any clause: if the student lost no fact and no key, the clause was filler. The recurring offenders, named so new ones fail the same way: **announcement clauses** ("The graph originally wrote a word meaning X" → "The original word: X"), **restatement** of a fact already on the page in other words, **scaffolding idioms** ("carries the idea of going" → "carries *going*"), **pointer clauses** to content already in view ("(see the meaning tree)").
- **Fixture** (造 FORM, v1.3 → v1.4): "A foot on the road (辶) carries the idea of *going*; 告 carries the sound. The graph originally wrote a word meaning "to arrive; to go to." The everyday senses "make, build" don't come from the picture at all — they ride the sound (see the meaning tree)." → "A foot on the road (辶) carries *going*; 告 carries the sound. The original word: "to arrive; to go to." The everyday senses — make, build — ride the sound, not the picture." (Superseded again by §0.6 — label-openers out: "…告 gives the sound — together they wrote "to arrive; to go to." Make and build ride the sound, not the picture.")

### 0.6 Round 5 (Wedge, 2026-06-11) — show, don't tell

✅ **Put in the details; the reader's imagination fills the blanks.** Scenes and form paragraphs render concrete details — components, identities, things in spatial order — and stop. The banned moves, each from a live Batch 0 fixture:

1. **Instruction verbs.** "Picture a night market: steam, vendors yelling…" → "A night market: steam, vendors yelling, shoulder to shoulder." The imperative tells the reader to imagine; the details make them.
2. **Mood labels.** "a happy crush of people" → "shoulder to shoulder." Steam, yelling, and crowding imply the mood; naming it hands the reader a conclusion they would reach themselves.
3. **Interpretive paraphrase after the details.** "鬧 is 鬥 quarreling wrapped around 市 market — a quarrel's noise filling the marketplace." → "鬧 is 鬥 quarreling wrapped around 市 market." The trailing clause re-narrates what the components just showed ("yes the student can already see that — it's obvious").
4. **Label-openers.** "The original word: X." / "The everyday senses — make, build —…" → verbs carry the facts: "together they wrote "to arrive; to go to." Make and build ride the sound, not the picture."
5. **Stating what the page shows.** "市 'market' — the square inside the quarreling frame" → "shì — market." The layout is on screen; identity lines carry invisible facts only — depiction, meaning, reading, function.
6. **Device commentary.** "Feet first, walls after — the scene's order is the glyph's order." → "Feet first, walls after." The scene-to-glyph mapping is the story's job, done silently.
7. **One home per fact.** "together they wrote 'to arrive; to go to.' Make and build ride the sound, not the picture" duplicated the meaning tree's (orig.) and 〇 nodes one screen below; "The left side is not a body" duplicated the 身 row; "a hand, releasing the string" duplicated the 寸 row ("avoid redundancy — that's already written below"). Every FORM/STORY/EVOLUTION sentence is checked against the composition line, the rows, the tree, and the neighboring sections; a fact stated twice keeps its best single home — and the row usually wins. **Guard against over-cutting:** the assembly fact — the word the components jointly write — is FORM's own fact, distinct from the tree's sense nodes; without it the components sit unconnected (the 造 lesson: "carries going" + "gives the sound" needs "— zào, 'to arrive'" or the road and the sound never meet). Deleting the glue that makes a section intelligible fails Round 4's clarity half.
8. **Exposition.** "everyone shouting at once" — the reader infers the shouting from a quarrel wrapped around a market ("stop giving me exposition. i need details and components only. enough for the user to fill in the blanks"). Scenes carry components and concrete details; inferable action, summaries of the visible ("one donor, four everyday words"), and restated contrasts ("Same shape, different jobs") stay unwritten.

**Process rule (binding):** these eight moves are author-side checks, run on every rewrite before it ships — including rewrites made to fix a flagged line. A revision that removes one flagged clause and introduces a new clause of the same kind has failed the round. Wedge's strikes are not the QA loop.

---

## 1. The student rule — and why the meta goes

**The rule:** the entry page has exactly one reader, a student encoding a character. Every rendered or voiced sentence must do one of two jobs:

1. help the student encode, read, remember, or predict the character or the language; **or**
2. serve as **apparatus** — a key the student needs to decode content on the page (the component color legend, the meaning-tree notation key, a guess-then-reveal prompt). Apparatus must teach a code that encoding-bearing elements on the page actually use, and nothing else.

**The deletion test:** delete the sentence. If the student lost neither content (job 1) nor a key to content (job 2), the sentence was never content. Fable applies it to every sentence before shipping (§8 A10). A sentence that fails the test is worse than dead weight: it pulls the student's attention off the character mid-encoding — a distraction, not merely low signal (§0.4).

Why the demo's meta lines fail this test, written out so that new inventions of the same kind fail it too:

1. **Attention is the budget** (Memory Rule #5, Attention: encoding requires attention on the thing to be encoded; the rules are mapped in v2 §5.7). A student gives the page a fixed amount of attention; every sentence spends some. "Queued for a sourced expert fill" spends attention and buys zero encoding. At five entries a session, the waste compounds.
2. **Meta breaks the spell.** Stories encode through immersion (Rules #4 Visualization, #7 Interest): the student inhabits the scene of a body drawing a bow, and the glyph sticks. A story that grades its own historicity — "(A memory hook, not history)" — un-casts itself; the student steps out of the scene and into our editorial meeting. The 故事 chip and its standing subtitle (§2.3) already tell them what kind of thing they are holding. Where the history genuinely matters to understanding the form, the 字源 card states it as a fact about the character ("the everyday senses ride the sound"), which is content.
3. **Visible scaffolding reads as damage.** "Pending sourced fill" tells the student the page is unfinished — so they discount everything on it, including the finished sections. An entry either ships a section or omits it. No placeholder sections, no "image pending" labels, no empty-state apologies. Lint-clean scaffolding fails the same way: "a fuller account awaits future scholarship" contains no banned word and is still a construction sign.
4. **The audience for the bookkeeping is us.** Grounding tags, pipeline stage, TTS engine, batch status, framework attribution — these answer producer questions. They belong where producers look: `meta` fields and CI output. Student-facing honesty is structural: 字源 states only what is known, 故事 is labeled a scene, and a component with no claimed role renders bare — no chip, no color, no comment (§3). Process language and the state of the scholarship stay in `meta`.
5. **Product and method self-talk fails the same way.** "That's the whole design", "the folk trap this dictionary exists to flag", "a thing no folk-mnemonic dictionary can give you", "the Expert-contract example" — the page defending, selling, or attributing itself. The student came for the character. One narrow carve-out: an observation the student can convert into a concrete future behavior — a prediction rule, a confusion to avoid — is content even when it mentions their learning ("after two or three series, you start predicting characters you've never studied" licenses a specific guessing behavior). Claims about the method's effectiveness or superiority stay banned in every phrasing.

**Before → after, on real demo lines** (this table is the lint's test fixture — §7.1):

| Demo line (rendered today) | Verdict | Replacement |
|---|---|---|
| 鬧: "Honesty layer: the surface reading … is a folk decomposition … tagged ⚠ speculative until a sourced fill lands…" | process talk | "鬧 is 鬥 — quarreling — wrapped around 市 market: a quarrel's noise filling the marketplace." (declarative; the scholarship lives in `meta` — §0.4) |
| 鬧 component row: "'market' on the surface — original role unresolved ⚠ · queued for a sourced Expert fill" | process talk | "市 'market' — the market square you draw inside the quarreling frame" (no role chip, no color — §3) |
| 鬧 crumb: "· this entry leads with the story — its analysis is honestly unresolved" | self-reference | delete; `leadOrder` is a data field — the layout leads with the story |
| 鬧 EXPERT section: "Queued for the sourced fill (G3) … renders empty-state honestly rather than inventing history…" | placeholder + process | section omitted until content exists |
| 鬧 FORM sayText: "…我們先標記為待考。" ("we mark it as pending verification") | process talk, voiced | sayText regenerated to the §3 pattern — declarative surface reading, no hedging |
| 造 HEAD tags: "verb · the Expert-contract example" | attribution | "verb — to make; to build" |
| 造 story: "(A memory hook, not history — the real link is sound, not logic.)" | story grading itself | delete from the story; the 字源 card already carries "the everyday senses … ride the sound" as content |
| 射 story: "Wrong as history (the 字源 card just told you why), excellent as a hook. You get to choose … that's the whole design." | self-reference | delete; end the story inside the scene |
| 射 component row: "reading it as 'body' is exactly the folk trap this dictionary exists to flag" | self-reference | "the 'body' reading is a look-alike; the original picture was the bow" |
| Footer: "Voice: pre-baked Qwen3-TTS (Serena) … Grounding marks: ⓢ sourced · ⓐ authored · ⚠ speculative." | infrastructure + bookkeeping | delete both footers (`.note`, `.foot`) from every page |
| 告 series intro: "Every line below is real Serena audio with an 🌊 A/B-loop." | infrastructure | delete; keep "hear 告 living inside common words you already half-know" |
| 告 series note: "…that's the framework earning its keep (and it's a thing no folk-mnemonic dictionary can give you)." | product self-talk | keep the observation, cut the comparison: "The rhyme **-ào** survives in every member; only the initial drifts, and it drifts in bands. After two or three series, you start predicting characters you've never studied." |

---

## 2. The entry template

Section order is fixed; lead order between FORM and STORY is a per-entry field (`leadOrder: origin | story` — story leads when the analysis is uncertain or the story is the stronger anchor). All sections render; there are no depth tiers, study modes, or reveal bars.

An entry keeps exactly two pieces of rendered apparatus: the component color legend (§2.1) and the meaning-tree notation key (§2.4). The about page repeats both with fuller explanation and carries everything else about the method.

### 2.1 HEAD
- Glyph, zhuyin + pinyin.
- **Definition — the lookup answer, minimal by design:** one concise English line with part of speech ("verb — to make; to build") and one 簡明中文 line (做出來；蓋起來). Both stored; `dictDefault` picks the shown one; the zh line passes `checkDefLevel` at the corpus floor. Sense structure beyond one line belongs to MEANINGS.
- Composition line with each component typed and colored: `造 = 辶(形) + 告(聲)`. Components with unknown function render uncolored (§3).
- The component color legend (形/義/聲/空) — apparatus, kept.

### 2.2 FORM 字源
- One short paragraph: what each component does **in this character** and the word they jointly write, in concrete words — and nothing the layout already shows (§0.6). 造: "A foot on the road (辶) carries *going*; 告 gives the *sound* — zào, 'to arrive.'" That register is the bar, and it is checkable: every component identity names a concrete, drawable thing in one line (§4), and every clause carries a fact the student cannot see on the page.
- When a component is a corruption: say plainly what the early form drew and that the modern shape is a look-alike (射's 身 paragraph is the model). When a sense rides the sound: state it as a fact about the word.
- Per-component rows: glyph · role chip (形/義/聲/空) · one-line concrete identity · one-line detail. Sound components link their series page; every component links its component page (§2.9). Identities come from the component registry (§5) so 辶 reads the same on every entry that contains it.

### 2.3 STORY 故事
- Section chips carry fixed, template-level subtitles — apparatus that travels with every entry, so a student who deep-links still knows what each card is: **字源 — what the parts really do** · **故事 — a scene to remember it by**. The subtitles are set once in the template; entries never restate or elaborate them.
- One Chinese line with the components bolded, then two-to-three English sentences of scene.
- **The combination contract:** the scene uses every visible component under the identity FORM gave it (or the surface look-alike identity, for corrupted or uncertain ones), arranged so the glyph's own layout maps onto the scene — the student should be able to redraw the character from the story. 造: the foot arrives first, then the building begins. 射: a body leans in and draws, inch by inch — release.
- Sensory, concrete, specific (Rules #4, #7) — details only; the reader's imagination assembles them (§0.6). No instruction verbs ("Picture…", "Imagine…", 想像), no mood labels, no paraphrase of what the details just showed. The story never comments on itself, never grades its own historicity, never mentions the dictionary.

### 2.4 MEANINGS
- The tree: original sense → extensions, one arrow per step of extension (→, ⇒); loan senses get the 〇 borrowed-for-sound node (造's 製造); the modern base sense carries the COMMON tag. Every node: 中文 + English.
- The one-line notation key — apparatus, kept.

### 2.5 例句 EXAMPLES
- **5–6 sentences (floor 5, matching v2's target)**, everyday register. **The first sentence is the easiest in the set**; beyond that, order is free — no difficulty ramp required.
- **Sentence mix (Wedge, 2026-06-11 — a loose contract):** every set draws on three kinds — (a) **simple sentences the student can make with the word** (core sense, plain grammar, immediately producible), which open the set; (b) the character **inside the words it is most commonly met in**; (c) **looser ties to the definition** — extension and derived senses, where the deep tree node lives. Default mix ≈ 2+2+2; vary the ratio per entry (1/3/2, 2/1/3, …) — variety keeps the sets interesting.
- The target character is highlighted at every occurrence; words above the learner's level carry hover glosses.
- Collectively the sentences cover **≥ 2 meaning-tree branches including one deep node** (depth ≥ 2 where the tree has one) — 造's 捏造, 射's 影射. This requirement is stated identically here, in §4, and in §7.4.
- Each sentence: 中文 + English translation + `sayText` (the sentence itself, for voicing). Translations carry no commentary about the page or its apparatus.
- The section header renders as 例句 EXAMPLES alone; the grading and the audio are evident from the sentences themselves.

### 2.6 RELATED
- Three-to-four items, each with a one-phrase "why": the sound donor and series siblings; look-alike traps (real 身 in 身體 against the fossil in 射); the highest-frequency words containing the character; an antonym when it sharpens the meaning (鬧 ↔ 安靜).
- Every item earns its place by preventing a real confusion or enabling a prediction about *this* character. A closing contrast line is welcome when it teaches ("In 身體 the 身 really is a body. In 射 it only looks like one.").

### 2.7 EVOLUTION
- Ships when history explains the modern form (射: the bow's silhouette drifting into 身) or the sound story (造: motion element + 告 across bronze forms). Plain narrative, addressed to the student, ending on the character fact. The methodology lesson the demo appended ("why decomposition must stop at functional components") moves to the about page.
- This is the one section where the history of the analysis itself can be content — what early forms show, where readings diverged. Even here the prose describes the character's record; it never describes our pipeline.
- Script-stage strip (甲骨文 → 金文 → 小篆 → 楷書) only with real images or clean glyph renders; phonology rows (OC/MC) only with sourced values. Anything unavailable is omitted; the page carries no placeholder for it.
- When we have nothing beyond what FORM already said, the section is omitted entirely (as 鬧 will be after Batch 0 deletes its placeholder).

### 2.8 Sound-series pages (the 告 model — content locked)
- HEAD: donor glyph + reading + the donor's own meaning + the one-line promise ("learn the donor once, and every character below becomes a guess you can make") — apparatus: it instructs the use of the flip cards.
- Drift bands, in order: EXACT → regular shift (g → h) → further drift, rhyme held. Per member: glyph, guess-then-reveal, reading, gloss showing where the donor sits inside the member character, drift note. The ordering is the lesson.
- Five voiced example sentences using the donor inside common words (告訴 → 廣告 → 報告 → 警告).
- Closing observation in student-usable terms (the rhyme survives; initials drift in bands; the prediction behavior this licenses). No product comparisons, no method praise.
- Series pages ship from their own artifact with their own checklist line in §4; the §7 gates apply to them in full.
- The visual formatting (bands, card grid, spacing, mobile) is the implementation agent's redesign ticket, mockups first (§9 Q1); this content contract does not move.

### 2.9 Component pages — where stroke order lives
- One page per component that appears in any authored entry. The inventory grows with the corpus and converges on the set the student actually needs (order ~200–450; the exact count is an output, never a target).
- Contents: large glyph · the registry identity (§5), the same line every entry shows · **stroke order** (numbered diagram or animation; data from open stroke-data sets — implementation agent sources and licenses) · "characters you've met that use it," generated from the corpus · series link when the component is also a sound donor.
- Character entries link each component row here. Full characters get no stroke-order diagrams: stroke order is compositional, and the assembly rules (left→right, top→bottom, outside→inside) live once on the about page.
- **Exceptions list:** characters whose stroke order violates compositional assembly (必) carry one content line on their own entry ("必 is written as its own sequence: …"), maintained as a short list in the corpus.

---

## 3. Hard entries — the 鬧 pattern

Some characters have no settled analysis. The entry still ships full encoding content:

1. `leadOrder: story` — the story carries the memory load and renders first.
2. FORM presents the surface decomposition **declaratively** — what the parts are and how the surface reading fits together. The uncertainty budget on student surfaces is **zero** (§0.4): no *uncertain*, no *unclear*, no hedging in prose, rows, or sayText. A student encoding the character has no use for the state of the scholarship; hedging is a distraction in scholarly clothes. (Scholarly disagreement can appear in EVOLUTION when it ships, where the history of the analysis is itself content — §2.7.)
3. Components that cannot be typed with confidence render **no role chip and no color** — 空 is a content claim ("this part does no work"), and an unknown function is a different fact. The bare row is the entire signal. The identity line stays declarative about the surface: "市 'market' — the market square you draw inside the quarreling frame."
4. EVOLUTION is omitted until there is something to say.
5. Everything we actually know about the open question — candidate analyses, which sources conflict, what would settle it — goes in `meta.openQuestions`, where the producer pass that revisits hard entries will find it.

A hard entry reads as a confident page: a full story carrying the memory load, a declarative surface reading, and silence where the page makes no claim.

---

## 4. Completeness checklist

An entry ships when every line is true. This closes the "missing extra content" review note: every entry passes this checklist before it ships, and §7.5 enforces the structural minima in CI.

- [ ] HEAD: glyph, zhuyin + pinyin, definition (EN + 簡明中文; zh passes `checkDefLevel`), typed composition line.
- [ ] FORM: paragraph + one row per visible component; every component typed or left bare (§3); every identity names a concrete, drawable thing in one line; corruptions and loans stated plainly where present; zero hedging anywhere (§0.4).
- [ ] STORY: zh line + EN scene; passes the rebuild test (§7.3).
- [ ] MEANINGS: tree with original sense, base sense tagged COMMON, ≥ 1 extension; loan node where applicable.
- [ ] EXAMPLES: 5–6 (floor 5), easiest sentence first (order otherwise free), the §2.5 sentence mix present, target highlighted, glosses present, ≥ 2 meaning-tree branches covered including one deep node, every sentence with EN + sayText.
- [ ] RELATED: 3–4 items, each with a "why" tied to this character; series link present when the character contains or donates a sound component.
- [ ] EVOLUTION: present with real content, or omitted. No placeholders anywhere on the page.
- [ ] Component links: every component row links its component page (§2.9); new components enter the registry with identity + stroke data ticket.
- [ ] sayText present for FORM, STORY, MEANINGS, and every example (繁中, natural spoken register; no tier-name prefixes like 字源層/專家層).
- [ ] `meta` populated: per-claim grounding, sources, open questions. Zero `meta` content rendered.
- [ ] Every rendered and voiced sentence passes the deletion test (§1) and the voice-of-page test (§7.2) — run by Fable, fresh-context (§8 A10).
- [ ] Prose passes the clause-level deletion test (§0.5): no announcements, no restatement, no scaffolding idioms, no pointer clauses — every sentence one load-bearing fact, stated clearly.
- [ ] One home per fact, no exposition (§0.6.7–8): FORM/STORY/EVOLUTION state nothing the composition line, rows, tree, or neighboring sentences already carry, and nothing the reader can infer from the details.
- [ ] Lint clean (§7.1) and OpenCC-clean (zh-Hant throughout).

**Series pages:** donor HEAD complete; ≥ 3 members across ≥ 2 drift bands; per-member reading + gloss + drift note; 5 voiced donor examples; closing observation; same lint, deletion-test, and sayText lines as above.

---

## 5. The content artifact

One file per character; Fable's deliverable. Authoring shape `char-author@1`, merged into the engine's `tridict/char@1` in phase C1 (§0.3 amendment 5) — the implementation agent owns the merge; prose fields here are the superset the renderer needs. Series pages ship as `series-author@1` (donor, banded members, examples, observation — §2.8's bullets as fields). A shared `components.json` registry holds one canonical record per component: glyph, identity, default detail, strokeRef, seriesRef — Fable maintains it; entries may override `detail` per character, and `identity` renders identically everywhere.

```jsonc
{
  "schema": "char-author@1",
  "char": "造",
  "reading": { "zhuyin": "ㄗㄠˋ", "pinyin": "zào" },
  "definition": { "en": "verb — to make; to build", "zh": "做出來；蓋起來" },
  "leadOrder": "origin",                      // or "story" (§3)
  "composition": [
    { "glyph": "辶", "role": "form",          // form | meaning | sound | empty | null (unknown — §3)
      "identity": "a foot walking down a road — motion, going",   // from components.json
      "detail": "used here for the original sense “to arrive”",
      "componentRef": "辶", "seriesRef": null },
    { "glyph": "告", "role": "sound",
      "identity": "gào — gives the sound",
      "detail": "same sound family as 浩、皓、誥",
      "componentRef": "告", "seriesRef": "告" }
  ],
  "form":     { "prose": { "en": "…", "zh": "…" }, "sayText": "造，是辶加告。…" },
  "story":    { "zhLine": "要「造」任何東西，第一步是走到那個地方。",
                "prose": { "en": "…" }, "sayText": "…" },
                // STORY's zh surface = zhLine + sayText; the EN scene renders on the 譯 toggle
  "meanings": { "tree": [
                  { "kind": "original", "depth": 0, "zh": "到達", "en": "to arrive; to go to" },
                  { "kind": "loan",     "depth": 0, "zh": "製造、建造", "en": "to make; to build", "common": true },
                  { "kind": "derived",  "depth": 1, "zh": "製作", "en": "to manufacture" },
                  { "kind": "derived",  "depth": 2, "zh": "捏造", "en": "to fabricate (a story)" } ],
                "sayText": "…" },
  "examples": [ { "zh": "這座橋是去年造的。", "en": "This bridge was built last year.",
                  "glosses": [ { "word": "橋", "gloss": "qiáo — bridge" } ],
                  "sayText": "這座橋是去年造的。" } ],          // 5–6, floor 5
  "related":  [ { "text": "告",  "reading": "gào",  "why": "the sound donor — opens the 告 series", "href": "series-gao" },
                { "text": "製造", "reading": "zhìzào", "why": "the highest-frequency 造 word", "href": null } ],
  "evolution": { "prose": { "en": "…", "zh": "…" }, "sayText": "…",
                 "stages": [ { "script": "金文", "imageRef": null } ],
                 "phonology": { "mandarin": "zào", "oc": null, "mc": null } },   // or null → omit section
  "meta": {                                    // NEVER rendered
    "grounding": [ { "claim": "辶+告; original sense 'arrive'", "tag": "sourced", "source": "Wiktionary 字源; 小學堂" },
                   { "claim": "story scene", "tag": "mnemonic-device" } ],
    "openQuestions": [],
    "notes": "…"
  }
}
```

**The render contract:** the renderer prints nothing from `meta`, prints no placeholder for any `null`/absent optional field, and ships no depth toggles, study-mode button, or reveal bar. Every field outside `meta` is student-facing — that is the lint's scope definition (§7.1). Prose is authored bilingually (en + zh) for FORM / MEANINGS / EVOLUTION; STORY's zh surface is its zhLine + sayText. Render-language default is 繁中-primary with the 譯 toggle (§0.3 amendment 7).

---

## 6. Division of labor

| Owner | Work |
|---|---|
| **Claude Fable** (content author) | Everything in §5 per character: facts gathering from open sources, component typing, definition, FORM/STORY/MEANINGS/EXAMPLES/RELATED/EVOLUTION prose, sayText, glosses, grading order, component-registry entries, `meta` (grounding, sources, open questions). The about page's prose. Self-QA: §4 checklist + §7.1 lint + fresh-context deletion/voice-of-page pass (§8 A10) before handoff. |
| **Implementation agent** | Renderer + templates: remove depth buttons, study-mode button, reveal bar, and `.note`/`.foot` footers; render-contract enforcement (nothing from `meta`, no placeholders, no toggles — asserted in CI, §7.5). Voice pipeline: Serena batch generation from sayText, waveform + A/B-loop player, transcribe-back audio QA (verify each clip by transcribing it back; a file's existence alone is not a pass). `gen verify --dict`: the §7.1 lint **and** the §4 structural minima, machine-checked. Lint-list maintenance: every reviewer strike under §7.2 extends the list in the same change. Series-page formatting: mockups first, then the redesign Wedge picks (§9 Q1). Component pages: build, plus sourcing/licensing open stroke-order data. The `char-author@1` → `tridict/char@1` merge (C1). The about page: build and link (prose from Fable). |
| **Wedge** | Spot review (≥ 2 entries per batch), sign-off, curation pins, prose-quality veto (stories and FORM register both). Decides the series-formatting mockup round. |

Fable's artifact contains no HTML, no audio paths, no styling. The implementation agent changes no prose anywhere, the about page included; content defects route back to Fable as a re-author, keeping one author per layer.

---

## 7. QA gates

### 7.1 The lint (floor, machine-enforced)
**Scope:** every field the renderer or voice pipeline emits — the complement of `meta`. That includes `sayText`, `glosses[].gloss`, definitions, and series-artifact fields; the list of fields is derived from the schema, never enumerated by hand. The §1 before/after table is the lint's test fixture: every "Demo line" in it must trip at least one rule.

**Banned everywhere (en + zh, one list per language, maintained together):**
- Self-reference / product / method talk: "this dictionary", "this entry", "this page", "this series", "the design", "the framework", "memory hook", "not history", "wrong as history", "excellent as a hook", "folk trap", "does the remembering", "image pending", 本字典, 本頁, 本條目; names of other products or dictionaries.
- Attribution: Outlier, Expert-contract, "Lesson N", "functional-component framework", "Rules of Effective Memory", course or contract names of any kind.
- Infrastructure: TTS, Qwen, Serena, clip, pre-baked, browser's voice, 語音檔, 合成.
- Symbols: ⓢ ⓐ ⚠.
- Imperative scene-openers in prose and sayText: "Picture …", "Imagine …", 想像 (the noun "picture" stays legal — 射's "the fossil of a picture").

**Banned in prose fields (identity, detail, why, definition, zhLine, all `*.prose`, all `sayText`), exempt in example sentence text/translations** — these are ordinary words that legitimate example sentences will contain ("fill in the form", "a batch of cookies", 誠實 sentences):
- queued, pending, unresolved, uncertain, unclear, fill, sourced, speculative, tagged, grounding, provenance, honesty, pipeline, batch, prototype, feedback, schema, expert, G0–G7 stage refs, "folk decomposition", empty-state; 待補, 待考, 尚未, 考證中, 暫缺, 佔位, 開放來源, 不確定, 未明. (EVOLUTION prose may discuss the character's attested record and scholarly disagreement as content; it still never describes our process.)

The lint enforces the floor; the deletion test (§1) is the rule. A sentence can pass the lint and still be meta — reviewers strike it on the test, and the implementation agent extends the lint in the same change.

### 7.2 The voice-of-page test (per entry, owned)
Read every rendered and voiced sentence and ask who it addresses, about what. Pass = every sentence speaks to the student about the character, the language, or how to use an on-page key (apparatus). Any sentence about the dictionary, the sources, the pipeline, the method's merits, or the design fails the entry. **Owner: Fable, as a fresh-context pass separate from the authoring context (§8 A10) — the author who wrote a meta line is the least likely to see it. Second layer: Wedge's spot review.**

### 7.3 The rebuild test (story quality)
Give a reader the story and the component identities; they should be able to reconstruct the glyph — every visible component present in the scene, spatial arrangement matching the layout. 造 and 射 pass; a story that decorates without assembling fails.

### 7.4 Examples gate
5–6 sentences (floor 5); easiest sentence first, order otherwise free; the §2.5 sentence mix present; natural everyday register; ≥ 2 meaning-tree branches covered including one deep node; target highlighted at every occurrence; glosses on above-level words; translations faithful and free of page commentary.

### 7.5 Round-trip gate (implementation, in CI)
Artifact validates **including the §4 structural minima** (definition present + band-checked, example count, related count with "why" fields, sayText coverage, component links, COMMON tag). Renders with zero `meta` leakage, zero placeholders, and **zero depth/study-mode/reveal controls**. Every sayText has a Serena clip that passes transcribe-back QA. Lint runs in CI and fails the build on a hit.

---

## 8. Authoring procedure (Fable's runbook) and batch order

Per character, in order:

1. **A1 — Facts.** Pull glyph origin, component analysis, readings, and frequency words from open references (Wiktionary 字源/glyph-origin, 小學堂, Shuowen via open mirrors, CC-CEDICT for words). Record findings + citations directly into `meta.grounding`.
2. **A2 — Type the components.** form / meaning / sound / empty per the functional framework; corruptions and loans identified now; genuinely unknown roles stay untyped (§3). Typing follows the history. A surface look-alike reading appears only in the story; for a hard entry, FORM also states it plainly as the surface reading.
3. **A3 — Definition.** One EN line with part of speech + one 簡明中文 line; run `checkDefLevel` on the zh line.
4. **A4 — FORM prose** (en + zh + sayText). Concrete, drawable identities pulled from or added to the component registry; corruption/loan facts stated as facts about the character.
5. **A5 — STORY.** Build the scene from the typed components; check it against the rebuild test before moving on.
6. **A6 — MEANINGS tree** with loan nodes and depths; sayText.
7. **A7 — EXAMPLES.** 5–6, graded, tree-covering with one deep node; glosses; 繁中 (OpenCC-clean); sayText per sentence.
8. **A8 — RELATED** with the "why" per item; series and component links wired; registry updated for any new component.
9. **A9 — EVOLUTION** if there is real content; otherwise `null`.
10. **A10 — Fresh-context QA.** In a context that did not author the entry: §4 checklist, §7.1 lint, then the deletion test and voice-of-page test over every rendered and voiced sentence. Emit the artifact.

**Batch order:**
1. **Batch 0 — the demo set, regenerated to this standard:** 造, 射, 鬧, the 告 series page, and the first component pages their entries link (辶, 告, 寸, 鬥). The 熱鬧 word page joins when word authoring activates. This batch is the acceptance test for the whole PRD — Appendix A is its work order.
2. **Batch 1+ — the SRS frontier,** ~10 characters per batch (`gen dict --from-srs` ordering per [[PRD-Private-Dictionary-v2]]). Cycle per batch: Fable authors → CI gates → implementation renders + voices → Wedge spot-reviews ≥ 2.

---

## 9. Defaults taken (flag to change) and open questions

**Defaults taken in this PRD:**
1. Section rename EXPERT → EVOLUTION (§0.3 amendment 1).
2. The methodology/about page: prose by Fable, build by implementation, linked from the index footer and the entry-page brand.
3. Hard-entry uncertainty budget: one sentence in the FORM paragraph plus the component row's identity line (§3).
4. Render language: 繁中-primary with 譯 toggle, per v2 §0.1.2 extended (§0.3 amendment 7); artifacts author both surfaces either way.
5. Component inventory seeded from the corpus; stroke-order exceptions kept as a short list starting with 必 (§2.9).
6. Definition shown per `dictDefault`, both lines always stored (§2.1).

**Open:**
1. **Q1 — series-page formatting direction.** Owner: implementation agent produces 2–3 mockups (bands vs table vs cards; mobile behavior); Wedge decides. First item in the implementation backlog — it blocks the series redesign ticket.

---

## Appendix A — demo audit (Batch 0 work order)

**Global, all pages:** remove depth buttons, 📖 study-mode button, and "Reveal next ↓" reveal bar · remove `.note` and `.foot` footers · remove all grounding marks (ⓢ ⓐ ⚠) · drop "prototype" from the nav brand · render the examples header as 例句 EXAMPLES alone (no "five voiced, graded sentences" subtitle) · regenerate section sayTexts without tier-name prefixes (字源層/專家層) · add the standing 字源/故事 subtitles · link the about page.

| Page | Keeps | Changes beyond the global list |
|---|---|---|
| **zao.html 造** | FORM, STORY scene, meaning tree, examples, related, evolution narrative | Replace the tags line "verb · the Expert-contract example" with the definition line ("verb — to make; to build" + 簡明中文); strike the story's "(A memory hook, not history…)" parenthetical; end the evolution prose on the character fact (the "…is a story, not an analysis" clause moves to the about page); evolution drops "image pending" placeholders and the "pending sourced fill" OC/MC rows (render Mandarin-only or source the values); wire component rows to 辶/告 component pages |
| **she.html 射** | FORM (the corruption paragraph is the model), STORY scene, tree, examples, related contrast line | Delete the crumb annotation ("the corruption showcase…"); strike the story's self-commentary sentence; rewrite the 身 component note ("the 'body' reading is a look-alike; the original picture was the bow"); strip the "(There's the meaning-tree's deepest arrow, in the wild.)" parenthetical from example 4's translation; end the evolution prose on the character fact (the stop-at-functional-components lesson moves to the about page); wire the existing 謝 related card to the 射 series page; add the definition line |
| **nao.html 鬧** | STORY (leads), meaning tree, examples, related contrast (熱鬧 vs 鬧鐘) | Rewrite FORM per §3 (one plain uncertainty sentence; no "Honesty layer", no ⚠, no "queued"); regenerate FORM sayText to match (the voiced "我們先標記為待考" goes); fix the 市 row (no role chip, uncertain identity); rewrite the 鬥 row detail in content terms ("dòu — quarreling supplies the noise idea"); rewrite the RELATED heading annotation ("the collision this entry exists to fix" → "good noise vs bad noise"); delete the crumb annotation; delete the EXPERT placeholder section and its sayText entirely; add the definition line; park the open analysis in `meta.openQuestions` |
| **series-gao.html 告** | Drift bands, flip cards, donor examples, the drift observation | Delete the "real Serena audio" intro sentence (keep "hear 告 living inside common words you already half-know"); closing note keeps the linguistic observation, cuts the product comparison; formatting redesign per Q1 |
| **renao.html 熱鬧** | — | Audit against the student rule when word-page authoring activates |
| **index.html** | — | Gains the link to the sitewide "how to read these pages" page; entry-list chrome loses any pipeline talk |
