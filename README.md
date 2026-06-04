# Tsumugu

An open-source, **language-agnostic** engine for a Migaku-grade **graded reader** + a compounding **LLM-wiki**. The reader runs entirely **client-side** (free, offline); all LLM work is done in **batch** by your own coding agents (Claude Code / Grok Build) running scripts — **no paid API in the core loop**. The app just consumes the files the agents produce.

First two (private) language packs: **Traditional Mandarin (Taiwan)** and **Vietnamese**, with a **Hán-Việt bridge** that uses your Chinese to bootstrap Vietnamese.

> **Status:** Phases 0–5 implemented — engine + offline reader + agent-run generation CLI + wiki/bridge/cross-reference, with the OpenCC guard proven on a real `opencc-js` pack. See [`STATUS.md`](./STATUS.md) for the audited coverage. Read [`PRD.md`](./PRD.md) (the source of truth) and [`AGENTS.md`](./AGENTS.md) (build guide) first.

## Structure — two public repos + one private folder

- **engine** (this repo, public, Apache-2.0) — core logic, pack interface, demo pack, agent generation scripts, docs. Language-agnostic, **no bundled dictionary data, no personal data, no keys**.
- **wiki** (separate public repo) — a Karpathy-style **llm-wiki** published via **Quartz** (offline-HTML viewable), fed by Obsidian Web Clipper → Inbox → agent clean → Wiki.
- **personal** (private local folder) — the zh/vi language packs, dictionaries, vocab/word-store, status, flags, custom entries. Kept local for organization (and to avoid redistributing licensed dictionary data), not secrecy.

## Principles

- **Client-side, offline, $0 marginal cost.** Generation is batch, run by your agent.
- **Pluggable language packs** — segmenter, dictionary, phonetics, leveling, optional bridge.
- **LingQ-style 1–4 / Known / Ignore grading + Migaku-style hover popup**; pre-baked definitions for instant offline hover.
- **Built-in pull SRS** (no scheduler / no nagging) **+ Anki export**.
- All Traditional-Chinese LLM output passes through **OpenCC** (Simplified→Traditional).

## License

[Apache-2.0](./LICENSE). Copyright 2026 Wedge.
