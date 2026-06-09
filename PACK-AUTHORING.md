# Authoring a Tsumugu language pack

A **pack** teaches the engine a new language. Packs are *not* part of this public engine — they live in a private/separate folder and reference their own dictionary data (mind licenses; don't commit CC-BY-SA data into this Apache repo).

> This is the interface reference. For the fuller walkthrough — the reference implementation, the data-out-of-the-bundle pattern, and the ground rules — see **[`docs/06-extending.md`](./docs/06-extending.md)**.

## Interface (implement these)

| Member | Purpose |
|--------|---------|
**Required:** `segmenter`, `dictionaryProvider`, `phoneticLayer`, `levelingModel`. **Optional:** `scriptNormalizer?`, `ttsVoice?`, `bridge?` — omit `scriptNormalizer` for any language with no script-normalization need (most non-CJK languages); it is mandatory ONLY for Simplified-bearing scripts (zh-Hant).

| Member | Purpose |
|--------|---------|
| `segmenter(text)` | → tokens (words). zh: `jieba-wasm`; vi: a JS dictionary/longest-match tokenizer (or optional local CKIP/underthesea). |
| `dictionaryProvider(word)` | → `{ gloss, reading, senses, audio? }`. Packaged base **+ a custom/override layer** the user can edit. |
| `phoneticLayer` | reading system (Zhuyin/Pinyin; Latin + tone diacritics; …). |
| `levelingModel(word)` | → difficulty/frequency band (zh: TOCFL; vi: frequency + 6-level). |
| `scriptNormalizer?(text)` | *optional* → normalized text (zh: OpenCC Simplified→Traditional). Omit when no normalization is needed. |
| `ttsVoice?` | *optional* locale/voice id for the Web Speech API. |
| `bridge?` | *optional* cross-language etymon map (e.g. Hán-Việt → Hanzi) for cross-seeding. |

## Steps

1. Implement the interface for your language.
2. Provide dictionary data (fetched/transformed at build/run; keep it out of the engine repo).
3. Register the pack with the engine.
4. (Optional) Provide a `bridge` if a known related language can bootstrap this one.

The engine handles everything language-agnostic: reader UI, coloring, hover, grading, pull SRS, Anki export, the cross-language store, and consuming the agent-generated content files.
