# Tsumugu — Design History

A dated record of the design's evolution, kept for **provenance** (open / prior-art posture — see PRD §0; not pursuing a patent, putting the idea on the public record).

## 2026-06-03 — Origin → PRD v11

- **Origin:** a journal idea — "an AI reader for Traditional Mandarin: graded reader × LLM-wiki," aligned with an immersion-based practice.
- **Worked up** (with Claude, in Cowork) into **Tsumugu**: an open-source, language-agnostic graded-reader + LLM-wiki engine.
- **Naming history:** 中文Craft / CH-Craft → FoldCraft → **Tsumugu** (紡ぐ, "to weave/spin [words]").
- **Core design decisions** (full rationale in PRD §0):
  - One engine + pluggable language packs + a shared cross-language word store.
  - **Pure client-side; no paid API** — LLM generation runs in batch via Claude Code / Grok Build; the app consumes the files.
  - **1–4 / Known / Ignore grading + hover popup**; pre-baked definitions for instant offline hover.
  - **Built-in pull SRS** (`ts-fsrs`, no scheduler) **+ Anki export**; click an SRS word → an AI **encoding-layer** page (etymology, mnemonics, associations).
  - **Hán-Việt bridge** (AI-generated as-you-go) to learn Vietnamese *through* Chinese; cross-seeding from a known-word export from your SRS.
  - **Wiki = Karpathy-style llm-wiki published via Quartz** (public, offline-HTML), fed by Obsidian Web Clipper → Inbox → agent clean → Wiki.
  - **Structure:** two public repos (engine, wiki) + one private folder (personal). Apache-2.0.
- **Comprehensible-input target:** default Extensive ~95% known (Intensive ~80% available).

## 2026-06-04 — Phases 0–5 built; Phase 6 (extension) descoped

- **Built + validated:** the engine, the offline reader (web app), the agent-run generation CLI, the wiki/bridge/cross-reference layers, the live Quartz wiki ([tsumugu-wiki](https://github.com/Logos52/tsumugu-wiki)), and the real private zh-Hant + vi packs (CC-CEDICT + official TOCFL leveling + jieba; kaikki vi). Browser-side language packs give the reader tone coloring + OpenCC + TTS.
- **Decision — drop Phase 6 (the Chromium extension).** Its only unique value is reading arbitrary *live* pages in place, which conflicts with Tsumugu's batch/**pre-baked** design: a live page has no pre-generated explanations, so an overlay degrades to a plain hover popup dictionary — exactly what the browser packs already provide *inside* the web app. The "read this page" case is already served by Web Clipper → Inbox → `gen prep` → reader, which *adds* the pre-baked layer an extension can't. We keep at most a future trivial "clip selection → Inbox" button; we do not build the full overlay.
- **Next:** Phase 7 (transcript ingestion + AI commentary, text-first); Phase 8 (voice) stays deferred (§9).

This file is the public, timestamped record of authorship for the Tsumugu concept and design.
