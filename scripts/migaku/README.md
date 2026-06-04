# Migaku → Tsumugu import

Bridges a Migaku word export into Tsumugu's cross-reference importer, so the
vocabulary you already know in Migaku seeds your Tsumugu word store (and from
there, the reader's coloring and the wiki).

## 1. Export from Migaku

On `study.migaku.com` (logged in) click **Export Words** → pick categories
(**Known** + **Learning** are the useful ones; **Ignored** optional) → download
**JSON**. The records look like `{ word, reading, language, status }` with a
numeric `status` (1 = learning, 2 = known). Save it under the gitignored
personal layer, e.g. `personal/migaku/migaku-export.json`.

## 2. Convert to crossref input

```sh
pnpm migaku:convert \
  --in personal/migaku/migaku-export.json \
  --out personal/migaku/converted.json \
  --langs zh-Hant,vi \
  --include known,learning,ignored
```

It normalizes Migaku's numeric status → `KNOWN/LEARNING/IGNORED`, maps Migaku
language codes → Tsumugu ids (`zh → zh-Hant`, `vi → vi`; override with
`--lang-map zh=zh-Hant,yue=zh-Hant`), keeps only the requested languages, and
prints a summary. It does **not** guess: any unrecognized status code or
unmapped language is reported (`! unmapped …`) rather than dropped silently —
send those lines back and they get added to the map.

> Your Migaku Mandarin is Traditional (CC-CEDICT Taiwan Traditional), so the
> words match Tsumugu's zh-Hant store directly — no OpenCC conversion needed.

## 3. Import into the word store

Reconcile first (read-only — shows agreements / conflicts / new words):

```sh
pnpm gen crossref --source migaku --in personal/migaku/converted.json \
  --lang zh-Hant --store personal/vault/tsumugu/word-store.json
```

Then apply (writes the store). `--apply` imports new words + non-conflicting
statuses; add `--overwrite` only to let Migaku win over your local grades:

```sh
pnpm gen crossref --source migaku --in personal/migaku/converted.json \
  --lang zh-Hant --store personal/vault/tsumugu/word-store.json --apply
# repeat with --lang vi for the Vietnamese slice of the same file
```

Status mapping (Migaku → Tsumugu): `known → known`, `learning → l3`,
`ignored → ignored`. From there, `pnpm gen wiki` / `gen encoding` turn the
imported words into wiki pages.
