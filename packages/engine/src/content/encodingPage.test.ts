import { describe, it, expect } from "vitest";
import { ENCODING_PAGE_SCHEMA, type EncodingPageDoc } from "../types.js";
import { isEncodingPageDoc, parseEncodingPage } from "./encodingPage.js";

function makeDoc(over: Partial<EncodingPageDoc> = {}): EncodingPageDoc {
  return {
    schema: ENCODING_PAGE_SCHEMA,
    lang: "zh-Hant",
    term: "熱鬧",
    reading: { zhuyin: "ㄖㄜˋ ㄋㄠˋ", pinyin: "rènào" },
    pos: "adjective",
    level: "TOCFL-B1",
    definitions: {
      en: { gloss: "lively and noisy" },
      zh: {
        gloss: "人多、又吵又有活力",
        leveledVerdict: "leveled",
        levelCap: "TOCFL-B1",
      },
    },
    examples: [
      { text: "夜市很熱鬧。", translation: "The night market is lively." },
    ],
    etymology: {
      parts: [
        { char: "熱", reading: "rè", gloss: "hot" },
        { char: "鬧", reading: "nào", gloss: "noisy" },
      ],
      payoff: "hot + noisy → lively bustle",
      grounding: "mnemonic-device",
    },
    tricky: { text: "festive noise, not an alarm", confusable: "鬧鐘" },
    related: [{ word: "安靜", relation: "antonym" }],
    generatedAt: "2026-06-09T00:00:00.000Z",
    ...over,
  };
}

describe("isEncodingPageDoc", () => {
  it("accepts a valid encoding-page object", () => {
    expect(isEncodingPageDoc(makeDoc())).toBe(true);
  });

  it("rejects non-objects and wrong schema", () => {
    expect(isEncodingPageDoc(null)).toBe(false);
    expect(isEncodingPageDoc("x")).toBe(false);
    expect(isEncodingPageDoc({ ...makeDoc(), schema: "wrong" })).toBe(false);
  });

  it("rejects missing lang or term", () => {
    expect(isEncodingPageDoc({ ...makeDoc(), lang: 1 })).toBe(false);
    expect(isEncodingPageDoc({ ...makeDoc(), term: undefined })).toBe(false);
  });
});

describe("parseEncodingPage", () => {
  it("parses a valid JSON string", () => {
    const doc = makeDoc();
    const parsed = parseEncodingPage(JSON.stringify(doc));
    expect(parsed).toEqual(doc);
  });

  it("accepts an already-parsed object", () => {
    const doc = makeDoc();
    expect(parseEncodingPage(doc)).toBe(doc);
  });

  it("returns null on invalid JSON or shape", () => {
    expect(parseEncodingPage("{ not json")).toBeNull();
    expect(parseEncodingPage({ foo: "bar" })).toBeNull();
  });
});