import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import {
  convertMigaku,
  normalizeStatus,
  mapLang,
  DEFAULT_LANG_MAP,
  type ConvertedWord,
} from "./convert.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/migaku-export.sample.json", import.meta.url), "utf8"),
);

const byWord = (words: ConvertedWord[]) =>
  Object.fromEntries(words.map((w) => [w.word, w]));

describe("normalizeStatus", () => {
  it("maps Migaku numeric codes (1=learning, 2=known, 0=unknown)", () => {
    expect(normalizeStatus(2)).toBe("KNOWN");
    expect(normalizeStatus(1)).toBe("LEARNING");
    expect(normalizeStatus(0)).toBe("UNKNOWN");
  });
  it("maps string forms case-insensitively, incl. stringified numerics", () => {
    expect(normalizeStatus("Known")).toBe("KNOWN");
    expect(normalizeStatus("learning")).toBe("LEARNING");
    expect(normalizeStatus("IGNORED")).toBe("IGNORED");
    expect(normalizeStatus("new")).toBe("UNKNOWN");
    expect(normalizeStatus("2")).toBe("KNOWN");
  });
  it("returns undefined for unrecognized codes (no guessing)", () => {
    expect(normalizeStatus(7)).toBeUndefined();
    expect(normalizeStatus("mature")).toBeUndefined();
    expect(normalizeStatus(null)).toBeUndefined();
  });
});

describe("mapLang", () => {
  it("maps Migaku Chinese/Vietnamese codes to Tsumugu ids", () => {
    expect(mapLang("zh", DEFAULT_LANG_MAP)).toBe("zh-Hant");
    expect(mapLang("ZH-TW", DEFAULT_LANG_MAP)).toBe("zh-Hant");
    expect(mapLang("vi", DEFAULT_LANG_MAP)).toBe("vi");
  });
  it("returns undefined for unmapped codes", () => {
    expect(mapLang("ja", DEFAULT_LANG_MAP)).toBeUndefined();
    expect(mapLang(undefined, DEFAULT_LANG_MAP)).toBeUndefined();
  });
});

describe("convertMigaku (default options: zh-Hant+vi via map, include K/L/I)", () => {
  const result = convertMigaku(fixture, { langs: ["zh-Hant", "vi"] });
  const map = byWord(result.words);

  it("keeps Known/Learning/Ignored and drops Unknown + unmapped-status", () => {
    expect(Object.keys(map).sort()).toEqual(["發展", "熱鬧", "phát triển", "夜市", "垃圾"].sort());
    expect(map["夜市"]).toEqual({ word: "夜市", lang: "zh-Hant", status: "KNOWN", reading: "yè shì" });
    expect(map["熱鬧"]?.status).toBe("LEARNING");
    expect(map["垃圾"]?.status).toBe("IGNORED");
    expect(map["電腦"]).toBeUndefined(); // status 0 (UNKNOWN) excluded by default include
    expect(map["怪"]).toBeUndefined(); // status 7 unrecognized
  });

  it("maps the Vietnamese record's language to vi", () => {
    expect(map["phát triển"]).toEqual({
      word: "phát triển",
      lang: "vi",
      status: "KNOWN",
      reading: "phát triển",
    });
  });

  it("drops other languages and reports them as unmapped, not silent", () => {
    expect(map["あいさつ"]).toBeUndefined();
    expect(result.stats.unmappedLang).toContain("ja");
  });

  it("surfaces unrecognized status codes for follow-up", () => {
    expect(result.stats.unmappedStatus).toContain("7");
  });

  it("reports accurate stats", () => {
    expect(result.stats.total).toBe(8);
    expect(result.stats.kept).toBe(5);
    expect(result.stats.byLang).toEqual({ "zh-Hant": 4, vi: 1 });
    expect(result.stats.byStatus).toEqual({ KNOWN: 3, LEARNING: 1, IGNORED: 1 });
  });

  it("emits a shape the crossref migaku adapter consumes (words[] of {word,lang,status})", () => {
    for (const w of result.words) {
      expect(typeof w.word).toBe("string");
      expect(["zh-Hant", "vi"]).toContain(w.lang);
      expect(["KNOWN", "LEARNING", "UNKNOWN", "IGNORED"]).toContain(w.status);
    }
  });
});

describe("convertMigaku options", () => {
  it("honors --include to widen the kept statuses", () => {
    const result = convertMigaku(fixture, { langs: ["zh-Hant"], include: ["KNOWN"] });
    expect(result.stats.byStatus).toEqual({ KNOWN: 2 });
    expect(result.words.map((w) => w.word).sort()).toEqual(["發展", "夜市"].sort());
  });

  it("honors a custom langMap (e.g. mapping ja in)", () => {
    const result = convertMigaku(fixture, { langs: ["ja"], langMap: { ja: "ja" } });
    expect(result.words).toEqual([{ word: "あいさつ", lang: "ja", status: "KNOWN", reading: "aisatsu" }]);
  });

  it("accepts a bare array and {cards:[]} container too", () => {
    const arr = [{ word: "貓", language: "zh", status: 2 }];
    expect(convertMigaku(arr).words[0]?.word).toBe("貓");
    const cards = { cards: [{ word: "狗", language: "zh", status: 1 }] };
    expect(convertMigaku(cards).words[0]?.status).toBe("LEARNING");
  });
});
