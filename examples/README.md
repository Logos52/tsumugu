# Examples — Phase 0 "prove the loop by hand"

Hand-authored artifacts that demonstrate Tsumugu's data formats end-to-end (PRD §11 Phase 0). These are **generic demo data**, not licensed dictionary data — safe in the public engine repo. The real packs, dictionaries, and word store live in the user's private folder.

| File | Schema | Shows |
|------|--------|-------|
| `zh-hant/night-market.prepared.json` | `tsumugu/prepared-content@1` | A Traditional-Chinese passage with **pre-baked** unknown-word glosses, readings, leveled monolingual explanations, and examples — instant offline hover. |
| `vi/develop.prepared.json` | `tsumugu/prepared-content@1` | A Vietnamese passage with a **Hán-Việt bridge** box (`phát triển` ← 發展) so known Chinese bootstraps Vietnamese. |
| `word-store.example.json` | `tsumugu/word-store@1` | The cross-language word store: statuses, a **flag**, an FSRS `srs` state, and a `related[]` etymon link 發展 ↔ phát triển. |
| `wiki/yeshi-night-market.md` | wiki word page (§5.5) | A durable per-word wiki page (frontmatter + sections). |
| `wiki/encoding/熱鬧.md` | encoding-layer page (§5.5) | A memory-encoding page for an SRS word — etymology, mnemonic, "why it's tricky" (answers the flag). NFC filename + `word:` audit field per ARCHITECTURE.md §4. |

The flow these prove: **source → `content-prep` → `verify` (CI + OpenCC) → reader (pre-baked hover, grade, flag) → SRS → encoding page**. The generation prompts that produce these live in [`../scripts/gen/prompts/`](../scripts/gen/prompts/).

> The `.prepared.json` files validate against the engine's `parsePreparedContent()`; `word-store.example.json` round-trips through `WordStore.fromJSON()`.
