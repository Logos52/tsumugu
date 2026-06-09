import { describe, it, expect } from "vitest";

import type { WordEntry } from "../types.js";
import { encodingCoverageStats } from "./encodingStats.js";

function entry(word: string, stability: number, lapses: number): WordEntry {
  return {
    lang: "demo",
    word,
    status: "l2",
    srs: {
      due: "2026-06-09T00:00:00.000Z",
      stability,
      difficulty: 5,
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 2,
      lapses,
      state: 2,
    },
  };
}

describe("encodingCoverageStats", () => {
  it("splits SRS-tracked entries and averages stability/lapses per bucket", () => {
    const entries = [
      entry("熱鬧", 6, 1),
      entry("夜市", 4, 0),
      entry("安靜", 2, 2),
      entry("好", 1, 0),
    ];
    const hasEncoding = (word: string) => word === "熱鬧" || word === "夜市";

    const stats = encodingCoverageStats(entries, hasEncoding);

    expect(stats.encodedCount).toBe(2);
    expect(stats.bareCount).toBe(2);
    expect(stats.encodedAvgStability).toBe(5);
    expect(stats.bareAvgStability).toBe(1.5);
    expect(stats.encodedAvgLapses).toBe(0.5);
    expect(stats.bareAvgLapses).toBe(1);
  });

  it("skips entries without SRS state", () => {
    const entries: WordEntry[] = [
      entry("熱鬧", 8, 0),
      { lang: "demo", word: "孤兒", status: "new" },
    ];
    const stats = encodingCoverageStats(entries, () => false);

    expect(stats.encodedCount).toBe(0);
    expect(stats.bareCount).toBe(1);
    expect(stats.bareAvgStability).toBe(8);
    expect(stats.bareAvgLapses).toBe(0);
  });

  it("returns null averages when a bucket is empty", () => {
    const stats = encodingCoverageStats([entry("熱鬧", 3, 1)], () => true);

    expect(stats.encodedCount).toBe(1);
    expect(stats.bareCount).toBe(0);
    expect(stats.encodedAvgStability).toBe(3);
    expect(stats.bareAvgStability).toBeNull();
    expect(stats.encodedAvgLapses).toBe(1);
    expect(stats.bareAvgLapses).toBeNull();
  });
});