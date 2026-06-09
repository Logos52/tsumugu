# Tsumugu Comprehensive Improvement Review

**Date:** 2026-06  
**Context:** Review of the Tsumugu project (engine, web reader app, generation scripts, voice features, packs, docs, etc.) based on direct code inspection, PRD alignment, real usage artifacts in `personal/`, and multiple parallel subagent analyses. This document consolidates *all* findings (including the prior dedicated UI/UX response) into one place for review. It is **not** a formal PRD — it is a broad "areas of improvement" + feature/roadmap/quality/UX synthesis.

**How this was produced:** Orchestrated 4 specialized subagents (Architecture/Engine, UI/UX Deep-Dive, Features/PRD/Roadmap, Code Quality/Testing/Maintainability) + synthesis pass that folded in the previous standalone UI/UX analysis. All observations are evidence-based with absolute file paths under `/Users/n1/Projects/tsumugu`.

**Overall Health Assessment:** Very strong. The project is a clean, disciplined example of "fast-moving features under strict constraints" (batch/pre-baked, client-side $0 offline core, open-core hygiene, no paid API in core, pull-only SRS, vault writes on explicit confirm). Voice has evolved from a deferred §9 item into a *central, production-used immersion surface* (M1 + substantial M2/M3 + real heavy usage with 1000+ cue assets). Generation ergonomics are excellent. Tests and docs kept pace. The engine remains an excellent, extensible foundation. Real usage (GSM-style transcripts + voice + Migaku sync + SRS/Anki + wiki) proves the model works for the intended learner.

The main debts are classic "feature accretion in the view layer" (reader + transcript + voice) and some localized duplication after rapid voice shipping. No violations of core constraints were found. The system is ready for continued evolution.

---

## 1. Architecture & Extensibility

### Strengths
- **Ports abstraction** (`packages/engine/src/ports.ts`): Clean and effective. `VaultIO` (text + optional binary), `BinaryIO`, `AudioPort` (speak + optional stop), `Clock`. Engine stays DOM-/fs-/network-free except via explicit ports. Write gating matches PRD §6/§8. Hosts (web) implement cleanly; `systemClock` enables deterministic SRS/tests.
- **Pack interface** (`packages/engine/src/pack.ts`, `types.ts`): Sealed contract for pluggability + open-core hygiene. `LanguagePack` (segmenter, dictionaryProvider with custom override, phoneticLayer, levelingModel, scriptNormalizer, ttsVoice, optional bridge). Demo-pack is trivial/data-free. Private packs live correctly in gitignored `packs/private/`. `TtsVoiceSpec` is a host-resolved hint.
- **Voice as thin optional module**: Sidecars (`.voice-notes.json`, word-audio, section-audio), pure parse/bind/compose/selectPlayback logic (`apps/web/src/voice/manifest.ts`, `player.ts`, etc.), Web Speech fallback, inert when absent (discovery in `main.ts` returns null on error). Multi-track/per-speaker support (`voices.ts` + `composeBinding`). No engine changes. Matches PRD-Voice-Notes exactly.
- **Multi-language + constraints upheld**: zh-Hant + vi (Hán-Việt bridge). Batch/pre-baked/offline/no-paid-core/open-core all rigorously followed (greps confirm no live LLM/network in engine; generation is agent-run in `scripts/gen/`).
- **Pure logic isolation + testing**: `sync.ts` (cue alignment) is DOM-free and well-tested. Engine modules (store, srs, anki, bridge, crossref, content/hover, ci) are data-only with extensive tests.

### Weaknesses / Smells
- **View-layer god objects**: Reader + transcript sync + voice players have accreted (`apps/web/src/reader/reader.ts:25-27,124-169`; `transcript.ts` ~970 lines owns frame loop, 5+ transports, shadowing integration, practice bar follow, cue reparenting, precedence rules). Adding the next audio flavor will continue touching the same surface.
- **Duplicated sidecar discovery**: `main.ts:225-342` (discoverVoiceNotes/Tracks/WordAudio/SectionAudio + loadVaultReading) has near-identical slugBase + lastSlash + try/catch→null patterns. No single "ReadingBundle" type.
- **Binary support inconsistency**: Now heavily used by all voice paths + Anki, but still documented as "optional" on `VaultIO` (`ports.ts:28-31`). Leads to repetitive LRU/blob code across `player.ts`, `wordAudio.ts`, `sectionAudio.ts`, `practiceBar.ts`, `cueWaveforms.ts`.
- **Minor**: Browser packs split from private (intentional for licensing) creates some duplication in tone/OpenCC logic. No engine-level concept of "transcript media."

### Recommendations
1. **(High impact)** Introduce a thin `TranscriptMedia` / `AudioBindings` seam (new file under `apps/web/src/reader/media.ts` or `voice/`). Reader/transcript should not directly construct players or receive 10–15 individual voice props/callbacks. Pass one object (or small set) into `mountTranscriptSync`. Keep pure bits (manifest, selectPlayback) where they are.
2. **(Medium-high)** Centralize reading + sidecar loading into `loadReadingBundle` (extend `loadReading.ts` + main.ts discover helpers) that returns a single bundle with all bindings. Use from both file-picker and vault paths.
3. **(Medium)** Promote `readBytes` (or add `BinaryVaultIO` subtype) or extract a shared `host/blobAudio.ts` LRU helper to eliminate duplication.
4. **(Medium)** Extract more of the time-source/transport/highlighting state machine from `transcript.ts` (keep pure sync primitives in `sync.ts`; let voice/shadowing own more side-effects via events).
5. **(Lower)** Minor pack-loading polish (shared "pack-algorithms" barrel if tone logic ever needs sharing).

---

## 2. Features, Roadmap & PRD Alignment

### Strengths (Shipped vs. PRD)
- **Engine + reader core** (Phases 0/1 + extensions): Language-agnostic public engine, real private packs, instant offline hover (pre-baked + custom precedence), LingQ-style grading + hotkeys + flag, zh tone + (M1) zhuyin ruby + Migaku visual, File System Access vault (or dev bridge), Review (pull FSRS), Anki (client-side, now with media), Encoding pages, Hash router.
- **Generation ergonomics** (Phases 2/3/4/5/7): `pnpm gen` harness is excellent (deterministic machine work + prints exact prompt + context for agent fill). Commands for prep, transcript (with `.cues.json` + videoId), verify, wiki/encoding, bridge, crossref (including direct migaku-db), writeback. Real heavy usage in `personal/inbox/zh-Hant/` (GSM-style + voiced content). Prompts ground in dict/leveling/store, require OpenCC, etc.
- **Migaku metalayer + two-way sync** (post-PRD extensions, heavily shipped): M0 s2twp; M1 zhuyin ruby + visual CSS; M3 provenance + clock-aware resolver/never-demote; M3b direct SQLite; M3c fenced writeback (dry-run, never-clobber, copy-only); M4 synced reader (pure math + panel + sanctioned IFrame; highlights *in Tsumugu's own text*; full yt-dlp → gen transcript chain). "Deep dive" in hover. Local-dev ergonomics.
- **Voice (Phase 8)**: Core M1 + substantial M2/M3-lite + UX fully shipped and in heavy real use (per-cue + per-word + sections + practice bar + shadowing + Anki audio + synced video + source toggle + hoverable summaries + A/B loops). PRD-Voice-Notes v2 (local OSS batch only via Qwen3-TTS + mlx-audio; incremental + merge + validate; real 1010-cue runs with RTF ~0.8, polyphone QA, runaway fixes). Thin inert module (sidecars, pure logic, Web Speech fallback). Fits immersion/shadowing use case extremely well.
- **Wiki + durable artifacts**: Agent generators + harness; published Quartz site (combined zh+vi for now); cross-language store + Hán-Việt bridge + cross-seeding.
- **Open-core + tests/hygiene**: Demo-pack + examples public; 500+ tests (voice increments added many); STATUS audited table (8/12 criteria fully done + 4 open-core-by-design caveats); constraints preserved.

**Voice-specific wins**: Multi-track, practice bar (Audacity-style drag-select L-loop + speed + auto-follow), A/B video loops, per-sentence waveforms (opt-in), serena source toggle, section audio in target lang + 譯 + 🔊, hoverable summaries, Anki-with-audio. Real assets in `personal/inbox/zh-Hant/audio/` (thousands of mp3s across GSM lessons).

### Gaps vs. PRD + User Needs (Immersion/Voice-Heavy)
- Phase 6 (Chromium extension) explicitly descoped (by design; conflicts with pre-baked; Web Clipper + web reader covers 95%).
- vi voice deferred (PRD open question; zh-Hant voice now central and proven).
- Onboarding friction (dev-heavy; no guided first voiced reading or packaged starter voice assets in public examples).
- Learner analytics/progress visibility (PRD §2.9/§5.9 explicit; store has data but no viz/dashboard/export beyond review/Anki).
- Agent fill ergonomics still multi-step (strong but no single "pipeline" wrapper).
- Some post-MVP voice items from PRD-Voice-Notes (full per-word audio in Anki, read+explain on cues, tr/commentary voices, loop persistence, BreezyVoice zhuyin-exact for polyphones).
- Pack data build + custom dict UX is functional but manual/JSON.
- No community/shared features (by design; personal llm-wiki + public wiki is lightweight).
- Mobile out-of-scope.
- No automatic STT/scoring of shadowing (explicit non-goal).

**Feature/Roadmap Recommendations** (prioritized; all stay inside batch/offline/$0/open-core constraints; rationale + rough effort):
1. **Vietnamese voice notes parity** (MVP voice-notes + word-audio + section-audio for vi). High (completes Phase 8 for second language + Hán-Việt leverage). Effort: M.
2. **Per-word audio in Anki exports** (embed word-audio + cue audio). High (table stakes for voice feature). Effort: S.
3. **Lightweight learner progress dashboard/view** (in-app or static export: known growth, CI trends, due count, volume, active coverage). Med-High (PRD explicit; motivation + autonomous targeting). Effort: M. Client-side/batch.
4. **Pipeline ergonomics** (thin `gen pipeline` wrapper or enhanced CLI + updated personal/README). Med (Wedge productivity + onboarding). Effort: S.
5. **Multi-voice + tr/commentary voice notes** (per-note overrides; extend gen + player). Med (high immersion ROI for dialogues). Effort: M.
6. **Onboarding / first-run** (packaged starter voiced sample in examples/ + guided grant/load/shadow flow + improved PACK-AUTHORING). Med (adoption). Effort: S–M.
7. **BreezyVoice (or equiv) zhuyin-exact per-word as optional word-audio path**. Low-Med (addresses documented polyphone caveat). Effort: S–M.
8. **Pack data build + custom dict ergonomics polish + vi data maturation**. Low (current zh usage dominates). Effort: M.

**How Voice PRD Fits**: Executed faithfully (v2 local-OSS pivot + Decision Log + M1–M3 UX all landed + real assets + tests + reader integration). Thin optional + sidecar model is reusable for future pre-baked assets. Natural extensions (batch-friendly): vi voice, multi-voice, word-audio Anki, read+explain on cue, gapless AudioBufferSourceNode, region persistence.

---

## 3. Code Quality, Testing, Maintainability, Perf & Docs

### Strengths
- **Testing (especially voice)**: Excellent. Pure functions isolated and heavily tested (`player.test.ts` selectPlayback matrix; `practiceBarLogic.test.ts`; `shadowing.test.ts` reducer; `manifest.test.ts`, `wordAudio.test.ts`, etc.; integration in `transcript.voice.test.ts`, `reader.practice.test.ts`; gen `voiceNotes.test.ts` (19 tests on orchestration)). Reader tests use fake packs + happy-dom. Engine has solid separate coverage. Voice added dozens of tests in increments.
- **Code organization**: Thin optional voice module (inert, graceful fallbacks, no engine pollution). Pure orchestration in `scripts/gen/lib/` vs. thin CLI + worker. Strong schemas. Excellent Binding/resolve/select* split. Shadowing is a pure reducer. Engine is purity-enforcing.
- **Scripts & generation**: Robust (pure helpers for selection, incremental planning, manifest build/merge/validate, naming, worker jobs, ffmpeg args). CLI does preflight, dry-run, report parsing, validation. Incremental + merge handle real usage well. Python worker is thin local adapter.
- **Performance**: Conscious (lazy wavesurfer, small LRUs with revoke, incremental gen, CUE_WAVEFORM_LIMIT=80, on-demand loads). Real runs measured and documented (RTF ~0.77–0.83).
- **Docs & comments**: Outstanding. PRD-Voice-Notes with full Decision Log + M-phasing + risks + UX + open questions. STATUS audits every increment with numbers/caveats/"not built" lists. JSDoc on nearly every export with "why" + concrete numbers (0.85, 350ms gap, LRU sizes, tradeoffs). AGENTS.md, PACK-AUTHORING.md, inline comments, CLAUDE.md, etc.
- **Open-core hygiene**: Strong. No leaks of keys/data/models/audio into public tree (all under gitignored personal/, packs/private/, or vault). Demo-pack is skeleton-only. Engine never depends on wavesurfer (reader-only, dynamic). Voice schemas/players intentionally public for users who bring their own assets.

### Weaknesses
- **Audio code duplication** (clearest maintainability smell after rapid voice feature additions): Near-identical LRU/blob/Uint8Array/race-token/`new Audio()` (or wavesurfer) + fallback + destroy patterns in `player.ts`, `wordAudio.ts`, `sectionAudio.ts`, `practiceBar.ts`, `cueWaveforms.ts`.
- **Ad-hoc CSS classes**: In `cueWaveforms.ts` (`"tsg-cue-rows"`, etc.) not routed through `ui/classes.ts`.
- **View-layer coupling** (as in Architecture section): reader.ts + transcript.ts.
- **Sidecar discovery duplication** (as in Architecture).
- **Gen python worker**: Thin coverage (orchestration is well-tested in TS).
- No property-based tests for key reducers/logic.
- No public demo voice fixture (voice manifests are personal-only; demo-pack + transcript sample exist).

### Recommendations
1. Extract shared `host/blobAudio.ts` (or `voice/audioHost.ts`) for the repeated LRU/blob/loadUrl/destroy pattern (player/word/section; practice/cue can share URL cache piece). High leverage.
2. Centralize cue-waveform CSS classes into `ui/classes.ts`.
3. Add property-based tests (fast-check) for `shadowReducer` and `practiceBarLogic`.
4. Document (or lightly abstract) the audio player family (short note in voice/ README or voice/index.ts barrel explaining divergence and why separate).
5. Public demo voice fixture (minimal inert manifest + tiny/synthetic audio under `examples/`) so parse/bind/player creation can be exercised publicly.
6. (Lower) Add a comment around wavesurfer accounting vs. single-instance practiceBar model.

---

## 4. UI/UX (Consolidated from Prior Dedicated Review + New Subagent Deep-Dive)

### Prior UI/UX Findings (Categorized, Actionable)
**Discoverability**:
- Voice toggle buried as lone "🔊" checkbox in long flat toolbar (main.ts:500-510, 568). No prominent "Voice mode", no indication when assets present vs. absent, no guidance on generating sidecars + MP3s via Grok workflow.
- New elements (practice bar, cue waveforms, shadowing controls) can appear suddenly.
- **Suggestions**: Voice group/pill + empty-state helper + "how to add" affordance in transcript panel or status. Badge/filter voiced readings in picker. One-time tip on first voice-enabled load.

**Feedback & State Visibility**:
- Shadowing "your turn" (waiting phase) has excellent mechanics (highlight stays via voiceHighlight, 跟讀 btn active) but zero explicit feedback (no label, pulse, aria-live, or "Your turn" text). Relies on user remembering the tooltip.
- Multiple audio sources (voicePlayer, practice bar, word hover, section, video, Web Speech) have good pairwise stop/pause guards but limited global visibility of "who owns the speakers."
- Loading/decoding of local audio has no feedback.
- Practice bar appears magically.
- **Suggestions**: Transient/persistent "your turn" label + distinct `.tsg-shadow-waiting` styling + aria-live. Global audio-source pill ("🔊 Serena" or "🌊 Practice") + unified "⏹ Stop all voice". Transient status on asset load ("47 cue voice notes ready"). Clear labels on practice bar controls.

**Toolbar Bloat, Layout & Consistency**:
- Long flat toolbar becomes cluttered with voice additions (toggle + exportVoiceBtn + picker row + practice/🌊/跟讀 buttons) mixed with video chrome. Risk of wrap or overwhelm in immersion sessions.
- Multiple panels (text, transcript, video, practice waveform, cue rows) + dynamic voice tools can feel dense, especially in theater layouts.
- **Suggestions**: Group voice controls or introduce lightweight "focus/immersion" collapse for video chrome when shadowing/serena active. Make cue-waveform row mode explicitly opt-in. Consistent spacing and use of existing .tsg- classes. Ensure voice elements don't clash with burned-in subtitles.

**Keyboard, Accessibility & Error Handling**:
- Space overloaded (shadow advance vs. video/transport).
- Waveforms (wavesurfer) not inherently accessible (no ARIA/labels for regions; cue reparenting changes reading flow for long transcripts).
- Many icon-only buttons (🔊, 🎨, etc.).
- Missing assets are silent fallbacks (good behavior, but no clear notice).
- **Suggestions**: Context-specific Space when shadowing or hotkey legend ("?"). ARIA roles/labels on waveform containers + hosts. Visible labels on icon buttons. "Some voice notes missing — using speech fallback for X cues" message. `prefers-reduced-motion` for wavesurfer.

**Other Quick Wins**:
- Expose sidecar metadata lightly ("Voice notes: Serena (1,010 cues) — regenerate via `gen voice-notes`").
- Polish practice bar default visibility + ensure cue-waveform interaction doesn't fight main shadowing state.
- Add "Enter shadowing for this reading" one-click (if assets present).

### New/Deepened Findings from Latest Subagent
**Strengths**:
- Thin opt-in (inert without manifest + vault + setting).
- Excellent integration (voice claims highlight via `voiceHighlight`, precedence, auto-follow, stop/pause guards).
- Pure state machine + heavy tests.
- Multi-track with persistence.
- Hotkey density and transport locality for power users.
- Offline hygiene.

**Additional Issues**:
- Practice bar and cue waveforms appear suddenly; no metadata surface for manifest (voice + generatedAt).
- Toolbar + layout bloat for shadowing sessions.
- Accessibility of reparented rows + canvas waveforms.
- Potential fight between practice bar advance and main shadowing.
- `voiceNotesEnabled` toggle forces full remount (loses open practice selections).

**Actionable Items (7, same format as prior response)**:
1. Make "your turn" (shadow waiting phase) visible and self-explanatory (label + distinct cue styling + aria-live in dispatchShadow path). Update 跟讀 title or add legend.
2. Improve voice discoverability and onboarding (compact "🔊 Voice notes present (Serena + native)" indicator + generation hint in transcript panel or status when binding/partial detected).
3. Add visible "current voice audio source" indicator + unified stop (small pill in transport that reflects voiceHighlight / practice / cueWaves / serenaSource).
4. Mitigate toolbar + layout bloat (visually group voice controls or lightweight "focus/immersion" collapse for video chrome when shadowing or serenaSource active).
5. Accessibility pass on waveforms and dynamic states (ARIA roles/labels to practiceBar and cueWaveform containers + hosts; ensure keyboard users can reach region selection; document reparenting impact on reading flow; respect reduced-motion).
6. Expose sidecar metadata lightly in the reader (voice manifest `voice` + `generatedAt` or cue coverage count in small non-modal info area under player or in voice picker row).
7. Polish practice bar default + cue waveform interaction (confirm/make configurable whether practice bar defaults visible only for shadowing users; ensure cueWaves `playThrough`/selection integrates cleanly with main shadowing state; add one-time or per-reading subtle hint for `[ ]` / L practice hotkeys).

---

## 5. Generation, Ergonomics, Docs & Other

**Strengths**:
- Generation is a standout (robust pure helpers + CLI + incremental + real heavy usage proof in `personal/`). `pnpm gen` harness + prompts + verify gate + dry-run + incremental are ergonomic for Wedge.
- Docs outstanding (PRD-Voice-Notes with full Decision Log, STATUS audits every increment with numbers/caveats, JSDoc with "why" + concrete numbers, AGENTS.md, PACK-AUTHORING.md, inline comments, CLAUDE.md, etc.).
- Scripts clean/robust (pure orchestration vs. thin CLI + worker).
- Open-core hygiene enforced (voice manifests/assets stay in personal/ + gitignored; no leaks into public tree).

**Gaps/Opportunities**:
- Agent fill still multi-step (no single "pipeline" wrapper).
- Onboarding for voice assets is external (no in-app guidance or "generate voice notes for this reading" affordance).
- Pack data build + custom dict is functional but manual/JSON.
- No public demo voice fixture (voice surfaces can't be exercised publicly; demo-pack + transcript sample exist but voice manifests are personal-only).
- Some open questions from PRDs partially resolved in code but not all surfaced.

**Recommendations** (see also Feature section above for overlap):
- Thin `gen pipeline` wrapper or enhanced CLI + updated personal/README (pipeline ergonomics).
- In-app guidance for voice assets (see UI/UX section).
- Pack data build + custom dict ergonomics polish + vi data maturation.
- Public demo voice fixture (minimal manifest + synthetic/tiny audio under `examples/` so parse/bind/player can be exercised publicly).

---

## 6. Prioritized Consolidated Recommendations

**Cross-cutting themes from all sources**:
- Voice is the standout success (and the area with the most remaining polish opportunity for daily immersion users).
- View-layer accretion (reader + transcript + voice) is the main architectural debt.
- Duplication is localized (audio LRU/blob handling) and a natural outcome of shipping study UX quickly.
- Generation ergonomics are excellent; gaps are mostly "last mile" for onboarding and vi parity.
- Open-core + constraints are upheld rigorously (major strength).
- UI/UX is the most actionable area for an immersion user (discoverability of voice, "your turn" feedback, bloat, accessibility of waveforms, empty states).

**Top Prioritized Improvements** (consolidated, ordered by impact for an immersion/shadowing user + long-term health):
1. **UI/UX for voice** (discoverability + "your turn" feedback + source indicator + toolbar grouping + waveform accessibility + empty states + metadata surface) — immediate daily impact. (Consolidates prior 7 + new 7 items.)
2. **View-layer separation** (TranscriptMedia seam + ReadingBundle loader + extract time/transport from transcript.ts) — high long-term maintainability.
3. **Shared audio loader extraction** (`host/blobAudio.ts` or equivalent) — direct fix for the clearest duplication smell.
4. **vi voice parity + Anki per-word audio + lightweight progress dashboard** — biggest feature gaps vs. PRD + immersion needs.
5. **Onboarding + pipeline ergonomics + public demo voice fixture** — reduces friction for you and future users/contributors.
6. **Property-based tests + centralize ad-hoc CSS** — quality/maintainability quick wins.
7. **Lightweight documentation of audio surfaces + sidecar metadata in UI** — helps power users and future contributors.

**Next Steps (suggested)**:
- Review this file.
- Pick top 2–3 items and we can produce a concrete implementation plan (or plan-mode breakdown) for them.
- Draft specific diffs/prompts for the top items (e.g., "your turn" UI, shared audio loader, vi voice gen path).
- Focus on one area (detailed voice UX mocks or gen script enhancements).
- Re-run targeted subagents on a narrowed scope if desired.

All paths above are directly traceable to the sources. The project is already in excellent shape; these changes would make the voice/immersion experience feel first-class while preserving the excellent architecture and open-core boundaries.

---

*End of consolidated review. Ready for discussion or next action.*