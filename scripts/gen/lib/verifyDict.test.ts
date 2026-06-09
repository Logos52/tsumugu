import { describe, it, expect } from "vitest";
import { WordStore, type PreparedContent } from "@tsumugu/engine";
import { verifyContent } from "./verify.js";
import { moedictByNdSeedFixture } from "./licenseAssert.js";
import type { DefLevelIndex } from "./defLevelData.js";

const S2T: Record<string, string> = {
  发: "發",
  热: "熱",
  闹: "鬧",
  图: "圖",
  书: "書",
  馆: "館",
  样: "樣",
};
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
  scriptNormalizer: async (text: string) =>
    [...text].map((c) => S2T[c] ?? c).join(""),
};

const DEF_INDEX: DefLevelIndex = {
  tocfl: {
    人: { level: "TOCFL-1" },
    多: { level: "TOCFL-1" },
    很: { level: "TOCFL-1" },
    開心: { level: "TOCFL-2" },
    熱鬧: { level: "TOCFL-5" },
    地方: { level: "TOCFL-2" },
    像: { level: "TOCFL-2" },
    夜市: { level: "TOCFL-3" },
  },
  freq: {},
};

function zhContent(glossary: PreparedContent["glossary"]): PreparedContent {
  return {
    schema: "tsumugu/prepared-content@2",
    lang: "zh-Hant",
    tokens: [{ text: "測", isWord: true }],
    glossary,
  };
}

describe("verifyContent — zh definition guards", () => {
  const store = new WordStore();

  it("OpenCC-rewrites definitions.zh gloss and illustration", async () => {
    const report = await verifyContent({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      defLevelIndex: DEF_INDEX,
      content: zhContent({
        測: {
          term: "測",
          gloss: "test",
          definitions: {
            zh: {
              gloss: "很热闹的地方",
              illustration: "像夜市那样",
              level: "TOCFL-3",
              monolingual: true,
            },
          },
        },
      }),
    });
    expect(report.openccChanged).toBe(true);
    const zh = report.normalized.glossary["測"]?.definitions?.zh;
    expect(zh?.gloss).toBe("很熱鬧的地方");
    expect(zh?.illustration).toBe("像夜市那樣");
  });

  it("flags circular zh definitions", async () => {
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
              gloss: "熱鬧的地方人很多。",
              level: "TOCFL-3",
              monolingual: true,
            },
          },
        },
      }),
    });
    expect(report.zhDefCircular).toContain("熱鬧");
  });

  it("flags empty zh definitions", async () => {
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
              gloss: "   ",
              level: "TOCFL-3",
              monolingual: true,
            },
          },
        },
      }),
    });
    expect(report.zhDefEmpty).toContain("熱鬧");
  });

  it("reports defLevelViolations and stamps achievedLevel", async () => {
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
              level: "TOCFL-1",
              monolingual: true,
            },
          },
        },
      }),
    });
    expect(report.defLevelViolations.length).toBeGreaterThan(0);
    expect(report.defLevelViolations.some((v) => v.word === "開心")).toBe(true);
    const stamped = report.normalized.glossary["熱鬧"]?.definitions?.zh;
    expect(stamped?.achievedLevel).toBeDefined();
    expect(stamped?.levelEscalated).toBe(true);
    expect(report.defLevelByEntry["熱鬧"]?.violationCount).toBeGreaterThan(0);
  });

  it("hard-fails license assertion when provenance includes BY-ND seed", async () => {
    const report = await verifyContent({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      defLevelIndex: DEF_INDEX,
      provenance: moedictByNdSeedFixture(),
      content: zhContent({
        熱鬧: {
          term: "熱鬧",
          gloss: "lively",
          definitions: {
            zh: {
              gloss: "人很多。",
              level: "TOCFL-3",
              monolingual: true,
            },
          },
        },
      }),
    });
    expect(report.licenseErrors.length).toBeGreaterThan(0);
  });
});