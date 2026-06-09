import { describe, it, expect } from "vitest";
import {
  computeHighlightSpans,
  validateHighlightSpans,
  renderHighlightSpans,
} from "./highlightSpans.js";

describe("computeHighlightSpans", () => {
  it("finds a single headword occurrence", () => {
    expect(computeHighlightSpans("週末的夜市總是很熱鬧。", "熱鬧")).toEqual([{ start: 8, end: 10 }]);
  });

  it("finds multiple non-overlapping occurrences", () => {
    expect(computeHighlightSpans("熱鬧的街很熱鬧。", "熱鬧")).toEqual([
      { start: 0, end: 2 },
      { start: 5, end: 7 },
    ]);
  });

  it("returns empty when headword is absent", () => {
    expect(computeHighlightSpans("這裡很安靜。", "熱鬧")).toEqual([]);
  });
});

describe("validateHighlightSpans", () => {
  it("accepts spans that mark every occurrence", () => {
    const text = "週末的夜市總是很熱鬧。";
    const spans = computeHighlightSpans(text, "熱鬧");
    const result = validateHighlightSpans(text, "熱鬧", spans);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects missing highlightSpans when headword is present", () => {
    const result = validateHighlightSpans("週末的夜市總是很熱鬧。", "熱鬧");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("highlightSpans missing");
  });

  it("rejects spans that do not cover the headword slice", () => {
    const result = validateHighlightSpans("週末的夜市總是很熱鬧。", "熱鬧", [{ start: 8, end: 9 }]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("not marked"))).toBe(true);
  });
});

describe("renderHighlightSpans", () => {
  it("wraps marked regions with emphasis tags", () => {
    const text = "週末的夜市總是很熱鬧。";
    const spans = computeHighlightSpans(text, "熱鬧");
    expect(renderHighlightSpans(text, spans)).toBe("週末的夜市總是很<em>熱鬧</em>。");
  });
});