# Prompt — Hán-Việt bridge entry (batch, agent-run)

Generate a **bridge entry** that connects a Sino-Vietnamese word to its Chinese etymon, so the user's Mandarin bootstraps their Vietnamese (PRD §5.6). Entries are **AI-generated as-you-go, cached, confidence-flagged, and correctable**.

## Inputs
- `word` — a Vietnamese word (likely Sino-Vietnamese).
- `knownHanzi` — the user's known Hanzi set (from their known-Mandarin SRS export).

## Produce a `BridgeInfo` (see `packages/engine/src/types.ts`)
```json
{
  "bridgeLang": "zh-Hant",
  "etymon": "發展",
  "bridgeReading": "fā zhǎn / ㄈㄚ ㄓㄢˇ",
  "meaning": "to develop; development",
  "confidence": 0.0,
  "corrected": false,
  "morphemes": [
    { "surface": "phát", "etymon": "發", "reading": "fā", "gloss": "emit; set out" },
    { "surface": "triển", "etymon": "展", "reading": "zhǎn", "gloss": "unfold; extend" }
  ]
}
```

## Rules
1. **Only bridge genuine Sino-Vietnamese.** Native Vietnamese words have no Hanzi etymon — return none rather than invent one.
2. **Morpheme alignment.** Map each Vietnamese syllable to its Hanzi etymon + Hán-Việt reading. ~40% of Vietnamese is Sino with systematic Middle-Chinese correspondence.
3. **Confidence.** Score 0–1. High when the correspondence is regular and the Hanzi is common; low when irregular or guessed. Low-confidence entries surface for human correction; `corrected:true` only after the user confirms.
4. **Cross-seed.** When the etymon Hanzi ∈ `knownHanzi`, note it — `crossSeed()` will lift the user's Vietnamese CI coverage from what they already know.
5. **[zh-Hant] OpenCC**: etymon Hanzi must be Traditional.
6. **Cache** into the private bridge dictionary (`BridgeRegistry` JSON); reconcile against a Wiktionary Hán-Việt dump later if desired.
