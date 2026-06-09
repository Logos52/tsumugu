import { describe, it, expect } from "vitest";

import { enDefinitionFromCedictGlosses, senseFromCedictGloss } from "./cedict.js";

describe("senseFromCedictGloss", () => {
  it("keeps a single gloss line intact", () => {
    expect(senseFromCedictGloss("night market")).toEqual({ gloss: "night market" });
  });

  it("joins slash-delimited synonyms with ·", () => {
    expect(senseFromCedictGloss("lively / bustling / buzzing with activity")).toEqual({
      gloss: "lively · bustling · buzzing with activity",
    });
  });
});

describe("enDefinitionFromCedictGlosses", () => {
  it("populates gloss, senses[], and legacy semicolon gloss", () => {
    const { en, senses, legacyGloss } = enDefinitionFromCedictGlosses([
      "bustling with noise and excitement",
      "lively",
    ]);

    expect(en.gloss).toBe("bustling with noise and excitement");
    expect(en.senses).toEqual(senses);
    expect(senses).toEqual([
      { gloss: "bustling with noise and excitement" },
      { gloss: "lively" },
    ]);
    expect(legacyGloss).toBe("bustling with noise and excitement; lively");
  });

  it("splits slash-delimited synonyms inside one sense", () => {
    const { en, senses } = enDefinitionFromCedictGlosses([
      "lively / bustling / buzzing with activity",
    ]);

    expect(en.gloss).toBe("lively · bustling · buzzing with activity");
    expect(senses).toEqual([
      { gloss: "lively · bustling · buzzing with activity" },
    ]);
  });
});