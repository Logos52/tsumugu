import { describe, it, expect } from "vitest";
import { migakuAdapter, mapKnownness, DEFAULT_LANG } from "./index.js";
import type { ExternalVocabRecord } from "../types.js";

describe("mapKnownness", () => {
  it("maps the documented values (case-insensitive)", () => {
    expect(mapKnownness("KNOWN")).toBe("known");
    expect(mapKnownness("known")).toBe("known");
    expect(mapKnownness("LEARNING")).toBe("l3");
    expect(mapKnownness("learning")).toBe("l3");
    expect(mapKnownness("UNKNOWN")).toBe("new");
    expect(mapKnownness("new")).toBe("new");
    expect(mapKnownness("IGNORED")).toBe("ignored");
  });

  it("trims surrounding whitespace before mapping", () => {
    expect(mapKnownness("  Known ")).toBe("known");
  });

  it("maps every documented label in mixed case", () => {
    expect(mapKnownness("Learning")).toBe("l3");
    expect(mapKnownness("Ignored")).toBe("ignored");
    expect(mapKnownness("New")).toBe("new");
    expect(mapKnownness("Unknown")).toBe("new");
    expect(mapKnownness("KnOwN")).toBe("known");
  });

  it("returns undefined for unrecognized values", () => {
    expect(mapKnownness("suspended")).toBeUndefined();
    expect(mapKnownness("")).toBeUndefined();
    expect(mapKnownness("   ")).toBeUndefined();
    expect(mapKnownness("l3")).toBeUndefined();
    // Tsumugu's own status labels are NOT Migaku labels (mapping is per-adapter).
    expect(mapKnownness("l1")).toBeUndefined();
    expect(mapKnownness("l4")).toBeUndefined();
  });
});

describe("migakuAdapter.parse — shape resilience", () => {
  it("accepts a bare array of records", () => {
    const out = migakuAdapter.parse([
      { word: "你好", lang: "zh-Hant", status: "KNOWN" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.word).toBe("你好");
  });

  it("accepts an object wrapping `words`", () => {
    const out = migakuAdapter.parse({
      words: [{ word: "謝謝", lang: "zh-Hant", status: "LEARNING" }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.status).toBe("l3");
  });

  it("accepts an object wrapping `cards`", () => {
    const out = migakuAdapter.parse({
      cards: [{ word: "再見", lang: "zh-Hant", status: "UNKNOWN" }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.status).toBe("new");
  });

  it("prefers `words` over `cards` when both present", () => {
    const out = migakuAdapter.parse({
      words: [{ word: "甲" }],
      cards: [{ word: "乙" }],
    });
    expect(out.map((r) => r.word)).toEqual(["甲"]);
  });

  it("returns [] for unusable shapes without throwing", () => {
    expect(migakuAdapter.parse(null)).toEqual([]);
    expect(migakuAdapter.parse(undefined)).toEqual([]);
    expect(migakuAdapter.parse(42)).toEqual([]);
    expect(migakuAdapter.parse("nope")).toEqual([]);
    expect(migakuAdapter.parse(true)).toEqual([]);
    expect(migakuAdapter.parse({})).toEqual([]);
    expect(migakuAdapter.parse({ words: "not-an-array" })).toEqual([]);
    expect(migakuAdapter.parse({ cards: 7 })).toEqual([]);
    expect(migakuAdapter.parse([])).toEqual([]);
    expect(migakuAdapter.parse({ words: [] })).toEqual([]);
  });

  it("does not treat array prototype/own keys as records (prototype safety)", () => {
    // An array is not a plain object, so `words`/`cards` are not read off it,
    // and the bare-array branch iterates its elements as records.
    const arr = [{ word: "甲", lang: "zh-Hant" }];
    expect(migakuAdapter.parse(arr).map((r) => r.word)).toEqual(["甲"]);
    // Objects created without a prototype still parse.
    const noProto = Object.assign(Object.create(null), {
      words: [{ word: "乙", lang: "zh-Hant" }],
    });
    expect(migakuAdapter.parse(noProto).map((r) => r.word)).toEqual(["乙"]);
  });

  it("skips entries with no usable word but keeps the rest", () => {
    const out = migakuAdapter.parse([
      { lang: "zh-Hant", status: "KNOWN" }, // no word
      { word: "  ", lang: "zh-Hant" }, // empty after trim
      42, // not an object
      null,
      { word: "好", lang: "zh-Hant" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.word).toBe("好");
  });
});

describe("migakuAdapter.parse — field mapping", () => {
  it("maps status, externalStatus, reading, gloss and preserves raw", () => {
    const rawRec = {
      word: "發展",
      lang: "zh-Hant",
      status: "LEARNING",
      reading: "fā zhǎn",
      gloss: "development",
    };
    const out = migakuAdapter.parse([rawRec]);
    const rec = out[0] as ExternalVocabRecord;
    expect(rec.source).toBe("migaku");
    expect(rec.lang).toBe("zh-Hant");
    expect(rec.word).toBe("發展");
    expect(rec.status).toBe("l3");
    expect(rec.externalStatus).toBe("LEARNING");
    expect(rec.reading).toBe("fā zhǎn");
    expect(rec.gloss).toBe("development");
    expect(rec.raw).toEqual(rawRec);
  });

  it("keeps externalStatus but leaves status undefined for unknown labels", () => {
    const out = migakuAdapter.parse([
      { word: "X", lang: "zh-Hant", status: "SUSPENDED" },
    ]);
    expect(out[0]?.externalStatus).toBe("SUSPENDED");
    expect(out[0]?.status).toBeUndefined();
  });

  it("falls back to DEFAULT_LANG when no language field is present", () => {
    const out = migakuAdapter.parse([{ word: "x" }]);
    expect(out[0]?.lang).toBe(DEFAULT_LANG);
    expect(DEFAULT_LANG).toBe("und");
  });

  it("reads alternate field names (term/language/meaning/pronunciation)", () => {
    const out = migakuAdapter.parse([
      {
        term: "y",
        language: "vi",
        meaning: "a thing",
        pronunciation: "yuh",
      },
    ]);
    expect(out[0]?.word).toBe("y");
    expect(out[0]?.lang).toBe("vi");
    expect(out[0]?.gloss).toBe("a thing");
    expect(out[0]?.reading).toBe("yuh");
  });

  it("prefers the primary field name over aliases when both exist", () => {
    const out = migakuAdapter.parse([
      {
        word: "primary",
        term: "alias",
        reading: "good",
        pronunciation: "bad",
        gloss: "kept",
        meaning: "dropped",
      },
    ]);
    expect(out[0]?.word).toBe("primary");
    expect(out[0]?.reading).toBe("good");
    expect(out[0]?.gloss).toBe("kept");
  });

  it("ignores non-string and empty field values, falling through to aliases", () => {
    const out = migakuAdapter.parse([
      {
        word: "", // empty → not usable on its own
        term: 123, // non-string → skipped
        text: "  real  ", // trimmed and used
        reading: 42, // non-string → reading stays undefined
        gloss: "", // empty → gloss stays undefined
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.word).toBe("real");
    expect(out[0]?.reading).toBeUndefined();
    expect(out[0]?.gloss).toBeUndefined();
  });

  it("reads externalStatus from `knownness` / `known` field aliases", () => {
    const fromKnownness = migakuAdapter.parse([
      { word: "a", lang: "vi", knownness: "LEARNING" },
    ]);
    expect(fromKnownness[0]?.externalStatus).toBe("LEARNING");
    expect(fromKnownness[0]?.status).toBe("l3");

    const fromKnown = migakuAdapter.parse([
      { word: "b", lang: "vi", known: "ignored" },
    ]);
    expect(fromKnown[0]?.externalStatus).toBe("ignored");
    expect(fromKnown[0]?.status).toBe("ignored");
  });

  it("omits optional fields when absent (clean records)", () => {
    const out = migakuAdapter.parse([{ word: "z", lang: "vi" }]);
    const rec = out[0] as ExternalVocabRecord;
    expect(rec.status).toBeUndefined();
    expect(rec.externalStatus).toBeUndefined();
    expect(rec.reading).toBeUndefined();
    expect(rec.gloss).toBeUndefined();
  });
});

describe("migakuAdapter — serialization round-trip", () => {
  it("produces JSON-serializable records that survive a round-trip", () => {
    const out = migakuAdapter.parse({
      words: [
        { word: "一", lang: "zh-Hant", status: "KNOWN" },
        { word: "二", lang: "zh-Hant", status: "weird" },
      ],
    });
    const round = JSON.parse(JSON.stringify(out)) as ExternalVocabRecord[];
    expect(round).toEqual(out);
  });

  it("the source field is exactly the literal 'migaku'", () => {
    const out = migakuAdapter.parse([{ word: "x", lang: "vi" }]);
    expect(out[0]?.source).toBe("migaku");
    expect(migakuAdapter.source).toBe("migaku");
  });

  it("round-trips nested JSON-safe values inside raw passthrough", () => {
    const rawRec = {
      word: "詞",
      lang: "zh-Hant",
      status: "KNOWN",
      meta: { tags: ["a", "b"], n: 3, nested: { ok: true } },
    };
    const out = migakuAdapter.parse([rawRec]);
    const round = JSON.parse(JSON.stringify(out)) as ExternalVocabRecord[];
    expect(round).toEqual(out);
    expect(round[0]?.raw).toEqual(rawRec);
  });
});
