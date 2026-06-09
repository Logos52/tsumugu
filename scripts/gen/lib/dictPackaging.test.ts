import { describe, it, expect, beforeAll } from "vitest";
import initSqlJs from "sql.js";
import type { SqlJsStatic } from "sql.js";

import {
  CORE_BAND_MAX_UNGZIPPED_BYTES,
  SQLITE_TRIGGER_ENTRY_COUNT,
  SQLITE_TRIGGER_UNGZIPPED_BYTES,
  assertPackagingLicenses,
  buildBilingualRows,
  buildJsonShards,
  buildMonolingualRows,
  buildSqliteAsset,
  computeSizeBudgetReport,
  defaultPackagingProvenance,
  lookupPackagingEntry,
  packageDictAssets,
  packagingMoedictFixtureFails,
  shouldMigrateToSqlite,
  type CedictData,
  type MonoDictData,
} from "./dictPackaging.js";
import { moedictByNdSeedFixture } from "./licenseAssert.js";

let SQL: SqlJsStatic;

beforeAll(async () => {
  SQL = await initSqlJs();
});

const SAMPLE_CEDICT: CedictData = {
  熱鬧: { py: "re4 nao5", g: ["bustling with noise and excitement", "lively"], s: "热闹" },
  你好: { py: "ni3 hao3", g: ["hello"], s: "你好" },
  罕見: { py: "han3 jian4", g: ["rare"], s: "罕见" },
};

const SAMPLE_TOCFL = {
  熱鬧: { level: "TOCFL-2" },
  你好: { level: "TOCFL-1" },
};

const SAMPLE_FREQ: Record<string, number> = {
  罕見: 50000,
};

describe("dictPackaging sqlite builder", () => {
  it("builds bilingual sqlite and round-trips a lookup in-memory", () => {
    const rows = buildBilingualRows(SAMPLE_CEDICT, SAMPLE_TOCFL, SAMPLE_FREQ);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.term === "熱鬧")?.band).toBe("TOCFL-2");

    const bytes = buildSqliteAsset(SQL, rows);
    expect(bytes.byteLength).toBeGreaterThan(0);

    const db = new SQL.Database(bytes);
    const hit = lookupPackagingEntry(db, "熱鬧");
    expect(hit).toBeDefined();
    const payload = JSON.parse(hit!.payload) as { g: string[] };
    expect(payload.g).toContain("lively");
    db.close();
  });

  it("builds an empty monolingual stub when no generated data", () => {
    const rows = buildMonolingualRows(undefined);
    expect(rows).toEqual([]);

    const bytes = buildSqliteAsset(SQL, rows);
    const db = new SQL.Database(bytes);
    const stmt = db.prepare("SELECT COUNT(*) AS n FROM entries");
    stmt.step();
    expect(stmt.getAsObject().n).toBe(0);
    stmt.free();
    db.close();
  });

  it("builds monolingual sqlite from generated JSON", () => {
    const mono: MonoDictData = {
      熱鬧: {
        gloss: "（形容）人多、又吵又有活力。",
        illustration: "像夜市那種氣氛。",
        level: "TOCFL-2",
      },
    };
    const rows = buildMonolingualRows(mono);
    const bytes = buildSqliteAsset(SQL, rows);
    const db = new SQL.Database(bytes);
    const hit = lookupPackagingEntry(db, "熱鬧");
    expect(hit?.band).toBe("TOCFL-2");
    const payload = JSON.parse(hit!.payload) as { gloss: string };
    expect(payload.gloss).toContain("人多");
    db.close();
  });
});

describe("dictPackaging JSON shards", () => {
  it("places TOCFL-1..2 entries in the core shard", () => {
    const shards = buildJsonShards(SAMPLE_CEDICT, SAMPLE_TOCFL, SAMPLE_FREQ);
    expect(shards["tocfl-1-2"]).toMatchObject({
      熱鬧: SAMPLE_CEDICT["熱鬧"],
      你好: SAMPLE_CEDICT["你好"],
    });
    expect(shards["tocfl-1-2"]).not.toHaveProperty("罕見");
    expect(shards["tocfl-7"]).toHaveProperty("罕見");
  });
});

describe("dictPackaging size budget math", () => {
  it("shouldMigrateToSqlite triggers at 50k entries", () => {
    expect(shouldMigrateToSqlite(49_999, 0)).toBe(false);
    expect(shouldMigrateToSqlite(SQLITE_TRIGGER_ENTRY_COUNT, 0)).toBe(true);
  });

  it("shouldMigrateToSqlite triggers at 25 MB ungzipped", () => {
    expect(shouldMigrateToSqlite(0, SQLITE_TRIGGER_UNGZIPPED_BYTES - 1)).toBe(false);
    expect(shouldMigrateToSqlite(0, SQLITE_TRIGGER_UNGZIPPED_BYTES)).toBe(true);
  });

  it("computeSizeBudgetReport flags core band over 2 MB", () => {
    const over = computeSizeBudgetReport({
      coreShard: {
        x: { py: "a", g: ["y".repeat(CORE_BAND_MAX_UNGZIPPED_BYTES)], s: "x" },
      },
      totalJsonBytes: CORE_BAND_MAX_UNGZIPPED_BYTES + 100,
      totalEntryCount: 1,
      bilingualSqliteBytes: 1000,
      monoSqliteBytes: 512,
      lookupTransferBytesEstimate: 64,
    });
    expect(over.coreBandWithinBudget).toBe(false);
    expect(over.sqliteMigrationRecommended).toBe(false);
  });

  it("packageDictAssets reports lookup transfer for a real sample", () => {
    const assets = packageDictAssets(SQL, {
      cedict: SAMPLE_CEDICT,
      tocfl: SAMPLE_TOCFL,
      freq: SAMPLE_FREQ,
    });
    expect(assets.sizeReport.metrics.lookupTransferBytesEstimate).toBeGreaterThan(0);
    expect(assets.sizeReport.metrics.coreBandEntryCount).toBe(2);
    expect(assets.licenseAssert.ok).toBe(true);
  });
});

describe("dictPackaging license assertion", () => {
  it("hard-fails MoEDict BY-ND seed via packaging assert (PRD fixture)", () => {
    expect(packagingMoedictFixtureFails()).toBe(true);
    const result = assertPackagingLicenses(moedictByNdSeedFixture());
    expect(result.ok).toBe(false);
  });

  it("allows default packaging provenance without mono data", () => {
    const result = assertPackagingLicenses(defaultPackagingProvenance(false));
    expect(result.ok).toBe(true);
  });

  it("allows authored mono as generation seed", () => {
    const result = assertPackagingLicenses(defaultPackagingProvenance(true));
    expect(result.ok).toBe(true);
  });
});