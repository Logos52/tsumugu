---
title: "READING-LAYER — Tsumugu interactive reading layer (highlighting, hover defs, backlinks + YouTube deep-links)"
type: prd
status: draft
created: 2026-06-05
updated: 2026-06-05
revision: v1 (sub-PRD of PRD.md; owner decision = build-time personal highlighting baked into the public wiki; client overlay is optional future work)
license: Apache-2.0
parent: "[[PRD.md]]"
languages:
  - zh-Hant (Traditional Mandarin, Taiwan) — primary / proving pack
  - vi (Vietnamese) — Hán-Việt bridge
tags:
  - prd
  - tsumugu
  - reading-layer
  - highlighting
  - hover-definitions
  - backlinks
  - quartz
  - comprehensible-input
---

# READING-LAYER — Tsumugu interactive reading layer

**A focused sub-PRD for the layer that makes Tsumugu content *read* like Migaku/LingQ: per-word highlighting of unknown words, hover-over definitions, and cross-page navigation (summary ↔ vocab ↔ transcript) with "watch on YouTube at this line" deep-links. This sits under [`PRD.md`](./PRD.md) and inherits all of its hard rules. The defining design choice: personal unknown-word highlighting is baked into the public Quartz wiki at BUILD TIME — the wiki build reads the owner's locally-stored, gitignored word-store and emits pre-colored word spans that publish with the site. No client-side overlay or private build is required for the owner's own use.**

> Lives at root as `READING-LAYER.md`, parallel to `PRD.md` and `AGENTS.md`, matching the engine's flat root-doc convention (no `docs/` folder). Open questions resolve into `DECISIONS.md` once locked.

---

## 0. Decision log (decisions + overrides, on the record)

- **✅ Owner override — unknown-word STATUS is NOT private.** Wedge has decided his known/unknown word status is just "vocabulary I haven't learned yet" and is fine publishing it. This overrides the earlier "no personal data on the public wiki" caution *for word-status coloring specifically*. It does **not** relax the rule against committing licensed dictionaries, keys, or the word-store file itself into the public **engine** repo.
- **✅ PRIMARY design = build-time personal highlighting.** The Quartz wiki build reads the owner's local (gitignored) `word-store.json`, segments page content with the same engine segmenter, and emits pre-colored `<span class="tsg-status-*" data-word="…">` directly into the static HTML. This is the default path. The published page is correct on first paint, for the owner and every visitor, with zero client JS for coloring.
- **✅ The word-store stays out of the public ENGINE repo.** The build reads it from the local personal layer (Wedge's vault), gitignored in the wiki repo. The build emits only the *colored output* (HTML), never the store. The engine repo ships no data, as today.
- **✅ Reuse the engine's existing status model + CSS classes verbatim.** The reader already ships `WordStatus` (`new | l1..l4 | known | ignored`), `statusColorClass()` → `tsg-status-${status}`, and the CSS in `apps/web/src/styles.css:221-260`. The wiki build emits the *same* classes so the reader app and the wiki render identically.
- **✅ Hover defs are pre-baked, never live.** Wiki hover reads from a per-page sidecar (a slim `glossary` projection of the existing `PreparedContent.glossary`) baked at build time. This honors the no-live-API rule and matches the reader's `mergeHover()` precedence (`custom > prebaked > dict`).
- **✅ Backlinks ship first, mostly free.** Summary ↔ vocab already use Obsidian wikilinks; Quartz's native `Backlinks.tsx` + `CrawlLinks` give reverse links out of the box. We add the missing summary→source and a `related[]` frontmatter index, plus YouTube deep-links.
- **✅ "Watch on YouTube at this line" needs a per-transcript `.cues.json`.** None exists yet. We generate one (private, alongside the transcript) mapping line → `start_seconds`, and emit `…&t=Ns` deep-links. Transcript stays private (under `content/private/`, ignored by Quartz + gitignore); only the public summary/vocab carry the deep-links.
- **✅ Transcript stays RAW.** Highlighting and deep-linking are presentation only. We never grade the transcript to vocabulary, consistent with the "transcripts stay raw" rule.
- **✅ Shared "annotation core" in the engine.** One DOM-free function that turns `(tokens, word-store, glossary)` into annotated spans, consumed by both the reader app and the wiki build plugin. No duplicated segmentation/coloring logic.
- **✅ Client-side overlay for OTHER visitors = optional future work.** A Quartz `afterDOMLoaded` script that lets a visitor load *their own* word-list and recolor in place is a nice-to-have, deferred. The owner's own highlighting does not depend on it.
- **✅ OpenCC guard applies to every zh-Hant span we emit.** Any zh surface form written into wiki HTML or a glossary sidecar passes the pack `scriptNormalizer` first (no Simplified leakage).

---

## 1. Problem

Tsumugu already produces three artifact types per source — a public **summary** page, a public **vocab** page, and a private **transcript** — plus a fully interactive **reader app**. The reader has the rich behavior (status coloring, hover popups, grade hotkeys, guess-first); the published Quartz wiki does not. Reading on the wiki today is flat: bolded vocab words, manual wikilinks between summary and vocab, no per-word status, no hover, no path back to the source video at a specific line.

Three concrete gaps:

1. **No per-word highlighting on the wiki.** A reader of `why-friendship-differs-summary.md` cannot see at a glance which words are new to the owner versus already known. The reader app computes this; the wiki throws it away.
2. **No hover definitions on the wiki.** The reader app's `mergeHover()` popup (gloss + reading + examples + explanation) exists only in the app. Wiki readers get nothing on hover beyond Quartz's native link popovers.
3. **Navigation is partial and the source video is unreachable per-line.** Summary ↔ vocab is bidirectional; transcript is unlinked (private, by design); and there is no "jump to this line on YouTube" because no per-cue timestamp file exists — the transcript frontmatter stores only `duration: "38:12"`, not line timings.

We close all three while keeping the engine data-free and respecting that the wiki is the owner's personal published site where his word-status is fair game to publish.

---

## 2. Goals & success criteria (concrete, checkable)

**Highlighting (build-time, primary):**

1. The Quartz build segments public page body text with the engine segmenter and emits `<span class="tsg-status-{status}" data-word="…">` for each word token, with `status` resolved from the owner's local word-store. New + `l1..l3` are visually loud; `l4 | known | ignored` are unstyled. *One public build; correct on first paint; no client JS for coloring.*
2. The same page can optionally shade by TOCFL level (a separate, generic, attribution-carrying layer) as a toggle independent of personal status.
3. The engine repo commits **zero** word-store data and **zero** dictionary data; the build reads the store from the local personal layer only.

**Hover definitions (build-time, pre-baked):**

4. Hovering a highlighted word on the wiki shows reading + gloss (and, where present, examples + explanation + Hán-Việt bridge), drawn from a per-page glossary sidecar baked at build time. *No network, no live API.*
5. Hover data sources and precedence match the reader's `mergeHover()` (`custom > prebaked > dict`).

**Backlinks + deep-links:**

6. Summary ↔ vocab backlinks render via Quartz native components (no new plugin). A `related[]` frontmatter index makes the relationship machine-readable.
7. Public summary and vocab pages link to the source video, and where line-level cue data exists, to specific timestamps: `https://www.youtube.com/watch?v=<id>&t=<seconds>`.
8. A private `.cues.json` per transcript maps line → `start_seconds`; the build uses it to emit per-line deep-links. The transcript itself stays private and unpublished.

**Shared core:**

9. One engine function annotates `(tokens, store, glossary)` → spans, DOM-free and language-agnostic, consumed by both the reader app and the wiki plugin. No duplicated logic.

**Stretch (later phases):**

10. Click-to-grade from the wiki (writes to the local store on confirm), and a client overlay letting other visitors load their own word-list.

---

## 3. Scope

### In scope
- An engine **annotation core**: `annotate(tokens, store, glossary)` → annotated spans (statuses + hover payload refs), DOM-free.
- A Quartz **build-time transformer plugin** that segments public body text, resolves status from the local word-store, and bakes `tsg-status-*` spans + `data-word` into the HTML.
- A Quartz **hover component** (CSS + `afterDOMLoaded` script) that reads a baked per-page glossary sidecar and shows reading/gloss on hover.
- A small **wiki-build step** (run alongside Quartz, or as a pre-transform) that projects each page's words into a glossary sidecar from the personal pack + `PreparedContent.glossary`, OpenCC-guarded.
- **Backlinks**: reuse Quartz `Backlinks.tsx`; add `related[]` frontmatter; add summary/vocab → source-video links.
- A **`.cues.json` generator** (batch, agent-run) producing private per-transcript line→seconds maps, and the deep-link emission that consumes them.

### Out of scope (this layer, v1)
- Any **live dictionary or LLM call** at read time on the wiki (all hover data is pre-baked).
- Committing the word-store, CC-CEDICT, MoEDict, or TOCFL lists into the public engine or wiki repos.
- Publishing the raw transcript (stays under `content/private/`).
- A **private second Quartz build** (unnecessary — build-time coloring goes into the public site directly).
- Click-to-grade from the wiki and the multi-reader client overlay (deferred to Phase R3).
- Lemmatization / stem fallback, sentence-level hovers, audio libraries (tracked as reader-parity gaps, not this layer's job).

---

## 4. Users & use cases

**Primary: Wedge**, reading his own published wiki and reader app.

1. **Skim the summary, see my gaps.** Open the published summary; new + lightly-learned words glow; known words are invisible — exactly the LingQ "known is invisible" default.
2. **Hover an unknown word.** Reading + gloss appear instantly from baked data; for a Vietnamese word, the Hán-Việt bridge box shows the Chinese etymon.
3. **Jump between artifacts.** Summary → vocab (and back) via backlinks; vocab entry → the line in the transcript context; summary line → the exact moment on YouTube.
4. **Watch the source at a line.** Click a deep-link on a summary/vocab line → YouTube opens at `&t=Ns`.

**Secondary: any visitor.** Sees the owner's coloring baked in (status is public by decision) plus generic TOCFL shading. Later, optionally loads their own word-list via the client overlay.

---

## 5. Core concepts

### 5.1 Status model and coloring (reused from the reader app)
We reuse the engine's existing `WordStatus` (`new | l1 | l2 | l3 | l4 | known | ignored`, `packages/engine/src/types.ts:13`), the coloring map in `packages/engine/src/status/coloring.ts`, and `statusColorClass(status) → "tsg-status-${status}"` from the reader (`apps/web/src/reader/reader.ts:96-110`). The wiki build emits the same classes, so a word looks identical in the reader app and on the published page.

**Two independent visual layers:**
- **Highlight-by-personal-status (primary, default-on):** `new` strongest, `l1→l4` fading per the CSS in `apps/web/src/styles.css:221-260`; `known | ignored` unstyled. Underline + background for `new | l1 | l2 | l3` so unknowns are scannable at a glance (the one CSS gap Finding 2 flags for Migaku parity).
- **Shade-by-TOCFL-level (secondary, toggle):** a generic frequency/level band shading derived from a level list, carrying SC-TOP/NAER attribution. This is the same for every visitor and uses no personal data. Off by default; useful when no personal store is present (generic baseline per Finding 7 pattern (c)).

### 5.2 How "unknown" is computed
Identical to the reader and CI scorer: segment text into `Token[]` (`{text, start, end, isWord}`, `types.ts:74-83`) with the pack segmenter, then `store.getStatus(word)` per word token — exact surface-form match, no case-folding or normalization (that is the pack's job), per `packages/engine/src/ci/scorer.ts:77-85`. A word is "unknown" (highlighted) when its status is in the loud set (`new | l1 | l2 | l3`). Words absent from the store default to `new`.

### 5.3 Hover data — pre-baked, precedence preserved
Hover payload comes from `PreparedContent.glossary` (`types.ts:261-277`) projected into a slim per-page sidecar at build time: `term, reading, gloss, pos, level, examples?, explanation?, bridge?`. Resolution precedence matches `packages/engine/src/content/hover.ts:52-87` (`custom > prebaked > dict`); on the wiki, `dict` is absent (no live lookups), so it is `custom > prebaked`. Examples and explanation live on prebaked only, as in the reader.

### 5.4 Backlinks topology
- **Summary ↔ vocab:** already bidirectional via `[[slug|display]]` wikilinks; Quartz `CrawlLinks` builds `file.data.links` and `Backlinks.tsx` renders the reverse index. No new code.
- **Summary/vocab → source video:** new, emitted from frontmatter `source` (the YouTube URL; video ID is extractable, e.g. `2idX7w0gs4k`).
- **Summary/vocab → transcript:** stays absent in the *published* site (transcript is private, excluded by `ignorePatterns: ["private", …]`). Linking a public page to a private path would 404. The deep-link to YouTube is the public-facing "go to source" path; transcript context is owner-only in the reader/local vault.

### 5.5 Cue timestamps and deep-links
The transcript frontmatter has `source` (video URL) and `duration: "38:12"`, but no per-line timings (Finding 4). We add a private `.cues.json` next to each transcript:

```json
[
  { "line": 12, "start_seconds": 2146, "text": "…" },
  { "line": 13, "start_seconds": 2151, "text": "…" }
]
```

Deep-links are then `https://www.youtube.com/watch?v=2idX7w0gs4k&t=2146`. The `.cues.json` is private (same boundary as the transcript), gitignored, never published; only the resulting `&t=Ns` URLs appear on public pages.

---

## 6. Architecture (where each part lives)

| Layer | Component | New / reuse | Location |
|-------|-----------|-------------|----------|
| **Engine (public, data-free)** | Annotation core `annotate()` | New, DOM-free | `packages/engine/src/content/annotate.ts` |
| Engine | Status model, `statusColorClass`, CI scorer, hover merge | Reuse | `status/coloring.ts`, `ci/scorer.ts`, `content/hover.ts` |
| Engine | Glossary-sidecar projection types | New (slim type) | `packages/engine/src/content/sidecar.ts` |
| **Reader app** | Render + recolor + hover popup + grade | Reuse, refactor onto `annotate()` | `apps/web/src/reader/reader.ts:64-301` |
| **Wiki build plugin** | Per-word highlight transformer | New | `tsumugu-wiki/quartz/plugins/transformers/perWordHighlight.ts` |
| Wiki build | Glossary sidecar builder (reads personal pack + store) | New, runs pre-build | `tsumugu-wiki/scripts/build-reading-layer.ts` |
| Wiki client | Hover component (CSS + `afterDOMLoaded`) | New | `tsumugu-wiki/quartz/components/WordHover.tsx` + `.../scripts/wordHover.inline.ts` |
| Wiki client | Backlinks | Reuse native | `quartz/components/Backlinks.tsx` |
| **Batch scripts** | `.cues.json` generator | New, agent-run | `scripts/gen/cues.ts` (engine repo) |
| **Personal (private, local)** | `word-store.json`, packs, `.cues.json`, glossary sidecars input | Reuse | Wedge's vault; gitignored in wiki repo |

**Key principle.** The engine stays data-free. The wiki build plugin and sidecar builder are *code* (publishable); the word-store, dictionaries, and `.cues.json` are *data* read locally at build time and never committed. The build emits only colored HTML + a baked glossary sidecar of words that already appear on the (public) page — no personal data beyond the owner's word-status, which is published by decision.

### 6.1 Build-time data flow (the primary path)

```
content/zh-Hant/*-summary.md, *-vocab.md          (public markdown)
        │
        ▼  [pre-build: scripts/build-reading-layer.ts]
   read local word-store.json  +  personal pack (segmenter, dict)  +  PreparedContent.glossary
        │
        ├─ segment body text → tokens[]            (engine segmenter; OpenCC guard on zh)
        ├─ status per word    → store.getStatus()
        └─ project glossary   → per-page sidecar (reading/gloss/examples/explanation/bridge)
        │
        ▼  [Quartz htmlPlugins: perWordHighlight.ts]   (post-Rehype, HAST visitor like links.ts)
   wrap body text nodes → <span class="tsg-status-*" data-word="…">
        │
        ▼  [Quartz emit]
   static HTML with baked spans + emitted glossary sidecar JSON
        │
        ▼  [client: wordHover.inline.ts, afterDOMLoaded + "nav" event]
   on hover over .tsg-status-* span → read baked sidecar → show reading/gloss popup
```

The transformer runs as a custom `htmlPlugins()` callback registered in `quartz.config.ts` after `CrawlLinks()` (Finding 3), traversing HAST with `visit(tree, "element")` exactly as `links.ts:51-158` does. It wraps text nodes in body content (skipping code blocks, link text already handled by `CrawlLinks`). Coloring is baked; the only client JS is the hover popup.

---

## 7. The three behaviors

### 7.1 Behavior A — Per-word highlighting / underlining

**Design.** Build-time. The `perWordHighlight` transformer segments each public page's body text and wraps every word token in a span carrying its status class and `data-word`. The sidecar builder resolves status from the local word-store before the build; the transformer just emits what the builder computed (passed via a per-page status map keyed by `data-word` to avoid re-segmenting in the plugin).

**Two coloring modes**, toggled by a body data-attribute (`data-highlight-mode="status|tocfl|off"`):
- `status` (default): emit `tsg-status-{status}`. CSS reused from `apps/web/src/styles.css:221-260`, copied into a Quartz SCSS partial. Add the missing underline rule for `new | l1 | l2 | l3` (the Migaku-parity gap, Finding 2) so unknowns are scannable, not only background-shaded.
- `tocfl`: emit a `tsg-level-{band}` class from the generic level list; carries SC-TOP/NAER attribution in the page footer. No personal data.
- `off`: plain spans with `data-word` only (structure without color), so a future client overlay can recolor.

**Data model.** Per-page status map produced by the sidecar builder:

```json
{
  "schema": "tsumugu/reading-status-map@1",
  "page": "zh-Hant/why-friendship-differs-summary",
  "lang": "zh-Hant",
  "words": { "封閉": "new", "隱私": "l2", "夜市": "known", "…": "…" }
}
```

`known | ignored | l4` map to "no class." This map is derived from the gitignored word-store and is itself gitignored; only the emitted HTML ships.

**Where it lives.** Engine: `annotate()` produces the token→status pairs (DOM-free). Wiki: `perWordHighlight.ts` emits the spans; `build-reading-layer.ts` builds the status map. Reader app: the existing `renderWord()` (`reader.ts:96-110`) refactors to call `annotate()` so app and wiki agree.

**Hard rules touched.** Engine-data-free (status map + store read locally, never committed); OpenCC guard (zh surface forms normalized before emission); owner-decision (status is publishable).

### 7.2 Behavior B — Hover-over definitions

**Design.** Build-time pre-baked. The sidecar builder projects each highlighted word's `PreparedContent.glossary` entry into a per-page glossary JSON emitted next to the page. The `wordHover.inline.ts` client script (registered `afterDOMLoaded`, re-bound on Quartz's `"nav"` SPA event per Finding 3) attaches a hover/focus handler to `.tsg-status-*` spans, reads the baked sidecar, and renders a popup: term, reading (always visible), gloss + explanation (guess-first blur, reusing the reader's reveal pattern), examples, and the Hán-Việt bridge box for vi.

This mirrors the reader popup (`reader.ts:151-301`) minus the live `dictionaryProvider` call — on the wiki there is no live dict, only baked data, which honors no-live-API.

**Client-side dictionary + segmentation source.** Segmentation happens at **build time** with the personal pack segmenter (jieba-wasm for zh, JS tokenizer for vi), so the published site ships pre-segmented spans and needs no in-browser segmenter (Finding 7's "pre-segment at build time is cleanest"). The dictionary data is the engine's pre-baked glossary, itself sourced from the personal packs (CC-CEDICT / MoEDict for zh, OVDP/EVDict/Wiktionary Hán-Việt for vi). **None of this data is committed to the public engine repo** — it lives in the personal pack and is read at build time; only the per-page glossary projection (the words that already appear on the public page) ships as a sidecar. This keeps the engine data-free and respects CC-BY-SA share-alike on CC-CEDICT (we never redistribute the full dictionary, only glosses for words already on the page, with attribution).

**Data model.** Per-page glossary sidecar (slim projection of `PreparedContent.glossary`):

```json
{
  "schema": "tsumugu/page-glossary@1",
  "page": "zh-Hant/why-friendship-differs-summary",
  "lang": "zh-Hant",
  "entries": {
    "封閉": { "term": "封閉", "reading": "ㄈㄥ ㄅㄧˋ / fēng bì", "gloss": "closed off", "pos": "adj", "level": "TOCFL-B1", "explanation": "…", "examples": ["…"] }
  },
  "attribution": "Glosses derived from CC-CEDICT (MDBG, CC BY-SA 4.0) and MoEDict (CC0)."
}
```

**Where it lives.** Engine: `sidecar.ts` (projection types + projector), reuses `mergeHover()` precedence. Wiki: `build-reading-layer.ts` emits the sidecar; `WordHover.tsx` + `wordHover.inline.ts` render it.

**Hard rules touched.** No-live-API (all baked); engine-data-free (full dicts stay in personal packs; only on-page glosses ship, with attribution); OpenCC guard (readings/forms normalized); CC-BY-SA attribution carried in the sidecar + page footer.

### 7.3 Behavior C — Backlinks + YouTube line deep-links

**Design.**
- **Summary ↔ vocab:** ships as-is via Quartz native `Backlinks.tsx` + `CrawlLinks`. We add a `related[]` frontmatter array (matching the existing `夜市.md` convention of `related: [...]`) as a machine-readable index and ensure both directions have an explicit wikilink.
- **Source-video link:** emitted on summary + vocab from frontmatter `source`. A small frontmatter addition `video_id` (or extraction from `source`) makes deep-link assembly trivial.
- **Per-line YouTube deep-links:** the `.cues.json` generator (`scripts/gen/cues.ts`, agent-run batch) produces a private line→`start_seconds` map per transcript. When a summary/vocab line corresponds to a transcript line, the build emits `…&t=Ns`. Lines without a cue mapping fall back to the plain video link.

**Data model.** Private `.cues.json` (Finding 4 recommendation), stored at `content/private/transcripts/zh-Hant/<slug>.cues.json`, gitignored:

```json
[
  { "line": 12, "start_seconds": 2146, "text": "…" }
]
```

**Where it lives.** Backlinks: zero new code (Quartz native). Deep-links: `scripts/gen/cues.ts` in the engine repo (code, publishable; emits no data), consuming the private transcript; the wiki build reads the private `.cues.json` locally and bakes the `&t=Ns` URLs.

**Transcript privacy.** The transcript and its `.cues.json` stay under `content/private/` (excluded by `ignorePatterns`) and gitignored. Public pages link only to YouTube, never to the private transcript path (which would 404 in the build). This holds the "transcripts stay raw + private" rule while still giving the reader a "watch the source at this moment" path.

**Hard rules touched.** Transcripts-stay-raw/private (transcript + cues never published); engine-data-free (cues generator ships no data); local-writes-on-confirm (cues file written under the standard vault-write confirm).

---

## 8. Shared annotation core (proposal)

We add one DOM-free engine function so the reader app and the wiki plugin never diverge:

```ts
// packages/engine/src/content/annotate.ts
export interface AnnotatedToken {
  text: string;
  isWord: boolean;
  status?: WordStatus;        // resolved from store; undefined for punctuation
  statusClass?: string;       // statusColorClass(status), or undefined when unstyled
  hoverKey?: string;          // surface form → glossary sidecar key
}

export function annotate(
  tokens: Token[],
  getStatus: (word: string) => WordStatus,
  opts?: { loudStatuses?: WordStatus[] }   // default ["new","l1","l2","l3"]
): AnnotatedToken[]
```

`annotate()` is pure, JSON-serializable in/out, language-agnostic, and DOM-free — it fits the engine's "everything is JSON-serializable, DOM-free, language-agnostic" contract. The reader's `renderWord()` becomes a thin DOM wrapper over `annotate()`; the wiki transformer maps `AnnotatedToken[]` onto HAST spans. Coloring intensity, the loud-status set, and the `tsg-status-*` mapping all live in one place. This is warranted: it removes the only place where the wiki could drift from the app, and it is small.

---

## 9. Note for downstream (build + agent runtime)

- The `.cues.json` and glossary-sidecar builders run as **batch, agent-run** steps (Claude Code / Grok Build), consistent with PRD §5.3 — no live API, files written on confirm.
- The wiki build adds one pre-build script (`build-reading-layer.ts`) and one Quartz transformer; both must read the local word-store path from config (gitignored), failing **soft** to "generic TOCFL shading" if the store is absent (so a clean public clone still builds, data-free).
- Reader-parity gaps from Finding 2 (lemmatization, sentence hovers, audio library, SRS metadata in cards) are **out of scope** here and tracked against the main PRD's reader work.

---

## 10. Risks & mitigations

| Risk | Sev | Mitigation |
|------|-----|------------|
| **Word-store path leaks into a committed file** | High | Store read from a gitignored config path; CI secret/data scan; build fails soft to generic shading when absent. |
| **CC-BY-SA dictionary data redistributed via sidecars** | High | Sidecar carries only glosses for words already on the public page (not the full dict), with CC-CEDICT/MDBG attribution; full dicts stay in the private pack. |
| **Simplified leakage into emitted zh spans** | High | OpenCC `scriptNormalizer` runs on every zh surface form before emission (pack guard). |
| **Reader app and wiki coloring drift** | Med | Single `annotate()` core; both consume it; shared `tsg-status-*` classes + CSS. |
| **Cue ↔ video timing drift** (re-upload / edited cut) | Med | Key cues by exact video ID; tolerate per-line fallback to the plain video link when a cue is missing. |
| **No `.cues.json` for a transcript yet** | Low | Deep-links degrade to the whole-video link; backlinks + highlighting still ship. |
| **HTML bloat from per-word spans** | Med | Spans only on body prose, not code/tables-as-data; emit class only for loud statuses (known/ignored unstyled = no class). |
| **Quartz/YouTube DOM churn (future overlay/extension)** | Low (deferred) | Overlay is optional future work; build-time path has no runtime DOM dependency on third parties. |

---

## 11. Plan (phased)

- **Phase R0 — Annotation core + reuse audit.** Add `annotate()` (`content/annotate.ts`) and `sidecar.ts` projection; refactor the reader's `renderWord()` onto `annotate()` so nothing changes visually in the app. *Exit: reader renders identically via the shared core; core is DOM-free + tested.*
- **Phase R1 — Backlinks + build-time highlighting (ships first).** (a) Add `related[]` frontmatter + source-video links; confirm Quartz `Backlinks.tsx` renders summary ↔ vocab. (b) Build the per-page status map from the local word-store; add `perWordHighlight.ts`; bake `tsg-status-*` spans + the underline CSS rule; generate `.cues.json` for the proving source and emit `&t=Ns` deep-links. *Exit: published summary + vocab show the owner's coloring on first paint, link to each other, and deep-link to YouTube at the right line.*
- **Phase R2 — Hover definitions.** Emit per-page glossary sidecars; add `WordHover.tsx` + `wordHover.inline.ts` (guess-first reveal, bridge box for vi), re-bound on the `"nav"` SPA event. *Exit: hovering a highlighted word on the wiki shows reading/gloss/examples offline, attribution carried.*
- **Phase R3 — Click-to-grade + multi-reader overlay (optional/stretch).** Wiki-side click-to-grade writing to the local store on confirm; a client `afterDOMLoaded` overlay letting other visitors load their own word-list (localStorage / File System Access) and recolor `data-word="off"` spans. *Exit: owner can grade from the wiki; a visitor can load a personal list and see their own coloring.*

Build tooling and cadence inherit PRD §11: plan → approve → build → review, Grok Build (plan) + Claude Code.

---

## 12. Open questions

1. **Status-map vs re-segment in plugin** — bake a per-page status map (keyed by `data-word`) and have the transformer look it up, or re-run the segmenter inside the Quartz plugin? The map avoids shipping the segmenter into the build's HAST pass and avoids re-segmentation drift; confirm the map is the chosen contract.
2. **Underline + background CSS** — exact treatment for `new | l1 | l2 | l3` so unknowns are scannable without being garish (Migaku underline vs LingQ background). Lock the SCSS partial copied from `apps/web/src/styles.css:221-260`.
3. **Glossary sidecar granularity** — one sidecar per page, or one shared per source (summary + vocab + transcript share a glossary)? Shared reduces duplication but couples public + private; per-page is cleaner for the publish boundary.
4. **`video_id` source** — add an explicit `video_id` frontmatter field, or always extract from `source`? Extraction is DRY; an explicit field is robust against URL format changes.
5. **Cue line ↔ summary line mapping** — how do we associate a summary sentence with a transcript line for deep-linking when the summary paraphrases (not quotes) the transcript? Options: nearest-quote match at generation time, or a manual `cue` annotation on key summary lines.
6. **TOCFL shading data** — derive our own level buckets (to sidestep the ambiguous official-list license) or mirror an open list (PSeitz/NAER) with attribution? Keep the level list in the personal layer either way.
7. **Build-soft-fail UX** — when the local word-store is absent (clean public clone), do we ship plain `data-word` spans (overlay-ready) or fully unstyled prose? Recommend overlay-ready spans.
8. **Multi-reader overlay storage** — localStorage vs File System Access for a visitor's own list, and whether to reuse the engine `word-store.json` shape (Phase R3).
9. **Reader-parity backfill** — fold the underline/level-badge/seenCount popup improvements (Finding 2 low-effort wins) into the reader app at the same time as R1, or keep them separate?

---

## 13. Sources
- Engine word-store, status model, tokens, hover merge, prepared content, packs: `packages/engine/src/types.ts`, `status/coloring.ts`, `ci/scorer.ts`, `content/hover.ts`, `content/prepared.ts`, `pack.ts` (Finding 1).
- Reader render + recolor + hover popup + grade hotkeys + CSS: `apps/web/src/reader/reader.ts:64-301`, `apps/web/src/styles.css:221-260`, `apps/web/src/state.ts` (Finding 2).
- Quartz build pipeline, `CrawlLinks`/`links.ts`, `Backlinks.tsx`, popover system, `ignorePatterns`, `afterDOMLoaded` + `"nav"` event: `tsumugu-wiki/quartz/processors/parse.ts`, `quartz/plugins/transformers/links.ts`, `quartz/components/Backlinks.tsx`, `quartz/components/scripts/popover.inline.ts`, `quartz.config.ts` (Finding 3).
- Root-doc placement, PRD conventions, transcript frontmatter (`source`, `duration`, no per-cue timing), `.cues.json` recommendation, cross-link syntax: `PRD.md`, `content/private/transcripts/zh-Hant/why-friendship-differs.md` (Finding 4).
- Client-dict sizing, segmentation tradeoffs (pre-segment at build time), CC-CEDICT CC-BY-SA + attribution, TOCFL list licensing, build-time vs client-overlay personalization patterns: Finding 7.
- Parent PRD: [`PRD.md`](./PRD.md) §5.5, §5.8, §6.
