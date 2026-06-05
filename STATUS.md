# Build status

Snapshot of what's implemented and validated. Intent lives in [`PRD.md`](./PRD.md); this tracks *reality*. Verified by `pnpm test` (368 public tests; ~416 incl. the private packs), five typecheck passes, `pnpm validate:phase0` (14 e2e checks), and `pnpm --filter @tsumugu/web build`.

## PRD §2 success-criteria coverage (audited)

| # | Criterion | Status | Where |
|---|-----------|--------|-------|
| 1 | Read + live status + pre-baked hover + grade (buttons/hotkeys) + next-unknown nav + zh tone coloring | ✅ done | `apps/web/src/reader`, `apps/web/src/packs` (browser packs: tone coloring + OpenCC + zh-TW/vi-VN TTS), `engine/*` |
| 2 | Offline dict, custom/override entries, ≥95% coverage | ✅ engine done · ⚠️ ≥95% needs a real private pack | `engine/content/hover` (custom>prebaked>dict), `store.setCustom` |
| 3 | Compounding cross-language word store, in the vault | ✅ done | `engine/store`, `web/host/fsVault` |
| 4 | Flag-for-clarification → next batch | ✅ done (word-level) | `store.flag`, `reader` `f` key, CLI `--flagged` |
| 5 | Content prep w/ pre-resolved unknowns, CI ~95%, OpenCC-guarded | ✅ done | `scripts/gen` (`prep`/`verify`), real OpenCC via example pack |
| 6 | Directed + autonomous modes | ✅ done | `gen prep --mode directed` / `gen auto` |
| 7 | Wiki + encoding pages + bridge entries | ✅ generators done · ⚠️ Quartz site is a starter; pages are agent-filled skeletons | `scripts/gen/lib/wiki`, `wiki/` |
| 8 | Pull SRS (no scheduler) + click word → encoding page | ✅ done | `engine/srs`, `web/review`, `web/encoding` (hash router) |
| 9 | Anki `.apkg` export (client-side) | ✅ done | `engine/anki` (deterministic; structural validation only) |
| 10 | Hán-Việt bridge + cross-seeding | ✅ engine+harness done · ⚠️ seed = your private Migaku export | `engine/bridge`, `gen bridge` |
| 11 | External-vocab cross-reference (Migaku→Pleco/Anki) | ✅ Migaku done; adapter interface for the rest | `engine/crossref`, `gen crossref` |
| 12 | Public engine clones + runs a demo, data-free | ✅ done | `demo-pack`, `examples/` |

**8 done, 4 with caveats that are open-core-by-design (the ≥95% dict, the published Quartz site, and the Migaku seed all live in your private layer / Repo 2, not this public repo). 0 hard gaps.**

## Open-core hygiene (audited)

No secrets/keys, no network calls in the engine or reader runtime, no licensed dictionary dumps. All deps (`ts-fsrs`, `sql.js`, `fflate`, `opencc-js`) are **Apache-2.0**. `.gitignore` blocks `/packs/private/`, `/personal/`, `/data/`, `/vocab/`, and secrets. Engine is DOM-/fs-/network-free (only the `systemClock` adapter touches `new Date`).

## What's NOT here (by design or deferred)

- **Private zh/vi packs** — **built** (in the gitignored `packs/private/`, never committed): zh-Hant = jieba-wasm seg + 122k CC-CEDICT + **official TOCFL leveling** (14.8k words, freq fallback) + pinyin→Zhuyin + OpenCC; vi = longest-match tokenizer + 39k kaikki dict + IPA + tones + Hán-Việt bridge hook. Build the data with `pnpm exec tsx packs/private/fetch-data.ts`; plug in via `--pack-module packs/private/index.ts`. **Browser-side packs** (`apps/web/src/packs`) give the reader real tone coloring / OpenCC / TTS with public algorithms + optional vault-loaded dictionary. The public repo ships only the data-free demo pack + the `examples/packs/zh-hant-example` (real OpenCC, tiny original sample).
- **Published Quartz wiki (Repo 2)** — now live at **https://logos52.github.io/tsumugu-wiki/** (repo [`Logos52/tsumugu-wiki`](https://github.com/Logos52/tsumugu-wiki), Quartz v4 → GitHub Pages, auto-deploys on push). The `wiki/` folder here is the seed content; the live repo is the source of truth.
- **Phase 6 (Chromium extension)** — **descoped** (see `DESIGN-HISTORY.md`): it conflicts with the pre-baked design and duplicates the web app + clip→prep→read pipeline.
- **Phase 7 (transcript ingestion)** — **done**: `pnpm gen transcript` parses SRT/VTT/YouTube/plain (dedup, tag-strip, timestamp sidecar) → reader content with line breaks; `prompts/transcript-commentary.md` for AI commentary on hard sections.
- **Phase 8 (voice)** — deferred per PRD §9.
- **The agent fill step** — generation prompts brief Claude Code / Grok Build; the actual gloss/explanation/etymology writing is that agent's job (no API in the core).

## Migaku reading layer + two-way sync (in progress — 2026-06-05)

Building the Migaku-style reading layer (zhuyin ruby above, colored unknown-underline, hover, click-to-grade) across reader + Netflix + YouTube, plus safe two-way Migaku sync. Design + PRD in `personal/migaku-style-overlay/`. Shipped & green (381 public + 195 private tests, typecheck):

- **M0 — s2twp guard.** `apps/web/src/packs/zhHant.ts` + `packs/private/zh-hant/index.ts` now use OpenCC `cn→twp` (Taiwan-idiom), not plain `tw` (fixes 軟件→軟體 / 信息→資訊). Asserted in `zhHant.test.ts`.
- **M1 (reader seam) — zhuyin ruby.** `settings.phonetics` (default off) renders each word as per-char `<ruby><span>字</span><rt>ㄗ</rt></ruby>` aligned to the prebaked reading (`reader.ts paintWordContent`), graceful fallback when unaligned; reader container gets `data-visual="migaku"`. Neutral-tone dot kept LEADING (matches `tones.ts` + Taiwan MoE), locked by `packs/private/zh-hant/pinyin.test.ts` (147 rows).
- **M1 CSS — Migaku visual.** `styles.css` scopes the ruby styling + per-status colored underline ramp (`#fe4670` pink / `#ff9345` orange, no fill) + filled-blue selected box under `[data-visual="migaku"]`; the default fill model is untouched. A `zhuyin` toolbar toggle flips it. *(integrated)*
- **M3 — provenance sync core.** Store bumped to `tsumugu/word-store@2` with a per-word provenance envelope (`statusUpdatedAt`/`statusSource`/`statusOrigin`/`externalRefs`); `@1` files still load. `setStatus` stamps a real status-change clock (distinct from `lastSeen`). New engine `resolveStatusUpdate` (clock-aware, `never-demote` default) replaces `applyToStore`'s binary `--overwrite` — **fixes the confirmed demote-on-reimport data-loss bug** (regression test in `crossref/resolve.test.ts` + `phase35.test.ts`).
- **M4 — YouTube synced-reader.** `apps/web/src/reader/sync.ts` (pure: `parseTimecode`, `cueIndexAtTime`, `alignCuesToTokens`) + `transcript.ts` (player/scrubber panel + rAF cue-highlight) + `youtube.ts` (sanctioned IFrame Player wrapper; falls back to a local scrubber offline). `AppState.transcript` binds cues to content; the reader mounts the panel only when a transcript is present (plain reading + tests unaffected). Highlights the playing cue in Tsumugu's OWN text — no code runs on youtube.com. Demo sample "中文 — 夜市 (synced ▶)". Tests: `sync.test.ts` (10) + `transcript.test.ts` (2). **393 public tests green.**

- **M3b — enriched Migaku importer (direct SQLite).** `scripts/gen/lib/migaku-db.ts` (`parseMigakuDb`/`readMigakuDb`) reads the real `migaku-core.db` via sql.js — skips soft-deleted rows, joins the latest `wordHistory` origin, and emits `ExternalVocabRecord[]` with the 4-tuple + `mod` + origin in `raw.*` (exactly what the M3 resolver consumes). CLI: `gen crossref --source migaku-db --in *.db` (also auto-detected by `.db`), plus a `--from-lang` relabel (Migaku stores Chinese as **`zh`**; Tsumugu uses `zh-Hant` — relabel re-tags rows while `externalRefs[].language` preserves the original code). `sql.js` added to root devDeps (engine untouched; reader stays in `scripts/`). Test `migaku-db.test.ts` (2, in-memory fixture). **Real-DB acceptance:** seeds 2108 zh words with provenance; **re-apply = "0 demotion(s) blocked", idempotent**. The direct path is richer than the lossy `converted.json` (2109 incl. 497 unknowns vs 1611 known-only).

Outstanding: real Netflix/YouTube caption ingest wiring (`gen transcript` → `.cues.json` already exists; binding a real video id + offline-pulled cues to a reader session is the remaining glue), and the optional, default-off Migaku write-back (PRD §8, Fork B2). Handoffs in `personal/migaku-style-overlay/HANDOFF*.md`. **395 public + 195 private tests green.**

## Run it

`pnpm test` · `pnpm typecheck` · `pnpm validate:phase0` · `pnpm --filter @tsumugu/web dev` (reader) · `pnpm gen help` (batch CLI).
