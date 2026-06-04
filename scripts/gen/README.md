# Batch generation (agent-run) — `scripts/gen`

Tsumugu has **no live API in the core**. All LLM work runs in **batch**, executed by *your own* coding agent (Claude Code / Grok Build) using the prompts in [`prompts/`](./prompts/). This CLI is the **deterministic harness** around that: it does the parts that don't need a model (segment, identify unknowns, score CI, OpenCC-guard, validate, write files) and hands the model a filled-in prompt + a content skeleton to complete.

```
source ─▶ gen prep ─▶ (agent fills glosses/explanations via prompts/content-prep.md)
                       ─▶ gen verify (CI re-score + OpenCC guard, deterministic)
                       ─▶ PreparedContent in Inbox/ ─▶ reader (on your confirm)
```

## Why a CLI if the model does the writing?

The CLI keeps the **machine-checkable** work out of the model's hands, so generation is cheap and reliable:

| Step | Who | How |
|------|-----|-----|
| Segment the source | CLI | `pack.segmenter()` |
| Find unknown words | CLI | diff tokens against the word store |
| Draft a `PreparedContent` skeleton (tokens + empty glossary slots for unknowns) | CLI | engine types |
| Fill glosses / readings / leveled explanations / bridge | **agent** | `prompts/content-prep.md` |
| OpenCC Simplified→Traditional guard (zh) | CLI | `pack.scriptNormalizer()` |
| CI coverage re-score | CLI | `scoreCI()` |
| Validate the final file | CLI | `parsePreparedContent()` |

## Commands

```bash
# Phase 2 — reader content
pnpm gen prep     --lang zh-Hant --in <source.txt> --store <ws.json> [--target 0.95] [--mode directed --words 夜市,小吃]
pnpm gen verify   --in <prepared.json> --store <ws.json> [--lang zh-Hant] [--fix]   # OpenCC + CI re-score
pnpm gen auto     --lang vi --store <ws.json> [--limit 8]                            # autonomous: gaps + due

# Phase 3 — wiki + encoding pages
pnpm gen wiki     --lang zh-Hant --store <ws.json> [--words a,b | --flagged | --srs] [--out-dir wiki/Inbox]
pnpm gen encoding --lang zh-Hant --store <ws.json> [--words a,b | --flagged | --srs] [--out-dir wiki/Inbox]

# Phase 4 — Hán-Việt bridge (brief, then cache + cross-seed)
pnpm gen bridge   --lang vi --store <ws.json> [--bridge-lang zh-Hant] [--words a,b]
pnpm gen bridge   --cache <results.json> --registry bridge/vi-bridge.json --lang vi --store <ws.json>

# Phase 5 — external vocab cross-reference
pnpm gen crossref --source migaku --in <export.json> --lang zh-Hant --store <ws.json> [--apply] [--overwrite] [--out ws.json]
```

- Any command takes `--pack <id>` / `--pack-module <path.ts>` to load a `LanguagePack`. The public repo ships only the **demo** pack; the **example** zh-Hant pack (`examples/packs/zh-hant-example/index.ts`) demonstrates the real OpenCC guard + segmentation; your full private zh/vi packs register via `--pack-module` (see `PACK-AUTHORING.md`).
- `--agent claude|grok` selects the generation-runtime hint; the CLI emits the right prompt. Default `claude`.
- `verify` exits non-zero when content is not ready (missing glosses, or Simplified found without `--fix`) — usable in the autonomous loop.
- Outputs land in `Inbox/<lang>/` and only move into the reader/wiki on **your confirm**.

> The CLI's deterministic steps are fully testable with the demo pack; the agent step is where your subscription (not a metered API) does the language work.
