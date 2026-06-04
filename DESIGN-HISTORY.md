# Tsumugu — Design History

A dated record of the design's evolution, kept for **provenance** (open / prior-art posture — see PRD §0; not pursuing a patent, putting the idea on the public record).

## 2026-06-03 — Origin → PRD v11

- **Origin:** a journal idea — "an AI reader for Traditional Mandarin: graded reader × LLM-wiki," aligned with a Refold immersion practice.
- **Worked up** (with Claude, in Cowork) into **Tsumugu**: an open-source, language-agnostic graded-reader + LLM-wiki engine.
- **Naming history:** 中文Craft / CH-Craft → FoldCraft → **Tsumugu** (紡ぐ, "to weave/spin [words]").
- **Core design decisions** (full rationale in PRD §0):
  - One engine + pluggable language packs + a shared cross-language word store.
  - **Pure client-side; no paid API** — LLM generation runs in batch via Claude Code / Grok Build; the app consumes the files.
  - **LingQ-style 1–4 / Known / Ignore grading + Migaku-style hover popup**; pre-baked definitions for instant offline hover.
  - **Built-in pull SRS** (`ts-fsrs`, no scheduler) **+ Anki export**; click an SRS word → an AI **encoding-layer** page (etymology, mnemonics, associations).
  - **Hán-Việt bridge** (AI-generated as-you-go) to learn Vietnamese *through* Chinese; cross-seeding from a Migaku known-word export.
  - **Wiki = Karpathy-style llm-wiki published via Quartz** (public, offline-HTML), fed by Obsidian Web Clipper → Inbox → agent clean → Wiki.
  - **Structure:** two public repos (engine, wiki) + one private folder (personal). Apache-2.0.
- **Comprehensible-input target:** default Extensive ~95% known (Intensive ~80% available).

This file is the public, timestamped record of authorship for the Tsumugu concept and design.
