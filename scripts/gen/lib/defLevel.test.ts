import { describe, it, expect } from "vitest";
import {
  checkDefLevel,
  decomposesIntoAllowList,
  segmentDefText,
} from "./defLevel.js";
import {
  buildAllowList,
  freqRankToTocflBand,
  tocflOrdinal,
  type DefLevelIndex,
} from "./defLevelData.js";

const FIXTURE_INDEX: DefLevelIndex = {
  tocfl: {
    人: { level: "TOCFL-1" },
    多: { level: "TOCFL-1" },
    很: { level: "TOCFL-1" },
    開心: { level: "TOCFL-2" },
    手: { level: "TOCFL-1" },
    機: { level: "TOCFL-1" },
    手機: { level: "TOCFL-5" },
    電腦: { level: "TOCFL-5" },
    圖書: { level: "TOCFL-2" },
    館: { level: "TOCFL-2" },
    圖書館: { level: "TOCFL-4" },
  },
  freq: {
    的: 2,
    是: 5,
    常見: 2500,
  },
};

/** Deterministic char split segmenter for tests (no jieba dependency). */
function charSegment(text: string): string[] {
  return [...text].filter((c) => /\p{Script=Han}/u.test(c));
}

describe("freqRankToTocflBand", () => {
  it("maps rank thresholds into TOCFL-1..7", () => {
    expect(freqRankToTocflBand(100)).toBe("TOCFL-1");
    expect(freqRankToTocflBand(1000)).toBe("TOCFL-2");
    expect(freqRankToTocflBand(2500)).toBe("TOCFL-3");
    expect(freqRankToTocflBand(50000)).toBe("TOCFL-7");
  });
});

describe("decomposesIntoAllowList", () => {
  it("credits a compound when all parts are on the allow-list", () => {
    const allow = buildAllowList("TOCFL-2", FIXTURE_INDEX);
    expect(allow.has("圖書")).toBe(true);
    expect(allow.has("館")).toBe(true);
    expect(decomposesIntoAllowList("圖書館", allow)).toBe(true);
  });

  it("rejects when a part is missing from the allow-list", () => {
    const allow = buildAllowList("TOCFL-1", FIXTURE_INDEX);
    expect(decomposesIntoAllowList("圖書館", allow)).toBe(false);
  });
});

describe("checkDefLevel", () => {
  it("passes when every token is at or below the ceiling", () => {
    const result = checkDefLevel({
      text: "人很多，很開心。",
      ceiling: "TOCFL-2",
      index: FIXTURE_INDEX,
      segmenter: () => ["人", "多", "很", "開心"],
    });
    expect(result.violations).toEqual([]);
    expect(result.achievedLevel).toBe("TOCFL-2");
    expect(result.levelEscalated).toBe(false);
  });

  it("flags tokens above the ceiling that do not decompose", () => {
    const result = checkDefLevel({
      text: "這台電腦很快。",
      ceiling: "TOCFL-3",
      index: FIXTURE_INDEX,
      segmenter: (t) => ["電腦"],
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.word).toBe("電腦");
    expect(result.violations[0]?.band).toBe("TOCFL-5");
    expect(tocflOrdinal(result.achievedLevel)).toBeGreaterThan(3);
    expect(result.levelEscalated).toBe(true);
  });

  it("credits decomposition against the band-N allow-list", () => {
    const result = checkDefLevel({
      text: "圖書館裡很安靜。",
      ceiling: "TOCFL-2",
      index: FIXTURE_INDEX,
      segmenter: (t) => (t.includes("圖書館") ? ["圖書館", "很"] : charSegment(t)),
    });
    expect(result.violations.find((v) => v.word === "圖書館")).toBeUndefined();
  });

  it("places out-of-TOCFL tokens by frequency rank", () => {
    const result = checkDefLevel({
      text: "這是常見的。",
      ceiling: "TOCFL-3",
      index: FIXTURE_INDEX,
      segmenter: () => ["常見"],
    });
    expect(result.violations).toEqual([]);
    expect(result.violations.length).toBe(0);
  });

  it("flags unrankable tokens unless decomposed", () => {
    const result = checkDefLevel({
      text: "某某某",
      ceiling: "TOCFL-3",
      index: FIXTURE_INDEX,
      segmenter: () => ["某某某"],
    });
    expect(result.violations[0]?.band).toBe("unrankable");
  });

  it("segments with jieba when no injectable segmenter is passed", () => {
    const tiny: DefLevelIndex = {
      tocfl: { 你好: { level: "TOCFL-1" } },
      freq: {},
      cedictWords: ["你好"],
    };
    const tokens = segmentDefText("你好", tiny);
    expect(tokens.length).toBeGreaterThan(0);
  });
});