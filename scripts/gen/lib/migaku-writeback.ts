/**
 * Migaku write-back (PRD §8, Fork B2) — the second leg of two-way sync, fenced.
 *
 * Pushes status changes the user made in Tsumugu back toward Migaku, addressed
 * by the 4-tuple preserved in `WordEntry.externalRefs` at import. Safety is the
 * whole point:
 *   - DRY-RUN by default: `planWriteback` only reports; nothing is written.
 *   - NEVER-CLOBBER: a word is pushed only when Tsumugu's `statusUpdatedAt` is
 *     strictly newer than Migaku's current `mod` (the symmetric counterpart to
 *     the import resolver), so a Migaku change made after import is never lost.
 *   - COPY-ONLY: `writeBack` writes a MODIFIED COPY unless `inPlace` is forced;
 *     it never touches Migaku's live OPFS store (this file is an exported
 *     snapshot — re-importing the copy into Migaku is a deliberate manual step).
 *
 * Only `WordList` is updated (knownStatus, a fresh mod, isPendingEnqueue=1 so
 * Migaku's own syncer uploads it). `wordHistory` is intentionally NOT written:
 * its `day` counter is a Migaku-internal value we can't reconstruct safely.
 *
 * Lives in scripts/ (never the engine); sql.js is a shared dependency.
 */

import { readFile, writeFile } from "node:fs/promises";

import initSqlJs from "sql.js";
import type { Database, SqlValue } from "sql.js";

import type { WordEntry, WordStatus } from "@tsumugu/engine";

export type MigakuKnown = "KNOWN" | "LEARNING" | "UNKNOWN" | "IGNORED";

/** 4-tuple key separator — an ASCII unit separator never appears in a field. */
const SEP = String.fromCharCode(31);

function tupleKey(a: SqlValue, b: SqlValue, c: SqlValue, d: SqlValue): string {
  return [a, b, c, d].map((x) => String(x ?? "")).join(SEP);
}
function str(v: SqlValue): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function num(v: SqlValue): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Tsumugu status → Migaku's 4-bucket knownStatus (lossy; l1..l3 collapse). */
export function reverseStatus(s: WordStatus): MigakuKnown {
  switch (s) {
    case "known":
    case "l4":
      return "KNOWN";
    case "l1":
    case "l2":
    case "l3":
      return "LEARNING";
    case "ignored":
      return "IGNORED";
    case "new":
    default:
      return "UNKNOWN";
  }
}

export interface DbStatusRow {
  knownStatus: string;
  mod: number;
}

/** Current non-deleted WordList status keyed by 4-tuple. */
export function readWordListStatus(db: Database): Map<string, DbStatusRow> {
  const rows = new Map<string, DbStatusRow>();
  const s = db.prepare(
    "SELECT dictForm, secondary, partOfSpeech, language, mod, knownStatus FROM WordList WHERE del = 0",
  );
  while (s.step()) {
    const r = s.getAsObject();
    rows.set(tupleKey(r.dictForm, r.secondary, r.partOfSpeech, r.language), {
      knownStatus: str(r.knownStatus) ?? "",
      mod: num(r.mod),
    });
  }
  s.free();
  return rows;
}

export interface WritebackChange {
  word: string;
  lang: string;
  dictForm: string;
  secondary: string;
  partOfSpeech: string;
  language: string;
  from: string;
  to: MigakuKnown;
  storeAt: number;
  dbMod: number;
}

export interface WritebackPlan {
  changes: WritebackChange[];
  skipped: { noRef: number; noRow: number; same: number; notNewer: number; noClock: number };
}

/**
 * Compute the set of Tsumugu→Migaku status pushes. Pure: takes store entries +
 * the current Migaku rows, returns the plan. A change is emitted only when the
 * store entry carries a Migaku 4-tuple, the row exists, the mapped status
 * differs, the store has a status clock, and that clock is strictly newer than
 * Migaku's `mod`.
 */
export function planWriteback(
  entries: readonly WordEntry[],
  dbRows: Map<string, DbStatusRow>,
): WritebackPlan {
  const changes: WritebackChange[] = [];
  const skipped = { noRef: 0, noRow: 0, same: 0, notNewer: 0, noClock: 0 };

  for (const e of entries) {
    const refs = (e.externalRefs ?? []).filter((r) => r.source === "migaku");
    if (refs.length === 0) {
      skipped.noRef++;
      continue;
    }
    const at = e.statusUpdatedAt ? Date.parse(e.statusUpdatedAt) : NaN;
    const to = reverseStatus(e.status);
    for (const ref of refs) {
      const row = dbRows.get(tupleKey(ref.dictForm, ref.secondary, ref.partOfSpeech, ref.language));
      if (!row) {
        skipped.noRow++;
        continue;
      }
      if (row.knownStatus === to) {
        skipped.same++;
        continue;
      }
      if (!Number.isFinite(at)) {
        skipped.noClock++;
        continue;
      }
      if (!(at > row.mod)) {
        skipped.notNewer++; // Migaku is newer-or-equal — never clobber
        continue;
      }
      changes.push({
        word: e.word,
        lang: e.lang,
        dictForm: ref.dictForm,
        secondary: ref.secondary,
        partOfSpeech: ref.partOfSpeech,
        language: ref.language,
        from: row.knownStatus,
        to,
        storeAt: at,
        dbMod: row.mod,
      });
    }
  }
  return { changes, skipped };
}

/** Apply changes to an open DB: WordList only, with a fresh mod + pending flag. */
export function applyWriteback(
  db: Database,
  changes: readonly WritebackChange[],
  nowMs: number,
): void {
  for (const c of changes) {
    db.run(
      "UPDATE WordList SET knownStatus = ?, mod = ?, isPendingEnqueue = 1 " +
        "WHERE dictForm = ? AND secondary = ? AND partOfSpeech = ? AND language = ?",
      [c.to, nowMs, c.dictForm, c.secondary, c.partOfSpeech, c.language],
    );
  }
}

export interface WritebackResult extends WritebackPlan {
  /** Path written when applied, else undefined (dry-run). */
  wrote?: string;
}

/** Plan, and (only with apply) write a modified COPY — or the snapshot if forced. */
export async function writeBack(opts: {
  store: { all(lang?: string): WordEntry[] };
  dbPath: string;
  lang?: string;
  apply?: boolean;
  outPath?: string;
  inPlace?: boolean;
  nowMs: number;
}): Promise<WritebackResult> {
  const SQL = await initSqlJs();
  const bytes = await readFile(opts.dbPath);
  const db = new SQL.Database(new Uint8Array(bytes));
  try {
    const dbRows = readWordListStatus(db);
    const plan = planWriteback(opts.store.all(opts.lang), dbRows);
    if (!opts.apply || plan.changes.length === 0) return plan;

    applyWriteback(db, plan.changes, opts.nowMs);
    const target = opts.inPlace ? opts.dbPath : opts.outPath;
    if (!target) return plan; // guarded by the CLI; defensive
    await writeFile(target, Buffer.from(db.export()));
    return { ...plan, wrote: target };
  } finally {
    db.close();
  }
}
