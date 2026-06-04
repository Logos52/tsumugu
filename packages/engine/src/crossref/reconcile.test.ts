import { describe, it, expect } from "vitest";
import { migakuAdapter, reconcile } from "./index.js";
import type {
  ExternalVocabRecord,
  ReconciliationReport,
  WordEntry,
} from "../types.js";

const LANG = "zh-Hant";

/** A tiny store: one agreement, one conflict, one store-only word. */
function store(): WordEntry[] {
  return [
    { lang: LANG, word: "你好", status: "known" }, // agrees with migaku
    { lang: LANG, word: "謝謝", status: "known" }, // migaku says LEARNING → conflict
    { lang: LANG, word: "孤獨", status: "l2" }, // not in migaku at all
    { lang: "vi", word: "xin", status: "new" }, // other language → ignored
  ];
}

/** A small Migaku-shaped export covering agreement, conflict, and missing. */
const migakuJson = {
  words: [
    { word: "你好", lang: LANG, status: "KNOWN" }, // matches store
    { word: "謝謝", lang: LANG, status: "LEARNING" }, // conflicts with store
    { word: "再見", lang: LANG, status: "UNKNOWN" }, // missing from store
    { word: "xin", lang: "vi", status: "KNOWN" }, // wrong lang → excluded
  ],
};

describe("reconcile — Migaku JSON → records → reconcile", () => {
  const records = migakuAdapter.parse(migakuJson);
  const report: ReconciliationReport = reconcile(LANG, store(), records);

  it("parses the right number of records (cross-lang kept at parse time)", () => {
    expect(records).toHaveLength(4);
  });

  it("reconciled covers store ∪ external for the target lang only", () => {
    // store: 你好, 謝謝, 孤獨 (zh) ; external adds 再見. vi rows excluded.
    expect(report.reconciled.map((r) => r.word)).toEqual([
      "你好",
      "謝謝",
      "孤獨",
      "再見",
    ]);
  });

  it("flags the conflict (謝謝: store=known vs migaku=l3)", () => {
    expect(report.conflicts.map((r) => r.word)).toEqual(["謝謝"]);
    const conflict = report.conflicts[0];
    expect(conflict?.storeStatus).toBe("known");
    expect(conflict?.external[0]?.status).toBe("l3");
    expect(conflict?.conflict).toBe(true);
  });

  it("does NOT flag the agreement (你好: store=known, migaku=known)", () => {
    const agree = report.reconciled.find((r) => r.word === "你好");
    expect(agree?.conflict).toBe(false);
    expect(agree?.storeStatus).toBe("known");
    expect(agree?.external[0]?.status).toBe("known");
  });

  it("reports words missing from the store (再見, external-only)", () => {
    expect(report.missingFromStore.map((r) => r.word)).toEqual(["再見"]);
    const missing = report.missingFromStore[0];
    expect(missing?.storeStatus).toBeUndefined();
    expect(missing?.external[0]?.status).toBe("new");
  });

  it("does not list store-only words as missing (孤獨)", () => {
    const lonely = report.reconciled.find((r) => r.word === "孤獨");
    expect(lonely?.external).toEqual([]);
    expect(report.missingFromStore.map((r) => r.word)).not.toContain("孤獨");
  });

  it("excludes the other-language row entirely", () => {
    expect(report.reconciled.map((r) => r.word)).not.toContain("xin");
  });
});

describe("reconcile — conflict semantics", () => {
  it("treats an undefined external status as non-conflicting", () => {
    const records: ExternalVocabRecord[] = [
      { source: "migaku", lang: LANG, word: "曖昧", externalStatus: "SUSPENDED" },
    ];
    const entries: WordEntry[] = [{ lang: LANG, word: "曖昧", status: "l2" }];
    const report = reconcile(LANG, entries, records);
    expect(report.conflicts).toHaveLength(0);
    const row = report.reconciled[0];
    expect(row?.conflict).toBe(false);
    expect(row?.external[0]?.externalStatus).toBe("SUSPENDED");
    expect(row?.external[0]?.status).toBeUndefined();
  });

  it("does not flag a conflict when the word is absent from the store", () => {
    const records: ExternalVocabRecord[] = [
      { source: "migaku", lang: LANG, word: "新詞", status: "known" },
    ];
    const report = reconcile(LANG, [], records);
    expect(report.conflicts).toHaveLength(0);
    expect(report.missingFromStore.map((r) => r.word)).toEqual(["新詞"]);
  });

  it("flags conflict when ANY of multiple external sources disagrees", () => {
    const records: ExternalVocabRecord[] = [
      { source: "migaku", lang: LANG, word: "詞", status: "known" },
      { source: "anki", lang: LANG, word: "詞", status: "l1" },
    ];
    const entries: WordEntry[] = [{ lang: LANG, word: "詞", status: "known" }];
    const report = reconcile(LANG, entries, records);
    expect(report.conflicts.map((r) => r.word)).toEqual(["詞"]);
    expect(report.reconciled[0]?.external).toHaveLength(2);
  });

  it("no conflict when all defined external statuses match the store", () => {
    const records: ExternalVocabRecord[] = [
      { source: "migaku", lang: LANG, word: "詞", status: "known" },
      { source: "anki", lang: LANG, word: "詞", status: "known" },
    ];
    const entries: WordEntry[] = [{ lang: LANG, word: "詞", status: "known" }];
    const report = reconcile(LANG, entries, records);
    expect(report.conflicts).toHaveLength(0);
  });

  it("agreeing source + undefined-status source = no conflict", () => {
    const records: ExternalVocabRecord[] = [
      { source: "migaku", lang: LANG, word: "詞", status: "known" },
      { source: "anki", lang: LANG, word: "詞", externalStatus: "SUSPENDED" },
    ];
    const entries: WordEntry[] = [{ lang: LANG, word: "詞", status: "known" }];
    const report = reconcile(LANG, entries, records);
    expect(report.conflicts).toHaveLength(0);
    expect(report.reconciled[0]?.external).toHaveLength(2);
  });

  it("conflicting source still flags even when a sibling source agrees", () => {
    const records: ExternalVocabRecord[] = [
      { source: "migaku", lang: LANG, word: "詞", status: "known" }, // agrees
      { source: "anki", lang: LANG, word: "詞", status: "l1" }, // disagrees
    ];
    const entries: WordEntry[] = [{ lang: LANG, word: "詞", status: "known" }];
    const report = reconcile(LANG, entries, records);
    expect(report.conflicts.map((r) => r.word)).toEqual(["詞"]);
  });

  it("does NOT flag external-vs-external disagreement when store is absent", () => {
    // Spec: conflict requires the store to be present. Two external sources that
    // disagree with each other but with no store entry are 'missingFromStore',
    // not a conflict.
    const records: ExternalVocabRecord[] = [
      { source: "migaku", lang: LANG, word: "詞", status: "known" },
      { source: "anki", lang: LANG, word: "詞", status: "new" },
    ];
    const report = reconcile(LANG, [], records);
    expect(report.conflicts).toHaveLength(0);
    expect(report.missingFromStore.map((r) => r.word)).toEqual(["詞"]);
    expect(report.reconciled[0]?.conflict).toBe(false);
  });

  it("conflicts is always a subset of reconciled (same row objects)", () => {
    const records = migakuAdapter.parse(migakuJson);
    const report = reconcile(LANG, store(), records);
    for (const c of report.conflicts) {
      expect(report.reconciled).toContain(c); // identity, not just equality
    }
    for (const m of report.missingFromStore) {
      expect(report.reconciled).toContain(m);
    }
  });
});

describe("reconcile — edge cases & determinism", () => {
  it("handles empty inputs", () => {
    const report = reconcile(LANG, [], []);
    expect(report).toEqual({
      lang: LANG,
      reconciled: [],
      conflicts: [],
      missingFromStore: [],
    });
  });

  it("last store entry wins per (lang, word)", () => {
    const entries: WordEntry[] = [
      { lang: LANG, word: "重", status: "new" },
      { lang: LANG, word: "重", status: "l4" },
    ];
    const report = reconcile(LANG, entries, []);
    expect(report.reconciled).toHaveLength(1);
    expect(report.reconciled[0]?.storeStatus).toBe("l4");
  });

  it("preserves first-seen ordering (store words anchor before new external)", () => {
    const entries: WordEntry[] = [{ lang: LANG, word: "乙", status: "new" }];
    const records: ExternalVocabRecord[] = [
      { source: "migaku", lang: LANG, word: "甲", status: "new" },
      { source: "migaku", lang: LANG, word: "乙", status: "new" },
    ];
    const report = reconcile(LANG, entries, records);
    // 乙 first (from store), then 甲 (external-only).
    expect(report.reconciled.map((r) => r.word)).toEqual(["乙", "甲"]);
  });

  it("preserves external source order within one word's external[]", () => {
    const records: ExternalVocabRecord[] = [
      { source: "anki", lang: LANG, word: "詞", status: "l1" },
      { source: "migaku", lang: LANG, word: "詞", status: "l2" },
      { source: "pleco", lang: LANG, word: "詞", status: "l3" },
    ];
    const report = reconcile(LANG, [], records);
    expect(report.reconciled[0]?.external.map((e) => e.source)).toEqual([
      "anki",
      "migaku",
      "pleco",
    ]);
  });

  it("filters BOTH store and records to the target lang at reconcile time", () => {
    const entries: WordEntry[] = [
      { lang: "vi", word: "xin", status: "known" },
      { lang: LANG, word: "你好", status: "known" },
    ];
    const records: ExternalVocabRecord[] = [
      { source: "migaku", lang: "vi", word: "chào", status: "new" },
      { source: "migaku", lang: LANG, word: "再見", status: "new" },
    ];
    const report = reconcile(LANG, entries, records);
    expect(report.reconciled.map((r) => r.word)).toEqual(["你好", "再見"]);
    expect(report.missingFromStore.map((r) => r.word)).toEqual(["再見"]);
  });

  it("returns no rows when no input matches the requested lang", () => {
    const entries: WordEntry[] = [{ lang: "vi", word: "xin", status: "new" }];
    const records: ExternalVocabRecord[] = [
      { source: "migaku", lang: "vi", word: "chào", status: "new" },
    ];
    const report = reconcile("zh-Hant", entries, records);
    expect(report).toEqual({
      lang: "zh-Hant",
      reconciled: [],
      conflicts: [],
      missingFromStore: [],
    });
  });

  it("a store-only word (no external) is reconciled but not missing", () => {
    const entries: WordEntry[] = [{ lang: LANG, word: "孤", status: "l2" }];
    const report = reconcile(LANG, entries, []);
    expect(report.reconciled[0]?.external).toEqual([]);
    expect(report.reconciled[0]?.storeStatus).toBe("l2");
    expect(report.missingFromStore).toHaveLength(0);
  });

  it("produces a JSON-serializable report", () => {
    const records = migakuAdapter.parse(migakuJson);
    const report = reconcile(LANG, store(), records);
    const round = JSON.parse(JSON.stringify(report)) as ReconciliationReport;
    expect(round).toEqual(report);
  });
});
