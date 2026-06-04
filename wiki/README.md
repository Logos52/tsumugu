# Tsumugu wiki (Repo 2 starter)

> **Live:** https://logos52.github.io/tsumugu-wiki/ — repo [`Logos52/tsumugu-wiki`](https://github.com/Logos52/tsumugu-wiki) (Quartz v4 → GitHub Pages, auto-deploys on push). That repo is the source of truth; this folder is the seed content it was created from.

The Karpathy-style **LLM-wiki** for your languages, published via **Quartz** to a public GitHub-Pages site that's also **openable offline as HTML** (PRD §5.5). Extracted into a **separate public repo**, sibling to your `llm-knowledge-base` — it reuses that same Obsidian → Quartz → Pages toolchain, not a rebuild.

## The loop

```
Obsidian Web Clipper ─┐
pnpm gen wiki/encoding ─┴─▶ Inbox/ ─▶ agent clean/tag/commentary ─▶ content/ (on your confirm)
                                                                      └─▶ Quartz build ─▶ GitHub Pages (+ offline HTML)
```

- **content/** — canonical pages. One page per word/idiom (`content/<lang>/<slug>.md`) and per encoding page (`content/<lang>/encoding/<slug>.md`). Links, not copies — the #1 rule against duplication/staleness.
- **Inbox/** — landing zone for Web Clipper captures and `pnpm gen wiki` / `pnpm gen encoding` skeletons. Promote into `content/` only on your confirm.
- **Public vs private** — published: general word/idiom/encoding pages. Never published: your status, flags, word store, custom dictionary (those live in the engine's private vault layer).

## Page shapes

Frontmatter + section templates are in the engine repo: `scripts/gen/prompts/{wiki-page,encoding-page}.md`, with worked examples in `examples/wiki/`. The `pnpm gen wiki|encoding` commands emit filled-frontmatter skeletons with `TODO` markers for the agent to complete.

## Publishing with Quartz

This starter ships an example `quartz.config.ts`. To publish:

1. `npx quartz create` in your extracted repo (or reuse your `llm-knowledge-base` Quartz install), point `content` at this folder's `content/`.
2. `npx quartz build --serve` to preview; `npx quartz sync` / GitHub Action to deploy to Pages.
3. Quartz's static output under `public/` is the **offline-viewable HTML**.

> zh + vi are combined here for now (one repo, `content/zh-Hant/` and `content/vi/`), splittable per-language later — the pack interface + cross-language store make either layout work.
