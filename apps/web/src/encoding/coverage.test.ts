// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  WordStore,
  ensureSrs,
  type LanguagePack,
  type PreparedContent,
  type Clock,
  type WordEntry,
} from "@tsumugu/engine";
import { AppState } from "../state.js";
import { MemoryVault } from "../host/fsVault.js";
import { encodingArtifactPath } from "./encoding.js";
import {
  computeEncodingCoverageStats,
  formatEncodingCoverageLine,
  formatStabilityDays,
  hasEncoding,
  hasEncodingArtifact,
} from "./coverage.js";

const zhPack: LanguagePack = {
  id: "zh-Hant",
  name: "zh-Hant test",
  segmenter: (text) => [{ text, start: 0, end: text.length, isWord: true }],
  dictionaryProvider: () => undefined,
  phoneticLayer: { id: "none", reading: () => undefined },
  levelingModel: () => undefined,
};

function fixedClock(at: Date): Clock {
  return { now: () => at };
}

function srsEntry(word: string, stability: number, lapses = 0): WordEntry {
  const entry: WordEntry = { lang: "zh-Hant", word, status: "l2" };
  ensureSrs(entry, fixedClock(new Date("2020-01-01T00:00:00Z")));
  entry.srs!.stability = stability;
  entry.srs!.lapses = lapses;
  return entry;
}

const richContent: PreparedContent = {
  schema: "tsumugu/prepared-content@1",
  lang: "zh-Hant",
  tokens: [{ text: "熱鬧", isWord: true }],
  glossary: {
    熱鬧: {
      term: "熱鬧",
      gloss: "lively",
      explanation: "character story",
      examples: ["夜市很熱鬧。"],
    },
  },
};

describe("hasEncodingArtifact", () => {
  it("returns true when the vault holds the encoding JSON", async () => {
    const vault = new MemoryVault();
    vault.writeText(encodingArtifactPath("zh-Hant", "熱鬧"), '{"schema":"x"}');
    const app = new AppState({ pack: zhPack, vault, content: richContent });

    expect(await hasEncodingArtifact(app, "熱鬧")).toBe(true);
    expect(await hasEncodingArtifact(app, "安靜")).toBe(false);
  });
});

describe("hasEncoding", () => {
  it("detects vault artifacts, rich prebaked entries, and flag notes", async () => {
    const vault = new MemoryVault();
    vault.writeText(encodingArtifactPath("zh-Hant", "夜市"), "{}");
    const store = new WordStore();
    store.upsert({ ...srsEntry("夜市", 2), flagNote: undefined });
    store.upsert({ ...srsEntry("鬧鐘", 2), flagNote: "confusable" });

    const app = new AppState({
      pack: zhPack,
      vault,
      store,
      content: richContent,
    });

    expect(await hasEncoding(app, "夜市")).toBe(true);
    expect(await hasEncoding(app, "熱鬧")).toBe(true);
    expect(await hasEncoding(app, "鬧鐘")).toBe(true);
    expect(await hasEncoding(app, "安靜")).toBe(false);
  });
});

describe("computeEncodingCoverageStats", () => {
  it("aggregates encoded vs bare stability for SRS-tracked words", async () => {
    const vault = new MemoryVault();
    vault.writeText(encodingArtifactPath("zh-Hant", "熱鬧"), "{}");
    const store = new WordStore();
    store.upsert(srsEntry("熱鬧", 6, 1));
    store.upsert(srsEntry("安靜", 2, 2));
    store.upsert({ lang: "zh-Hant", word: "孤兒", status: "new" });

    const app = new AppState({
      pack: zhPack,
      vault,
      store,
      content: richContent,
    });

    const stats = await computeEncodingCoverageStats(app);
    expect(stats.encodedCount).toBe(1);
    expect(stats.bareCount).toBe(1);
    expect(stats.encodedAvgStability).toBe(6);
    expect(stats.bareAvgStability).toBe(2);
    expect(formatEncodingCoverageLine(stats)).toBe(
      "encoded 1 · bare 1 · stab encoded 6.0d / bare 2.0d",
    );
  });
});

describe("formatStabilityDays", () => {
  it("formats sub-day stability in hours", () => {
    expect(formatStabilityDays(0.25)).toBe("6h");
  });

  it("formats multi-day stability with one decimal", () => {
    expect(formatStabilityDays(6.18)).toBe("6.2d");
  });
});