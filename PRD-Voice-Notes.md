# PRD — Tsumugu Voice Notes

**Local open-source batch TTS for per-sentence (cue-level) audio on transcripts and video, enabling high-quality listen + read + shadowing/chorusing.**

**Status:** Draft v2 (amended 2026-06-06 — generation path replaced, see Decision Log)
**Date:** 2026-06 (v1 interview draft → v2 amendment 2026-06-06)
**Related:** Tsumugu main PRD §9 (Phase 8 Voice), Phase 7 transcripts, M4 synced reader, `personal/research/zh-tts-options.md` (engine research), `personal/archive/PRD-Voice-Notes-v1-supergrok-archived-2026-06-06.md` (superseded v1)
**Owner:** Wedge (primary user/learner)
**Generation constraint (user requirement, v2):** All voice note creation runs **locally on the Apple Silicon Mac via open-source TTS engines** — batch, scriptable, $0. **No cloud or paid TTS APIs** (xAI, ElevenLabs, DashScope, etc.) in any script, helper, or the reader app. Engine choice is **gated by a listening bake-off** (see §11 M0). Apache-2.0/MIT engines preferred; NC-licensed weights must never produce assets that leave the private layer.

---

## Decision Log

**2026-06-06 — M1 built + QA'd; generation-side slow dropped for a reader-side 0.85× toggle; Serena confirmed.**
The M1 helper + reader module shipped and the full `why-friendship-differs` batch (1,010 cues, Serena, **RTF 0.81**) was ear-checked. Two QA outcomes revised the design from the entry below. (1) **The instruct-driven slow take overcorrected.** Every phrasing tried — `語速放慢、咬字清晰`, `語速放慢`, even `語速稍慢` ("slightly slow") — stretched cues unpredictably (1.4–2×; e.g. cue 647 3.9s → 7.7s) and read unnaturally. So **generation-side slow variants are dropped**, and slow becomes a single uniform **reader-side pitch-corrected `playbackRate` 0.85×** (mechanism 2 below), chosen by ear over 0.75×. The `--slow` flag and the worker's `instruct` path stay in the code (off by default) in case a future engine/phrasing produces a genuinely natural slow take. (2) **Serena's naturalness holds for study.** An early "sultry"/over-performed take on cue 386 was stochastic (temperature 0.9), not the voice; Serena stays the default. Polyphone 得=ㄉㄟˇ verified by ear on cue 73.

**2026-06-06 — Slow-speech option added; natural speed stays the default.**
Wedge: "default to Qwen's natural speaking voice… but it's nice to have a slower option — I will definitely use the slower option sometimes, especially for long sentences." Design: two composing mechanisms. (1) **Generation-side slow variants** — the helper can render an instruct-driven slow take (`語速放慢、咬字清晰`-style; exact phrasing is a build-time experiment) for chosen cues (`--slow` on all / length threshold / specific indices), stored as `cue-NNNN.slow.mp3` and referenced by an optional `audioSlow` manifest field. Naturally articulated slow speech beats time-stretching for learning. (2) **Reader slow toggle** — plays `audioSlow` when present, otherwise falls back to pitch-corrected `playbackRate` ≈0.75×, so every cue has *some* slow path at zero generation cost. Origin case: cue-0647 was too fast to verify 進行=xíng by ear.

**2026-06-06 — Validation batch PASSED; 1.7B bf16 locked, quantized fallbacks unnecessary.**
23 real cues on the M3/18GB: **36.9s generation for 47.9s of audio (RTF 0.77 — faster than realtime)**, avg 1.6s/cue (0.6–3.2s), projecting the full 1,010-cue transcript at **≈27 minutes** — the batch philosophy got cheap; "overnight" worst-case planning is obsolete. Ear checks: cue-0073 他們得=děi ✅, cue-0386 natural 啊 ✅, cue-0647 進行 — speech rate too fast for Wedge to verify xíng cleanly (not heard as wrong; logged as pass-with-note — the M2.1 loop bar at 0.75× is the built-in verification tool for exactly this). First real `voice-notes.json` manifest produced at `bakeoff/validation/`. Consequence: M1 success criteria for speed and polyphone QA are met; production helper builds on 1.7B-CustomVoice-bf16 unchanged.

**2026-06-06 — Feature added: segment-loop practice bar (Audacity-style) on voice notes.**
Origin: Wedge feature request mid-validation — a waveform bar under each cue's audio where a drag-selected region loops on **L**, for drilling segments during shadowing practice (Audacity workflow, brought in-app and in-context). Decisions: appears on **every voice-note cue** (on demand), built as the **first M2 item** right after core playback; implemented with **wavesurfer.js v7 + regions plugin** (BSD-3-Clause, reader/host layer only — engine stays dep-free) per the reuse-over-custom rule, with hand-rolled canvas recorded as the rejected alternative (no failure reason against wavesurfer; license-purity cosmetics insufficient). Known tradeoff accepted: stock region-loop has a ~30ms seam but gives pitch-corrected `playbackRate` slowdown for free; a gapless `AudioBufferSourceNode` path at 1× is the documented upgrade if the seam annoys in practice. STATUS.md's "all deps Apache-2.0" line softens to "all permissive" when the dep lands.

**2026-06-06 — M0 bake-off result: Qwen3-TTS adopted. Voice: Serena.**
Wedge rendered the test sentences locally on the M3 (1.7B CustomVoice bf16 via mlx-audio, `bakeoff/qwen3_render.py`) after the hosted demos proved flaky, and judged the output "quite good" with a clear preference for this option; **Serena** (sentence 1 render) was the standout. Basis: direct listening preference — the M0 gate existed to satisfy the user's ear, and it did. Caveats recorded honestly: the BreezyVoice side-by-side was not completed before the call was made, and the 得=děi polyphone spot-check on S1 is pending confirmation. Consequences: MVP builds on Qwen3-TTS 1.7B-CustomVoice (bf16 confirmed running on M3/18GB) with Serena as the default voice; BreezyVoice stays the Taiwan-register/zhuyin fallback; GPT-SoVITS stays the M3-phase accent track. Voice remains a swappable knob (clone/VoiceDesign later) — engine choice is what's now locked.

**2026-06-06 — Supergrok generation path ruled out; replaced by local OSS engines.**
v1 of this PRD mandated interactive generation in the Supergrok heavy-subscription voice/chat UI (manually saving clips, no API). Following the TTS landscape research (`personal/research/zh-tts-options.md`), Wedge decided to **replace that path entirely**. Reasoning: (a) open-source Mandarin TTS reached commercial-grade naturalness in Dec 2025–Jan 2026 (Qwen3-TTS, CosyVoice 3), removing the quality argument for Grok; (b) manual clip-saving across hundreds of cues was v1's own top-listed risk — a batch CLI eliminates it; (c) local batch generation matches Tsumugu's pre-baked/$0/offline philosophy *better* than a subscription UI; (d) consistent voice across cues and re-runs is trivial with a fixed clone prompt or fine-tuned voice, and painful in a chat UI. The v1 doc is archived, not deleted — the interactive steer-a-line-reading idea may be worth resurrecting someday as an expressive special-case.

**2026-06-06 — Candidate engines: Qwen3-TTS and GPT-SoVITS v2ProPlus; bake-off decides.**
Both impressed in research; neither is committed yet. The PRD stays engine-agnostic behind a thin adapter seam, and M0 (bake-off on real cues) picks the MVP engine. The loser doesn't vanish — it remains the named alternative track (see §11 M3).

**Context held from v1 (unchanged decisions):** separate `voice-notes.json` manifest (not `.cues.json` augmentation); thin optional voice module, inert without assets; Web Speech stays as fallback; per-word hover audio untouched by MVP; Anki export with embedded audio is high priority.

---

## 1. Executive Summary

Tsumugu already supports excellent text-first transcript ingestion (`gen transcript`) that produces `.prepared.json` + `.prepared.cues.json` sidecars. These cues give per-sentence text + timestamps that power the synced reader (visual cue highlighting, optional YouTube IFrame, local scrubber, theater/document/subtitle layouts).

This PRD adds **high-quality per-sentence voice notes generated in batch by a local open-source TTS engine** running on Wedge's Apple Silicon Mac. A `gen voice-notes` helper reads the existing cue structure, synthesizes one MP3 per cue with a consistent voice, and writes a manifest the reader consumes — so the reader can play the voiced sentence in sync with the text highlight and video.

Primary use case: immersion through simultaneous listen + read, plus deliberate **shadowing / chorusing** practice (hear the high-quality voice → immediately repeat the sentence while reading the highlighted text → advance).

The feature is delivered as a **thin, optional voice module** (inert when no assets are present). It respects all core Tsumugu invariants: client-side $0 offline core after generation, batch/pre-baked philosophy, no paid APIs anywhere, open-core hygiene, and no regression on existing per-word hover audio or visual cue sync.

**Candidate engines (bake-off gated, see §7 and §11 M0):**

- **Qwen3-TTS** (Apache-2.0, Jan 2026) — 0.6B/1.7B; top-tier Mandarin naturalness; 3-second zero-shot voice cloning with reusable clone prompts; runs on Apple Silicon via `mlx-audio` with `mlx-community` quantized checkpoints. Lowest-friction start: no training session.
- **GPT-SoVITS v2ProPlus** (MIT) — few-shot voice fine-tune (~1 min of target speaker) yields a permanent, consistent voice with the accent baked in; inference ≈2× realtime on M4 **CPU**; first-class macOS support; the strongest Taiwan-accent path of any general engine.

---

## 2. Problem & Motivation

Wedge (intermediate+ zh-TW / beginner vi learner using immersion-based workflows) already relies heavily on voice for immersion while reading. The current Tsumugu baseline (Web Speech API per-word in the hover popup via `AudioPort` + pack `ttsVoice`) is convenient and fully offline, but the quality is insufficient for natural prosody, tones, Taiwan register, and effective shadowing practice.

Existing transcript support gives clean per-sentence cues (text + timing). The user wants to attach **high-quality synthesized audio** to those exact sentences so they can:

- Listen and read the same sentence simultaneously (with visual highlight + optional video scrub).
- Practice chorusing/shadowing at high fidelity: hear an excellent voice → immediately repeat the sentence out loud while the text is highlighted → advance.

Key user constraints (explicit, v2):

- **$0 forever**: open-source engines, local inference, no paid or cloud TTS APIs anywhere.
- **Apple Silicon Mac only** — no CUDA box, no cloud GPU. Overnight batch is acceptable; per-clip manual work is not.
- **Naturalness first** (Wedge, 2026-06-06: mainland accent acceptable — "not much difference between the Chinese spoken language. i want something that sounds natural"). Noted tension: for *shadowing specifically*, the accent you hear is the accent you train; the GPT-SoVITS Taiwan-accent track (§11 M3) exists to resolve this if it starts to matter.
- Assets are ordinary local files saved in the vault/personal layer (gitignored).
- Must integrate cleanly with existing transcript/video readings for listen + read + shadowing.

This realizes the deferred items in the main PRD §9 (TTS quality for zh-TW + vi, shadowing UX, read-aloud on real content) while staying inside Tsumugu's batch/pre-baked, offline, no-paid-API model.

---

## 3. Goals & Success Criteria

### Primary Goals (MVP that delivers the desired immersion)

1. For any transcript or video reading the user has already ingested, a single batch command produces local high-quality MP3s (one per cue/sentence) **on the Mac, unattended** — no per-clip manual steps.
2. When opening that reading in the Tsumugu reader:
   - The voice note for any sentence can be played in sync with the existing visual cue highlight and (when present) the video playback/scrubber.
   - A "Shadowing / Chorusing" mode supports the exact workflow: play the voice note for the current sentence → text is highlighted → user repeats the sentence out loud while reading → manual advance (Space or button).
3. Everything is 100% offline and client-side — generation included (models run locally; weights downloaded once).
4. Web Speech remains a seamless fallback for any cue that lacks a pre-generated voice note (no regression on current per-word hover audio).
5. **The same voice across every cue, every batch, every re-run** — via a persisted clone prompt (Qwen3-TTS) or a fine-tuned voice (GPT-SoVITS).

### Secondary Goals (high priority, carried from v1)

- Anki export with embedded voice notes (for SRS shadowing practice on due lines/words).
- **Segment-loop practice bar** (added 2026-06-06): expandable waveform under any voice-note cue; drag-select a region, **L** toggles looping it, with pitch-corrected speed control — Audacity-style segment drilling without leaving the reader.
- "Read + explain" on a cue (play the voice note for the sentence, then surface/speak the pre-baked explanation for key words in that cue).
- Voice notes for the `tr` (translation) field and/or commentary notes, not just raw cue text.
- Support for multiple voices per reading (different voices for different speakers in a dialogue/podcast).

### Measurable Success Criteria

- **M0:** bake-off completed on ≥5 real cues from an ingested transcript (incl. one polyphone trap and one zh-en code-switch line); winner recorded in the Decision Log with reasoning.
- **MVP:** user runs `gen voice-notes` on a real ingested transcript (e.g. `why-friendship-differs`), the batch completes locally (overnight acceptable), and the reader immediately supports high-quality listen + read + manual shadowing/chorusing from the produced files.
- A 20-cue validation batch completes on the Mac at a measured, documented speed before any full-transcript run (speed claims verified, not assumed).
- Polyphone spot-check: sampled cue audio agrees with the stored `PrebakedEntry` readings for trap words (了/著/得/行-class); mismatches documented with a workaround.
- Feature is a thin optional module (inert or off-by-default when no voice assets are present for a reading).
- No regressions on existing text-first transcripts, visual cue sync (`alignCuesToTokens`, highlighting, transport), per-word hover audio, or offline guarantees.
- All audio assets and voice references live only in the private vault/personal layer (gitignored).

**Non-goals for this PRD (deferred or out of scope)**

- Any cloud or paid TTS API usage anywhere (xAI, DashScope, ElevenLabs, edge-tts included — the latter is free but online + ToS-gray).
- Live TTS calls from inside the reader app (generation is batch, outside the app).
- Automatic STT or scoring of the user's shadowing.
- Replacing the existing per-word Web Speech hover audio (it stays as the lightweight always-available baseline; pre-baked word audio is a separate later decision — see §12).
- Engine fine-tuning beyond the optional GPT-SoVITS voice-training session (no dataset building, no model training pipelines in Tsumugu).

---

## 4. Current State

**What already exists and will be leveraged (no big refactors required):**

- Transcript ingestion (`scripts/gen/lib/transcript.ts`, `buildTranscriptSkeleton`): produces `PreparedContent` + `cues: TranscriptCue[]`.
- `TranscriptCue` (in `apps/web/src/reader/sync.ts`): `{ text, start, end, tr? }`. `TranscriptDoc` also carries optional `videoId` and `sections`.
- Reader synced transcript UI (`apps/web/src/reader/{sync.ts, transcript.ts, reader.ts, main.ts}`): cue-to-token alignment, visual highlighting, transport (Space, etc.), optional YouTube IFrame + local scrubber, theater/document/subtitle layouts, "Open reading…" picker + vault restore, `showTranslation` toggle. All data comes from local `.prepared.json` + `.cues.json` sidecar.
- Audio abstraction (`packages/engine/src/ports.ts` `AudioPort`, `TtsVoiceSpec`; `apps/web/src/host/webAudio.ts`; `AppState.speak` in `state.ts`; usage in `reader.ts` hover popup): currently only per-word via pack `ttsVoice` (zh-TW / vi-VN). Pluggable, degrades gracefully to no-op.
- Pre-baked philosophy + constraints: everything the reader consumes is generated in batch by the user's agents and lives in the vault. Open-core hygiene (`/personal/`, `/packs/private/` gitignored).
- Anki exporter (text-only today, `packages/engine/src/anki/exporter.ts`).
- Settings/toolbar pattern (phonetics, toneColoring, guessFirst, transcriptLayout, showTranslation — all persisted, live-updating where possible).
- **Per-word zhuyin readings in `PrebakedEntry`** — usable as ground truth for polyphone QA on generated audio.
- Engine research: `personal/research/zh-tts-options.md` (2026-06-06) — full landscape, licenses, Mac viability, bake-off protocol.

**Gaps this PRD fills:**

- No mechanism to attach or play high-quality per-sentence local audio files.
- No dedicated shadowing/chorusing UI on the transcript panel.
- No batch generation helper (`gen voice-notes`) or engine adapter.
- No support for the prioritized secondary features (Anki audio, read+explain on cues, voice for `tr`/commentary, multi-voice).

---

## 5. Proposed Solution

**High-level architecture:**

- Generation is a **local batch CLI step** (`gen voice-notes`), parallel in spirit to `gen transcript` / `gen prep`: read `.cues.json` → synthesize per-cue audio via the chosen engine → write `audio/<slug>/cue-NNNN.mp3` + `voice-notes.json` manifest → validate (every cue has a file, durations sane).
- A **thin engine adapter seam** (mirroring the language-pack philosophy): the helper shells out to / imports the engine behind a small interface (`synthesize(text, voiceRef) → wav/mp3`). MVP implements exactly one adapter — the bake-off winner. The seam exists so the M3 accent track or a future engine swap doesn't touch the pipeline.
- **Voice consistency by construction:** the voice reference (clone prompt audio + transcript, or fine-tuned model ID) is a checked-in-to-personal artifact (`personal/voices/<name>/`), reused across every run.
- Assets are referenced via a lightweight sidecar/manifest (additive, backward-compatible — unchanged from v1).
- The reader gains a thin "voice notes" consumption layer that plays the local files in sync with the existing cue system (visual highlight + video scrubber) — **unchanged from v1**.
- A "Shadowing Mode" makes the listen → repeat → advance loop first-class — **unchanged from v1**.
- Web Speech fallback is always available — **unchanged from v1**.
- The whole thing is packaged as a **thin optional voice module** (inert when no assets or feature disabled).

This directly extends the existing transcript + synced reader machinery without changing the text-first or pre-baked contract.

---

## 6. Data & Sidecar Model

*(Unchanged from v1, with one addition: `engine` joins `voice` in the optional per-note metadata.)*

**Decision:** separate parallel manifest (`<slug>.voice-notes.json` or `voice.json`) next to the existing `.cues.json`.

**Rationale (clean separation of concerns):**

- `.cues.json` stays focused on timing + raw text + optional `tr`.
- Voice assets are a separate concern (can evolve independently, e.g., different voices, re-generations, full-passage variants).
- Easier to keep backward compatibility (old readers / non-voice users simply ignore the new sidecar).
- Simpler migration story if we ever want a combined schema later.

**Proposed manifest shape (simple & explicit):**

```json
{
  "schema": "tsumugu/voice-notes@1",
  "lang": "zh-Hant",
  "slug": "why-friendship-differs",
  "engine": "qwen3-tts-1.7b-base@mlx",
  "voice": "personal/voices/tw-warm-female",
  "notes": [
    {
      "cueIndex": 0,
      "audio": "audio/why-friendship-differs/cue-0000.mp3"
    }
  ]
}
```

- `audio` paths are relative to the vault root (or the reading's directory) — the host resolves them via File System Access.
- One entry per cue (matching the order in `.cues.json`).
- Optional per-note `audioSlow` — an instruct-rendered slow take of the same cue (`cue-NNNN.slow.mp3`); the reader's slow toggle prefers it and falls back to pitch-corrected `playbackRate` when absent.
- Top-level `engine` + `voice` record provenance for re-generation; optional per-note overrides (`voice`, `speed`, `notes`) support multi-voice and commentary later.

The main `.prepared.json` / `PreparedContent` is **not** modified for audio refs (keep it focused on glossary + tokens). Audio is purely a transcript/cue concern for this feature.

---

## 7. Generation Workflow (Local OSS Batch — replaces v1's Supergrok workflow)

**Core principle:** generation is one scriptable batch step the user (or an agent) runs on the Mac. No manual per-clip work, no network beyond the one-time model download.

**Step 0 — Bake-off (M0, once).** Per the protocol in `personal/research/zh-tts-options.md` §9: 5 real cues (polyphone trap + code-switch line included) rendered on the hosted demos of both candidates — Qwen3-TTS ([official Space](https://huggingface.co/spaces/Qwen/Qwen3-TTS), CustomVoice presets + a Taiwan-clip clone on Base) and GPT-SoVITS (space or quick local run) — blind-ranked for naturalness and shadow-worthiness. Winner recorded in the Decision Log. Zero install for this step.

**Step 1 — Ingest the source normally** (unchanged):

```
pnpm gen transcript --video <id> --lang zh-Hant --pack-module packs/private/index.ts \
  --out personal/inbox/<slug>.prepared.json
```

**Step 2 — Prepare the voice reference (once per voice):**

- *Qwen3-TTS path:* place a 3–10s reference clip + its transcript in `personal/voices/<name>/` (a Taiwan-accented clip if TW register is wanted; rights note — real-person clips are for private study only, never published). The helper builds and caches the reusable clone prompt (`create_voice_clone_prompt`) so hundreds of cues don't re-extract features. Alternative: a CustomVoice preset (Serena/Vivian-class) with no reference at all; or VoiceDesign-then-clone for a designed persona.
- *GPT-SoVITS path:* one-time fine-tune session (~1–5 min of target speaker audio through its WebUI) producing a voice checkpoint stored under `personal/voices/<name>/`. Higher one-time cost, permanent accent-faithful voice.

**Step 3 — Batch generate:**

```
pnpm gen voice-notes --in personal/inbox/<slug>.prepared.cues.json \
  --engine <winner> --voice personal/voices/<name> \
  --out personal/inbox/audio/<slug>/
```

The helper: iterates cues → synthesizes (engine adapter) → encodes MP3 (`cue-0000.mp3`, …) → writes `voice-notes.json` → validates (file per cue, durations > 0, no truncations) → reports a summary (time per cue, total). Re-runs are incremental (skip existing files unless `--force`).

**Step 4 — Validate on a slice first.** First run on any new engine/voice uses `--limit 20`: confirms measured speed on the Mac and lets the user ear-check polyphones against stored `PrebakedEntry` readings before committing to a full transcript.

**Step 5 — Open the reading.** The reader detects the manifest and lights up voice transport + Shadowing Mode (see §8).

**Engine notes (from research, to verify in M0/MVP):**

- *Qwen3-TTS on Mac:* via `mlx-audio` + `mlx-community` quantized checkpoints (1.7B bf16/4-bit; 0.6B-4bit as the light option). Official `qwen-tts` package is CUDA-oriented — the MLX path is the Mac path. Batch API + reusable clone prompts are first-class in the upstream API.
- *GPT-SoVITS on Mac:* officially supported; upstream benchmark: v2ProPlus RTF ≈0.53 on M4 CPU (~2× realtime). Inference scriptable via its API server or CLI.
- *Polyphone QA:* neither engine takes inline phonetic overrides. QA samples against `PrebakedEntry` zhuyin; stubborn misreadings get a carrier-phrase re-render or a documented exception. (BreezyVoice's inline-zhuyin path remains the research-noted fallback tool for pathological cases and the future word-audio question.)
- *zh-Hant input:* feed cue text as-is first (both engines accept Traditional); if a model stumbles on variant chars, OpenCC-convert the *TTS input only* — display text stays zh-Hant. Watch the known `了解/瞭解` normalization class.

**Multi-voice / translations / commentary:** same pipeline with per-note `voice` overrides in the manifest (different reference/checkpoint per speaker role). Post-MVP.

---

## 8. Reader UX & Integration

*(Unchanged from v1 — the consumption side is engine-agnostic by design.)*

**Leverage existing machinery (minimal new code):**

- When a reading is loaded with a `voice-notes.json` (or equivalent), the transcript controller knows about cue audio refs.
- In the existing transcript panel (the one with scrubber, transport, cue highlighting, optional YouTube IFrame):
  - New (or enhanced) audio transport controls: "Play current cue voice note", "Play from here (full passage)", "Stop", and a **slow toggle** (plays the cue's `audioSlow` variant when present, else pitch-corrected `playbackRate` ≈0.75×; persisted setting).
  - "Shadowing / Chorusing Mode" (toggle or dedicated button/hotkey):
    - Plays the voice note for the current cue.
    - Highlights the sentence (existing mechanism).
    - Fully manual advance: after the note finishes, the highlight stays on; user hits **Space** (or a dedicated "Next" button) when they have finished repeating.
    - Visual cue during user's turn: the highlight remains (or a subtle "Your turn" indicator can be added later).
  - Normal "Listen + Read" playback: audio drives the existing cue highlight + video scrubber timing.
  - Optional "Read + explain on this sentence": play the voice note, then surface the pre-baked explanation(s) for words in the cue (reuses existing hover/ResolvedHover logic).

**Audio playback implementation notes (host layer):**

- Extend or wrap `AudioPort` / add a cue-aware audio player in the web host.
- Local MP3 playback via File System Access (read as blob → `<audio>` element or AudioContext). This is already how other binary assets (Anki) are handled in spirit.
- Sync with existing time source (YouTube player or local scrubber) and cue highlighting.
- Web Speech fallback for any cue without an `audio` ref (or when the file is missing).

**Settings (follow existing pattern):**

- `voiceNotesEnabled`, `voiceNotesSpeed`, `shadowingPauseHint` (if we add light auto hints later), preferred voice for multi-voice cases, etc.
- Persisted + toolbar discoverable, like phonetics / transcript layout.

**Segment-loop practice bar (M2.1 — first post-MVP item):**

- Each cue with a voice note can expand an inline waveform bar (collapsed by default; click/hotkey to open on the active cue).
- Drag on the waveform selects a region (resize handles on both edges); **L** toggles loop on the selection; **[ / ]** nudge the nearest edge; selecting nothing + L loops the whole cue. Hotkeys must be checked against existing reader bindings (1–4, f, Space) at build time.
- Speed control (e.g. 1× / 0.85× / 0.75×) using media-element `playbackRate` — pitch-corrected natively by the browser.
- Implementation: **wavesurfer.js v7 + regions plugin** (BSD-3-Clause) in the web host layer, fed by the same File System Access blob as normal playback. Engine untouched. Accepted tradeoff: ~30ms loop seam (media-element seek); documented upgrade path to gapless `AudioBufferSourceNode` (`loopStart`/`loopEnd`) at 1× if drilling reveals the seam as an irritant.
- Loop state is per-session; no persistence of regions in MVP (open question below).

**Anki integration (high priority):**

- Extend the existing client-side Anki exporter to include voice note files as media when present.
- Notes can contain the spoken sentence (with `[sound:cue-XXXX.mp3]`) for SRS shadowing practice.

The feature is **inert** for plain (non-transcript) readings or readings without voice assets. Existing per-word hover audio is untouched.

---

## 9. Constraints & Guardrails

- **Generation:** strictly local, strictly open-source engines. Apache-2.0/MIT engines (and weights) preferred; engines with NC-licensed weights may be experimented with privately but must never produce assets that ship beyond the private layer (public wiki included). No cloud/paid TTS APIs anywhere — including "free but online" services (edge-tts class).
- **Runtime:** 100% client-side, offline, local files only. No network in the reader for voice playback.
- **Philosophy:** pre-baked / batch. Voice notes are generated assets the app consumes (like explanations and cues). No live TTS inside the app.
- **Hygiene:** all audio assets, manifests, voice references, and model checkpoints live in the user's private vault/personal layer (gitignored) or outside the repo entirely. The public engine repo gains no model weights, no audio, no new runtime deps for generation (the helper's engine deps stay in `scripts/` / external envs).
- **Voice cloning ethics:** reference clips of real people (podcast hosts, tutors) are for private study only; cloned-voice audio of a real person is never published without permission.
- **No regression:** existing per-word hover audio, visual cue sync, text-first transcripts, and pre-baked hover content must continue to work identically.
- **Thin optional:** the module adds no hard dependency. It is disabled or a no-op when no voice assets are present.

---

## 10. Risks & Mitigations

- **Engine maturity (Qwen3-TTS):** model is from Jan 2026; the MLX port is younger than the CUDA path. *Mitigation:* M0 bake-off + 20-cue validation batch before adoption; pin engine + port versions in the helper.
- ~~**Speed reality on the Mac**~~ → **Measured 2026-06-06: RTF 0.77** (see Decision Log). Risk retired.
- **Polyphone misreadings:** neither candidate takes inline phonetic input. *Mitigation:* QA against stored `PrebakedEntry` zhuyin on the validation slice; carrier-phrase re-renders for stubborn words; BreezyVoice noted as the inline-zhuyin fallback tool.
- **Accent drift in shadowing:** mainland-accented engine output trains a mainland accent. *Mitigation:* documented tension (§2); GPT-SoVITS TW fine-tune track (§11 M3) is the planned resolution if it matters in practice; Taiwan-clip cloning on Qwen3-Base is the cheap interim.
- **License drift:** weights licenses have changed before (Spark-TTS went Apache → NC). *Mitigation:* record engine + weights version and license in the manifest `engine` field; re-check on upgrades.
- **File management / drift:** manifest + helper validation; consistent `cue-XXXX.mp3` naming; incremental re-runs.
- **Storage growth:** user-controlled (only generate for readings you actually want to shadow). Local vault remains the single source of truth.
- **One-time SoVITS training friction (if it wins):** dataset prep + WebUI session has a learning curve. *Mitigation:* it's once per voice; gated behind the bake-off actually choosing it.
- **Scope creep into live features:** explicitly out of scope; any interactive "explain this line" stays a later, heavily gated thin optional path.

---

## 11. Phasing & MVP Definition

**M0 — Bake-off — ✅ DONE 2026-06-06.** Winner: **Qwen3-TTS 1.7B CustomVoice (mlx-audio), voice Serena** — see Decision Log. Run locally via `personal/research/bakeoff/qwen3_render.py` after hosted demos flaked.

**M1 — MVP (delivers the core immersion value):**

- `gen voice-notes` helper with the winning engine's adapter (batch, incremental, validating, measured).
- Voice reference convention under `personal/voices/` (clone prompt or checkpoint).
- `voice-notes.json` manifest convention with per-cue `audio` refs + `engine`/`voice` provenance.
- Reader support for playing per-cue local MP3s in sync with existing visual cues + video.
- "Shadowing / Chorusing Mode" with fully manual advance (Space / button).
- Web Speech fallback.
- Basic documentation + a real generated transcript end-to-end (e.g. `why-friendship-differs`).
- Anki export with embedded voice notes (high priority).

**M2 — Post-MVP (still in the thin module):**

- **M2.1 (first): segment-loop practice bar** — waveform + drag-region + L-loop + speed, per §8. Committed 2026-06-06.
- "Read + explain" on cues.
- Voice notes for `tr` / commentary.
- Multi-voice support per reading (per-note `voice` overrides).
- Per-note speed controls; transport polish; "your turn" indicator; global voice-notes speed in settings.

**M3 — Accent / engine track (optional, evidence-driven):**

- If shadowing accent starts to matter: GPT-SoVITS Taiwan-voice fine-tune (or swap the Qwen3 clone prompt to a better TW reference) — the engine adapter seam makes this a voice/adapter swap, not a pipeline change.
- Revisit per-word pre-baked hover audio (separate decision; research §6 suggests on-encounter baking via Kokoro v1.1-zh or the same Tier-1 voice — and possibly BreezyVoice for zhuyin-exact word renders).

---

## 12. Open Questions

- ~~**Which voice?**~~ → **Resolved 2026-06-06: Serena** (CustomVoice preset). Cloning (Eileen / TW clip) and VoiceDesign remain later knobs, not blockers.
- ~~**Qwen3 sizing:**~~ → **Resolved 2026-06-06: 1.7B bf16, measured RTF 0.77 on the M3** (23-cue validation; full transcript ≈27 min). Quantized variants shelved — no speed problem to solve.
- **MP3 vs WAV/AAC, bitrate:** MP3 assumed for size + `[sound:]` Anki compatibility; confirm encoder choice in the helper (ffmpeg dependency acceptable?).
- **Where generation deps live:** Python env for the engine (mlx-audio / GPT-SoVITS) is outside the pnpm workspace — document a `personal/voices/README` setup, or a small uv/conda env spec under `scripts/gen/voice/`?
- **Vietnamese:** neither candidate lists vi among supported languages. The vi voice-notes story needs its own mini-research pass (research doc notes F5-TTS vi community finetunes as a lead) — explicitly deferred.
- **Long-form passages:** stitching per-cue audio (ffmpeg concat with pauses) is the assumed approach (stays cue-aligned); confirm whether a "Play from here" full-passage mode needs pre-stitched files or can chain per-cue playback in the reader.
- **Loop-region persistence:** should a drilled region survive reload (e.g. stored per cue in the vault) or stay ephemeral? Decide after real practice use in M2.1.

---

Next steps: run M0 (bake-off), record the decision here, then break M1 into an implementation plan (files to touch, order of work, tests) for Grok Build / Claude Code.
