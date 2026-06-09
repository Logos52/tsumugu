<p align="center">
  <img src="../logo.svg" alt="Tsumugu logo" width="120">
</p>

# Tsumugu documentation

Tsumugu is an open-source, language-agnostic engine for a **graded reader** plus a compounding **LLM-wiki**. The reader runs entirely client-side — free and offline. All language-model work happens in **batch**, run by your own coding agent (Claude Code / Grok Build); the app only consumes the files that work produces. There is no paid API in the core loop. The first two language packs are Traditional Mandarin (Taiwan) and Vietnamese, joined by a **Hán-Việt bridge** that uses your Chinese to bootstrap Vietnamese.

## Reading order

Read these in sequence the first time; after that, jump straight to what you need.

| # | Guide | What it answers |
|---|-------|-----------------|
| 1 | [Overview — what & why](./01-overview.md) | What Tsumugu is, the problems it solves, the principles, who it's for. **Start here.** |
| 2 | [Core concepts](./02-concepts.md) | The vocabulary you need: word-status model, comprehensible input, pre-baking, batch generation, packs, the bridge, open-core layering. |
| 3 | [Architecture — the parts](./03-architecture.md) | The repos, the engine, packs, the web app, the generation CLI, the wiki, the voice stack — and the open-core boundary that holds them apart. |
| 4 | [The loop — how it comes together](./04-the-loop.md) | The end-to-end flow: source → prep → fill → verify → read → grade → flag → wiki / SRS / Anki, and the cycle back. |
| 5 | [Feature tour](./05-features.md) | A walk through everything the reader and toolchain actually do today. |
| 6 | [Extending Tsumugu](./06-extending.md) | For builders: authoring a language pack, the generation CLI as a toolkit, the ports model, conventions, and the hard rules. |

## How this set relates to the other docs

Tsumugu already carries several documents. They each have a distinct job; this guide sits alongside them.

- **[`PRD.md`](../PRD.md)** — the source of truth for *intent*: goals, scope, success criteria, decisions. When intent and these guides disagree, the PRD wins.
- **[`STATUS.md`](../STATUS.md)** — the audited record of *reality*: what is built and validated, in chronological detail. When you want "is X actually done?", read STATUS.
- **[`AGENTS.md`](../AGENTS.md)** — the build guide for coding agents, with the phases as runnable workflows.
- **[`DECISIONS.md`](../DECISIONS.md)** — how each open question was resolved, with the defaults on the record.
- **[`DESIGN-HISTORY.md`](../DESIGN-HISTORY.md)** — the dated provenance of the design (open / prior-art posture).
- **[`PACK-AUTHORING.md`](../PACK-AUTHORING.md)** — the pack-interface reference; [Extending Tsumugu](./06-extending.md) is the fuller walkthrough.
- **[wiki `ARCHITECTURE.md`](https://github.com/Logos52/tsumugu-wiki)** — the directory schema for the published Quartz wiki (lives in the separate wiki repo).

## The shortest possible summary

You feed Tsumugu real foreign text. Your agent pre-resolves every word you don't yet know — gloss, reading, a leveled explanation, examples — and bakes it into a content file. The reader opens that file offline, colors every word by how well you know it, and shows the baked explanation on hover with no network call. You grade words as you read; words you flag feed the next batch run. The words worth keeping become durable, cross-linked wiki pages and spaced-repetition cards. One language can bootstrap another. Nothing in the reading loop costs money or needs a connection.
