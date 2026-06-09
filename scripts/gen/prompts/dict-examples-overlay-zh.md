# Prompt — Per-learner example overlay (zh-Hant, vault-only stub)

**Status: optional overlay — not part of the shared/CC0 asset.**

Use this prompt **only** when generating **personal** example sentences for a specific learner's vault. These rows recycle the learner's known words (i+1) and must **never** ship in a shared prepared-content file.

## Vault-only overlay rules (PRD §5.4, §2 check 7)

- Read the learner's word store (`isKnown` / `l4`+`known` policy).
- Prefer vocabulary the learner already knows in each sentence.
- Tag every overlay row **`"shared": false`** and **`"source": "generated"`**.
- Write into the vault **custom** layer (`WordEntry.custom.examples`) — not the shared glossary asset.
- `gen verify` reports the **known-word recycle ratio on overlay rows only** when a `--store` is provided.

## Input per headword

- `headword`, `definitions.zh.gloss`, `defFloorBand`, `allowList`
- `recycleList` — known words from the vault store the agent should prefer
- `overlayCount` — typically 1–3 extra sentences (on top of the 3–6 shared base)

## Prompt template (agent fills N, recycle list, sense)

> Write **N** short, common, everyday Traditional-Chinese sentences using **[headword]** in the sense "[definitions.zh.gloss]". Prefer these words the learner already knows: [recycle list from the vault store]. Keep every word at/below band N. Give an English translation for each. Tag `"shared": false`.

## Shape

```json
{
  "examples": [
    {
      "text": "我們昨晚去的夜市很熱鬧。",
      "translation": "The night market we went to last night was lively.",
      "source": "generated",
      "level": "TOCFL-3",
      "shared": false,
      "highlightSpans": [{ "start": 9, "end": 11 }]
    }
  ]
}
```

## Stub note

The gen CLI does **not** auto-run this overlay today. An agent invokes this prompt manually after the shared base passes `gen verify`, then merges results into the vault custom layer. Shared-base generation (`dict-examples-zh.md`) remains the D3 blocking path.