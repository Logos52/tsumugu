import { describe, it, expect, vi, afterEach } from "vitest";
import type { Definition, EncodingPageDoc, ResolvedHover } from "@tsumugu/engine";
import {
  acceptEncodingContent,
  acceptExampleRows,
  acceptExamples,
  acceptZhDefinition,
} from "./accept.js";

const leveledZh: Definition = {
  gloss: "人多又吵",
  leveledVerdict: "leveled",
  levelCap: "TOCFL B1",
};

const unleveledZh: Definition = {
  gloss: "人多又吵",
};

const aboveCapZh: Definition = {
  gloss: "人多又吵",
  leveledVerdict: "above-cap",
  offendingWord: "活力",
};

describe("acceptZhDefinition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zh only when leveledVerdict is leveled", () => {
    expect(acceptZhDefinition(leveledZh)).toEqual(leveledZh);
    expect(acceptZhDefinition(unleveledZh)).toBeUndefined();
    expect(acceptZhDefinition(aboveCapZh)).toBeUndefined();
  });

  it("logs a dev-only reason when zh is dropped", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    acceptZhDefinition(unleveledZh);
    expect(debug).not.toHaveBeenCalled();

    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    acceptZhDefinition(aboveCapZh);
    expect(debug).toHaveBeenCalledWith(
      "[encoding] dropped 簡明中文 definition: above-cap (活力)",
    );
    process.env.NODE_ENV = prev;
  });
});

describe("acceptExampleRows", () => {
  it("filters rows without translation or with empty text", () => {
    const rows = acceptExampleRows([
      { text: "週末的夜市總是很熱鬧。", translation: "The night market is lively." },
      { text: "沒有翻譯。", translation: "" },
      { text: "", translation: "Empty text row." },
      { text: "   ", translation: "Whitespace text." },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe("週末的夜市總是很熱鬧。");
  });
});

describe("acceptExamples", () => {
  it("merges mergeHover fallback rows when the artifact has fewer than three", () => {
    const accepted = acceptExamples(
      [{ text: "週末的夜市總是很熱鬧。", translation: "The night market is lively." }],
      [
        { text: "過年很熱鬧。", translation: "New Year is lively." },
        { text: "餐廳很熱鬧。", translation: "The restaurant is lively." },
        { text: "沒翻譯", translation: "" },
      ],
    );
    expect(accepted).toHaveLength(3);
    expect(accepted.map((row) => row.text)).toEqual([
      "週末的夜市總是很熱鬧。",
      "過年很熱鬧。",
      "餐廳很熱鬧。",
    ]);
  });

  it("caps accepted rows at six", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      text: `例句${i + 1}`,
      translation: `Example ${i + 1}`,
    }));
    expect(acceptExamples(rows)).toHaveLength(6);
  });
});

describe("acceptEncodingContent", () => {
  it("drops zh without a leveled verdict and filters invalid examples", () => {
    const doc: EncodingPageDoc = {
      schema: "tsumugu/encoding-page@1",
      lang: "zh-Hant",
      term: "熱鬧",
      definitions: {
        en: { gloss: "lively" },
        zh: unleveledZh,
      },
      examples: [
        { text: "週末的夜市總是很熱鬧。", translation: "The night market is lively." },
        { text: "沒翻譯", translation: "" },
      ],
      etymology: {
        parts: [{ char: "熱" }],
        payoff: "hot + noisy",
      },
    };
    const hover: ResolvedHover = {
      term: "熱鬧",
      sources: ["prebaked"],
      definitions: { en: { gloss: "lively" }, zh: unleveledZh },
      examples: [
        { text: "過年很熱鬧。", translation: "New Year is lively." },
        { text: "餐廳很熱鬧。", translation: "The restaurant is lively." },
      ],
    };

    const accepted = acceptEncodingContent(doc, hover);
    expect(accepted.definitions.en?.gloss).toBe("lively");
    expect(accepted.definitions.zh).toBeUndefined();
    expect(accepted.examples).toHaveLength(3);
    expect(accepted.etymology).toBeUndefined();
  });
});