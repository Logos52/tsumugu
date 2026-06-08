import { describe, it, expect, beforeAll } from "vitest";

import initSqlJs from "sql.js";
import type { Database } from "sql.js";

import { parseSrsDb } from "./srs-db.js";

let SQL: Awaited<ReturnType<typeof initSqlJs>>;
beforeAll(async () => {
  SQL = await initSqlJs();
});

/**
 * A tiny in-memory SRS store: a deleted row, a row with two history entries
 * (latest = STUDY), a row with no history, and an UNKNOWN row.
 */
function fixture(): Database {
  const db = new SQL.Database();
  db.run(
    "CREATE TABLE WordList (dictForm TEXT, secondary TEXT, partOfSpeech TEXT, language TEXT, mod INTEGER, del INTEGER, knownStatus TEXT)",
  );
  db.run(
    "CREATE TABLE wordHistory (dictForm TEXT, secondary TEXT, partOfSpeech TEXT, language TEXT, mod INTEGER, day INTEGER, knownStatus TEXT, prevKnownStatus TEXT, origin TEXT)",
  );
  db.run(
    "INSERT INTO WordList (dictForm, secondary, partOfSpeech, language, mod, del, knownStatus) VALUES " +
      "('學', '', 'noun', 'zh-Hant', 1764000000000, 0, 'KNOWN')," +
      "('習', '', 'verb', 'zh-Hant', 1765000000000, 0, 'LEARNING')," +
      "('刪', '', 'noun', 'zh-Hant', 1766000000000, 1, 'KNOWN')," +
      "('新', '', 'noun', 'zh-Hant', 1767000000000, 0, 'UNKNOWN')",
  );
  db.run(
    "INSERT INTO wordHistory (dictForm, secondary, partOfSpeech, language, mod, day, knownStatus, prevKnownStatus, origin) VALUES " +
      "('學', '', 'noun', 'zh-Hant', 1763000000000, 100, 'LEARNING', 'UNKNOWN', 'MANUAL')," +
      "('學', '', 'noun', 'zh-Hant', 1764000000000, 200, 'KNOWN', 'LEARNING', 'STUDY')",
  );
  return db;
}

describe("parseSrsDb", () => {
  it("skips soft-deleted rows", () => {
    const recs = parseSrsDb(fixture());
    const words = recs.map((r) => r.word);
    expect(recs).toHaveLength(3);
    expect(words).not.toContain("刪"); // del = 1
    expect(words).toEqual(expect.arrayContaining(["學", "習", "新"]));
  });

  it("maps knownStatus and carries the enriched 4-tuple + mod + latest origin in raw", () => {
    const byWord = Object.fromEntries(parseSrsDb(fixture()).map((r) => [r.word, r]));

    const xue = byWord["學"]!;
    expect(xue.status).toBe("known");
    expect(xue.externalStatus).toBe("KNOWN");
    expect(xue.lang).toBe("zh-Hant");
    // raw.* keys are exactly what applyToStore consumes; origin is the LATEST
    // history row (day 200 STUDY), not the earlier day-100 MANUAL one.
    expect(xue.raw).toMatchObject({
      dictForm: "學",
      secondary: "",
      partOfSpeech: "noun",
      language: "zh-Hant",
      mod: 1764000000000,
      knownStatus: "KNOWN",
      prevKnownStatus: "LEARNING",
      origin: "STUDY",
    });

    const xi = byWord["習"]!;
    expect(xi.status).toBe("l3"); // LEARNING → l3
    expect(xi.raw).toMatchObject({ partOfSpeech: "verb", mod: 1765000000000 });
    // No history row → no origin key (caller defaults to "import").
    expect((xi.raw as Record<string, unknown>).origin).toBeUndefined();

    const xin = byWord["新"]!;
    expect(xin.status).toBe("new"); // UNKNOWN → new
    expect(xin.externalStatus).toBe("UNKNOWN");
  });
});
