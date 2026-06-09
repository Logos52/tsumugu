/**
 * Dictionary packaging at scale (PRD D5 §6.3).
 *
 * Converts private-pack JSON (CC-CEDICT, optional mono dict) into read-only
 * SQLite assets per license regime, band-sharded JSON shards for eager core
 * load, LICENSE/ATTRIBUTION sidecars, and size-budget reporting.
 *
 * Lives in scripts/gen only — the public engine bundles zero dictionary data.
 */
import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

import initSqlJs from "sql.js";
import type { Database } from "sql.js";

import { enDefinitionFromCedictGlosses } from "@tsumugu/engine";
import {
  assertMonolingualSeedLicenses,
  moedictByNdSeedFixture,
  type LicenseAssertResult,
  type ProvenanceManifest,
} from "./licenseAssert.js";
import {
  freqRankToTocflBand,
  type DefLevelIndex,
  type TocflRecord,
} from "./defLevelData.js";

// ── Size budget (PRD §6.3) ───────────────────────────────────────────────────

/** Eager core band (TOCFL-1..2) ungzipped ceiling. */
export const CORE_BAND_MAX_UNGZIPPED_BYTES = 2 * 1024 * 1024;
/** Per-pack ungzipped ceiling before SQLite is mandatory. */
export const TOTAL_PACK_MAX_UNGZIPPED_BYTES = 40 * 1024 * 1024;
/** SQLite migration trigger: ungzipped asset size. */
export const SQLITE_TRIGGER_UNGZIPPED_BYTES = 25 * 1024 * 1024;
/** SQLite migration trigger: entry count. */
export const SQLITE_TRIGGER_ENTRY_COUNT = 50_000;
/** Bands loaded eagerly under the core budget. */
export const CORE_BANDS = ["TOCFL-1", "TOCFL-2"] as const;

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface CedictRecord {
  py: string;
  g: string[];
  s: string;
}
export type CedictData = Record<string, CedictRecord>;

export interface MonoDictRecord {
  gloss: string;
  illustration?: string;
  level: string;
  achievedLevel?: string;
  levelEscalated?: boolean;
  source?: string;
}
export type MonoDictData = Record<string, MonoDictRecord>;

export interface DictRow {
  term: string;
  reading: string;
  band: string;
  payload: string;
}

export interface SizeBudgetMetrics {
  coreBandUngzippedBytes: number;
  coreBandEntryCount: number;
  totalUngzippedBytes: number;
  totalEntryCount: number;
  bilingualSqliteBytes: number;
  monoSqliteBytes: number;
  lookupTransferBytesEstimate: number;
}

export interface SizeBudgetReport {
  metrics: SizeBudgetMetrics;
  coreBandWithinBudget: boolean;
  totalWithinBudget: boolean;
  sqliteMigrationRecommended: boolean;
  notes: string[];
}

export interface PackagingAssets {
  bilingualSqlite: Uint8Array;
  monoSqlite: Uint8Array;
  jsonShards: Record<string, Record<string, CedictRecord>>;
  sizeReport: SizeBudgetReport;
  licenseAssert: LicenseAssertResult;
}

export interface PackageDictOptions {
  cedict: CedictData;
  tocfl: Record<string, TocflRecord>;
  freq: Record<string, number>;
  /** Optional from-scratch monolingual dict; absent → empty mono sqlite stub. */
  mono?: MonoDictData;
  /** Monolingual-generation provenance for license assertion. */
  monoProvenance?: ProvenanceManifest;
}

// ── Band resolution ──────────────────────────────────────────────────────────

/** Resolve a headword's canonical TOCFL band for sharding (private index only). */
export function bandForWord(
  word: string,
  tocfl: Record<string, TocflRecord>,
  freq: Record<string, number>,
): string {
  const official = tocfl[word];
  if (official !== undefined) return official.level;
  const rank = freq[word];
  if (rank !== undefined) return freqRankToTocflBand(rank);
  return "unranked";
}

/** True when the band is in the eager core set (TOCFL-1..2). */
export function isCoreBand(band: string): boolean {
  return (CORE_BANDS as readonly string[]).includes(band);
}

// ── SQLite builder (in-memory) ───────────────────────────────────────────────

const ENTRIES_DDL = `
CREATE TABLE entries (
  term TEXT NOT NULL,
  reading TEXT NOT NULL DEFAULT '',
  band TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX idx_entries_term ON entries(term);
CREATE INDEX idx_entries_band ON entries(band);
CREATE INDEX idx_entries_term_band ON entries(term, band);
`;

/** Create a fresh in-memory database with the packaging schema. */
export function createPackagingDb(SQL: initSqlJs.SqlJsStatic): Database {
  const db = new SQL.Database();
  db.run(ENTRIES_DDL);
  return db;
}

/** Insert rows and export the database as bytes. */
export function finalizePackagingDb(db: Database): Uint8Array {
  const bytes = db.export();
  db.close();
  return bytes;
}

/** Build bilingual (BY-SA) rows from CC-CEDICT + private band index. */
export function buildBilingualRows(
  cedict: CedictData,
  tocfl: Record<string, TocflRecord>,
  freq: Record<string, number>,
): DictRow[] {
  const rows: DictRow[] = [];
  for (const [term, rec] of Object.entries(cedict)) {
    const band = bandForWord(term, tocfl, freq);
    const payload = JSON.stringify({ py: rec.py, g: rec.g, s: rec.s });
    rows.push({
      term,
      reading: rec.py,
      band,
      payload,
    });
  }
  rows.sort((a, b) => (a.term === b.term ? 0 : a.term < b.term ? -1 : 1));
  return rows;
}

/** Build monolingual (from-scratch) rows; empty when no generated data. */
export function buildMonolingualRows(mono: MonoDictData | undefined): DictRow[] {
  if (mono === undefined || Object.keys(mono).length === 0) return [];
  const rows: DictRow[] = [];
  for (const [term, rec] of Object.entries(mono)) {
    rows.push({
      term,
      reading: "",
      band: rec.level,
      payload: JSON.stringify(rec),
    });
  }
  rows.sort((a, b) => (a.term === b.term ? 0 : a.term < b.term ? -1 : 1));
  return rows;
}

/** Populate a packaging database from pre-built rows. */
export function insertDictRows(db: Database, rows: DictRow[]): void {
  const stmt = db.prepare(
    "INSERT INTO entries (term, reading, band, payload) VALUES (?, ?, ?, ?)",
  );
  for (const row of rows) {
    stmt.run([row.term, row.reading, row.band, row.payload]);
  }
  stmt.free();
}

/** Build a read-only SQLite asset from rows (in-memory; testable without IO). */
export function buildSqliteAsset(
  SQL: initSqlJs.SqlJsStatic,
  rows: DictRow[],
): Uint8Array {
  const db = createPackagingDb(SQL);
  insertDictRows(db, rows);
  return finalizePackagingDb(db);
}

/** Lookup one entry from an open packaging database. */
export function lookupPackagingEntry(
  db: Database,
  term: string,
): { reading: string; band: string; payload: string } | undefined {
  const stmt = db.prepare(
    "SELECT reading, band, payload FROM entries WHERE term = ? LIMIT 1",
  );
  stmt.bind([term]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return {
    reading: String(row.reading ?? ""),
    band: String(row.band ?? ""),
    payload: String(row.payload ?? ""),
  };
}

// ── JSON band shards ─────────────────────────────────────────────────────────

/**
 * Shard CC-CEDICT into per-band JSON maps. Core shard key is
 * `tocfl-1-2` (TOCFL-1 ∪ TOCFL-2); other bands get `tocfl-N` keys.
 */
export function buildJsonShards(
  cedict: CedictData,
  tocfl: Record<string, TocflRecord>,
  freq: Record<string, number>,
): Record<string, Record<string, CedictRecord>> {
  const shards: Record<string, Record<string, CedictRecord>> = {
    "tocfl-1-2": {},
  };

  for (const [term, rec] of Object.entries(cedict)) {
    const band = bandForWord(term, tocfl, freq);
    if (isCoreBand(band)) {
      shards["tocfl-1-2"]![term] = rec;
      continue;
    }
    const key =
      band === "unranked" ? "unranked" : band.toLowerCase().replace("tocfl-", "tocfl-");
    if (shards[key] === undefined) shards[key] = {};
    shards[key]![term] = rec;
  }
  return shards;
}

// ── Size budget math ─────────────────────────────────────────────────────────

/** Whether packaging should recommend SQLite migration (PRD §6.3 trigger). */
export function shouldMigrateToSqlite(
  entryCount: number,
  ungzippedBytes: number,
): boolean {
  return (
    entryCount >= SQLITE_TRIGGER_ENTRY_COUNT ||
    ungzippedBytes >= SQLITE_TRIGGER_UNGZIPPED_BYTES
  );
}

/** Estimate per-lookup HTTP transfer for a headword query (row + index overhead). */
export function estimateLookupTransferBytes(
  db: Database,
  sampleTerm: string,
): number {
  const hit = lookupPackagingEntry(db, sampleTerm);
  if (hit === undefined) return 0;
  // Payload + SQLite B-tree leaf overhead (measured order-of-magnitude in D5).
  const payloadBytes = new TextEncoder().encode(hit.payload).length;
  const indexOverhead = 128;
  const termBytes = new TextEncoder().encode(sampleTerm).length;
  return payloadBytes + indexOverhead + termBytes;
}

/** Compute the §6.3 size-budget report from measured asset sizes. */
export function computeSizeBudgetReport(input: {
  coreShard: Record<string, CedictRecord>;
  totalJsonBytes: number;
  totalEntryCount: number;
  bilingualSqliteBytes: number;
  monoSqliteBytes: number;
  lookupTransferBytesEstimate: number;
}): SizeBudgetReport {
  const coreBandUngzippedBytes = Buffer.byteLength(
    JSON.stringify(input.coreShard),
    "utf8",
  );
  const coreBandEntryCount = Object.keys(input.coreShard).length;
  const notes: string[] = [];

  const coreBandWithinBudget =
    coreBandUngzippedBytes <= CORE_BAND_MAX_UNGZIPPED_BYTES;
  if (!coreBandWithinBudget) {
    notes.push(
      `core band TOCFL-1..2 is ${formatBytes(coreBandUngzippedBytes)} (budget ${formatBytes(CORE_BAND_MAX_UNGZIPPED_BYTES)})`,
    );
  }

  const totalUngzippedBytes = input.totalJsonBytes;
  const totalWithinBudget = totalUngzippedBytes <= TOTAL_PACK_MAX_UNGZIPPED_BYTES;
  if (!totalWithinBudget) {
    notes.push(
      `total JSON is ${formatBytes(totalUngzippedBytes)} (budget ${formatBytes(TOTAL_PACK_MAX_UNGZIPPED_BYTES)})`,
    );
  }

  const sqliteMigrationRecommended = shouldMigrateToSqlite(
    input.totalEntryCount,
    Math.max(input.bilingualSqliteBytes, totalUngzippedBytes),
  );
  if (sqliteMigrationRecommended) {
    notes.push(
      `SQLite migration trigger met (entries≥${SQLITE_TRIGGER_ENTRY_COUNT} or size≥${formatBytes(SQLITE_TRIGGER_UNGZIPPED_BYTES)})`,
    );
  }

  return {
    metrics: {
      coreBandUngzippedBytes,
      coreBandEntryCount,
      totalUngzippedBytes,
      totalEntryCount: input.totalEntryCount,
      bilingualSqliteBytes: input.bilingualSqliteBytes,
      monoSqliteBytes: input.monoSqliteBytes,
      lookupTransferBytesEstimate: input.lookupTransferBytesEstimate,
    },
    coreBandWithinBudget,
    totalWithinBudget,
    sqliteMigrationRecommended,
    notes,
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ── License assertion (packaging inputs) ─────────────────────────────────────

/** Default provenance manifest for a packaging build. */
export function defaultPackagingProvenance(hasMono: boolean): ProvenanceManifest {
  const sources: ProvenanceManifest["sources"] = [
    { id: "cc-cedict", license: "cc-by-sa", role: "reference-only" },
    { id: "freq-words", license: "mit", role: "reference-only" },
  ];
  if (hasMono) {
    sources.push({
      id: "mono-zh-generated",
      license: "authored",
      role: "generation-seed",
    });
  }
  return { sources };
}

/**
 * Assert packaging inputs against the per-source license allow-list.
 * Integrates {@link assertMonolingualSeedLicenses} from D2.
 */
export function assertPackagingLicenses(
  manifest: ProvenanceManifest,
): LicenseAssertResult {
  return assertMonolingualSeedLicenses(manifest);
}

/** PRD §6.2 first fixture — must hard-fail when run through packaging assert. */
export function packagingMoedictFixtureFails(): boolean {
  return !assertPackagingLicenses(moedictByNdSeedFixture()).ok;
}

// ── LICENSE / ATTRIBUTION sidecars ─────────────────────────────────────────

export interface LicenseSidecar {
  license: string;
  attribution: string;
}

export const BY_SA_LICENSE_TEXT = `CC-BY-SA 3.0 — CC-CEDICT English–Chinese Dictionary
https://www.mdbg.net/chinese/dictionary?page=cedict

This bilingual asset aggregates CC-CEDICT data under CC-BY-SA 3.0.
You must provide attribution and release derivatives under the same license.
The monolingual zh asset is a separate, independently licensed file.
`;

export const BY_SA_ATTRIBUTION_TEXT = `CC-CEDICT
Source: https://www.mdbg.net/chinese/dictionary?page=cedict
License: Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0)
Retrieval: build-time from packs/private/zh-hant/data/cedict.json
`;

export const MONO_LICENSE_TEXT = `CC0 1.0 — Monolingual Traditional Chinese definitions (from-scratch generated text)

The definition TEXT in this asset is authored from scratch and released under
CC0 1.0 where present. TOCFL-derived level metadata is a private transformed
index and is NOT relicensed. No CC-BY-SA or CC-BY-ND source text was adapted
into this asset (PRD §7 R-2).
`;

export const MONO_ATTRIBUTION_TEXT = `Monolingual zh definitions
Authored: LLM-generated from scratch (headword + meaning anchor + TOCFL allow-list)
Level metadata: private TOCFL-derived index (not published, not relicensed)
`;

export function licenseSidecars(regime: "by-sa" | "mono"): LicenseSidecar {
  return regime === "by-sa"
    ? { license: BY_SA_LICENSE_TEXT, attribution: BY_SA_ATTRIBUTION_TEXT }
    : { license: MONO_LICENSE_TEXT, attribution: MONO_ATTRIBUTION_TEXT };
}

// ── Full packaging pipeline ──────────────────────────────────────────────────

/** Package dictionary assets in-memory (no filesystem; used by tests + CLI). */
export function packageDictAssets(
  SQL: initSqlJs.SqlJsStatic,
  opts: PackageDictOptions,
): PackagingAssets {
  const bilingualRows = buildBilingualRows(opts.cedict, opts.tocfl, opts.freq);
  const monoRows = buildMonolingualRows(opts.mono);
  const jsonShards = buildJsonShards(opts.cedict, opts.tocfl, opts.freq);

  const bilingualSqlite = buildSqliteAsset(SQL, bilingualRows);
  const monoSqlite = buildSqliteAsset(SQL, monoRows);

  const bilingualDb = new SQL.Database(bilingualSqlite);
  const sampleTerm = bilingualRows[0]?.term ?? "";
  const lookupTransferBytesEstimate = sampleTerm
    ? estimateLookupTransferBytes(bilingualDb, sampleTerm)
    : 0;
  bilingualDb.close();

  const totalJsonBytes = Object.values(jsonShards).reduce(
    (sum, shard) => sum + Buffer.byteLength(JSON.stringify(shard), "utf8"),
    0,
  );

  const manifest =
    opts.monoProvenance ?? defaultPackagingProvenance(monoRows.length > 0);
  const licenseAssert = assertPackagingLicenses(manifest);

  const sizeReport = computeSizeBudgetReport({
    coreShard: jsonShards["tocfl-1-2"] ?? {},
    totalJsonBytes,
    totalEntryCount: bilingualRows.length,
    bilingualSqliteBytes: bilingualSqlite.byteLength,
    monoSqliteBytes: monoSqlite.byteLength,
    lookupTransferBytesEstimate,
  });

  return {
    bilingualSqlite,
    monoSqlite,
    jsonShards,
    sizeReport,
    licenseAssert,
  };
}

export interface WritePackagingOutputOptions {
  outDir: string;
  assets: PackagingAssets;
}

/** Write packaged assets + LICENSE/ATTRIBUTION sidecars to disk. */
export async function writePackagingOutput(
  opts: WritePackagingOutputOptions,
): Promise<void> {
  const { outDir, assets } = opts;
  const bySaDir = join(outDir, "dict.en.by-sa");
  const monoDir = join(outDir, "dict.mono.zh");
  const shardDir = join(outDir, "shards");

  await mkdir(bySaDir, { recursive: true });
  await mkdir(monoDir, { recursive: true });
  await mkdir(shardDir, { recursive: true });

  await writeFile(join(bySaDir, "dict.sqlite"), assets.bilingualSqlite);
  await writeFile(join(monoDir, "dict.sqlite"), assets.monoSqlite);

  const bySaLicense = licenseSidecars("by-sa");
  await writeFile(join(bySaDir, "LICENSE"), bySaLicense.license);
  await writeFile(join(bySaDir, "ATTRIBUTION"), bySaLicense.attribution);

  const monoLicense = licenseSidecars("mono");
  await writeFile(join(monoDir, "LICENSE"), monoLicense.license);
  await writeFile(join(monoDir, "ATTRIBUTION"), monoLicense.attribution);

  for (const [bandKey, shard] of Object.entries(assets.jsonShards)) {
    await writeFile(
      join(shardDir, `dict.en.by-sa.${bandKey}.json`),
      JSON.stringify(shard) + "\n",
    );
  }

  await writeFile(
    join(outDir, "size-report.json"),
    JSON.stringify(assets.sizeReport, null, 2) + "\n",
  );
}

/** Load private-pack data and run the full packaging pipeline to disk. */
export async function packageDictFromPrivatePack(input: {
  dataDir: string;
  outDir: string;
  monoPath?: string;
  monoProvenance?: ProvenanceManifest;
}): Promise<PackagingAssets> {
  const cedictPath = resolve(input.dataDir, "cedict.json");
  const tocflPath = resolve(input.dataDir, "tocfl.json");
  const freqPath = resolve(input.dataDir, "freq.json");

  if (!existsSync(cedictPath) || !existsSync(tocflPath) || !existsSync(freqPath)) {
    throw new Error(
      `packaging requires cedict.json, tocfl.json, and freq.json under ${input.dataDir}`,
    );
  }

  const cedict = JSON.parse(readFileSync(cedictPath, "utf8")) as CedictData;
  const tocfl = JSON.parse(readFileSync(tocflPath, "utf8")) as Record<
    string,
    TocflRecord
  >;
  const freq = JSON.parse(readFileSync(freqPath, "utf8")) as Record<string, number>;

  let mono: MonoDictData | undefined;
  if (input.monoPath !== undefined && existsSync(input.monoPath)) {
    mono = JSON.parse(readFileSync(input.monoPath, "utf8")) as MonoDictData;
  }

  const SQL = await initSqlJs();
  const assets = packageDictAssets(SQL, {
    cedict,
    tocfl,
    freq,
    mono,
    monoProvenance: input.monoProvenance,
  });

  if (!assets.licenseAssert.ok) {
    throw new Error(
      `packaging license assertion failed:\n${assets.licenseAssert.errors.join("\n")}`,
    );
  }

  await writePackagingOutput({ outDir: input.outDir, assets });
  return assets;
}

/** Format a human-readable size report for CLI output. */
export function formatSizeReport(report: SizeBudgetReport): string {
  const m = report.metrics;
  const lines = [
    "Dictionary packaging size report (PRD §6.3)",
    `  core band TOCFL-1..2: ${formatBytes(m.coreBandUngzippedBytes)} / ${formatBytes(CORE_BAND_MAX_UNGZIPPED_BYTES)} (${m.coreBandEntryCount} entries) — ${report.coreBandWithinBudget ? "OK" : "OVER"}`,
    `  total JSON shards:    ${formatBytes(m.totalUngzippedBytes)} / ${formatBytes(TOTAL_PACK_MAX_UNGZIPPED_BYTES)} (${m.totalEntryCount} entries) — ${report.totalWithinBudget ? "OK" : "OVER"}`,
    `  bilingual SQLite:     ${formatBytes(m.bilingualSqliteBytes)}`,
    `  monolingual SQLite:   ${formatBytes(m.monoSqliteBytes)}${m.monoSqliteBytes < 4096 ? " (empty stub)" : ""}`,
    `  est. lookup transfer: ~${formatBytes(m.lookupTransferBytesEstimate)} per headword`,
    `  SQLite migration:     ${report.sqliteMigrationRecommended ? "RECOMMENDED" : "not yet triggered"}`,
  ];
  if (report.notes.length > 0) {
    lines.push("  notes:");
    for (const note of report.notes) lines.push(`    - ${note}`);
  }
  return lines.join("\n");
}

/** Re-export for consumers that map sqlite payloads to DictEntry. */
export { enDefinitionFromCedictGlosses };