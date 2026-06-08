/**
 * Enriched SRS importer (M3b, PRD §5.7). Reads the real SRS SQLite store
 * (`srs-core.db`) directly via sql.js, instead of the lossy `(word, lang,
 * status)` JSON export, so the clock-aware reconciler gets what it needs: each
 * word's `mod` change-epoch, its 4-tuple identity, and the latest `wordHistory`
 * origin. The output is plain `ExternalVocabRecord[]` — the SAME shape the JSON
 * adapter produces — with the enrichment carried in `raw.*` exactly where
 * `applyToStore` reads it (`raw.mod`, `raw.origin`, the 4-tuple).
 *
 * Lives in scripts/ (never the engine): the engine stays data-free; sql.js is a
 * shared dependency. Confirmed schema (extra server / isPending columns ignored):
 *   WordList(dictForm, secondary, partOfSpeech, language)  -- PK 4-tuple
 *           + mod, del, knownStatus, …
 *   wordHistory(… same 4-tuple, day) + mod, knownStatus, prevKnownStatus, origin
 */

import { readFile } from "node:fs/promises";

import initSqlJs from "sql.js";
import type { Database, SqlValue } from "sql.js";

import { mapKnownness, type ExternalVocabRecord } from "@tsumugu/engine";

/** 4-tuple key separator — an ASCII unit separator (0x1f) never appears in a form / POS / language value. */
const SEP = String.fromCharCode(31);

// getAsObject() column reads are `SqlValue | undefined` under noUncheckedIndexedAccess;
// these helpers already treat nullish as "absent", so accept the wider type.
type Cell = SqlValue | undefined;

/** Non-empty string, else undefined. */
function str(v: Cell): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** A SqlValue as a finite number (INTEGER columns), else 0. */
function num(v: Cell): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Stable key for the (dictForm, secondary, partOfSpeech, language) 4-tuple. */
function tupleKey(a: Cell, b: Cell, c: Cell, d: Cell): string {
  return [a, b, c, d].map((x) => String(x ?? "")).join(SEP);
}

/**
 * Map an OPEN SRS database to enriched records. Pure (no IO) so it can be
 * unit-tested against an in-memory sql.js fixture.
 *
 * - Skips soft-deleted rows (`del` truthy).
 * - Joins the latest `wordHistory` row per 4-tuple (max `day`, then `mod`) for
 *   `origin` / `prevKnownStatus`.
 * - Maps `knownStatus` to a Tsumugu status via the engine's `mapKnownness`.
 */
export function parseSrsDb(db: Database): ExternalVocabRecord[] {
  // Latest history per 4-tuple. ORDER ascending + overwrite ⇒ last write wins.
  const history = new Map<string, { origin?: string; prevKnownStatus?: string }>();
  try {
    const h = db.prepare(
      "SELECT dictForm, secondary, partOfSpeech, language, origin, prevKnownStatus " +
        "FROM wordHistory ORDER BY day ASC, mod ASC",
    );
    while (h.step()) {
      const r = h.getAsObject();
      history.set(tupleKey(r.dictForm, r.secondary, r.partOfSpeech, r.language), {
        origin: str(r.origin),
        prevKnownStatus: str(r.prevKnownStatus),
      });
    }
    h.free();
  } catch {
    // No wordHistory table (older export) — proceed without origins.
  }

  const out: ExternalVocabRecord[] = [];
  const w = db.prepare(
    "SELECT dictForm, secondary, partOfSpeech, language, mod, knownStatus " +
      "FROM WordList WHERE del = 0",
  );
  while (w.step()) {
    const r = w.getAsObject();
    const dictForm = str(r.dictForm);
    if (!dictForm) continue; // a real entry must have a dictionary form

    const language = str(r.language) ?? "und";
    const knownStatus = str(r.knownStatus);
    const hist = history.get(tupleKey(r.dictForm, r.secondary, r.partOfSpeech, r.language));

    // raw.* keys match exactly what applyToStore reads (externalChangeIso →
    // raw.mod, externalOrigin → raw.origin, linkExternalRef → the 4-tuple).
    const raw: Record<string, unknown> = {
      dictForm,
      secondary: str(r.secondary) ?? "",
      partOfSpeech: str(r.partOfSpeech) ?? "",
      language,
      mod: num(r.mod),
    };
    if (knownStatus) raw.knownStatus = knownStatus;
    if (hist?.origin) raw.origin = hist.origin;
    if (hist?.prevKnownStatus) raw.prevKnownStatus = hist.prevKnownStatus;

    const rec: ExternalVocabRecord = { source: "srs", lang: language, word: dictForm, raw };
    if (knownStatus) {
      rec.externalStatus = knownStatus;
      const mapped = mapKnownness(knownStatus);
      if (mapped !== undefined) rec.status = mapped;
    }
    out.push(rec);
  }
  w.free();
  return out;
}

/** Read an SRS SQLite file and return enriched records. */
export async function readSrsDb(path: string): Promise<ExternalVocabRecord[]> {
  const SQL = await initSqlJs();
  const bytes = await readFile(path);
  const db = new SQL.Database(new Uint8Array(bytes));
  try {
    return parseSrsDb(db);
  } finally {
    db.close();
  }
}
