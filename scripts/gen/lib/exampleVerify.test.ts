import { describe, it, expect } from "vitest";
import {
  WordStore,
  computeHighlightSpans,
  type ExampleSentence,
  type PreparedContent,
} from "@tsumugu/engine";
import { verifyContent } from "./verify.js";
import type { DefLevelIndex } from "./defLevelData.js";
import { exampleTargetCount } from "./examples.js";
import { mineTatoeba } from "./tatoeba.js";

const fakeZh = {
  id: "zh-Hant",
  name: "Fake zh-Hant",
  segmenter: async (text: string) =>
    [...text].map((ch, i) => ({
      text: ch,
      start: i,
      end: i + 1,
      isWord: /\p{Script=Han}/u.test(ch),
    })),
  dictionaryProvider: async () => undefined,
  phoneticLayer: { id: "none", reading: () => undefined },
  levelingModel: async () => undefined,
};

const DEF_INDEX: DefLevelIndex = {
  tocfl: {
    週末: { level: "TOCFL-2" },
    夜市: { level: "TOCFL-3" },
    總是: { level: "TOCFL-2" },
    很: { level: "TOCFL-1" },
    熱鬧: { level: "TOCFL-5" },
    人: { level: "TOCFL-1" },
    多: { level: "TOCFL-1" },
    的: { level: "TOCFL-1" },
    是: { level: "TOCFL-1" },
    去: { level: "TOCFL-1" },
    我們: { level: "TOCFL-2" },
  },
  freq: {},
};

function exampleRow(text: string, translation: string, shared = true): ExampleSentence {
  const headword = "熱鬧";
  return {
    text,
    translation,
    shared,
    source: "generated",
    highlightSpans: computeHighlightSpans(text, headword),
  };
}

function zhContent(glossary: PreparedContent["glossary"]): PreparedContent {
  return {
    schema: "tsumugu/prepared-content@2",
    lang: "zh-Hant",
    tokens: [{ text: "熱鬧", isWord: true }],
    glossary,
  };
}

describe("exampleTargetCount", () => {
  it("returns a value between 3 and 6", () => {
    expect(exampleTargetCount("熱鬧")).toBeGreaterThanOrEqual(3);
    expect(exampleTargetCount("熱鬧")).toBeLessThanOrEqual(6);
  });
});

describe("verifyContent — examples", () => {
  const store = new WordStore();
  store.setStatus("zh-Hant", "夜市", "known");
  store.setStatus("zh-Hant", "週末", "known");

  it("accepts 3–6 shared examples with highlightSpans and band pass", async () => {
    const report = await verifyContent({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      defLevelIndex: DEF_INDEX,
      content: zhContent({
        熱鬧: {
          term: "熱鬧",
          gloss: "lively",
          definitions: {
            zh: {
              gloss: "人很多，很開心。",
              level: "TOCFL-3",
              monolingual: true,
            },
          },
          examples: [
            exampleRow("週末的夜市總是很熱鬧。", "The weekend night market is always lively."),
            exampleRow("夜市總是很熱鬧。", "The night market is always lively."),
            exampleRow("人很多，夜市很熱鬧。", "Many people; the night market is lively."),
          ],
        },
      }),
    });

    const stats = report.exampleByEntry["熱鬧"];
    expect(stats?.exampleCount).toBe(3);
    expect(stats?.countOk).toBe(true);
    expect(stats?.headwordMissing).toEqual([]);
    expect(stats?.highlightSpanErrors).toEqual([]);
    expect(report.exampleErrors).toBe(false);
  });

  it("flags missing headword and highlightSpans", async () => {
    const report = await verifyContent({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      defLevelIndex: DEF_INDEX,
      content: zhContent({
        熱鬧: {
          term: "熱鬧",
          gloss: "lively",
          definitions: {
            zh: {
              gloss: "人很多，很開心。",
              level: "TOCFL-3",
              monolingual: true,
            },
          },
          examples: [
            { text: "週末的夜市總是很開心。", translation: "Happy night market.", shared: true },
            exampleRow("夜市總是很熱鬧。", "Lively night market."),
            exampleRow("人很多，夜市很熱鬧。", "Many people; lively night market."),
          ],
        },
      }),
    });

    const stats = report.exampleByEntry["熱鬧"];
    expect(stats?.headwordMissing).toContain(0);
    expect(stats?.highlightSpanErrors.some((e) => e.index === 0)).toBe(true);
    expect(report.exampleErrors).toBe(true);
  });

  it("enforces shared:true on shared-base rows", async () => {
    const report = await verifyContent({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      defLevelIndex: DEF_INDEX,
      content: zhContent({
        熱鬧: {
          term: "熱鬧",
          gloss: "lively",
          definitions: {
            zh: {
              gloss: "人很多，很開心。",
              level: "TOCFL-3",
              monolingual: true,
            },
          },
          examples: [
            {
              text: "週末的夜市總是很熱鬧。",
              translation: "Lively night market.",
              highlightSpans: computeHighlightSpans("週末的夜市總是很熱鬧。", "熱鬧"),
            },
            exampleRow("夜市總是很熱鬧。", "Always lively."),
            exampleRow("這裡人很多，很熱鬧。", "Many people, lively."),
          ],
        },
      }),
    });

    expect(report.exampleByEntry["熱鬧"]?.sharedFlagErrors.length).toBeGreaterThan(0);
    expect(report.exampleErrors).toBe(true);
  });

  it("reports overlay recycle ratio only for shared:false rows", async () => {
    const report = await verifyContent({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      defLevelIndex: DEF_INDEX,
      content: zhContent({
        熱鬧: {
          term: "熱鬧",
          gloss: "lively",
          definitions: {
            zh: {
              gloss: "人很多，很開心。",
              level: "TOCFL-3",
              monolingual: true,
            },
          },
          examples: [
            exampleRow("週末的夜市總是很熱鬧。", "Shared one."),
            exampleRow("夜市總是很熱鬧。", "Shared two."),
            exampleRow("人很多，夜市很熱鬧。", "Shared three."),
            exampleRow("我們週末去夜市，很熱鬧。", "Overlay one.", false),
          ],
        },
      }),
    });

    expect(report.exampleOverlayRecycleRatio).not.toBeNull();
    expect(report.exampleByEntry["熱鬧"]?.overlayCount).toBe(1);
  });

  it("stubs Tatoeba mining when no data file is present", async () => {
    const result = await mineTatoeba({
      headword: "熱鬧",
      floorBand: "TOCFL-3",
      dataPath: "/tmp/nonexistent-tatoeba.jsonl",
    });
    expect(result.stubbed).toBe(true);
    expect(result.cc0).toEqual([]);
    expect(result.ccBy).toEqual([]);
  });
});