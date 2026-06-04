# CLAUDE.md

This repo is the **Tsumugu engine** — public, Apache-2.0, language-agnostic, **client-side**, **no paid API** (LLM work is batch, run by you).

- **Source of truth:** [`PRD.md`](./PRD.md).
- **Build guide + phases-as-workflows:** [`AGENTS.md`](./AGENTS.md).
- **Hard rules:** client-side only; no API in the core (batch generation writes files the app consumes); OpenCC guard on all zh-Hant output; engine stays data-free (no dictionaries / personal data / keys); SRS is pull-based (no scheduler); local-file writes only on explicit confirm.

Start at PRD §11 Phase 0 → 1. Surface PRD §12 open questions rather than guessing.
