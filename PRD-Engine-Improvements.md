---
title: "PRD — Tsumugu Engine & Codebase Improvements: view-layer separation, generation-pipeline ergonomics, agent- and language-agnostic hardening"
type: prd
status: draft
created: 2026-06-10
updated: 2026-06-10
revision: v1
license: Apache-2.0
basis:
  - "Fresh code analysis (2026-06-10): line counts, module inventory, git log, grep verification"
  - "[[Tsumugu-Improvement-Review]] (2026-06) — consolidated review; claims spot-checked, several extended"
  - "[[PRD]] §2/§5.9/§6 — the unmet criteria this PRD closes"
links:
  - "[[PRD]]"
  - "[[STATUS]]"
  - "[[Tsumugu-Improvement-Review]]"
  - "[[PRD-Voice-Notes]]"
tags: [prd, tsumugu, engine, refactor, agent-agnostic, language-agnostic, improvement]
---

# PRD — Tsumugu Engine & Codebase Improvements

**A consolidation-and-hardening PRD for the Tsumugu codebase. The engine core is healthy (3,943 lines, ports-clean, DOM-/fs-/network-free, 731 tests); the debt is concentrated in three places the fresh analysis confirms and quantifies: (1) the web view layer (`transcript.ts` 1,018 lines, `reader.ts` 915, `main.ts` 809) where voice features accreted; (2) the generation CLI (`scripts/gen/cli.ts` at 1,737 lines — a god object the prior review missed); (3) the voice module family (~15 files repeating the same LRU/blob/fallback pattern). On top of the structural work, this PRD closes the PRD §5.9 gap (no learner-progress surface exists), brings Vietnamese to parity where it lags (voice, leveling), and hardens the two adjectives in the project's own description — *agent-agnostic* and *language-agnostic* — into tested contracts rather than conventions.**

> **Relationship to the Improvement Review.** `Tsumugu-Improvement-Review.md` is the findings document; this is the *commitment* document — problem → checkable exits → phases. Review claims were re-verified against the 2026-06-10 tree; deltas are noted inline (the codebase moved since the review: dictionary D0/D1 landed, `encodingAudio.ts`/`exampleAudio.ts` joined the duplication family, `cli.ts` grew past 1,700 lines).

---

## 0. Decision log

- **✅ Refactor-in-place, no rewrite.** The engine's ports/pack architecture is correct and battle-tested. All work here is extraction and seam-introduction inside the existing monorepo; no new packages unless a phase exit demands it.
- **✅ Hard constraints inherited unchanged:** client-side offline core, $0 marginal cost, batch-not-realtime, no paid API in the core loop, engine stays DOM-/fs-/network-/data-free, open-core hygiene, pull-only SRS, vault writes on confirm.
- **✅ Behavior-preserving phases ship behind green tests.** Every extraction phase exits with the *same* test suite green plus new tests for the extracted seam. No phase couples a refactor with a feature.
- **✅ "Agent-agnostic" becomes a contract, not a habit.** Prompts in `scripts/gen/prompts/` are already plain markdown any agent can execute; this PRD adds a written fill-contract (input files, expected output schema, verify gate) per prompt so Claude Code / Grok Build / any future agent are interchangeable by spec.
- **✅ "Language-agnostic" is audited via the vi pack.** zh-Hant is the proving pack; vi is the *honesty check*. Where a feature silently assumes zh (band ladders, voice, zhuyin ruby), the interface gets a language-neutral seam and vi gets either parity or an explicit, typed "unsupported" path.
- **✅ The progress dashboard is in scope** (PRD §2 criterion list / §5.9 — explicit, never built). Read-only, computed from the store + history, client-side.
- **🚫 Ruled out: framework adoption** (React/Svelte/etc. for the web app). The vanilla-TS + happy-dom approach is working and keeps the bundle small; the problem is seams, not the absence of a framework.
- **🚫 Ruled out: splitting the monorepo** or extracting the engine to its own repo now. Re-evaluate only if the public dictionary's GO decision (sibling PRD) creates a second consumer.

---

## 1. Problem

Three structural debts, measured on the 2026-06-10 tree:

1. **View-layer god objects.** `apps/web/src/reader/transcript.ts` (1,018 lines) owns the frame loop, five-plus transport controls, shadowing integration, practice-bar follow, cue reparenting, and precedence rules; `reader.ts` (915) and `main.ts` (809) carry similar accretion. `main.ts` repeats a near-identical discover-sidecar pattern (slugBase + lastSlash + try/catch→null) for voice notes, tracks, word audio, and section audio with no single `ReadingBundle` type. Every new audio flavor touches the same three files — the review predicted this, and the two modules added *since* the review (`encodingAudio.ts`, `exampleAudio.ts`) confirmed it.
2. **The generation CLI is now the largest file in the repo.** `scripts/gen/cli.ts` is 1,737 lines holding ~18 `cmd*` functions plus arg parsing, preflight, and report printing. The pure logic lives correctly in `scripts/gen/lib/*` (well-tested), but the command shell itself is monolithic: adding a subcommand means editing a 1,700-line switch. The prior review did not flag this; it has since grown past the threshold where it slows the project's own velocity.
3. **The audio-host duplication family grew.** Seven modules (`player.ts`, `wordAudio.ts`, `sectionAudio.ts`, `encodingAudio.ts`, `exampleAudio.ts`, `practiceBar.ts`, `cueWaveforms.ts`) repeat the LRU/blob/Uint8Array/race-token/`new Audio()`/Web-Speech-fallback/destroy pattern. `VaultIO.readBytes` is still documented "optional" (`ports.ts`) while being load-bearing for every one of them plus Anki media.

Plus three capability gaps against the project's own PRD and self-description:

4. **No learner-progress surface** (PRD §5.9): known-word growth, comprehension trend, promotions, reading volume, active-target coverage — the store has the data; nothing renders it.
5. **Vietnamese lags the "language-agnostic" claim**: no vi voice path (Qwen3-TTS supports zh/en; vi needs a separate engine — PRD-Voice-Notes open item), frequency-only leveling with no band ladder, weaker dictionary data, and zh-specific assumptions (zhuyin ruby, tone coloring) handled by convention rather than typed capability flags.
6. **Onboarding assumes the author.** A new user (or future contributor) cannot exercise the voice surfaces publicly (no demo voice fixture), and the multi-step agent fill (prep → fill → verify → voice-notes → word-audio → section-audio) has no single pipeline entry point.

---

## 2. Goals & success criteria (concrete, checkable)

**Structural:**

1. **`transcript.ts` ≤ ~450 lines; no view module over 600.** The time-source/transport/highlight state machine extracts to a tested, DOM-light module; voice players are passed in as one `AudioBindings` object, not 10–15 props. *Check: line counts; `mountTranscriptSync` signature takes ≤ 4 params; full suite green.*
2. **One `loadReadingBundle()`** returns content + cues + all sidecar bindings; used by both the file-picker and dev-vault paths; the four `discover*` helpers in `main.ts` collapse into it. *Check: a single discovery test covers all sidecars; `main.ts` shrinks ≥ 150 lines.*
3. **One shared audio host.** `host/blobAudio.ts` (LRU + blob/object-URL + race token + destroy + Web-Speech fallback hook) backs all seven audio modules; each module keeps only its selection/binding logic. *Check: grep finds one `new Audio(` site outside tests; LRU eviction tested once, centrally.*
4. **`readBytes` promoted to required** on `VaultIO` (or split `BinaryVaultIO` adopted everywhere binary IO occurs), docs updated. *Check: no `readBytes?` optional-chaining at call sites.*
5. **`cli.ts` ≤ ~300 lines** — a thin dispatcher; each subcommand moves to `scripts/gen/commands/<name>.ts` with its own arg spec. *Check: adding a no-op subcommand touches only a new file + a one-line registry entry.*

**Capability:**

6. **Progress view (PRD §5.9), read-only, per language**: known-growth curve, words promoted per week, reading volume, due count, active-target coverage; computed client-side from the vault store + history; zero new network. *Check: renders offline from a fixture store; numbers reconcile with `wordStore` counts in a test.*
7. **Anki exports can embed word audio** (cue audio already ships): word-deck builder reads `word-audio` manifests; absent audio degrades to text-only cards, byte-identical to today. *Check: exporter media test extended; empty case unchanged.*
8. **vi voice parity decision executed**: an open VI TTS is evaluated (bake-off mirroring `personal/research/zh-tts-options.md`) and either (a) `gen voice-notes --pack vi` works end-to-end on one real vi text, or (b) a documented NO-GO with the blocking reason lands in PRD-Voice-Notes. *Check: bake-off notes + either a real vi run or the recorded decision.*
9. **Language-capability flags typed**: `LanguagePack` exposes capabilities (e.g. `phoneticRuby`, `toneColoring`, `bandLadder`, `voice`) so hosts stop inferring zh-ness. (Audit note 2026-06-10: the view layer already avoids hard `=== "zh-Hant"` checks — the zh-ness is implicit in which toggles/render paths exist at all.) vi returns honest values; the demo pack exercises the all-off path. *Check: zh-specific toggles (zhuyin ruby, tone coloring) appear only when the pack declares the capability; a demo-pack test asserts the all-off reader renders no zh chrome.*
10. **Agent fill contract per prompt**: each file in `scripts/gen/prompts/` gains a frontmatter contract (inputs, output schema id, verify command); `AGENTS.md` references the contract table; one `gen pipeline --in <source>` wrapper sequences prep → fill-brief → verify (printing the exact agent hand-off at the fill step). *Check: a dry pipeline run on the example pack prints every step; contracts list schema ids that exist in `content/schema.ts`.*
11. **Public demo voice fixture**: a tiny synthetic manifest + silent/beep mp3s under `examples/` so parse/bind/player paths run publicly. *Check: a public test exercises `voice/manifest.ts` → player against the fixture; no personal data.*

**Hygiene:**

12. Property-based tests (fast-check) for `shadowing` reducer and `practiceBarLogic`; ad-hoc CSS class names in `cueWaveforms.ts` routed through `ui/classes.ts`; worktree branches (`.claude/worktrees/reader-content-loader`, `migaku-import`) reconciled or deleted. *Check: fast-check in devDeps, two property suites; `git worktree list` clean after Wedge's call on each branch.*

---

## 3. Scope

### In scope
- View-layer extractions: `AudioBindings`/`TranscriptMedia` seam, transport/time-source state machine, `ReadingBundle` loader.
- `host/blobAudio.ts` extraction; `readBytes` promotion.
- `scripts/gen` command split + `gen pipeline` wrapper + per-prompt fill contracts.
- Progress view; Anki word-audio; demo voice fixture; capability flags; vi voice bake-off + decision.
- Test/CSS/worktree hygiene items above.

### Out of scope
- Any new study feature beyond the progress view (encoding/dictionary work → sibling PRDs).
- Wiki and reader *UX* changes (→ [[PRD-Wiki-Reader-UX]]); this PRD only creates seams UX work will sit on.
- Engine repo split, framework adoption, mobile, server backend, Chromium extension (stays descoped).
- vi monolingual dictionary (→ [[PRD-Private-Dictionary-v2]] notes the deferral).

---

## 4. Users & use cases

**Primary: Wedge** — daily immersion user *and* sole maintainer; every god-object line is a tax on his iteration speed. Secondary: future contributors to the public engine; any agent (Claude Code / Grok Build / other) executing the fill contracts; learners cloning the public repo who should be able to see the voice surfaces work via the demo fixture.

1. **Ship the next audio flavor** by writing one selection module + registering a binding — without touching `transcript.ts`.
2. **Run one command** (`gen pipeline`) on a clipped page and get told exactly what the agent must fill and how it will be verified.
3. **Open Progress** and see whether the month of GSM lessons moved the known-word curve.
4. **Swap agents** mid-project because the prompt contract, not the agent, defines the work.
5. **Clone the public repo** and hear the demo reading speak (fixture), proving the voice path without private assets.

---

## 5. Design sketches (the load-bearing ones only)

### 5.1 `AudioBindings` seam
One object groups what `main.ts` currently discovers piecemeal and `transcript.ts` receives as loose props:

```ts
// apps/web/src/reader/media.ts (new)
export interface AudioBindings {
  voiceNotes?: VoiceBinding;       // per-cue
  wordAudio?: WordAudioBinding;    // per-word
  sectionAudio?: SectionAudioBinding;
  tracks?: TrackSet;               // multi-voice
}
export interface ReadingBundle {
  content: PreparedContent;
  transcript?: TranscriptDoc;
  audio: AudioBindings;            // all optional, all inert when absent
}
export async function loadReadingBundle(vault: VaultIO, slug: string): Promise<ReadingBundle>;
```

`mountTranscriptSync(host, bundle, callbacks)` replaces today's long parameter surface. Pure pieces (`manifest.ts` parse, `selectPlayback`) stay put.

### 5.2 `host/blobAudio.ts`
One class: `BlobAudioHost(vault, { lru = 10 })` → `play(path, { rate, onEnd, fallbackText })`, `stop()`, `destroy()`. Wavesurfer users (`practiceBar`, `cueWaveforms`, `sentenceWaveform`) share only the URL-cache piece via `getObjectUrl(path)`. Fallback to Web Speech is a constructor hook so each module keeps its own fallback text policy.

### 5.3 `scripts/gen/commands/` split
`cli.ts` becomes parse + registry + dispatch. Each `commands/<name>.ts` exports `{ name, help, flags, run }`. `gen pipeline` is itself just a command that sequences others and prints the agent hand-off block between machine steps — no new orchestration runtime, no watched folders (DECISIONS.md §7 stands).

### 5.4 Capability flags
```ts
// packages/engine/src/pack.ts — additive
export interface PackCapabilities {
  phoneticRuby?: boolean;   // zh zhuyin
  toneColoring?: boolean;
  bandLadder?: string;      // e.g. "TOCFL-1..7"; undefined = freq-only
  voice?: "supported" | "fallback-only";
}
```
Hosts branch on capabilities; the demo pack returns all-off and thereby *tests* the language-agnostic claim continuously.

---

## 6. Risks & mitigations

| Risk | Sev | Mitigation |
|------|-----|------------|
| Refactor churn breaks the daily-use reader | High | Behavior-preserving phases; full suite + the manual click-through checklist (STATUS) per phase; no refactor+feature mixing |
| `transcript.ts` extraction stalls (deeply entangled frame loop) | Med | Extract in dependency order: bindings object first (mechanical), then time-source/transport machine; allow an intermediate state where the machine lives beside, not under, transcript |
| vi TTS bake-off finds no acceptable open engine | Med | That *is* an acceptable exit (criterion 8b); record it; Web Speech remains the vi fallback |
| CLI split breaks muscle-memory invocations | Low | Dispatcher preserves every existing subcommand name + flag; `gen help` regression-tested |
| Capability flags fossilize wrong abstractions | Low | Flags mirror only behaviors that already exist in two packs; no speculative entries |
| Progress view tempts scope creep (charts, goals, streaks) | Med | v1 = numbers + one sparkline per metric, read-only; anything interactive is out |

---

## 7. Plan (phased; each exits green)

| Phase | Deliverable | Exit |
|---|---|---|
| **E0 — Worktree + hygiene sweep** | Reconcile/delete the two `.claude/worktrees`; CSS classes centralized; fast-check property suites | `git worktree list` clean (Wedge decides each); suite green |
| **E1 — Audio host extraction** | `host/blobAudio.ts`; seven modules migrated; `readBytes` promoted | one `new Audio(` site; criteria 3–4 |
| **E2 — ReadingBundle + AudioBindings** | `loadReadingBundle`; `mountTranscriptSync(bundle)`; `main.ts` shrinks | criteria 1–2 |
| **E3 — Transport state machine** | time-source/precedence/highlight machine extracted + property-tested | `transcript.ts` ≤ ~450; precedence rules tested in isolation |
| **E4 — CLI split + pipeline + contracts** | `scripts/gen/commands/*`; `gen pipeline`; prompt frontmatter contracts; AGENTS.md table | criteria 5, 10 |
| **E5 — Capability flags + demo voice fixture** | `PackCapabilities`; reader consults flags; public fixture + tests | criteria 9, 11 |
| **E6 — Progress view** | `#/progress` per-language metrics from store+history | criterion 6 |
| **E7 — Anki word audio + vi voice decision** | word-deck media; vi TTS bake-off → run or recorded NO-GO | criteria 7–8 |

Sequencing rationale: E1–E3 are ordered by mechanical-first (lowest risk earns trust for the entangled extraction); E4 is independent and can interleave; E6–E7 land on clean seams instead of adding to the debt.

---

## 8. Open questions

1. **Worktree branches** — keep, merge, or delete `reader-content-loader` and `migaku-import`? (Needs Wedge per branch; E0 blocks on it.)
2. **Progress history source** — derive trends from `statusUpdatedAt` provenance only, or start an append-only `history.jsonl` in the vault? (Provenance-only is v1-simplest; history file is more honest for "volume read".)
3. **vi TTS candidates** — shortlist for the bake-off (open-weights, vi-capable, Apache/MIT-class licenses); same harness as `personal/research/bakeoff`.
4. **`gen pipeline` default agent block format** — plain printed brief (today's pattern) vs a `--brief-out file.md` the agent is pointed at?
5. **Does `samples.ts` (478 lines of inline demo content) move to `examples/` data files?** Cosmetic, but it's the 5th-largest web file.
