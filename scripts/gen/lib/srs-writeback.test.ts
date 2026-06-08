import { describe, it, expect, beforeAll } from "vitest";

import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import type { WordEntry } from "@tsumugu/engine";

import {
  reverseStatus,
  readWordListStatus,
  planWriteback,
  applyWriteback,
} from "./srs-writeback.js";

let SQL: Awaited<ReturnType<typeof initSqlJs>>;
beforeAll(async () => {
  SQL = await initSqlJs();
});

const iso = (ms: number): string => new Date(ms).toISOString();

function db(): Database {
  const d = new SQL.Database();
  d.run(
    "CREATE TABLE WordList (dictForm TEXT, secondary TEXT, partOfSpeech TEXT, language TEXT, mod INTEGER, del INTEGER, knownStatus TEXT, isPendingEnqueue INTEGER)",
  );
  d.run(
    "INSERT INTO WordList (dictForm, secondary, partOfSpeech, language, mod, del, knownStatus, isPendingEnqueue) VALUES " +
      "('學', '', 'noun', 'zh', 1000, 0, 'LEARNING', 0)," + // newer Tsumugu KNOWN → push
      "('習', '', 'verb', 'zh', 2000, 0, 'LEARNING', 0)," + // l3 maps to same LEARNING → skip
      "('讀', '', 'verb', 'zh', 9000, 0, 'UNKNOWN', 0)," + // SRS mod newer → never clobber
      "('說', '', 'verb', 'zh', 1000, 0, 'UNKNOWN', 0)", // store has no clock → skip
  );
  return d;
}

const ref = (dictForm: string, partOfSpeech: string, mod: number) => ({
  source: "srs" as const,
  dictForm,
  secondary: "",
  partOfSpeech,
  language: "zh",
  mod,
});

function entries(): WordEntry[] {
  return [
    { lang: "zh", word: "學", status: "known", statusUpdatedAt: iso(5000), externalRefs: [ref("學", "noun", 1000)] },
    { lang: "zh", word: "習", status: "l3", statusUpdatedAt: iso(2000), externalRefs: [ref("習", "verb", 2000)] },
    { lang: "zh", word: "讀", status: "known", statusUpdatedAt: iso(5000), externalRefs: [ref("讀", "verb", 9000)] },
    { lang: "zh", word: "寫", status: "known", statusUpdatedAt: iso(5000) }, // no externalRefs
    { lang: "zh", word: "聽", status: "known", statusUpdatedAt: iso(5000), externalRefs: [ref("聽", "noun", 1)] }, // no DB row
    { lang: "zh", word: "說", status: "known", externalRefs: [ref("說", "verb", 1000)] }, // no statusUpdatedAt
  ];
}

describe("reverseStatus", () => {
  it("collapses Tsumugu statuses into the SRS's 4 buckets", () => {
    expect(reverseStatus("known")).toBe("KNOWN");
    expect(reverseStatus("l4")).toBe("KNOWN");
    expect(reverseStatus("l3")).toBe("LEARNING");
    expect(reverseStatus("l1")).toBe("LEARNING");
    expect(reverseStatus("new")).toBe("UNKNOWN");
    expect(reverseStatus("ignored")).toBe("IGNORED");
  });
});

describe("planWriteback", () => {
  it("pushes only newer, differing, addressable changes; never clobbers", () => {
    const plan = planWriteback(entries(), readWordListStatus(db()));
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({ word: "學", from: "LEARNING", to: "KNOWN" });
    expect(plan.skipped).toEqual({ noRef: 1, noRow: 1, same: 1, notNewer: 1, noClock: 1 });
  });
});

describe("applyWriteback", () => {
  it("updates WordList knownStatus + mod + isPendingEnqueue, leaves others alone", () => {
    const d = db();
    const plan = planWriteback(entries(), readWordListStatus(d));
    applyWriteback(d, plan.changes, 12345);

    const after = readWordListStatus(d);
    const key = ["學", "", "noun", "zh"].join(String.fromCharCode(31));
    expect(after.get(key)).toEqual({ knownStatus: "KNOWN", mod: 12345 });

    const s = d.prepare("SELECT isPendingEnqueue FROM WordList WHERE dictForm = '學'");
    s.step();
    expect(s.getAsObject().isPendingEnqueue).toBe(1);
    s.free();

    // An untouched row keeps its original status.
    const xi = after.get(["習", "", "verb", "zh"].join(String.fromCharCode(31)));
    expect(xi).toEqual({ knownStatus: "LEARNING", mod: 2000 });
  });

  it("matches rows with SQL NULL tuple columns (COALESCE) and reports rows modified", () => {
    const d = new SQL.Database();
    d.run(
      "CREATE TABLE WordList (dictForm TEXT, secondary TEXT, partOfSpeech TEXT, language TEXT, mod INTEGER, del INTEGER, knownStatus TEXT, isPendingEnqueue INTEGER)",
    );
    // secondary AND partOfSpeech are SQL NULL — the read normalizes them to "".
    d.run(
      "INSERT INTO WordList (dictForm, secondary, partOfSpeech, language, mod, del, knownStatus, isPendingEnqueue) VALUES ('案', NULL, NULL, 'zh', 1000, 0, 'UNKNOWN', 0)",
    );
    const e: WordEntry = {
      lang: "zh",
      word: "案",
      status: "known",
      statusUpdatedAt: iso(5000),
      externalRefs: [ref("案", "", 1000)],
    };
    const plan = planWriteback([e], readWordListStatus(d));
    expect(plan.changes).toHaveLength(1);

    // Without COALESCE this UPDATE would match zero rows (NULL = '' is false).
    const modified = applyWriteback(d, plan.changes, 999);
    expect(modified).toBe(1);
    const key = ["案", "", "", "zh"].join(String.fromCharCode(31));
    expect(readWordListStatus(d).get(key)).toEqual({ knownStatus: "KNOWN", mod: 999 });
  });
});
