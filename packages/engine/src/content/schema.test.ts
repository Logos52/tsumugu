import { describe, it, expect } from "vitest";
import {
  PREPARED_CONTENT_SCHEMA,
  PREPARED_CONTENT_SCHEMA_V2,
  type PrebakedEntry,
  type ExampleSentence,
} from "../types.js";
import {
  normalizePreparedContent,
  normalizePrebakedEntry,
  type RawPreparedContent,
} from "./schema.js";
import { parsePreparedContent, lookupPrebaked } from "./prepared.js";

/** Compile-level guard: widened `PrebakedEntry.examples` is never `string[]`. */
type ExamplesType = NonNullable<PrebakedEntry["examples"]>;
type AssertNotStringArray = ExamplesType extends string[] ? never : true;
const _examplesAreStructured: AssertNotStringArray = true;
void _examplesAreStructured;

describe("normalizePrebakedEntry", () => {
  it("upgrades @1 gloss and explanation into definitions.en", () => {
    const out = normalizePrebakedEntry(
      {
        term: "熱鬧",
        gloss: "lively; bustling",
        explanation: "人多、聲音多、很有活力的樣子。",
        examples: ["那裡很熱鬧。"],
      },
      PREPARED_CONTENT_SCHEMA,
    );
    expect(out.definitions?.en).toEqual({
      gloss: "lively; bustling",
      explanation: "人多、聲音多、很有活力的樣子。",
    });
    expect(out.gloss).toBe("lively; bustling");
    expect(out.definitions?.zh).toBeUndefined();
  });

  it("lifts legacy string[] examples to ExampleSentence rows", () => {
    const out = normalizePrebakedEntry(
      {
        term: "夜市",
        gloss: "night market",
        examples: ["今晚去夜市。", "台灣夜市很有名。"],
      },
      PREPARED_CONTENT_SCHEMA,
    );
    expect(out.examples).toEqual([
      { text: "今晚去夜市。", translation: "" },
      { text: "台灣夜市很有名。", translation: "" },
    ]);
  });

  it("passes through structured @2 examples", () => {
    const rows: ExampleSentence[] = [
      { text: "夜市很熱鬧。", translation: "The night market is lively." },
    ];
    const out = normalizePrebakedEntry(
      {
        term: "熱鬧",
        gloss: "lively",
        examples: rows,
        definitions: {
          en: { gloss: "lively" },
          zh: {
            gloss: "人多又吵",
            level: "TOCFL-2",
            monolingual: true,
          },
        },
      },
      PREPARED_CONTENT_SCHEMA_V2,
    );
    expect(out.examples).toEqual(rows);
    expect(out.definitions?.zh).toEqual({
      gloss: "人多又吵",
      level: "TOCFL-2",
      monolingual: true,
    });
  });

  it("upgrades Encoding-PRD zh levelCap rows into MonoDefinition", () => {
    const out = normalizePrebakedEntry(
      {
        term: "熱鬧",
        gloss: "lively",
        definitions: {
          zh: {
            gloss: "人多又吵",
            levelCap: "TOCFL-B1",
            leveledVerdict: "leveled",
          } as never,
        },
      },
      PREPARED_CONTENT_SCHEMA_V2,
    );
    expect(out.definitions?.zh).toEqual({
      gloss: "人多又吵",
      level: "TOCFL-B1",
      monolingual: true,
    });
  });
});

describe("normalizePreparedContent", () => {
  it("upgrades an entire @1 fixture to canonical @2 in memory", () => {
    const raw: RawPreparedContent = {
      schema: PREPARED_CONTENT_SCHEMA,
      lang: "zh-Hant",
      tokens: [{ text: "熱鬧", isWord: true }],
      glossary: {
        熱鬧: {
          term: "熱鬧",
          gloss: "lively",
          explanation: "人多、又吵又有活力。",
          examples: ["夜市很熱鬧。"],
        },
      },
    };
    const out = normalizePreparedContent(raw);
    expect(out.schema).toBe(PREPARED_CONTENT_SCHEMA_V2);
    expect(lookupPrebaked(out, "熱鬧")).toEqual({
      term: "熱鬧",
      gloss: "lively",
      definitions: {
        en: { gloss: "lively", explanation: "人多、又吵又有活力。" },
      },
      examples: [{ text: "夜市很熱鬧。", translation: "" }],
    });
  });

  it("passes through an @2 fixture", () => {
    const raw: RawPreparedContent = {
      schema: PREPARED_CONTENT_SCHEMA_V2,
      lang: "zh-Hant",
      tokens: [],
      glossary: {
        熱鬧: {
          term: "熱鬧",
          gloss: "lively",
          definitions: {
            en: { gloss: "lively and noisy" },
            zh: {
              gloss: "人多又吵",
              level: "TOCFL-2",
              monolingual: true,
            },
          },
          examples: [
            { text: "夜市很熱鬧。", translation: "The night market is lively." },
          ],
        },
      },
    };
    const out = normalizePreparedContent(raw);
    expect(out.schema).toBe(PREPARED_CONTENT_SCHEMA_V2);
    expect(lookupPrebaked(out, "熱鬧")?.definitions?.zh?.level).toBe("TOCFL-2");
  });
});

describe("parsePreparedContent integration", () => {
  it("normalizes @1 JSON on load so consumers never see string[] examples", () => {
    const json = JSON.stringify({
      schema: PREPARED_CONTENT_SCHEMA,
      lang: "zh-Hant",
      tokens: [],
      glossary: {
        夜市: {
          term: "夜市",
          gloss: "night market",
          examples: ["今晚去夜市。"],
        },
      },
    });
    const parsed = parsePreparedContent(json);
    expect(parsed.schema).toBe(PREPARED_CONTENT_SCHEMA_V2);
    const entry = lookupPrebaked(parsed, "夜市");
    expect(entry?.examples?.[0]).toEqual({ text: "今晚去夜市。", translation: "" });
    expect(typeof entry?.examples?.[0]).toBe("object");
  });
});