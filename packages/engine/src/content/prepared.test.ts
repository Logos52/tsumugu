import { describe, it, expect } from "vitest";
import {
  PREPARED_CONTENT_SCHEMA,
  type PreparedContent,
  type PrebakedEntry,
} from "../types.js";
import {
  isPreparedContent,
  parsePreparedContent,
  lookupPrebaked,
  wordTokens,
} from "./index.js";

function makeContent(over: Partial<PreparedContent> = {}): PreparedContent {
  return {
    schema: PREPARED_CONTENT_SCHEMA,
    lang: "zh-Hant",
    title: "Demo",
    source: "directed",
    ciTarget: 0.95,
    ciMeasured: 0.96,
    tokens: [
      { text: "你好", isWord: true },
      { text: "，", isWord: false },
      { text: "世界", isWord: true },
      { text: "。", isWord: false },
    ],
    glossary: {
      你好: { term: "你好", gloss: "hello", reading: "nǐ hǎo" },
      世界: { term: "世界", gloss: "world", reading: "shì jiè" },
    },
    generatedAt: "2026-06-04T00:00:00.000Z",
    ...over,
  };
}

describe("isPreparedContent", () => {
  it("accepts a valid prepared-content object", () => {
    expect(isPreparedContent(makeContent())).toBe(true);
  });

  it("accepts minimal valid content (no optional fields)", () => {
    const minimal = {
      schema: PREPARED_CONTENT_SCHEMA,
      lang: "vi",
      tokens: [],
      glossary: {},
    };
    expect(isPreparedContent(minimal)).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(isPreparedContent(null)).toBe(false);
    expect(isPreparedContent(undefined)).toBe(false);
    expect(isPreparedContent("string")).toBe(false);
    expect(isPreparedContent(42)).toBe(false);
    expect(isPreparedContent(true)).toBe(false);
    expect(isPreparedContent([])).toBe(false);
  });

  it("rejects a wrong or missing schema", () => {
    expect(isPreparedContent({ ...makeContent(), schema: "wrong" })).toBe(false);
    expect(
      isPreparedContent({ ...makeContent(), schema: "tsumugu/prepared-content@2" }),
    ).toBe(false);
    const { schema: _omit, ...noSchema } = makeContent();
    void _omit;
    expect(isPreparedContent(noSchema)).toBe(false);
  });

  it("rejects a non-string lang", () => {
    expect(isPreparedContent({ ...makeContent(), lang: 123 })).toBe(false);
    expect(isPreparedContent({ ...makeContent(), lang: undefined })).toBe(false);
  });

  it("rejects a non-array tokens field", () => {
    expect(isPreparedContent({ ...makeContent(), tokens: {} })).toBe(false);
    expect(isPreparedContent({ ...makeContent(), tokens: "x" })).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(
      isPreparedContent({ ...makeContent(), tokens: [{ text: "a" }] }),
    ).toBe(false);
    expect(
      isPreparedContent({ ...makeContent(), tokens: [{ isWord: true }] }),
    ).toBe(false);
    expect(
      isPreparedContent({
        ...makeContent(),
        tokens: [{ text: 1, isWord: true }],
      }),
    ).toBe(false);
    expect(
      isPreparedContent({
        ...makeContent(),
        tokens: [{ text: "a", isWord: "yes" }],
      }),
    ).toBe(false);
    expect(isPreparedContent({ ...makeContent(), tokens: [null] })).toBe(false);
  });

  it("tolerates extra fields on tokens", () => {
    const c = {
      ...makeContent(),
      tokens: [{ text: "a", isWord: true, start: 0, end: 1 }],
    };
    expect(isPreparedContent(c)).toBe(true);
  });

  it("rejects a non-object glossary", () => {
    expect(isPreparedContent({ ...makeContent(), glossary: [] })).toBe(false);
    expect(isPreparedContent({ ...makeContent(), glossary: null })).toBe(false);
    expect(isPreparedContent({ ...makeContent(), glossary: "x" })).toBe(false);
    expect(isPreparedContent({ ...makeContent(), glossary: 0 })).toBe(false);
  });

  it("rejects a missing glossary", () => {
    const { glossary: _omit, ...noGlossary } = makeContent();
    void _omit;
    expect(isPreparedContent(noGlossary)).toBe(false);
  });

  it("rejects a missing tokens field", () => {
    const { tokens: _omit, ...noTokens } = makeContent();
    void _omit;
    expect(isPreparedContent(noTokens)).toBe(false);
  });

  it("accepts an empty-string lang (string type is the only gate)", () => {
    expect(isPreparedContent({ ...makeContent(), lang: "" })).toBe(true);
  });
});

describe("parsePreparedContent", () => {
  it("parses a valid JSON string", () => {
    const json = JSON.stringify(makeContent());
    const parsed = parsePreparedContent(json);
    expect(parsed.lang).toBe("zh-Hant");
    expect(parsed.tokens).toHaveLength(4);
  });

  it("accepts an already-parsed object", () => {
    const obj = makeContent();
    expect(parsePreparedContent(obj)).toBe(obj);
  });

  it("round-trips through JSON without loss", () => {
    const original = makeContent();
    const round = parsePreparedContent(JSON.stringify(original));
    expect(round).toEqual(original);
  });

  it("throws a clear error on invalid JSON", () => {
    expect(() => parsePreparedContent("{ not json")).toThrowError(
      /not valid JSON/,
    );
  });

  it("throws a clear error on a valid-JSON but wrong-shape value", () => {
    expect(() => parsePreparedContent('{"schema":"wrong"}')).toThrowError(
      /expected schema/,
    );
    expect(() => parsePreparedContent({ foo: "bar" })).toThrowError(
      /Invalid prepared content/,
    );
  });

  it("throws on a JSON value that is not an object", () => {
    expect(() => parsePreparedContent("42")).toThrowError(
      /Invalid prepared content/,
    );
    expect(() => parsePreparedContent('"hi"')).toThrowError(
      /Invalid prepared content/,
    );
    expect(() => parsePreparedContent("null")).toThrowError(
      /Invalid prepared content/,
    );
  });

  it("rejects a JSON array (valid JSON, wrong shape)", () => {
    // JSON.parse("[]") succeeds, but an array is not PreparedContent.
    expect(() => parsePreparedContent("[]")).toThrowError(
      /expected schema/,
    );
    expect(() => parsePreparedContent([])).toThrowError(
      /Invalid prepared content/,
    );
  });

  it("round-trips a glossary with nested bridge data without loss", () => {
    const original = makeContent({
      glossary: {
        發展: {
          term: "發展",
          gloss: "to develop",
          examples: ["經濟發展很快。"],
          explanation: "Sino-Vietnamese compound.",
          bridge: {
            bridgeLang: "zh-Hant",
            etymon: "發展",
            bridgeReading: "phát triển",
            morphemes: [
              { surface: "phát", etymon: "發", reading: "fā", gloss: "emit" },
              { surface: "triển", etymon: "展", reading: "zhǎn", gloss: "unfold" },
            ],
            confidence: 0.87,
            corrected: false,
          },
        },
      },
    });
    const round = parsePreparedContent(JSON.stringify(original));
    expect(round).toEqual(original);
    // lossless deep equality on the nested bridge structures.
    expect(lookupPrebaked(round, "發展")?.bridge?.morphemes).toHaveLength(2);
  });
});

describe("lookupPrebaked", () => {
  it("returns the entry for a known surface form", () => {
    const c = makeContent();
    const entry = lookupPrebaked(c, "你好");
    expect(entry).toBeDefined();
    expect(entry?.gloss).toBe("hello");
  });

  it("returns undefined for an unknown word", () => {
    expect(lookupPrebaked(makeContent(), "未知")).toBeUndefined();
  });

  it("does not match inherited prototype keys", () => {
    expect(lookupPrebaked(makeContent(), "toString")).toBeUndefined();
    expect(lookupPrebaked(makeContent(), "constructor")).toBeUndefined();
    expect(lookupPrebaked(makeContent(), "hasOwnProperty")).toBeUndefined();
  });

  it("returns an entry that owns the key even if named like a proto member", () => {
    const entry: PrebakedEntry = { term: "toString", gloss: "to string" };
    const c = makeContent({ glossary: { toString: entry } });
    expect(lookupPrebaked(c, "toString")).toBe(entry);
  });
});

describe("wordTokens", () => {
  it("returns only the lexical tokens, in order", () => {
    const words = wordTokens(makeContent());
    expect(words.map((t) => t.text)).toEqual(["你好", "世界"]);
    expect(words.every((t) => t.isWord)).toBe(true);
  });

  it("returns an empty array when there are no word tokens", () => {
    const c = makeContent({
      tokens: [
        { text: "，", isWord: false },
        { text: "。", isWord: false },
      ],
    });
    expect(wordTokens(c)).toEqual([]);
  });
});
