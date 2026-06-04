import { describe, it, expect } from "vitest";
import type { WordStatus, KnownPolicy } from "../types.js";
import { scoreCI, DEFAULT_CI_TARGET, type CiToken } from "./index.js";
// DEFAULT_KNOWN_POLICY is not re-exported from the barrel (the canonical copy
// lives in the `status` module); the scorer's identical internal copy is
// imported from its source for these unit tests.
import { DEFAULT_KNOWN_POLICY } from "./scorer.js";

/** Build a Map-backed status lookup; words absent from the map are "new". */
function statusFromMap(
  pairs: Record<string, WordStatus>,
): (word: string) => WordStatus {
  const map = new Map<string, WordStatus>(Object.entries(pairs));
  return (word) => map.get(word) ?? "new";
}

/** Convenience: turn a list of [text, isWord] into tokens. */
function toks(...items: [string, boolean][]): CiToken[] {
  return items.map(([text, isWord]) => ({ text, isWord }));
}

describe("constants", () => {
  it("exports the default CI target as 0.95", () => {
    expect(DEFAULT_CI_TARGET).toBe(0.95);
  });

  it("exports a default known-policy matching the locked contract value", () => {
    expect(DEFAULT_KNOWN_POLICY.knownStatuses).toEqual([
      "l4",
      "known",
      "ignored",
    ]);
  });
});

describe("scoreCI — counting", () => {
  it("counts only word tokens toward the total", () => {
    const tokens = toks(
      ["你好", true],
      ["，", false],
      [" ", false],
      ["世界", true],
      ["。", false],
    );
    const r = scoreCI({
      lang: "zh-Hant",
      tokens,
      getStatus: statusFromMap({ 你好: "known", 世界: "new" }),
    });
    expect(r.totalWordTokens).toBe(2);
    expect(r.knownWordTokens).toBe(1);
    expect(r.lang).toBe("zh-Hant");
  });

  it("treats l4, known, and ignored as comprehended by default", () => {
    const tokens = toks(
      ["a", true],
      ["b", true],
      ["c", true],
      ["d", true],
    );
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({
        a: "l4",
        b: "known",
        c: "ignored",
        d: "l3",
      }),
    });
    expect(r.knownWordTokens).toBe(3); // a,b,c known; d not
    expect(r.totalWordTokens).toBe(4);
    expect(r.coverage).toBe(0.75);
  });

  it("does NOT treat l1..l3 or new as known under the default policy", () => {
    const tokens = toks(["a", true], ["b", true], ["c", true], ["d", true]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({ a: "new", b: "l1", c: "l2", d: "l3" }),
    });
    expect(r.knownWordTokens).toBe(0);
    expect(r.coverage).toBe(0);
  });
});

describe("scoreCI — coverage & target", () => {
  it("computes coverage as known/total", () => {
    const tokens = toks(
      ["a", true],
      ["b", true],
      ["c", true],
      ["d", true],
      ["e", true],
    );
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({
        a: "known",
        b: "known",
        c: "known",
        d: "known",
        e: "new",
      }),
    });
    expect(r.coverage).toBe(0.8);
    expect(r.target).toBe(0.95);
    expect(r.meetsTarget).toBe(false);
  });

  it("meetsTarget is true when coverage equals the target exactly", () => {
    // 19/20 = 0.95 exactly.
    const items: [string, boolean][] = [];
    for (let i = 0; i < 19; i++) items.push([`k${i}`, true]);
    items.push(["u", true]);
    const known: Record<string, WordStatus> = {};
    for (let i = 0; i < 19; i++) known[`k${i}`] = "known";
    const r = scoreCI({
      lang: "x",
      tokens: toks(...items),
      getStatus: statusFromMap(known),
    });
    expect(r.coverage).toBeCloseTo(0.95, 10);
    expect(r.meetsTarget).toBe(true);
  });

  it("honors a custom target", () => {
    const tokens = toks(["a", true], ["b", true]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({ a: "known", b: "new" }),
      target: 0.5,
    });
    expect(r.coverage).toBe(0.5);
    expect(r.meetsTarget).toBe(true);
  });

  it("returns coverage 0 and meetsTarget false when there are no word tokens", () => {
    const tokens = toks(["。", false], [" ", false]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({}),
    });
    expect(r.totalWordTokens).toBe(0);
    expect(r.knownWordTokens).toBe(0);
    expect(r.coverage).toBe(0);
    expect(r.meetsTarget).toBe(false); // 0 >= 0.95 is false
  });

  it("an empty token list yields a zero report that meets a 0 target", () => {
    const r = scoreCI({
      lang: "x",
      tokens: [],
      getStatus: statusFromMap({}),
      target: 0,
    });
    expect(r.coverage).toBe(0);
    expect(r.meetsTarget).toBe(true); // 0 >= 0
    expect(r.unknownWords).toEqual([]);
  });
});

describe("scoreCI — custom policy", () => {
  it("respects a policy that includes more statuses", () => {
    const policy: KnownPolicy = {
      knownStatuses: ["l3", "l4", "known", "ignored"],
    };
    const tokens = toks(["a", true], ["b", true]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({ a: "l3", b: "l2" }),
      policy,
    });
    expect(r.knownWordTokens).toBe(1); // l3 now counts, l2 does not
    expect(r.coverage).toBe(0.5);
  });

  it("an empty knownStatuses policy counts nothing as known", () => {
    const tokens = toks(["a", true], ["b", true]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({ a: "known", b: "ignored" }),
      policy: { knownStatuses: [] },
    });
    expect(r.knownWordTokens).toBe(0);
    expect(r.coverage).toBe(0);
    // both surface as unknown words
    expect(r.unknownWords).toEqual([
      { word: "a", count: 1 },
      { word: "b", count: 1 },
    ]);
  });
});

describe("scoreCI — unknownWords", () => {
  it("lists distinct unknown words with counts, sorted by count desc then word asc", () => {
    const tokens = toks(
      ["zeta", true],
      ["apple", true],
      ["apple", true],
      ["apple", true],
      ["mango", true],
      ["mango", true],
      ["known", true],
      ["known", true],
    );
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({ known: "known" }),
    });
    expect(r.unknownWords).toEqual([
      { word: "apple", count: 3 },
      { word: "mango", count: 2 },
      { word: "zeta", count: 1 },
    ]);
  });

  it("breaks count ties by word ascending (code-unit order)", () => {
    const tokens = toks(
      ["b", true],
      ["a", true],
      ["c", true],
    );
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({}),
    });
    expect(r.unknownWords.map((u) => u.word)).toEqual(["a", "b", "c"]);
  });

  it("excludes known words from the unknown list", () => {
    const tokens = toks(["x", true], ["y", true], ["x", true]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({ x: "known" }),
    });
    expect(r.unknownWords).toEqual([{ word: "y", count: 1 }]);
  });

  it("does not count punctuation tokens as unknown words", () => {
    const tokens = toks(["x", true], ["x", false], ["，", false]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({}),
    });
    // only the single isWord "x" counts
    expect(r.unknownWords).toEqual([{ word: "x", count: 1 }]);
    expect(r.totalWordTokens).toBe(1);
  });
});

describe("scoreCI — targetRecycle", () => {
  it("is omitted when no targetWords are supplied", () => {
    const r = scoreCI({
      lang: "x",
      tokens: toks(["a", true]),
      getStatus: statusFromMap({}),
    });
    expect(r.targetRecycle).toBeUndefined();
  });

  it("is omitted when targetWords is empty", () => {
    const r = scoreCI({
      lang: "x",
      tokens: toks(["a", true]),
      getStatus: statusFromMap({}),
      targetWords: [],
    });
    expect(r.targetRecycle).toBeUndefined();
  });

  it("counts occurrences and flags ok when count >= 3", () => {
    const tokens = toks(
      ["发展", true],
      ["发展", true],
      ["发展", true],
      ["进步", true],
      ["进步", true],
      ["未见", true],
    );
    const r = scoreCI({
      lang: "zh",
      tokens,
      getStatus: statusFromMap({}),
      targetWords: ["发展", "进步", "缺席"],
    });
    expect(r.targetRecycle).toEqual([
      { word: "发展", count: 3, ok: true },
      { word: "进步", count: 2, ok: false },
      { word: "缺席", count: 0, ok: false }, // absent → 0
    ]);
  });

  it("only counts word tokens for the recycle check, not punctuation", () => {
    const tokens = toks(
      ["x", true],
      ["x", false], // punctuation-like with same text — must NOT count
      ["x", true],
    );
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({}),
      targetWords: ["x"],
    });
    expect(r.targetRecycle).toEqual([{ word: "x", count: 2, ok: false }]);
  });

  it("preserves the first-seen order of targetWords and dedupes them", () => {
    const tokens = toks(["b", true], ["a", true], ["a", true]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({}),
      targetWords: ["b", "a", "b"], // duplicate "b"
    });
    expect(r.targetRecycle).toEqual([
      { word: "b", count: 1, ok: false },
      { word: "a", count: 2, ok: false },
    ]);
  });

  it("counts target words regardless of their known status", () => {
    // A directed target that the learner already knows still gets counted —
    // recycle is about exposure, not novelty.
    const tokens = toks(["seen", true], ["seen", true], ["seen", true]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({ seen: "known" }),
      targetWords: ["seen"],
    });
    expect(r.knownWordTokens).toBe(3);
    expect(r.targetRecycle).toEqual([{ word: "seen", count: 3, ok: true }]);
  });
});

describe("scoreCI — interactions & invariants", () => {
  it("lists an unknown target word in BOTH unknownWords and targetRecycle (independent)", () => {
    // A directed target the learner does NOT know should still appear in the
    // unknown-word frequency list; targetRecycle is a separate dimension.
    const tokens = toks(["新词", true], ["新词", true]);
    const r = scoreCI({
      lang: "zh",
      tokens,
      getStatus: statusFromMap({}), // "新词" is "new" → unknown
      targetWords: ["新词"],
    });
    expect(r.unknownWords).toEqual([{ word: "新词", count: 2 }]);
    expect(r.targetRecycle).toEqual([{ word: "新词", count: 2, ok: false }]);
  });

  it("never calls getStatus for non-word tokens", () => {
    const seen: string[] = [];
    const getStatus = (word: string): WordStatus => {
      seen.push(word);
      return "new";
    };
    scoreCI({
      lang: "x",
      tokens: toks(["w", true], ["。", false], [" ", false], ["w2", true]),
      getStatus,
    });
    expect(seen).toEqual(["w", "w2"]); // punctuation/whitespace never queried
  });

  it("counts a target word that appears only as a non-word token as 0", () => {
    // The same surface as punctuation: isWord:false occurrences must not count.
    const tokens = toks(["…", false], ["…", false]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({}),
      targetWords: ["…"],
    });
    expect(r.targetRecycle).toEqual([{ word: "…", count: 0, ok: false }]);
  });

  it("does not mutate the caller's policy or the exported DEFAULT_KNOWN_POLICY", () => {
    const policy: KnownPolicy = { knownStatuses: ["l4", "known"] };
    const before = [...policy.knownStatuses];
    scoreCI({
      lang: "x",
      tokens: toks(["a", true]),
      getStatus: statusFromMap({ a: "l4" }),
      policy,
    });
    expect(policy.knownStatuses).toEqual(before);
    // Default policy untouched after a call that relied on it.
    scoreCI({
      lang: "x",
      tokens: toks(["b", true]),
      getStatus: statusFromMap({}),
    });
    expect(DEFAULT_KNOWN_POLICY.knownStatuses).toEqual([
      "l4",
      "known",
      "ignored",
    ]);
  });

  it("omits the targetRecycle key entirely (not present) when no targets given", () => {
    const r = scoreCI({
      lang: "x",
      tokens: toks(["a", true]),
      getStatus: statusFromMap({}),
    });
    // Genuinely absent, not an `undefined`-valued property — matters for
    // JSON.stringify output and `in`/hasOwnProperty checks.
    expect("targetRecycle" in r).toBe(false);
    expect(Object.keys(JSON.parse(JSON.stringify(r)))).not.toContain(
      "targetRecycle",
    );
  });

  it("preserves a non-known target's count in targetRecycle even when policy is empty", () => {
    const r = scoreCI({
      lang: "x",
      tokens: toks(["t", true], ["t", true], ["t", true]),
      getStatus: statusFromMap({ t: "known" }),
      policy: { knownStatuses: [] }, // nothing counts as known
      targetWords: ["t"],
    });
    expect(r.knownWordTokens).toBe(0);
    expect(r.unknownWords).toEqual([{ word: "t", count: 3 }]);
    expect(r.targetRecycle).toEqual([{ word: "t", count: 3, ok: true }]);
  });

  it("does not treat duplicate token surfaces with mixed isWord flags as the same lexical entry", () => {
    // "1" appears once as a numeral (isWord:false) and twice as a word.
    const tokens = toks(["1", false], ["1", true], ["1", true]);
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({}),
    });
    expect(r.totalWordTokens).toBe(2);
    expect(r.unknownWords).toEqual([{ word: "1", count: 2 }]);
  });
});

describe("scoreCI — matching semantics & determinism", () => {
  it("uses exact surface-form matching (case-sensitive)", () => {
    const tokens = toks(["The", true], ["the", true], ["the", true]);
    const r = scoreCI({
      lang: "en",
      tokens,
      getStatus: statusFromMap({ the: "known" }), // capital "The" stays unknown
    });
    expect(r.knownWordTokens).toBe(2);
    expect(r.unknownWords).toEqual([{ word: "The", count: 1 }]);
  });

  it("produces a fully JSON-serializable report (round-trips)", () => {
    const tokens = toks(
      ["a", true],
      ["b", true],
      ["b", true],
      ["c", true],
      ["c", true],
      ["c", true],
    );
    const r = scoreCI({
      lang: "x",
      tokens,
      getStatus: statusFromMap({ a: "known" }),
      targetWords: ["c"],
    });
    const round = JSON.parse(JSON.stringify(r));
    expect(round).toEqual(r);
  });

  it("is deterministic across calls with identical input", () => {
    const make = () =>
      scoreCI({
        lang: "x",
        tokens: toks(["a", true], ["b", true], ["a", true]),
        getStatus: statusFromMap({}),
        targetWords: ["a", "z"],
      });
    expect(make()).toEqual(make());
  });
});
