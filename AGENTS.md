# AGENTS.md — Tsumugu build guide

**Read [`PRD.md`](./PRD.md) first — it is the source of truth.** This file orients coding agents (Claude Code, Grok Build) and lists the build phases as runnable workflows.

## What you're building

A client-side, offline graded reader + compounding LLM-wiki engine. Real foreign text is segmented, every word colored by how well the user knows it (LingQ-style 1–4 / Known / Ignore), hover shows a definition + pre-baked AI explanation, and unknown words/idioms become durable wiki pages. The engine is language-agnostic; languages are pluggable packs. First packs: Traditional Mandarin (zh-Hant) + Vietnamese (vi), with a Hán-Việt bridge.

## Hard constraints — do not violate

- **Pure client-side.** Chromium extension + web app. No backend/server in the core.
- **No paid LLM API in the core.** LLM generation = **batch** scripts that the user runs via their own agent (you: Claude Code / Grok Build). Scripts read inputs + the word store and **write files** (prepared content, wiki/encoding pages, bridge entries); the app only consumes those files. Unknown words are **pre-resolved at generation time** so the reader's hover is instant + offline.
- **OpenCC guard:** all zh-Hant generated output passes through Simplified→Traditional normalization.
- **Open-core hygiene:** this engine repo is language-agnostic and **data-free** — no dictionaries, no personal vocab, no API keys. Packs + dictionaries + the word store live in the user's **private folder**; the wiki is a **separate public Quartz repo**.
- **Vault/local-file writes happen only on the user's explicit confirm.**
- **No scheduler/notifications** — SRS is pull-based (serve due words only when the user opens review).

## Architecture (see PRD §6)

Engine (this repo) → pluggable **language packs** (segmenter, dictionaryProvider, phoneticLayer, levelingModel, scriptNormalizer, ttsVoice, optional bridge) → cross-language store + Hán-Việt bridge → user's private personal layer. App↔local files via the **File System Access API**; word store lives in the user's vault (syncs across machines).

## Phases — runnable workflows (see PRD §11)

0. **Prove the loop by hand** — one zh + one vi source; hand-run a generation script.
1. **Engine + reader + both packs** — pluggable segmentation (jieba-wasm zh / JS tokenizer vi), packaged dicts + custom layer, word store (File System Access), coloring, hover (pre-baked), grading + hotkeys, guess-first, **built-in pull SRS (`ts-fsrs`)**, **Anki export**. Offline, $0.
2. **Generation scripts** — batch content prep (CI ~95%, pre-baked unknowns, OpenCC), directed + autonomous, verification re-score.
3. **Wiki + encoding-layer pages + Web Clipper intake** — Inbox → clean/tag/commentary → Wiki; click an SRS word → its AI encoding page; publish via Quartz.
4. **Hán-Việt bridge + cross-seeding** — AI-generated as-you-go, cached, seeded from the Migaku known-Mandarin export.
5. **External-vocab cross-reference** — import + reconcile Migaku/Pleco/Anki.
6. **Browser extension** — shared engine overlay (Chromium).
7. **Transcripts + AI commentary** (text-first).
8. **Voice** — per PRD §9 (Grok to evaluate).

Each phase: **plan → approve → build → review.**

## Stack hints

`ts-fsrs` (SRS), `jieba-wasm` / jieba-tw (zh seg), `opencc-js` (S→T), File System Access API (local files), Quartz (wiki publishing), genanki-style `.apkg` / AnkiConnect (Anki), Web Speech API (free TTS). Vietnamese segmentation: client JS tokenizer for v1, optional local CKIP/underthesea service later.

## Open questions

See **PRD §12** — surface these as you hit them; don't guess silently.
