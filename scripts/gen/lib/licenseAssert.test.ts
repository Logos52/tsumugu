import { describe, it, expect } from "vitest";
import {
  assertMonolingualSeedLicenses,
  moedictByNdSeedFixture,
} from "./licenseAssert.js";

describe("assertMonolingualSeedLicenses", () => {
  it("hard-fails on MoEDict BY-ND used as a generation seed (PRD fixture)", () => {
    const result = assertMonolingualSeedLicenses(moedictByNdSeedFixture());
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("cc-by-nd"))).toBe(true);
    expect(result.errors.some((e) => e.includes("MoEDict") || e.includes("教育部"))).toBe(
      true,
    );
  });

  it("allows authored and MIT sources as generation seeds", () => {
    const result = assertMonolingualSeedLicenses({
      sources: [
        { id: "meaning-anchor", license: "authored", role: "generation-seed" },
        { id: "freq", license: "mit", role: "reference-only" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("records BY-SA as reference-only without hard-fail", () => {
    const result = assertMonolingualSeedLicenses({
      sources: [
        { id: "cedict", license: "cc-by-sa", role: "reference-only" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("hard-fails CC-BY-SA used as a generation seed", () => {
    const result = assertMonolingualSeedLicenses({
      sources: [
        {
          id: "cedict-gloss",
          license: "cc-by-sa",
          role: "generation-seed",
          text: "lively; bustling",
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("cc-by-sa");
  });
});