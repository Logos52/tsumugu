import { describe, it, expect } from "vitest";
import type { BridgeInfo } from "../types.js";
import { crossSeed } from "./index.js";
import type { CrossSeedEntry } from "./index.js";

function bridge(
  etymon: string | undefined,
  morphemeEtyma?: string[],
): BridgeInfo {
  const info: BridgeInfo = { bridgeLang: "zh-Hant" };
  if (etymon !== undefined) info.etymon = etymon;
  if (morphemeEtyma) {
    info.morphemes = morphemeEtyma.map((e) => ({ surface: e, etymon: e }));
  }
  return info;
}

describe("crossSeed", () => {
  it("seeds words whose every morpheme etymon is known, leaves others", () => {
    // Learner knows these Hanzi (e.g. from an imported known-word list).
    const knownEtyma = new Set(["發", "展", "國"]);

    const entries: CrossSeedEntry[] = [
      // Both morphemes known → seeded.
      { word: "phát triển", bridge: bridge("發展", ["發", "展"]) },
      // 家 not known → unseeded.
      { word: "quốc gia", bridge: bridge("國家", ["國", "家"]) },
      // No bridge at all → unseeded.
      { word: "xìu", bridge: undefined },
    ];

    const result = crossSeed({ targetLang: "vi", entries, knownEtyma });

    expect(result.targetLang).toBe("vi");
    expect(result.total).toBe(3);
    expect(result.seededCount).toBe(1);
    expect(result.seeded).toEqual([
      { word: "phát triển", etymon: "發展", via: ["發", "展"] },
    ]);
    expect(result.unseeded).toEqual(["quốc gia", "xìu"]);
  });

  it("requires ALL morpheme etyma when morphemes are present", () => {
    const knownEtyma = new Set(["國"]); // only the first morpheme
    const entries: CrossSeedEntry[] = [
      { word: "quốc gia", bridge: bridge("國家", ["國", "家"]) },
    ];
    const result = crossSeed({ targetLang: "vi", entries, knownEtyma });
    expect(result.seededCount).toBe(0);
    expect(result.unseeded).toEqual(["quốc gia"]);
  });

  it("falls back to the full etymon when there are no morphemes", () => {
    const knownEtyma = new Set(["山"]);
    const entries: CrossSeedEntry[] = [
      // Single-char etymon, no morphemes → match on full etymon.
      { word: "san", bridge: bridge("山") },
      // Full etymon not known.
      { word: "thủy", bridge: bridge("水") },
    ];
    const result = crossSeed({ targetLang: "vi", entries, knownEtyma });
    expect(result.seeded).toEqual([{ word: "san", etymon: "山", via: ["山"] }]);
    expect(result.unseeded).toEqual(["thủy"]);
  });

  it("does NOT seed on the full etymon when morphemes exist but are unknown", () => {
    // The whole etymon string is 'known', but a component morpheme is not.
    // The morpheme rule must win: a partially-known compound is unseeded.
    const knownEtyma = new Set(["發展"]); // the compound, not the parts
    const entries: CrossSeedEntry[] = [
      { word: "phát triển", bridge: bridge("發展", ["發", "展"]) },
    ];
    const result = crossSeed({ targetLang: "vi", entries, knownEtyma });
    expect(result.seededCount).toBe(0);
  });

  it("derives etymon from morphemes when no full etymon string is given", () => {
    const knownEtyma = new Set(["發", "展"]);
    const entries: CrossSeedEntry[] = [
      { word: "phát triển", bridge: bridge(undefined, ["發", "展"]) },
    ];
    const result = crossSeed({ targetLang: "vi", entries, knownEtyma });
    expect(result.seeded).toEqual([
      { word: "phát triển", etymon: "發展", via: ["發", "展"] },
    ]);
  });

  it("derives etymon from morphemes when the full etymon string is blank", () => {
    // Regression: an empty/whitespace `etymon` alongside valid morphemes must
    // fall back to the morpheme-joined form, not surface a blank label.
    const entries: CrossSeedEntry[] = [
      {
        word: "phát triển",
        bridge: {
          bridgeLang: "zh-Hant",
          etymon: "   ",
          morphemes: [
            { surface: "phát", etymon: "發" },
            { surface: "triển", etymon: "展" },
          ],
        },
      },
      {
        word: "quốc gia",
        bridge: {
          bridgeLang: "zh-Hant",
          etymon: "",
          morphemes: [
            { surface: "quốc", etymon: "國" },
            { surface: "gia", etymon: "家" },
          ],
        },
      },
    ];
    const result = crossSeed({
      targetLang: "vi",
      entries,
      knownEtyma: new Set(["發", "展", "國", "家"]),
    });
    expect(result.seeded).toEqual([
      { word: "phát triển", etymon: "發展", via: ["發", "展"] },
      { word: "quốc gia", etymon: "國家", via: ["國", "家"] },
    ]);
    // No seeded word may report a blank etymon label.
    for (const s of result.seeded) {
      expect(s.etymon.trim()).not.toBe("");
    }
  });

  it("via does not alias the morpheme array (fresh array per word)", () => {
    const morphemes = [
      { surface: "phát", etymon: "發" },
      { surface: "triển", etymon: "展" },
    ];
    const entries: CrossSeedEntry[] = [
      { word: "phát triển", bridge: { bridgeLang: "zh-Hant", morphemes } },
    ];
    const result = crossSeed({
      targetLang: "vi",
      entries,
      knownEtyma: new Set(["發", "展"]),
    });
    const seeded = result.seeded[0];
    expect(seeded).toBeDefined();
    if (seeded) {
      // Mutating the result's `via` must not reach back into the input.
      seeded.via.push("MUTATED");
      expect(morphemes.map((m) => m.etymon)).toEqual(["發", "展"]);
    }
  });

  it("trims morpheme etyma before matching against knownEtyma", () => {
    // knownEtyma holds the trimmed char; the morpheme carries surrounding space.
    const entries: CrossSeedEntry[] = [
      {
        word: "san",
        bridge: { bridgeLang: "zh", morphemes: [{ surface: "san", etymon: " 山 " }] },
      },
    ];
    const result = crossSeed({
      targetLang: "vi",
      entries,
      knownEtyma: new Set(["山"]),
    });
    expect(result.seeded).toEqual([{ word: "san", etymon: "山", via: ["山"] }]);
  });

  it("treats empty/whitespace etyma as never known", () => {
    const knownEtyma = new Set(["", "  "]);
    const entries: CrossSeedEntry[] = [
      { word: "blankFull", bridge: bridge("   ") },
      { word: "blankMorph", bridge: { bridgeLang: "zh", morphemes: [{ surface: "x", etymon: "" }] } },
    ];
    const result = crossSeed({ targetLang: "vi", entries, knownEtyma });
    expect(result.seededCount).toBe(0);
    expect(result.unseeded).toEqual(["blankFull", "blankMorph"]);
  });

  it("handles an empty input list", () => {
    const result = crossSeed({
      targetLang: "vi",
      entries: [],
      knownEtyma: new Set(["發"]),
    });
    expect(result).toEqual({
      targetLang: "vi",
      seeded: [],
      unseeded: [],
      seededCount: 0,
      total: 0,
    });
  });

  it("an empty knownEtyma set seeds nothing", () => {
    const entries: CrossSeedEntry[] = [
      { word: "phát triển", bridge: bridge("發展", ["發", "展"]) },
    ];
    const result = crossSeed({
      targetLang: "vi",
      entries,
      knownEtyma: new Set(),
    });
    expect(result.seededCount).toBe(0);
    expect(result.unseeded).toEqual(["phát triển"]);
  });

  it("bridge with empty morphemes array falls back to full etymon", () => {
    const knownEtyma = new Set(["山"]);
    const entries: CrossSeedEntry[] = [
      { word: "san", bridge: { bridgeLang: "zh", etymon: "山", morphemes: [] } },
    ];
    const result = crossSeed({ targetLang: "vi", entries, knownEtyma });
    expect(result.seeded).toEqual([{ word: "san", etymon: "山", via: ["山"] }]);
  });

  it("result is JSON-serializable (plain data)", () => {
    const entries: CrossSeedEntry[] = [
      { word: "phát triển", bridge: bridge("發展", ["發", "展"]) },
    ];
    const result = crossSeed({
      targetLang: "vi",
      entries,
      knownEtyma: new Set(["發", "展"]),
    });
    const round = JSON.parse(JSON.stringify(result)) as typeof result;
    expect(round).toEqual(result);
  });
});
