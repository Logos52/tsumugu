# Prompt — Wiki word/idiom page (batch, agent-run)

Generate one durable **wiki page** per word/idiom (PRD §5.5), Karpathy-llm-wiki style, language-tuned. One canonical page per item — **links, not copies** (the #1 pain point is duplication/staleness).

## Inputs
- `term`, `lang`, the dictionary entry, the user's reading examples, related words.

## Frontmatter (required)
```yaml
term: <surface form>
reading: <Zhuyin/Pinyin | Latin+tones>
pos: <part of speech>
status: <new|l1|l2|l3|l4|known|ignored>   # mirrors the word store
tocfl: <band, zh>                          # or freq band (vi)
tags: [topic/..., semantic/...]
first_seen: <YYYY-MM-DD>
source: <where it first appeared>
related: [<term>, <term>]                  # wikilinks
lang: <lang id>
```

## Body sections
1. **Meaning** — monolingual, leveled (English gloss as a `>` blockquote aside).
2. **Character / etymology breakdown** — per morpheme; radicals; contrasts.
3. **Similar / related** — `[[wikilink]]`s, not restated definitions.
4. **Examples (from your reading)** — pulled from the user's actual passages.
5. **Usage / register** — measure words, collocations, formality.
6. **[vi only] Hán-Việt box** — Hanzi etymon + reading + morphemes + the known-Chinese bridge.

## Rules
- **[zh-Hant] OpenCC**: Traditional only.
- One file per term, romanized filename + `term` in frontmatter (e.g. `yeshi-night-market.md`).
- Wikilinks over duplication. If a related page exists, link it; don't re-explain.
- Write to the wiki vault `Inbox/`; the user promotes to the wiki on confirm. See `examples/wiki/` for the shape.
