# Build decisions & open-question resolutions

This file records the **default decisions** taken while building the engine, including how each **PRD §12 open question** was resolved. Defaults are reversible — flag any you want changed.

## Stack & layout

- **Monorepo** via pnpm workspaces. `packages/engine` (public, data-free core), `packages/demo-pack` (generic demo pack), `apps/web` (reader), `scripts/` (agent-run batch generation), `examples/` (Phase 0 proof).
- **TypeScript, ESM, strict** (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`, project references). Vitest for tests, Vite for the web app, `tsx` for node scripts.
- **Engine is DOM-free, network-free, data-free.** All platform IO goes through *ports* (`VaultIO`, `BinaryIO`, `AudioPort`, `Clock`); hosts supply implementations (web app = File System Access + Web Speech; node = fs; tests = memory). This is what keeps "no API in the core" and "open-core hygiene" enforceable.
- **Engine deps:** `ts-fsrs` (SRS), `sql.js` + `fflate` (Anki `.apkg`). No dictionary data, no keys.

## PRD §12 open questions — default resolutions

1. **In-app cache vs vault JSON; FS Access UX; MV3.** → Word store is the vault JSON (source of truth) loaded via `VaultIO`; the web app may keep an in-memory/IndexedDB cache for speed but the JSON is canonical. FS Access folder grant is per session (re-grant on load). Extension (MV3) deferred to Phase 6.
2. **vi segmentation.** → Client JS longest-match tokenizer for v1 (per PRD). Pluggable `segmenter` lets a local CKIP/underthesea service drop in later. No service stood up now.
3. **Custom dictionary entries.** → A `custom?: Partial<DictEntry>` layer on each word-store entry; **custom > prepared-glossary > packaged dict** precedence (implemented in `mergeHover`). Stored in the vault store, edited by the user.
4. **Bridge confidence + correction.** → `BridgeInfo.confidence` (0–1); low-confidence surfaces for correction; `corrected:true` only after the user confirms. Cached in a `BridgeRegistry` JSON. Wiktionary Hán-Việt reconciliation deferred (optional).
5. **Wiki templates + locations.** → Templates locked in `scripts/gen/prompts/{wiki-page,encoding-page}.md`; shapes shown in `examples/wiki/`. Pages live in the wiki vault; Web Clipper → `Inbox/` → agent clean → promote on confirm. Fade/evolve deferred (Wedge's design).
6. **SRS algorithm + state location.** → **FSRS via `ts-fsrs`** (per PRD §7), pull-based, no scheduler. State lives in the vault word store as `WordEntry.srs` (`SrsState`).
7. **Generation agent + invocation.** → Agent-agnostic prompts in `scripts/gen/prompts/`; a Node CLI (`pnpm gen`, Phase 2) orchestrates. Default agent **Claude Code**; Grok Build interchangeable. Invocation = manual CLI for v1 (no watched folder).
8. **Voice.** → Web Speech API (free) via `AudioPort`. Grok TTS evaluation deferred (PRD §9).
9. **Branch coherence (`front-pages-projects`).** → Out of scope for this repo (that's the vault/knowledge-base, not the engine). Noted, not actioned here.
10. **Wiki site repo + Quartz config.** → Separate public repo (Repo 2), zh+vi combined for now, splittable later. Repo/site name + Quartz config to be set up in Phase 3. Not created yet.

## Open-core hygiene

The public engine repo ships **only** the generic demo pack + interfaces + scripts + docs — no licensed dictionary data, no personal vocab, no keys (`.gitignore` blocks `/packs/private/`, `/personal/`, `/data/`, secrets). zh/vi packs + dictionaries + the word store live in the user's private folder.
