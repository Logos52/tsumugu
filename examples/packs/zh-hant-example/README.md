# Example zh-Hant pack

A minimal, runnable [`LanguagePack`](../../../PACK-AUTHORING.md) that proves two things end-to-end with **no licensed data**:

1. **The real OpenCC guard** — `scriptNormalizer` runs `opencc-js` (Apache-2.0) Simplified→Traditional (Taiwan). `pnpm gen verify` uses it to catch + fix any Simplified that leaks into generated zh content.
2. **The pack interface** — segmenter (client-side longest-match), dictionaryProvider, phoneticLayer, levelingModel, ttsVoice.

The lexicon in `index.ts` is a **tiny original sample** (~15 words), not a redistributed dictionary. A real pack supplies CC-CEDICT / MoEDict + TOCFL frequency data and (optionally) `jieba-wasm` segmentation from your **private folder**, so licensed data never enters this Apache-2.0 repo.

## Try it

```bash
# OpenCC guard catches Simplified and --fix rewrites to Traditional:
pnpm gen verify --in some.prepared.json --lang zh-Hant \
  --pack-module examples/packs/zh-hant-example/index.ts --fix

# Segment + skeleton a source with this pack:
pnpm gen prep --lang zh-Hant --in source.txt \
  --pack-module examples/packs/zh-hant-example/index.ts
```
