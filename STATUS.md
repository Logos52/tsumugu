# Build status

Snapshot of what's implemented and validated. Intent lives in [`PRD.md`](./PRD.md); this tracks *reality*. Verified by `pnpm test` (356 public tests; 404 incl. the private packs), five typecheck passes, `pnpm validate:phase0` (14 e2e checks), and `pnpm --filter @tsumugu/web build`.

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
- **Phase 6–8** — Chromium extension, transcript ingestion, voice (deferred per PRD §9).
- **The agent fill step** — generation prompts brief Claude Code / Grok Build; the actual gloss/explanation/etymology writing is that agent's job (no API in the core).

## Run it

`pnpm test` · `pnpm typecheck` · `pnpm validate:phase0` · `pnpm --filter @tsumugu/web dev` (reader) · `pnpm gen help` (batch CLI).
