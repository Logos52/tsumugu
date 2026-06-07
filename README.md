<p align="center">
  <img src="logo.svg" alt="Tsumugu logo" width="150">
</p>

# Tsumugu

An open-source, **language-agnostic** engine for a **graded reader** + a compounding **LLM-wiki**. The reader runs entirely **client-side** (free, offline); all LLM work is done in **batch** by your own coding agents (Claude Code / Grok Build) running scripts — **no paid API in the core loop**. The app just consumes the files the agents produce.

First two (private) language packs: **Traditional Mandarin (Taiwan)** and **Vietnamese**, with a **Hán-Việt bridge** that uses your Chinese to bootstrap Vietnamese.

> **Status:** Phases 0–7 implemented — engine + offline reader + agent-run generation CLI + wiki/bridge/cross-reference + transcript ingestion with a synced reader. **Phase 8 (voice): M1 shipped** — local batch TTS, cue-synced playback, shadowing mode, and Anki-with-audio; see [`PRD-Voice-Notes.md`](./PRD-Voice-Notes.md). We're also building a **metalayer** — an asbplayer-style watching layer over local + streaming video ([see below](#metalayer--the-watching-layer-building)). See [`STATUS.md`](./STATUS.md) for the audited coverage. Read [`PRD.md`](./PRD.md) (the source of truth) and [`AGENTS.md`](./AGENTS.md) (build guide) first.

## Structure — two public repos + one private folder

- **engine** (this repo, public, Apache-2.0) — core logic, pack interface, demo pack, agent generation scripts, docs. Language-agnostic, **no bundled dictionary data, no personal data, no keys**.
- **wiki** (separate public repo) — a Karpathy-style **llm-wiki** published via **Quartz** (offline-HTML viewable), fed by Obsidian Web Clipper → Inbox → agent clean → Wiki.
- **personal** (private local folder) — the zh/vi language packs, dictionaries, vocab/word-store, status, flags, custom entries. Kept local for organization (and to avoid redistributing licensed dictionary data), not secrecy.

## Principles

- **Client-side, offline, $0 marginal cost.** Generation is batch, run by your agent.
- **Pluggable language packs** — segmenter, dictionary, phonetics, leveling, optional bridge.
- **1–4 / Known / Ignore grading + hover popup**; pre-baked definitions for instant offline hover.
- **Built-in pull SRS** (no scheduler / no nagging) **+ Anki export**.
- All Traditional-Chinese LLM output passes through **OpenCC** (Simplified→Traditional).
- **Voice notes (M1)** — per-sentence audio pre-baked in batch by a **local open-source TTS engine** (reference setup: Qwen3-TTS, Apache-2.0, via `mlx-audio` on Apple Silicon). The reader plays cue-synced audio with a shadowing/chorusing mode; Web Speech stays as the fallback. Same rules as everything else: $0, offline after generation, no cloud TTS APIs.

## Metalayer — the watching layer (building)

Alongside the reader, we're building a **metalayer**: a lightweight tool that makes *watching* easier, in the spirit of [asbplayer](https://github.com/killergerbah/asbplayer). It rides on top of video — local files and streaming (YouTube, Netflix) — and carries Tsumugu's word-layer with it: synced subtitles, instant hover lookups in your own known/unknown colors, sentence-level looping and replay, per-line audio, and one-tap mining into the built-in SRS and Anki (with audio). The synced transcript reader (Phase 7) is the seed; the metalayer grows it from "a reader with a synced player" into the reader's intelligence laid over any video you watch. The layer runs client-side at $0; your vocabulary, lookups, and SRS stay local.

## License

[Apache-2.0](./LICENSE). Copyright 2026 Wedge.
