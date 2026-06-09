---
title: "SUBTITLE-EXTENSION — Tsumugu reading-layer subtitle overlay (YouTube primary, Netflix deferred)"
type: feasibility
status: draft
created: 2026-06-05
updated: 2026-06-05
revision: v1 (sub-feasibility + PRD-stub of PRD.md §11 Phase 6 — Browser extension)
license: Apache-2.0
parent: "[[PRD.md]]"
languages:
  - zh-Hant (Traditional Mandarin, Taiwan) — first MVP target
tags:
  - feasibility
  - tsumugu
  - browser-extension
  - subtitle-overlay
  - youtube
  - netflix
  - reading-layer
  - mv3
---

# SUBTITLE-EXTENSION — Tsumugu reading-layer subtitle overlay

**A browser extension that overlays Tsumugu-generated Traditional-Chinese subtitle cues onto auto-playing video, carrying the reading layer specified in [`READING-LAYER.md`](./READING-LAYER.md): status-coloring of unknown words plus hover definitions. YouTube is the MVP; Netflix is a deferred, best-effort adapter behind a "may break" flag. The extension stays client-side, carries no personal data and no paid API, and runs every Chinese form it displays through the OpenCC s2tw guard.**

> Focused sub-feasibility doc + PRD-stub for the engine PRD's §11 Phase 6 (Browser extension). It mirrors the PRD structure (goal → verdict → architecture → risks → open questions). Resolutions lock into [`DECISIONS.md`](./DECISIONS.md). This document recommends *whether* and *how* to build; it does not commit the engine to a schedule.

---

## 0. Decision log (decisions + overrides, on the record)

- **YouTube is the first and only committed target.** Netflix is deferred to a clearly-flagged, best-effort adapter that shares the overlay/sync core. Grounded in the operational and ToS asymmetry the research surfaced (Finding 6).
- **We supply our own transcripts; we never read the platform's caption tracks for YouTube.** This sidesteps the brittle `timedtext` endpoint that Language Reactor and Migaku pay to maintain, and puts us on cleaner legal footing (Finding 5).
- **The personal unknown-word layer is owned by the wiki build, not this extension.** Per the owner decision, known/unknown status is not private; the public wiki bakes pre-colored word spans at build time from the locally-stored, gitignored word-store. This extension is a *video reading surface*; the wiki build owns primary personalization. A client-side overlay that lets other readers load their own list is an optional future enhancement.
- **The engine repo stays data-free.** No CC-CEDICT, no TOCFL lists, no word-store, no keys committed to the Apache-2.0 engine. Dictionary and personal data load at runtime from assets the user places or fetches.
- **OpenCC s2tw guard applies to every zh-Hant surface this extension renders.** Same rule as the reader.

---

## 1. Goal + how this reuses existing Tsumugu assets

We want to watch Traditional-Chinese YouTube videos with Tsumugu-generated subtitles overlaid, auto-synced to playback, with the same reading layer the wiki and reader already give us: hover definitions, status coloring, click-to-grade. The video plays; our cues appear under it; every word is live.

This reuses assets we already produce:

- **Timestamped Traditional cues.** Our content-ingestion pipeline already transcribes caption-less video (yt-dlp + mlx-whisper + OpenCC s2twp) and produces raw, faithful transcripts. The hardest sub-problem for every other tool — getting accurate captions onto a video that has none — is the part we solved upstream. Migaku had to *add* an AI-caption-generation feature in 2025 to do what our batch pipeline already does. The missing piece today is a per-cue timestamp file: the transcript frontmatter stores total `duration` but no line-to-seconds mapping (Finding 4). We add a parallel `.cues.json` to close that gap (§3).
- **The annotation core.** The reader already renders token spans, applies `tsg-status-*` classes from the `(lang, word)` word-store, opens a hover popup merged via `custom > prebaked > dict`, and grades on `1/2/3/4/K/X` hotkeys (Findings 1, 2). The extension is a thin rendering+input layer over this same model. Cues should ship **pre-tokenized** from the batch step, exactly like `PreparedContent.tokens[]`, so the extension renders spans with no runtime segmenter.
- **The same client dict.** CC-CEDICT loaded at runtime as the `BrowserDict` provider, OpenCC-guarded, with the prebaked glossary from our cue file taking precedence. Same precedence chain, same status model, same guess-first reveal.

The extension introduces no new core concept. It points the existing reading layer at a `<video>` clock instead of a static page.

---

## 2. Feasibility verdict table

Ratings: 🟢 green (proven, low risk) · 🟡 yellow (workable, real friction) · 🔴 red (blocked or operationally unwise as a starting point).

| Dimension | YouTube | Netflix | Justification |
|---|---|---|---|
| **Subtitle injection** | 🟢 | 🟢 | Both: hide native captions, append our own `<div>` to the player container. Proven by easysubs (MV3, MIT) on both sites; NetflixSubLoader proves external-file injection specifically (F5, F6). |
| **Sync** | 🟢 | 🟢 | Both drive off the HTML5 `<video>` clock — `timeupdate` + `requestAnimationFrame`, filter cues by `currentTime`. Platform-agnostic once we have start/end times (F5, F6). |
| **Word interactivity** | 🟢 | 🟢 | Identical client-side path on both: pre-tokenized spans, CC-CEDICT hover, click-to-grade into local store. Performance is a non-issue at subtitle scale (jieba-wasm ~40ms/77KB; a cue is sub-millisecond) (F5, F7). |
| **MV3 / store policy** | 🟢 | 🟡 | YouTube: single-site content script, minimal permissions, cue data (not code) fetched in the worker — clean. Netflix needs MAIN-world injection to hook `JSON.parse` for title ID; allowed under MV3 but heavier, and Netflix has degraded streams on detected injection (F5, F6). |
| **Legal / ToS** | 🟡 | 🔴 | YouTube: overlays for learning are tolerated for years; using our own transcript avoids the timedtext gray area; we must not cover native controls. Netflix ToS explicitly bans "automated means to access" — reading the manifest for title ID is squarely in that zone (F5, F6). |
| **Maintenance burden** | 🟡 | 🔴 | YouTube DOM churn is the #1 cost LR/Migaku pay; defensive selectors keep it patchable for a solo maintainer. Netflix rebuilds Cadmium per-video, detects injection adversarially, and needs per-title offset tuning — a continuous reactive tax LR/Migaku absorb with paid teams (F5, F6). |

**Net:** YouTube is green-to-yellow across the board, with the yellows being operational rather than architectural. Netflix is green on the *technical* axes and red on the axes that matter for a solo, public, no-API project — ToS and maintenance.

---

## 3. Architecture for the YouTube MVP

The pragmatic first target. Everything below is grounded in what the research confirmed is possible; where the findings flag a limit, we say so.

### Manifest V3 shape

```jsonc
{
  "manifest_version": 3,
  "name": "Tsumugu — read Chinese on YouTube",
  "content_scripts": [
    { "matches": ["https://www.youtube.com/*"], "js": ["content.js"] }
  ],
  "background": { "service_worker": "worker.js" },
  "host_permissions": ["https://<tsumugu-wiki-origin>/*"],
  "permissions": ["storage"],
  "web_accessible_resources": [
    { "resources": ["dict/cedict.*", "jieba/*"], "matches": ["https://www.youtube.com/*"] }
  ]
}
```

Single-site match, not `<all_urls>` — over-asking permissions is the top rejection cause. The only host permission is our own wiki origin, and only for option (b) below. No remote code: jieba-wasm and CC-CEDICT ship inside the package; cue files are *data*, which MV3 permits fetching.

### Content script

On a watch page, the content script:

1. Extracts the 11-char video ID from the URL (the easysubs regex works).
2. Requests the cue file for that ID (cue loading, below).
3. Finds the player via stable selectors — `.html5-video-player` as the overlay container, `document.querySelector("video")` as the clock, controls injected next to `.ytp-right-controls`.
4. Sets YouTube's own captions to off / hides them via CSS, and appends our overlay `<div>` into the player container so we fully control styling and per-word DOM.
5. Re-attaches on SPA navigation — YouTube is a single-page app; the `<video>` and player are recreated without a full reload.

### Loading OUR cue file

Three delivery paths, all feeding the same render. We recommend **(b) + (c)** for the MVP:

- **(a) Bundled in the extension.** Simplest, but you re-ship the extension for every new transcript and MV3 forbids remote *code*. Viable only for a tiny fixed pack; not the primary path.
- **(b) Fetched from tsumugu-wiki (recommended primary).** Host cue files as static JSON keyed by video ID — `https://<wiki>/cues/<videoId>.json`. The content script extracts the ID; the **service worker** performs the cross-origin fetch (content scripts can't do arbitrary cross-origin requests under MV3) and returns the cues via `chrome.runtime.sendMessage`. This is data, fully MV3-compliant, and aligns with the engine's client-side / no-API-in-core rule. The cue files are not in the public engine repo; they live on the wiki, the owner's personal published site.
- **(c) Local file picker (matches the "local writes only on confirm" rule).** A `FileReader` picker, exactly like easysubs' `CustomSubs.tsx`, points at a Tsumugu-generated `.cues.json` from disk with zero network. This is the path for private transcripts we keep off the wiki — and it is a genuine differentiator: Language Reactor *cannot* load a local subtitle file onto a live YouTube video.

**Cue file shape.** Pre-tokenized, ms-based, OpenCC-guarded at generation time:

```jsonc
{
  "schema": "tsumugu/cues@1",
  "lang": "zh-Hant",
  "videoId": "2idX7w0gs4k",
  "cues": [
    {
      "start": 21460, "end": 24010,
      "tokens": [
        { "text": "中國", "isWord": true },
        { "text": "的", "isWord": true },
        { "text": "友情", "isWord": true },
        { "text": "。", "isWord": false }
      ]
    }
  ],
  "glossary": { "友情": { "term": "友情", "gloss": "friendship", "reading": "ㄧㄡˇ ㄑㄧㄥˊ / yǒu qíng", "...": "..." } }
}
```

This mirrors `PreparedContent` (Finding 1): `tokens[]` for rendering, a prebaked `glossary` for instant hover. Pre-tokenizing removes segmentation from the hot path entirely; jieba-wasm stays bundled only as a fallback for untokenized local files (Finding 5, 7).

### Overlay rendering + sync

Render the active cue's tokens as `<span>`s in the overlay. Each tick:

```js
// timeupdate fires ~4x/sec; rAF supplements for smooth highlight
const t = video.currentTime * 1000;
const active = cues.filter(c => c.start <= t && c.end >= t);
```

`timeupdate` alone is adequate for an MVP; we add `requestAnimationFrame` for smoother per-line transitions. A manual delay/resync control handles the case where the user watches a re-upload with shifted timing — key cues by exact video ID and let the offset slider absorb the rest.

### Auto-pause-at-line

Compare `currentTime` against the active cue's `end`; when crossed, call `video.pause()`. easysubs does exactly this. We can extend it later to pause-on-unknown-word or pause-on-hover (the Migaku behavior), deferred past MVP.

### Word hover / grade reusing the annotation core

Each word `<span>`:

- `mouseenter` → tooltip rendered from the same `mergeHover()` precedence (`custom > prebaked > dict`): term, reading (always visible), gloss + explanation under guess-first reveal, examples, and the Hán-Việt bridge box for vi. Prebaked glossary from the cue file is instant and offline; CC-CEDICT is the live fallback, OpenCC-guarded.
- `click` (or `1/2/3/4/K/X`) → `gradeWord(word, status)` into the local store (`chrome.storage` / IndexedDB), reusing the engine's pull-based SRS model and `tsg-status-*` coloring.

This is the reader's exact interaction model (Finding 2), retargeted from a page to a video overlay. The status store the extension writes is the same `(lang, word)` word-store shape the reader and wiki build read, so grading on video and grading on the page stay coherent.

**What the findings say is *not* possible / out of scope for MVP:** machine-translated second line, Anki export, keyboard line-navigation, AI sentence breakdowns, and multi-site. Lemmatization is not needed for zh (exact surface-form match is the contract); it stays out.

---

## 4. Netflix: honest assessment

**What is technically accessible.** Netflix encrypts the *video* (and DASH-mode audio) under Widevine via EME. Subtitles ride *outside* that pipeline — they are separate TTML/WebVTT documents served as plain HTTP from Open Connect, fully readable by a content script. None of the public tools touch Widevine, the CDM, or encrypted segments. The DRM boundary favors us: encrypted frames are inaccessible, subtitle text and timing are not (Finding 6).

**We don't even need their subtitles.** Our use case is the NetflixSubLoader pattern — render *our own* zh-Hant cues over the Netflix `<video>` and sync to `currentTime`, with a manual ms offset. We never push cues into Netflix's native track. Injecting an externally-sourced transcript matched by timing is proven and does not require breaking DRM.

**The title/timeline-matching problem.** This is where our externally-sourced transcript hits friction. We key the correct transcript file off Netflix's `movieId` (the episode-level numeric ID, available from the `/watch/<id>` URL or the intercepted manifest JSON). But reading `movieId` reliably means hooking `JSON.parse` in the page's MAIN world — and once matched, Netflix's regional cuts, intros, and recaps mean *every title needs a per-title offset*. We'd bootstrap alignment by anchoring against Netflix's own official subtitle timings, then ship a manual offset slider per `movieId`. This is real per-title data and UX we'd have to manage, on top of a transcript-to-episode mapping the YouTube path gets for free (video ID is the natural key).

**Honest recommendation: defer.** The technical axes are green. The axes that sink it for a solo, public, no-API project are red:

- **ToS posture.** Netflix's Terms explicitly ban "any robot, spider, scraper or other automated means to access the Netflix service." Reading the manifest JSON for title ID is reasonably read as automated access. LR and Migaku ship anyway, relying on tolerance, not permission — and they have legal cushion and team leverage a public solo repo does not. The exposure is contractual (account/IP action, cease-and-desist against a public repo), not criminal, since DRM is untouched. The breach is still real.
- **Maintenance asymmetry.** Cadmium is rebuilt per-video without a reload; the manifest schema, profile strings, and DOM all shift; Netflix has degraded streams on detected injection. LR/Migaku absorb this with paid teams. A solo maintainer patches reactively, forever — directly at odds with "engine stays small and data-free, run by one person."

We build the overlay/sync core against YouTube. The renderer, cue model, `currentTime` sync, and click-to-pause are platform-agnostic; only track acquisition, title-keying, and DOM-hiding are Netflix-specific. A Netflix adapter slots in later behind a "best-effort, may break" flag, once the core is proven.

---

## 5. Phased plan

- **Phase S0 — Cue file + one video by hand.** Add `.cues.json` emission to the batch transcription step (per-cue start/end + pre-tokenized tokens + prebaked glossary, OpenCC-guarded). Hand-verify one Mandarin Corner video's cues align to playback. *Exit: a single cue file that visibly syncs when scrubbed in a throwaway overlay.*
- **Phase S1 — YouTube MVP.** MV3 extension, content script on `youtube.com` only, service worker for cue fetch. Inject overlay into `.html5-video-player`; sync off `video.timeupdate` + `getCurrentSubs(currentTime)`; auto-pause-at-line. Cue loading via (b) wiki fetch + (c) local file picker. Render pre-tokenized spans; hover = prebaked glossary then CC-CEDICT (bundled, OpenCC-guarded); click/hotkey = grade into local store. Settings: font size, delay/resync, auto-pause toggle, show/hide native line. *Exit: we read a real zh-Hant YouTube video end to end with live words and grading that persists.*
- **Phase S2 — v1 polish.** jieba-wasm fallback for untokenized local cues; defensive selector config that's cheap to patch when YouTube churns; store submission to Chrome Web Store + Firefox AMO (single-purpose listing, minimal-permission justification, "no data collected" declaration for AMO's Nov-2025 rule). *Exit: published, installable, surviving a YouTube DOM update with a one-line patch.*
- **Phase S3 — Netflix adapter (deferred, optional).** Only if S1–S2 prove durable and the appetite exists. MAIN-world content script on `*.netflix.com/*` hooking `JSON.parse` for `movieId`; same overlay/sync core; local-file cues only; per-`movieId` offset slider; re-attach on Cadmium recreation; behind a "best-effort, may break" flag. *Exit: one Netflix title reads end to end — accepting it may break on any Netflix update.*

**Effort, qualitatively.** S0 is small — a serialization addition to a pipeline that already produces transcripts. S1 is the real build: a focused MV3 extension wrapping a reading core we already own, with a strong MIT reference (easysubs) to copy the player-hook and sync patterns from. S2 is mostly store-submission paperwork plus defensive hardening. S3 is open-ended and adversarial; treat its effort as unbounded and its lifespan as short.

**Recommendation:** Build S0 → S1 → S2 on YouTube. Defer S3. Revisit Netflix only after the YouTube core has survived real DOM churn.

---

## 6. Risks + open questions

### Risks (ranked)

| Risk | Severity | Mitigation |
|---|---|---|
| **YouTube DOM/markup churn** breaks selectors and player hooks — the maintenance treadmill LR/Migaku live on | High (recurring) | Defensive selectors + a tiny patchable "selectors config"; this is the explicit cost of entry, not a surprise. |
| **Cue ↔ video misalignment** on re-uploads/edited cuts | Medium | Key cues by exact video ID; ship a manual delay/resync slider (easysubs `subsResyncFx`). |
| **Store-review friction** (permission justification, single-purpose framing, AMO data-collection declaration) | Low | Minimal permissions, collect no data, declare "no data collected." |
| **Bundle size** from CC-CEDICT (~9.5 MB raw / ~3.5 MB gzip) + jieba WASM | Low | Lazy-load dict into IndexedDB; pre-tokenize cues so jieba is optional. |
| **CC-CEDICT BY-SA "infecting" the package** | Medium | Ship the dict as a runtime-loaded asset the user fetches/places, not committed to the Apache-2.0 engine; carry "CC-CEDICT, MDBG, CC BY-SA 4.0" attribution wherever it loads. |
| **YouTube ToS drift** | Low | Multi-year precedent for learning overlays; we use our own transcripts and never cover native controls. |
| **Netflix (if attempted): ToS enforcement + relentless breakage** | High impact / unbounded effort | Defer; if built, flag as best-effort and local-cues-only. |

### The maintenance treadmill — stated plainly

LR and Migaku pay continuous engineers to chase YouTube and Netflix player changes. The undocumented `timedtext` endpoint shifts its token requirements every few months; Netflix rebuilds Cadmium per-video. We dodge the worst of it on YouTube by **never reading the platform's caption endpoint** — we ship our own cues, so endpoint churn doesn't touch us. The residual tax is DOM selector drift, which a solo maintainer can absorb with defensive selectors and a one-line config patch. On Netflix the treadmill is adversarial and we decline to run it now.

### Open questions

1. **Cue file home and naming.** Recommend a private parallel `.cues.json` next to each transcript (e.g. `content/private/transcripts/zh-Hant/<slug>.cues.json`), served from the wiki at `/cues/<videoId>.json`. Confirm the wiki build emits cue JSON to a public path while keeping the transcript private (Finding 3: `private/` is ignored by the build).
2. **Glossary reuse vs. recompute.** Does the cue file carry its own prebaked glossary, or does the extension reuse the wiki page's already-baked glossary for the same video? One source of truth is cleaner; decide whether the cue file is self-contained.
3. **Status store sync across surfaces.** The reader writes the vault word-store via File System Access; the extension writes `chrome.storage`/IndexedDB. How do grades made on video reconcile with the wiki build's gitignored word-store? Define the import/export bridge so all three surfaces stay coherent.
4. **CC-CEDICT delivery to the extension.** Bundled asset vs. first-run download (to keep the package light and the BY-SA data cleanly separated). Confirm which satisfies both store policy and the data-free rule most cleanly.
5. **Other-reader overlay.** If we ever let other readers load their own word-list onto the wiki or the extension, that's the optional client-side overlay enhancement — explicitly out of scope for the owner's own use, which the wiki build serves at build time.

---

## 7. Proposed repo placement

**Recommendation: a new sibling repo, not a package in the engine monorepo.**

Reasoning, grounded in the conventions finding and the hard rules:

- **The engine repo stays data-free and language-agnostic.** A YouTube extension is platform-coupled (YouTube DOM, MV3 manifest, Chrome/Firefox store metadata) and ships data-adjacent assets (CC-CEDICT loader, jieba WASM). Bundling it into the Apache-2.0 engine pulls platform specificity and BY-SA-adjacent delivery into a repo whose whole point is to stay clean and generic.
- **The extension consumes engine output across a file boundary.** It reads `.cues.json` and the word-store the same way the reader consumes `.prepared.json` — engine ↔ app via files. That's the established seam (Finding 1, hard rules). A sibling repo respects it; the extension depends on the engine's published types, not the reverse.
- **Distribution lifecycle is separate.** Store review, versioning, and the DOM-churn patch cadence are the extension's own treadmill and shouldn't churn the engine's release history.

Concretely: a new public repo, `tsumugu-subs` (or similar), Apache-2.0, depending on the engine's published annotation-core and cue types. It imports the reading layer; it does not fork it. The cue files it consumes live on the wiki (the owner's personal site) or locally; neither the dictionary nor the word-store is committed to it.

Within the **engine** repo, the only change is additive and data-free: the batch transcription step gains `.cues.json` emission (Phase S0). The two new design docs — this one and a reading-layer sub-PRD — sit at the engine root alongside `PRD.md` and `AGENTS.md`, per the no-`docs/`-folder convention (Finding 4): `SUBTITLE-EXTENSION.md` (this document) and `READING-LAYER.md`.
