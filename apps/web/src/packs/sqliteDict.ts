/**
 * Lazy band-sharded dictionary lookup (PRD D5 §6.3).
 *
 * Resolution order (additive opt-in — v1 JSON path remains):
 * 1. SQLite bilingual asset (`dict.en.by-sa/dict.sqlite`) via vault.readBytes + sql.js.
 * 2. JSON core shard (`shards/dict.en.by-sa.tocfl-1-2.json`) — eager TOCFL-1..2.
 * 3. Higher-band JSON shards on first miss (`shards/dict.en.by-sa.tocfl-N.json`).
 * 4. Legacy monolithic `dict.json`.
 *
 * Monolingual zh definitions merge from `dict.mono.zh/dict.sqlite` when present.
 *
 * ## Range-fetch reader (sql.js-httpvfs — documented stub)
 *
 * Production deployment can host `.sqlite` on a Range-capable static host
 * (GitHub Pages) and mount via sql.js-httpvfs so only index leaf pages are
 * fetched per lookup (~few KB, measured in `pnpm gen pack-dict`). This module
 * currently loads the full asset from the vault when bytes are available; swap
 * `loadSqliteDb` for an httpvfs-backed VFS when deploying range-fetch.
 *
 * OPFS download-pack + `navigator.storage.persist()` are optional (best-effort)
 * and not wired here — JSON-shard fallback remains when sqlite is absent.
 */

import initSqlJs from "sql.js";
import type { Database, SqlJsStatic } from "sql.js";

import {
  enDefinitionFromCedictGlosses,
  type DictEntry,
  type MonoDefinition,
  type VaultIO,
} from "@tsumugu/engine";

import type { BrowserDict } from "./index.js";

/** Raw cedict-shaped shard entry. */
export interface CedictShardRecord {
  py?: string;
  g?: string | string[];
  s?: string;
}

type ShardMap = Record<string, CedictShardRecord>;

/** Monolingual sqlite payload shape. */
interface MonoSqlitePayload {
  gloss: string;
  illustration?: string;
  level: string;
  achievedLevel?: string;
  levelEscalated?: boolean;
  source?: string;
}

/** Vault-relative asset paths for zh-Hant packaging (license-quarantined). */
export const DICT_ASSET_PATHS = {
  bilingualSqlite: (lang: string) =>
    `tsumugu/packs/${lang}/dict.en.by-sa/dict.sqlite`,
  monoSqlite: (lang: string) => `tsumugu/packs/${lang}/dict.mono.zh/dict.sqlite`,
  coreShard: (lang: string) =>
    `tsumugu/packs/${lang}/shards/dict.en.by-sa.tocfl-1-2.json`,
  bandShard: (lang: string, bandKey: string) =>
    `tsumugu/packs/${lang}/shards/dict.en.by-sa.${bandKey}.json`,
  legacyDict: (lang: string) => `tsumugu/packs/${lang}/dict.json`,
} as const;

function cedictGlossLines(raw: CedictShardRecord): string[] {
  if (raw.g === undefined) return [];
  return Array.isArray(raw.g) ? raw.g : [raw.g];
}

function fromCedictShard(word: string, raw: CedictShardRecord): DictEntry {
  const lines = cedictGlossLines(raw);
  const entry: DictEntry = {
    term: word,
    gloss: "",
    ...(raw.py ? { reading: raw.py } : {}),
    source: "packaged",
  };
  if (lines.length > 0) {
    const { en, senses, legacyGloss } = enDefinitionFromCedictGlosses(lines);
    entry.gloss = legacyGloss;
    entry.senses = senses;
    entry.definitions = { en };
  }
  return entry;
}

function mergeMonoDefinition(
  entry: DictEntry,
  mono: MonoSqlitePayload,
): DictEntry {
  const zh: MonoDefinition = {
    gloss: mono.gloss,
    level: mono.level,
    monolingual: true,
    ...(mono.illustration !== undefined ? { illustration: mono.illustration } : {}),
    ...(mono.achievedLevel !== undefined ? { achievedLevel: mono.achievedLevel } : {}),
    ...(mono.levelEscalated !== undefined ? { levelEscalated: mono.levelEscalated } : {}),
    ...(mono.source !== undefined
      ? { source: mono.source as MonoDefinition["source"] }
      : { source: "generated" }),
  };
  return {
    ...entry,
    definitions: { ...entry.definitions, zh },
  };
}

/** Lookup one row from a packaging sqlite database. */
function sqliteLookup(
  db: Database,
  term: string,
): { band: string; payload: string } | undefined {
  const stmt = db.prepare(
    "SELECT band, payload FROM entries WHERE term = ? LIMIT 1",
  );
  stmt.bind([term]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return {
    band: String(row.band ?? ""),
    payload: String(row.payload ?? ""),
  };
}

export interface BandShardedDictOptions {
  vault: VaultIO;
  lang: string;
  /** Injectable sql.js init (tests supply in-memory wasm). */
  initSql?: () => Promise<SqlJsStatic>;
}

/**
 * Create a lazy band-sharded {@link BrowserDict}.
 * Falls back to JSON shards, then legacy `dict.json`, when sqlite is absent.
 */
export function createBandShardedDict(opts: BandShardedDictOptions): BrowserDict {
  const { vault, lang } = opts;
  const init = opts.initSql ?? initSqlJs;

  let bilingualDb: Promise<Database | null> | null = null;
  let monoDb: Promise<Database | null> | null = null;
  let coreShard: Promise<ShardMap | null> | null = null;
  const lazyShards = new Map<string, Promise<ShardMap | null>>();
  let legacyDict: Promise<ShardMap | null> | null = null;

  const loadSqliteDb = async (path: string): Promise<Database | null> => {
    const bytes = await vault.readBytes(path);
    if (bytes === null || bytes.byteLength === 0) return null;
    const SQL = await init();
    return new SQL.Database(bytes);
  };

  const loadBilingualDb = (): Promise<Database | null> => {
    if (!bilingualDb) {
      bilingualDb = loadSqliteDb(DICT_ASSET_PATHS.bilingualSqlite(lang));
    }
    return bilingualDb;
  };

  const loadMonoDb = (): Promise<Database | null> => {
    if (!monoDb) {
      monoDb = loadSqliteDb(DICT_ASSET_PATHS.monoSqlite(lang));
    }
    return monoDb;
  };

  const loadJsonShard = (path: string): Promise<ShardMap | null> =>
    vault
      .readText(path)
      .then((text) => {
        if (text == null) return null;
        try {
          return JSON.parse(text) as ShardMap;
        } catch {
          return null;
        }
      })
      .catch(() => null);

  const loadCoreShard = (): Promise<ShardMap | null> => {
    if (!coreShard) {
      coreShard = loadJsonShard(DICT_ASSET_PATHS.coreShard(lang));
    }
    return coreShard;
  };

  const loadBandShard = (bandKey: string): Promise<ShardMap | null> => {
    let pending = lazyShards.get(bandKey);
    if (!pending) {
      pending = loadJsonShard(DICT_ASSET_PATHS.bandShard(lang, bandKey));
      lazyShards.set(bandKey, pending);
    }
    return pending;
  };

  const loadLegacy = (): Promise<ShardMap | null> => {
    if (!legacyDict) {
      legacyDict = loadJsonShard(DICT_ASSET_PATHS.legacyDict(lang));
    }
    return legacyDict;
  };

  const lookupJson = async (word: string): Promise<DictEntry | undefined> => {
    const core = await loadCoreShard();
    const coreHit = core?.[word];
    if (coreHit) return fromCedictShard(word, coreHit);

    // Lazy-load higher-band shards only after a core miss.
    const bandKeys = ["tocfl-3", "tocfl-4", "tocfl-5", "tocfl-6", "tocfl-7", "unranked"];
    for (const key of bandKeys) {
      const shard = await loadBandShard(key);
      const hit = shard?.[word];
      if (hit) return fromCedictShard(word, hit);
    }

    const legacy = await loadLegacy();
    const legacyHit = legacy?.[word];
    if (legacyHit) return fromCedictShard(word, legacyHit);
    return undefined;
  };

  const lookupSqlite = async (word: string): Promise<DictEntry | undefined> => {
    const db = await loadBilingualDb();
    if (!db) return undefined;

    const row = sqliteLookup(db, word);
    if (!row) return undefined;

    let entry: DictEntry;
    try {
      const payload = JSON.parse(row.payload) as CedictShardRecord;
      entry = fromCedictShard(word, payload);
      if (row.band && row.band !== "unranked") entry.level = row.band;
    } catch {
      return undefined;
    }

    const mono = await loadMonoDb();
    if (mono) {
      const monoRow = sqliteLookup(mono, word);
      if (monoRow) {
        try {
          const monoPayload = JSON.parse(monoRow.payload) as MonoSqlitePayload;
          entry = mergeMonoDefinition(entry, monoPayload);
        } catch {
          /* mono merge best-effort */
        }
      }
    }
    return entry;
  };

  return {
    async lookup(word: string): Promise<DictEntry | undefined> {
      const fromSqlite = await lookupSqlite(word);
      if (fromSqlite !== undefined) return fromSqlite;
      return lookupJson(word);
    },
  };
}