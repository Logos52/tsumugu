import { describe, it, expect } from "vitest";
import type { PrebakedEntry, DictEntry, BridgeInfo } from "../types.js";
import { mergeHover, type ResolvedHover } from "./index.js";

const bridge: BridgeInfo = {
  bridgeLang: "zh-Hant",
  etymon: "發展",
  bridgeReading: "phát triển",
};

describe("mergeHover — precedence", () => {
  it("custom wins over prebaked and dict per field", () => {
    const dict: DictEntry = {
      term: "發展",
      gloss: "dict gloss",
      reading: "dict reading",
      pos: "dict-pos",
      level: "dict-level",
    };
    const prebaked: PrebakedEntry = {
      term: "發展",
      gloss: "prebaked gloss",
      reading: "prebaked reading",
      pos: "prebaked-pos",
      level: "prebaked-level",
    };
    const custom: Partial<DictEntry> = {
      gloss: "custom gloss",
      reading: "custom reading",
    };

    const hover = mergeHover({ word: "發展", prebaked, custom, dict });
    expect(hover.gloss).toBe("custom gloss");
    expect(hover.reading).toBe("custom reading");
    // not overridden by custom → falls to prebaked
    expect(hover.pos).toBe("prebaked-pos");
    expect(hover.level).toBe("prebaked-level");
  });

  it("prebaked wins over dict when custom is absent", () => {
    const dict: DictEntry = { term: "x", gloss: "dict", pos: "dict-pos" };
    const prebaked: PrebakedEntry = { term: "x", gloss: "prebaked" };
    const hover = mergeHover({ word: "x", prebaked, dict });
    expect(hover.gloss).toBe("prebaked");
    // dict still fills a gap prebaked left
    expect(hover.pos).toBe("dict-pos");
  });

  it("falls through to dict when neither custom nor prebaked set a field", () => {
    const dict: DictEntry = {
      term: "x",
      gloss: "dict gloss",
      reading: "dict reading",
    };
    const hover = mergeHover({ word: "x", dict });
    expect(hover.gloss).toBe("dict gloss");
    expect(hover.reading).toBe("dict reading");
  });

  it("uses the word as term when no layer supplies one", () => {
    const hover = mergeHover({ word: "落葉", custom: { gloss: "fallen leaf" } });
    expect(hover.term).toBe("落葉");
  });

  it("prefers a layer-supplied term over the word", () => {
    const hover = mergeHover({
      word: "surface",
      dict: { term: "canonical", gloss: "g" },
    });
    expect(hover.term).toBe("canonical");
    // custom term beats dict term
    const hover2 = mergeHover({
      word: "surface",
      custom: { term: "custom-term" },
      dict: { term: "canonical", gloss: "g" },
    });
    expect(hover2.term).toBe("custom-term");
  });
});

describe("mergeHover — prebaked-only fields", () => {
  it("carries examples, explanation, and bridge from prebaked", () => {
    const prebaked: PrebakedEntry = {
      term: "發展",
      gloss: "to develop",
      examples: [{ text: "經濟發展很快。", translation: "" }],
      explanation: "A Sino-Vietnamese compound meaning development.",
      bridge,
    };
    const hover = mergeHover({ word: "發展", prebaked });
    expect(hover.examples).toEqual([
      { text: "經濟發展很快。", translation: "" },
    ]);
    expect(hover.explanation).toBe(
      "A Sino-Vietnamese compound meaning development.",
    );
    expect(hover.bridge).toBe(bridge);
  });

  it("omits prebaked-only fields when prebaked is absent", () => {
    const hover = mergeHover({
      word: "x",
      custom: { gloss: "g" },
      dict: { term: "x", gloss: "d" },
    });
    expect(hover.examples).toBeUndefined();
    expect(hover.explanation).toBeUndefined();
    expect(hover.bridge).toBeUndefined();
  });
});

describe("mergeHover — sources", () => {
  it("lists all contributing layers in precedence order", () => {
    const hover = mergeHover({
      word: "x",
      custom: { gloss: "c" },
      // gloss shadowed by custom, but reading is a net contribution
      prebaked: {
        term: "x",
        gloss: "p",
        reading: "r",
        examples: [{ text: "ex", translation: "" }],
      },
      dict: { term: "x", gloss: "d", pos: "p" },
    });
    expect(hover.sources).toEqual(["custom", "prebaked", "dict"]);
    expect(hover.gloss).toBe("c");
    expect(hover.reading).toBe("r");
    expect(hover.pos).toBe("p");
  });

  it("lists only the layers actually provided", () => {
    const hover = mergeHover({ word: "x", custom: { gloss: "c" } });
    expect(hover.sources).toEqual(["custom"]);
  });

  it("does not list a custom layer that contributes nothing", () => {
    const hover = mergeHover({
      word: "x",
      custom: {},
      dict: { term: "x", gloss: "d" },
    });
    expect(hover.sources).toEqual(["dict"]);
  });

  it("does not list a prebaked layer fully shadowed by custom", () => {
    // custom provides gloss; prebaked only has gloss → no net contribution
    const hover = mergeHover({
      word: "x",
      custom: { gloss: "c", reading: "cr", pos: "cp", level: "cl", term: "x" },
      prebaked: { term: "x", gloss: "p" },
    });
    expect(hover.sources).toEqual(["custom"]);
    expect(hover.gloss).toBe("c");
  });

  it("does not list a dict layer fully shadowed by higher layers", () => {
    const hover = mergeHover({
      word: "x",
      prebaked: { term: "x", gloss: "p", reading: "pr" },
      dict: { term: "x", gloss: "d", reading: "dr" },
    });
    expect(hover.sources).toEqual(["prebaked"]);
  });

  it("counts prebaked as contributing when it owns examples even if shadowed lexically", () => {
    const hover = mergeHover({
      word: "x",
      custom: { gloss: "c", reading: "cr", pos: "cp", level: "cl", term: "x" },
      prebaked: {
        term: "x",
        gloss: "p",
        examples: [{ text: "ex", translation: "" }],
      },
    });
    expect(hover.sources).toEqual(["custom", "prebaked"]);
    expect(hover.examples).toEqual([{ text: "ex", translation: "" }]);
  });

  it("returns an empty sources array when every layer is empty/absent", () => {
    const hover = mergeHover({ word: "x" });
    expect(hover.sources).toEqual([]);
    expect(hover.term).toBe("x");
  });

  it("lists dict alone when it is the only layer with values", () => {
    const hover = mergeHover({ word: "x", dict: { term: "x", gloss: "d" } });
    expect(hover.sources).toEqual(["dict"]);
  });

  it("lists custom and dict but skips a no-op prebaked", () => {
    const hover = mergeHover({
      word: "x",
      // custom supplies term + gloss, so prebaked's term/gloss are shadowed
      custom: { term: "x", gloss: "c" },
      prebaked: { term: "x", gloss: "p" }, // both fields shadowed → no-op
      dict: { term: "x", gloss: "d", reading: "dr" }, // reading is a net contribution
    });
    expect(hover.gloss).toBe("c");
    expect(hover.reading).toBe("dr");
    expect(hover.sources).toEqual(["custom", "dict"]);
  });
});

describe("mergeHover — defined-but-empty values", () => {
  it("treats an empty examples array as a real (defined) contribution", () => {
    const hover = mergeHover({
      word: "x",
      prebaked: { term: "x", gloss: "p", examples: [] },
    });
    // [] is defined → carried verbatim, and prebaked counts as contributing.
    expect("examples" in hover).toBe(true);
    expect(hover.examples).toEqual([]);
    expect(hover.sources).toContain("prebaked");
  });

  it("treats an empty-string custom gloss as an override, not a gap", () => {
    // custom term + gloss both set (gloss empty) → dict's term/gloss are both
    // shadowed, so dict makes no net contribution at all.
    const hover = mergeHover({
      word: "x",
      custom: { term: "x", gloss: "" },
      dict: { term: "x", gloss: "dict gloss" },
    });
    // "" is defined, so custom wins; dict does not fill the gloss gap.
    expect(hover.gloss).toBe("");
    expect(hover.sources).toEqual(["custom"]);
  });

  it("an empty-string custom gloss still shadows dict's gloss specifically", () => {
    // Here dict.term is NOT shadowed (custom has no term), so dict legitimately
    // contributes the term — but its gloss must lose to the empty-string custom.
    const hover = mergeHover({
      word: "x",
      custom: { gloss: "" },
      dict: { term: "canonical", gloss: "dict gloss", reading: "dr" },
    });
    expect(hover.gloss).toBe("");
    expect(hover.term).toBe("canonical"); // term flows from dict
    expect(hover.reading).toBe("dr");
    // dict contributes term + reading (not gloss), so it is listed.
    expect(hover.sources).toEqual(["custom", "dict"]);
  });

  it("lists custom even when its only field equals the fallback word", () => {
    const hover = mergeHover({ word: "x", custom: { term: "x" } });
    expect(hover.term).toBe("x");
    expect(hover.sources).toEqual(["custom"]);
  });
});

describe("mergeHover — input integrity (purity)", () => {
  it("does not mutate any input layer", () => {
    const prebaked: PrebakedEntry = {
      term: "x",
      gloss: "p",
      examples: [{ text: "a", translation: "" }],
      bridge,
    };
    const custom: Partial<DictEntry> = { gloss: "c" };
    const dict: DictEntry = { term: "x", gloss: "d", reading: "dr" };
    const prebakedSnap = structuredClone(prebaked);
    const customSnap = structuredClone(custom);
    const dictSnap = structuredClone(dict);

    mergeHover({ word: "x", prebaked, custom, dict });

    expect(prebaked).toEqual(prebakedSnap);
    expect(custom).toEqual(customSnap);
    expect(dict).toEqual(dictSnap);
  });

  it("round-trips through JSON losslessly with nested bridge morphemes", () => {
    const richBridge: BridgeInfo = {
      bridgeLang: "zh-Hant",
      etymon: "發展",
      bridgeReading: "phát triển",
      morphemes: [
        { surface: "phát", etymon: "發", reading: "fā", gloss: "emit" },
        { surface: "triển", etymon: "展", reading: "zhǎn", gloss: "unfold" },
      ],
      confidence: 0.9,
      corrected: true,
    };
    const hover = mergeHover({
      word: "發展",
      prebaked: {
        term: "發展",
        gloss: "to develop",
        examples: [{ text: "經濟發展很快。", translation: "" }],
        explanation: "compound",
        bridge: richBridge,
      },
    });
    const round = JSON.parse(JSON.stringify(hover)) as ResolvedHover;
    expect(round).toEqual(hover);
    expect(round.bridge?.morphemes).toHaveLength(2);
    expect(round.sources).toEqual(["prebaked"]);
  });
});

describe("mergeHover — encoding-layer lifts", () => {
  it("lifts legacy gloss into definitions.en.gloss", () => {
    const hover = mergeHover({
      word: "熱鬧",
      dict: { term: "熱鬧", gloss: "lively and noisy" },
    });
    expect(hover.gloss).toBe("lively and noisy");
    expect(hover.definitions?.en?.gloss).toBe("lively and noisy");
    expect(hover.definitions?.zh).toBeUndefined();
  });



  it("feeds dict senses into definitions.en.senses", () => {
    const hover = mergeHover({
      word: "熱鬧",
      dict: {
        term: "熱鬧",
        gloss: "lively",
        senses: [{ gloss: "festive bustle" }, { gloss: "noisy crowd" }],
      },
    });
    expect(hover.definitions?.en?.senses).toEqual([
      { gloss: "festive bustle" },
      { gloss: "noisy crowd" },
    ]);
  });

  it("resolves definitions.zh symmetrically across custom, prebaked, and dict", () => {
    const zhDef = {
      gloss: "人多又吵",
      level: "TOCFL-B1",
      monolingual: true as const,
    };
    const fromDict = mergeHover({
      word: "熱鬧",
      dict: {
        term: "熱鬧",
        gloss: "lively",
        definitions: { zh: zhDef },
      },
    });
    expect(fromDict.definitions?.zh).toEqual(zhDef);

    const fromPrebaked = mergeHover({
      word: "熱鬧",
      prebaked: {
        term: "熱鬧",
        gloss: "lively",
        definitions: { zh: zhDef },
      },
    });
    expect(fromPrebaked.definitions?.zh).toEqual(zhDef);

    const fromCustom = mergeHover({
      word: "熱鬧",
      custom: {
        definitions: {
          zh: { gloss: "custom zh", level: "TOCFL-2", monolingual: true },
        },
      },
      prebaked: { term: "熱鬧", gloss: "lively", definitions: { zh: zhDef } },
    });
    expect(fromCustom.definitions?.zh?.gloss).toBe("custom zh");
  });

  it("custom.examples wins over prebaked.examples", () => {
    const hover = mergeHover({
      word: "熱鬧",
      custom: {
        examples: [{ text: "我的例句。", translation: "My example." }],
      },
      prebaked: {
        term: "熱鬧",
        gloss: "lively",
        examples: [{ text: "夜市很熱鬧。", translation: "The night market is lively." }],
      },
    });
    expect(hover.examples).toEqual([
      { text: "我的例句。", translation: "My example." },
    ]);
    expect(hover.gloss).toBe("lively");
    expect(hover.sources).toEqual(["custom", "prebaked"]);
  });

  it("prefers structured examples over lifting when already objects", () => {
    const hover = mergeHover({
      word: "熱鬧",
      prebaked: {
        term: "熱鬧",
        gloss: "lively",
        examples: [
          { text: "夜市很熱鬧。", translation: "The night market is lively." },
        ],
      },
    });
    expect(hover.examples).toEqual([
      { text: "夜市很熱鬧。", translation: "The night market is lively." },
    ]);
  });
});

describe("mergeHover — shape", () => {
  it("omits optional fields entirely when no layer supplies them", () => {
    const hover = mergeHover({ word: "x", dict: { term: "x", gloss: "g" } });
    expect("reading" in hover).toBe(false);
    expect("pos" in hover).toBe(false);
    expect("level" in hover).toBe(false);
    expect("examples" in hover).toBe(false);
    expect("explanation" in hover).toBe(false);
    expect("bridge" in hover).toBe(false);
  });

  it("produces a JSON-serializable result", () => {
    const hover: ResolvedHover = mergeHover({
      word: "發展",
      prebaked: {
        term: "發展",
        gloss: "to develop",
        examples: [{ text: "經濟發展很快。", translation: "" }],
        bridge,
      },
      dict: { term: "發展", gloss: "develop", reading: "fā zhǎn" },
    });
    const round = JSON.parse(JSON.stringify(hover)) as ResolvedHover;
    expect(round).toEqual(hover);
  });
});
