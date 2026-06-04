---
title: "PRD — Tsumugu: an open-source, language-agnostic graded-reader + LLM-wiki engine (instances: Traditional Chinese, Vietnamese)"
type: prd
status: draft
created: 2026-06-03
updated: 2026-06-03
revision: v11 (structure = two public repos [engine, wiki] + one private folder [personal]; all-public is fine — folder is organizational; zh+vi combined-for-now, splittable)
license: Apache-2.0
public_repo: "Tsumugu engine skeleton — language-agnostic, Apache-2.0, no bundled data, no keys, no personal layer"
languages:
  - zh-Hant (Traditional Mandarin, Taiwan) — primary / proving pack
  - vi (Vietnamese) — beginner; learned partly through Chinese via the Hán-Việt bridge
tags:
  - prd
  - tsumugu
  - language
  - traditional-chinese
  - vietnamese
  - han-viet
  - llm-wiki
  - comprehensible-input
  - open-source
links:
  - "[[journal/2026-06-03-ai-mandarin-reader]]"
  - "[[wiki/Resources/Mandarin Chinese Language Learning Resources]]"
  - "[[wiki/Language/Refold Language Learning System]]"
  - "[[wiki/Workflows/Raw to Wiki Compilation]]"
---

# PRD — Tsumugu

**An open-source, language-agnostic engine for a Migaku-grade graded reader + a compounding LLM-wiki. The reader runs entirely client-side (free, offline); the LLM work is done in batch by your own agents (Claude Code / Grok Build) running scripts — no paid API in the core loop. First two private packs: Traditional Mandarin (Taiwan) and Vietnamese, with a Hán-Việt bridge that uses your Chinese to bootstrap Vietnamese.**

> `Tsumugu` = the public engine/project. Private packs: Chinese (zh-Hant), Vietnamese (vi). A for-fun project; open-sourcing the engine is an explicit goal. The language **wiki** it produces is a **Karpathy-style llm-wiki published via Quartz** to a public, offline-viewable static site — an *adjacent project* reusing Wedge's existing llm-knowledge-base stack (Obsidian → Quartz → GitHub Pages).

---

## 0. Decision log (decisions + overrides, on the record)

- **Full build; "don't reinvent" consciously overridden** by Wedge for this project.
- **Works fully without Migaku** (optional source, never a dependency).
- **✅ ONE engine + pluggable language packs + a shared cross-language word store** (not two repos).
- **✅ Full multi-language now** (zh-Hant + vi first-class).
- **✅ Structure: two public repos + one private folder** (Apache-2.0). **Repo 1 (public): engine** — core logic + pack interface + demo pack + pack-authoring guide + agent scripts + docs. **Repo 2 (public): wiki** — the Quartz llm-wiki site (§5.5). **Private local folder: personal** — zh/vi packs, dictionaries, vocab/word-store, status, flags, custom entries, generated content. Wedge **doesn't mind any of it being public** — the folder is *organizational* (simplest, and avoids redistributing CC-BY-SA dictionary data), **not a privacy wall**. (Any API tokens still stay out of public repos — standard hygiene.) IP posture = open / prior-art, not patent (`DESIGN-HISTORY.md`).
- **✅ Pure client-side app (Option A).** Chromium-only extension + web app (covers Chrome/Brave/Arc). Segmentation behind a **pluggable interface**. No backend.
- **✅ NO paid API in the core.** All LLM generation runs in **batch**, executed by **Claude Code / Grok Build** (Wedge's existing subscriptions) running repo-shipped **scripts/workflows**; the app consumes the generated files. Agent is **configurable** (Claude Code or Grok Build).
- **✅ Batch, not real-time.** No instant in-reader API calls. Instead, generation **pre-bakes** unknown-word definitions + explanations into prepared content so **hover is instant and free** (reading pre-generated data). While reading, Wedge **flags** words he doesn't know / wants clarified → those feed the next batch run.
- **✅ Audio = free browser Web Speech API** (client-side, $0). **NOTE FOR GROK (later):** evaluate better voice options (Grok TTS quality for zh/vi, shadowing, interactive read-aloud) — deferred for Grok to investigate (§9).
- **✅ CI target: default Extensive ~95%** (Intensive ~80% + custom).
- **✅ Explanation language toggle:** target-monolingual (leveled) default; English; or another known L2. Circularity acceptable.
- **✅ Reader UX = LingQ numeric grading + Migaku hover popup** (1 New / 2 Recognized / 3 Familiar / 4 Learned + Known K / Ignore X; buttons + hotkeys). Guess-first reveal.
- **✅ Chinese tone coloring** (1st–4th + neutral), toggle, off by default; separate from status coloring.
- **✅ Dictionaries:** packaged offline base **+ a custom/override entry layer** (Wedge's own definitions, corrections, notes).
- **✅ Built-in SRS review — pull-based, no scheduler.** Uses an SRS algorithm (e.g. `ts-fsrs`, client-side, free) to pick what's *due*; serves it **only when Wedge opens review**. No scheduling, nagging, or notifications. **Plus Anki export.** Two review paths; Tsumugu never reminds.
- **✅ AI "encoding-layer" wiki pages for SRS words** — clicking a word opens an AI-generated page built for *memory encoding* (etymology, mnemonics, associations, vivid examples, the bridge); batch-generated.
- **✅ Hán-Việt bridge = AI-generated as-you-go (batch), cached + correctable**, seeded by Wedge's Migaku known-Mandarin export. Cross-seeds Vietnamese comprehension from known Chinese.
- **✅ External-vocab cross-reference** (Migaku first; Pleco/Anki same rails) — import + reconcile; write-back gated.
- **✅ Intake = Obsidian Web Clipper → Inbox → agent-run light clean/tag/commentary → Wiki** (promote on confirm). Lightweight wiki, **no workbench / L2–L3 quality layer**; dedup/stale cleanup manual.
- **✅ Wiki = Karpathy-style llm-wiki, published via Quartz** (Repo 2) to a public GitHub-Pages static site, **openable offline as HTML** — *reuses* Wedge's proven llm-knowledge-base stack (Obsidian → Quartz → Pages), not a rebuild.
- **✅ Chinese + Vietnamese combined for now** (one wiki repo + one personal folder covering both languages), **designed to split per-language later** if that proves cleaner. Pack interface + cross-language store make either layout work.
- **✅ Video: text-first transcripts + AI commentary on hard sections** (batch). No audio STT in v1.
- **✅ Tooling:** build via Grok Build (plan mode) + Claude Code. No Codex.
- **App ↔ local files** via the **File System Access API** (point at the vault/Inbox folder once). **Word store lives in the vault** as JSON (rides Wedge's existing vault sync/git across machines).
- **Learner:** Intermediate+ Chinese, beginner Vietnamese; stack Migaku + Pleco/Anki; for-fun project.

---

## 1. Problem

Wedge learns through real input (Refold) across **Traditional Mandarin (Taiwan)** and **Vietnamese (beginner)**, wants to use Chinese to learn Vietnamese **without English**, wants to **open-source the engine**, and **doesn't want recurring API costs**.

Gaps no existing tool closes together:

1. **Lookups evaporate** — popup dictionaries leave nothing durable.
2. **Content isn't matched** — generic readers don't know *your* words; nothing recycles what you're actively learning.
3. **Cross-language leverage is wasted** — ~40% of Vietnamese is Sino-Vietnamese with systematic correspondence to Chinese.
4. **Vocabulary knowledge is fragmented** across Migaku/Pleco/Anki.
5. **No reusable, publishable foundation** — and most tools assume a paid backend/API.

Tsumugu is one open, **client-side, cost-free** engine that reads like Migaku, keeps a durable cross-linked wiki + word store, generates reading + explanations **in batch via your own agents**, uses one language to bootstrap another, and reconciles your external vocab sources.

---

## 2. Goals & success criteria (concrete, checkable)

**Engine / reader (client-side, $0, offline):**

1. Read TL text with live word status (segment → color new→1–4→known→ignored). Hover popup = gloss + reading + audio + examples + **pre-baked AI explanation** (no live call); grade via 1–4 / Known / Ignore (buttons + hotkeys); next-unknown keyboard navigation. *< 2s for 500 tokens, offline.*
2. Offline dictionary, no Migaku, no network — ≥ 95% coverage on intermediate text; **custom/override entries** supported.
3. Compounding, portable, cross-language-linked word store; **stored in the vault** (syncs across machines).
4. **Flag-for-clarification:** any word/line can be flagged while reading → collected for the next batch generation run.

**Batch generation (run by your agent — Claude Code / Grok Build):**

5. A repo script turns a source (clipped page, transcript, or prompt) into prepared reader content with **unknown words pre-resolved** (definition + explanation embedded) at the chosen **CI target (~95% default)**; OpenCC-guarded Traditional output.
6. Two modes: **directed** ("make X using these words") and **autonomous** (agent picks next from gaps + active words).
7. Generates **wiki pages** incl. **encoding-layer pages** for SRS words, and **Hán-Việt bridge entries** (cached, correctable).

**Review:**

8. **Built-in pull SRS** — open review → due words served by the algorithm; **no scheduling/notifications.** Clicking an SRS word opens its **encoding-layer page**.
9. **Anki export** (`.apkg` built client-side / AnkiConnect).

**Cross-language + reconciliation:**

10. **Hán-Việt bridge** — Sino-Vietnamese word → Hanzi + reading + known meaning; **cross-seeding** raises Vietnamese known-coverage from your Chinese (Migaku export).
11. **External-vocab cross-reference** — import Migaku/Pleco/Anki → reconciled view + conflicts; import-first.

**Open-core:**

12. Public engine clones + runs a demo with **zero language logic, zero bundled licensed data, zero personal content/keys**.

---

## 3. Scope

### In scope
- Client-side engine: reader (web app + Chromium-extension overlay), pluggable segmentation, coloring, hover (pre-baked), grading, guess-first, flag-for-clarification, word store (in vault), built-in pull SRS, Anki export, File System Access bridge.
- Offline dictionaries (packaged base + custom/override layer); OpenCC.
- Cross-language store + Hán-Việt bridge (AI-as-you-go, cached) + cross-seeding.
- External-vocab cross-reference (Migaku/Pleco/Anki).
- **Agent-run batch generation scripts** (in the repo): content prep w/ pre-baked unknowns, CI-calibrated readers, wiki + encoding-layer pages, bridge entries, Inbox clean/tag/commentary. Configurable agent (Claude Code / Grok Build).
- Intake: Web Clipper → Inbox → agent clean → Wiki.
- Later: transcript ingestion + AI commentary; Grok voice (see Note for Grok).

### Out of scope (v1)
- Any **paid LLM API in the core loop** (generation is agent-run batch; a live API is at most an optional, off-by-default add-on for instant features — not built in v1).
- A scheduling/notification SRS layer (pull-only).
- Server backend; native mobile apps; Simplified-first; curated reader catalog; accounts/cloud.
- Audio STT subtitle generation (text/transcript-first).
- Bundling licensed dictionary data or personal content/keys in the public repo.

---

## 4. Users & use cases

**Primary: Wedge** (Intermediate+ zh, beginner vi). Also any learner; Chinese speakers learning Vietnamese; devs adding packs to the public engine.

1. **Prep + read:** run a generation script on a clipped page/transcript → open in the reader with unknowns pre-explained on hover → grade + flag.
2. **Directed make:** "≈300 chars on night markets, these 8 target words, TOCFL A" → CI-calibrated passage.
3. **Autonomous feed:** agent generates the next passage from your gaps + due words.
4. **Vietnamese through Chinese:** Sino words bridged to Hanzi + known meaning; explanations in Chinese.
5. **Review:** open SRS → due words → click one → its AI encoding-layer page.
6. **Reconcile:** import Migaku/Pleco/Anki → one view of what you know.
7. Later: transcript + AI commentary; shadow with voice.

---

## 5. Core concepts

### 5.1 Three language roles
Target (zh-Hant / vi) · Base/explanation (target-monolingual default, English/other-L2 toggle) · Bridge (vi's bridge = zh-Hant, Hán-Việt).

### 5.2 Word-status model
`0/new` → `1` New · `2` Recognized · `3` Familiar · `4` Learned → `known` (✓) → `ignored` (X). LingQ labels (Migaku-mappable). Colors: new strong → fades → known/ignored none. Tone coloring (zh) is a separate toggle. Stored per (language, word) in the vault; cross-linked across languages (§5.6).

### 5.3 Batch generation model (no live API)
The repo ships **prompts + scripts**; Wedge runs them via **Claude Code or Grok Build** (his subs, $0 marginal). They read inputs (clipped pages, transcripts, target words, the word store) and write outputs (prepared reader content, wiki/encoding pages, bridge entries, Inbox edits). **Unknown words are pre-resolved at generation time** so the reader's hover is instant and offline. A **verification pass** re-scores CI coverage + runs **OpenCC** on zh output (Grok leaks Simplified). Real-time AI is explicitly *not* in the core; flags collected while reading feed the next run.

### 5.4 CI target
Default **Extensive ~95% known** (Intensive ~80%, custom); TOCFL/frequency ceiling; recycle target words ≥ 3×.

### 5.5 Durable wiki + encoding-layer pages
- **Wiki page per word/idiom** (Karpathy-LLM-wiki atomic model, language-tuned). Frontmatter: `term, reading, pos, status, tocfl, tags[topic+semantic], first_seen, source, related[]`. Body: Meaning (monolingual, leveled) · Character/etymology breakdown · Similar/related (links) · Examples (from your reading) · Usage/register · [vi] Hán-Việt box. Category/topic MOC pages + tag/graph by shared characters/themes.
- **Encoding-layer page** (for SRS words; click to open): an AI-generated page tuned for *memory encoding* — etymology/character story, mnemonics, semantic associations, vivid/personal example sentences, the bridge, "why it's tricky." Deeper than the dictionary entry; aids retention.
- Lightweight + **manually maintained**; **no workbench/quality layer**. Vault writes via your confirm step.
- **Publishing (adjacent project):** the wiki is an Obsidian vault published with **Quartz** to a public GitHub-Pages **llm-wiki site** (Karpathy-style — the same toolchain as Wedge's llm-knowledge-base, *reused not rebuilt*), and Quartz's static output is **openable offline as HTML**. Captured via the **Obsidian Web Clipper** → Inbox → agent clean → Wiki loop. **Public** = general word/idiom/encoding pages; **private** = your status, flags, word-store, custom dict (separate layer, never published).
- **Open question (Wedge, later):** known/stale words *fade*/archive over time; and known words *evolve into sentences* by composition (overlaps CI generation over your known set).

### 5.6 Cross-language store + Hán-Việt bridge
Entries keyed (language, word), joined by etymon links (zh `發展` ↔ vi `phát triển`). **Bridge entries are AI-generated as-you-go (batch)** — Hanzi + Hán-Việt reading + morpheme breakdown + meaning — **cached** into the private bridge dictionary, **confidence-flagged + correctable**, optionally reconciled against a Wiktionary Hán-Việt dump later. **Seed = Wedge's Migaku known-Mandarin export** (the zh anchor); intersect bridge Hanzi with known Hanzi → **cross-seeding** lifts Vietnamese CI coverage.

### 5.7 External-vocab cross-reference
Adapter ingests an export (Migaku JSON first; Pleco/Anki next) → reconcile vs the store → unified per-word view (Tsumugu data + external status) + conflict report + gated sync (import-first; write-back fragile/optional).

### 5.8 Reader interaction & grading UX
Coloring always on (+ zh tone toggle). Hover popup (Migaku-style; **pre-baked** definition/reading/audio/examples/AI-explanation + wiki link; vi shows the bridge). Grade via `1/2/3/4/K/X` buttons **or** hotkeys → instant recolor + persist. Guess-first reveal. Keyboard sweep (next/prev highlighted, next unknown). **Flag** key to mark for next batch. Identical in web app + extension over the same store.

### 5.9 Learner-outcome metrics
Read-only progress from the store + history: known-word growth, comprehension-% trend, words promoted, reading volume, active-target coverage. Per language.

---

## 6. Architecture (open-core, client-side, layered)

1. **Tsumugu engine — PUBLIC, language-agnostic, data-free.** Reader/render, word-store interface + status model, **pull SRS** (algorithm-agnostic), CI scorer, **batch-output consumers** (parsers for the agent-generated files), File System Access bridge, Anki `.apkg` builder, Web Speech audio, sync/IO + cross-reference interfaces, pack interface, demo. No language logic / data / keys.
2. **Language packs — PRIVATE (Wedge's).** zh-Hant + vi: segmenter, dictionary provider (packaged + custom layer), phonetics, leveling, script normalizer (OpenCC for zh), optional bridge data. Public ships only a generic **demo pack** + interface + pack-authoring guide.
3. **Cross-language extensions.** Bridge registry (Hán-Việt) + cross-seeding rules.
4. **Personal — private local folder.** The zh/vi packs, dictionaries, vocab/word-store, status, flags, custom entries, generated content. Not published (organizational + avoids redistributing licensed dict data) — but Wedge doesn't mind it being public in principle. Synced via his existing vault/git.
5. **Wiki — public repo (Repo 2).** General word/idiom/**encoding-layer** pages in an Obsidian vault, published via **Quartz** to a GitHub-Pages **llm-wiki site** (Karpathy-style; reuses the llm-knowledge-base toolchain), **offline-HTML viewable**. Web Clipper → Inbox → agent clean → Wiki.

**Generation (not in the app):** repo-shipped **scripts/prompts** run by Claude Code / Grok Build; read the store + sources, write files into Inbox/vault. The app reads those files via the FS Access API.

**Segmentation (pluggable):** client-side default — `jieba-wasm` (zh, good) + a JS dictionary/longest-match tokenizer (vi, okay). Swap-in WASM CKIP / underthesea or an optional local NLP service later if accuracy demands.

**Audio:** browser **Web Speech API** (free, client-side). *(Note for Grok: better voices later.)*

---

## 7. Technical foundations (researched 2026-06-03)

- **zh-Hant:** TOCFL leveling + Academia Sinica frequency; **MoEDict (CC0)** + **CC-CEDICT (CC-BY-SA)**; `jieba-wasm`/`jieba-tw` (client) / CKIP (server, optional); **OpenCC** (`opencc-js`, client).
- **vi:** ~40% Sino-Vietnamese (systematic Middle-Chinese correspondence); segmentation underthesea/VnCoreNLP (server-grade) vs JS tokenizer (client); dicts OVDP/EVDict + C-V + Wiktionary Hán-Việt; leveling frequency + 6-level. *Data is multi-source/rough; the bridge is AI-built-as-you-go.*
- **SRS:** `ts-fsrs` (FSRS in TypeScript, client-side, free) for due-selection.
- **Anki:** build `.apkg` in-browser (sql.js/genanki-style) or POST to **AnkiConnect** (`localhost`).
- **Audio:** Web Speech API (`speechSynthesis`) — free, zh/vi voices OS-dependent. Grok TTS = optional later.
- **App↔files:** **File System Access API** (point at a local folder; read/write with permission).
- **Generation:** Claude Code / Grok Build CLIs (Wedge's subscriptions) — no metered API.

---

## 8. Constraints & dependencies
- TL-first per pack (zh Traditional/Zhuyin; vi tone-diacritic Latin).
- **Client-side, offline core; $0 marginal cost.** Generation needs an agent run (his subs), not a paid API.
- **Open-core hygiene:** public repo carries no licensed data, no personal content, no keys.
- **Vault writes via confirm only;** word store + wiki + custom entries live in the vault (synced).
- LLM-correctness risk (tone, register, fabricated etymology/bridge, Grok→Simplified) → dictionary/leveling-grounded prompts, OpenCC guard, verification pass, confidence flags, human correction.
- Client-side segmentation accuracy (esp. vi) is the known tradeoff; pluggable so it's upgradeable.
- Licensing: zh CC0/CC-BY-SA; vi per-source; video transcripts personal-use.

---

## 9. Note for Grok (deferred)

**Voice options.** Default audio is the free browser Web Speech API. Later, Grok to evaluate: Grok TTS quality for Traditional Mandarin + Vietnamese; shadowing UX; interactive read-aloud / "explain this line" (would imply some live calls — weigh against the no-API default); embedding generated audio into Anki cards. Output: a recommendation + a thin, optional voice module. Not a v1 blocker.

---

## 10. Risks & mitigations

| Risk | Sev | Mitigation |
|------|-----|------------|
| **Scope large** | High | Strict phasing (§11); Phase 0 by hand; ship the reader standalone; voice/video late. |
| **Batch ≠ instant** — pre-baking misses a word you hit | Med | Flag-for-clarification → next run; broad pre-resolution at generation; dictionary still covers basics offline. |
| **vi segmentation/data rough** | High | Pluggable segmenter; AI-built bridge w/ confidence + correction; start from high-freq Sino. |
| **LLM wrong (etymology/bridge/Simplified)** | High | Ground + OpenCC guard + verification + confidence flags + manual correction; corrections persist. |
| **Open-core leakage** (keys/data in public repo) | High | Hard layer split; secret-scan; packs + data + store all private/in-vault. |
| **App↔local-file friction** (browser sandbox) | Med | File System Access API; bundle dicts with the extension; degrade to import/export if denied. |
| **Word-store sync across machines** | Med | Store in the vault (already synced); export/import fallback. |
| **Wiki duplication/staleness** (#1 pain point) | Med | One canonical page per item; links not copies; manual cleanup (Wedge's call). |

---

## 11. Plan (phased; agent-run where noted)

- **Phase 0 — Prove the loop by hand.** One zh + one vi source: hand-run a generation script (prepared content w/ pre-baked unknowns + a few wiki/encoding pages + hand-traced bridge). *Exit: output worth keeping.*
- **Phase 1 — Engine + reader (client-side, offline) + both packs.** Pluggable segmentation, packaged dicts + custom layer, word store in vault (FS Access), coloring, hover (consuming pre-baked data), grading + hotkeys, guess-first, flag, Zhuyin/Pinyin + tone toggle, **Anki export**, **built-in pull SRS** (`ts-fsrs`). *Exit: read + grade + review + export, offline, $0.*
- **Phase 2 — Generation scripts (agent-run).** Repo prompts/scripts for Claude Code/Grok Build: content prep with pre-baked unknowns (CI-calibrated, OpenCC-guarded), directed + autonomous modes, verification re-score. *Exit: criteria 5–7.*
- **Phase 3 — Wiki + encoding-layer pages + Web Clipper intake.** Generate word/encoding pages; Inbox → clean/tag/commentary → Wiki; click SRS word → encoding page. *Exit: criteria 7, 8.*
- **Phase 4 — Cross-language: Hán-Việt bridge + cross-seeding** (seed from Migaku export; cached, correctable). *Exit: criteria 10.*
- **Phase 5 — External-vocab cross-reference** (Migaku → Pleco/Anki). *Exit: criterion 11.*
- **Phase 6 — Browser extension** (shared engine overlay, Chromium). 
- **Phase 7 — Transcript ingestion + AI commentary** (text-first).
- **Phase 8 — Voice** (per Note for Grok, §9).

**Build tooling:** Cowork for PRD/coordination; **Grok Build (plan mode) + Claude Code** for implementation *and* as the generation runtimes. Each phase: plan → approve → build → review.

---

## 12. Open questions

1. **Tech specifics** — in-app cache (IndexedDB) vs reading the vault JSON directly; FS Access API UX (folder grant per session); Chromium MV3 extension specifics.
2. **vi segmentation** — accept the client JS tokenizer for v1, or stand up the optional local CKIP/underthesea service sooner?
3. **Custom dictionary entries** — format + merge/override precedence vs packaged data (stored in the vault).
4. **Bridge** — confidence threshold + correction workflow; when (if ever) to reconcile against a Wiktionary Hán-Việt dump.
5. **Wiki** — exact page templates (word vs encoding-layer vs MOC) + vault locations; and Wedge's **fade/evolve** design (deferred).
6. **SRS** — which algorithm (FSRS vs SM-2) + where review state lives (in the vault word store).
7. **Generation agent** — default Claude Code or Grok Build per task; how scripts are invoked (CLI command, watched folder, manual).
8. **Voice** — see §9 (Grok).
9. **Branch coherence** — reconcile the `front-pages-projects` worktree into main.
10. **Wiki site** — separate Quartz repo (Repo 2), sibling to llm-knowledge-base; pick repo/site name + Quartz config. ✅ zh+vi **combined for now, splittable later**. Public/private is no longer a privacy concern (all-public is fine); the personal layer stays a local folder for organization, not secrecy.

---

## 13. Sources
- Sino-Vietnamese: https://en.wikipedia.org/wiki/Sino-Vietnamese_vocabulary
- vi NLP: https://underthesea.readthedocs.io/ · https://github.com/vncorenlp/VnCoreNLP
- vi dicts: https://sourceforge.net/projects/ovdp/ · https://github.com/ds4v/NomNaOCR
- zh: https://moedict.tw/ · https://www.mdbg.net/chinese/dictionary?page=cedict · https://github.com/ckiplab · https://github.com/BYVoid/OpenCC · TOCFL: https://zhongchinese.com/tocfl/vocabulary/
- SRS: ts-fsrs (FSRS, TypeScript) · Web Speech API (MDN)
- Migaku/Anki: https://chromewebstore.google.com/detail/migaku-word-exporter/akkpijkjiihgcalbfoobconnlnalafbd
- Reader UX verified: Migaku (popup/status) + LingQ (1–4 grading + hotkeys) — see prior journal entry.
- CI threshold: Nation; Hu & Nation (95–98%).
- Internal: `journal/2026-06-03-ai-mandarin-reader.md`, `wiki/Resources/Mandarin Chinese Language Learning Resources.md`, `cos/operating-instructions.md`
