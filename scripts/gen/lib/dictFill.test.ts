import { describe, it, expect } from "vitest";
import {
  applyDictionaryFill,
  listWordsNeedingFill,
  needsDictionaryFill,
} from "./dictFill.js";
import { PREPARED_CONTENT_SCHEMA_V2, type PreparedContent } from "@tsumugu/engine";

function makeContent(): PreparedContent {
  return {
    schema: "tsumugu/prepared-content@1",
    lang: "zh-Hant",
    tokens: [{ text: "熱鬧", isWord: true }],
    glossary: {
      熱鬧: {
        term: "熱鬧",
        gloss: "lively",
        definitions: {
          zh: { gloss: "", level: "TOCFL-3", monolingual: true, source: "generated" },
        },
        examples: [{ text: "", translation: "", shared: true, source: "generated" }],
        collocations: [{ phrase: "", translation: "", shared: true, source: "generated" }],
      },
    },
  };
}

describe("dictFill", () => {
  it("lists words needing fill", () => {
    const needs = listWordsNeedingFill(makeContent());
    expect(needs).toHaveLength(1);
    expect(needs[0]!.needs).toContain("definitions.zh");
    expect(needs[0]!.needs).toContain("examples");
    expect(needs[0]!.needs).toContain("collocations");
  });

  it("applies fill and stamps @2 with highlightSpans", () => {
    const filled = applyDictionaryFill(makeContent(), {
      熱鬧: {
        zh: {
          gloss: "（形容）人多、又吵、又有活力，讓人覺得開心的樣子。",
          illustration: "像夜市、廟會那種氣氛。",
        },
        examples: [
          {
            text: "週末的夜市很熱鬧。",
            translation: "The weekend night market is very lively.",
            shared: true,
            source: "generated",
          },
        ],
        collocations: [
          {
            phrase: "很熱鬧",
            translation: "very lively",
            pattern: "很 + ADJ",
            shared: true,
            source: "generated",
          },
        ],
      },
    });
    expect(filled.schema).toBe(PREPARED_CONTENT_SCHEMA_V2);
    expect(filled.glossary["熱鬧"]!.definitions?.zh?.gloss).toContain("人多");
    expect(filled.glossary["熱鬧"]!.examples?.[0]!.highlightSpans).toEqual([
      { start: 6, end: 8 },
    ]);
    expect(needsDictionaryFill(filled.glossary["熱鬧"]!)).toBe(false);
  });
});