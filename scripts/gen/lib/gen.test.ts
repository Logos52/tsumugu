import { describe, it, expect } from "vitest";
import { WordStore, ensureSrs, type LanguagePack, type Token, type PreparedContent } from "@tsumugu/engine";
import { demoPack } from "@tsumugu/demo-pack";
import { buildSkeleton } from "./skeleton.js";
import { verifyContent } from "./verify.js";
import { selectAutonomousTargets } from "./targets.js";

/** A tiny fake Traditional-Chinese pack with a real OpenCC-style normalizer. */
const S2T: Record<string, string> = { 发: "發", 热: "熱", 闹: "鬧", 国: "國", 个: "個" };
const fakeZh: LanguagePack = {
  id: "zh-Hant",
  name: "Fake zh-Hant",
  segmenter(text: string): Token[] {
    const out: Token[] = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      out.push({ text: ch, start: i, end: i + 1, isWord: /\p{Script=Han}/u.test(ch) });
    }
    return out;
  },
  dictionaryProvider: () => undefined,
  phoneticLayer: { id: "none", reading: () => undefined },
  levelingModel: () => undefined,
  scriptNormalizer: (text) => [...text].map((c) => S2T[c] ?? c).join(""),
};

describe("buildSkeleton", () => {
  it("creates glossary slots only for unknown words, seeding from the pack dict", async () => {
    const store = new WordStore();
    store.setStatus("demo", "hello", "known");
    const { content, unknownWords } = await buildSkeleton({
      lang: "demo",
      pack: demoPack,
      store,
      text: "hello world demo",
    });
    expect(unknownWords.sort()).toEqual(["demo", "world"]);
    expect(content.glossary["hello"]).toBeUndefined(); // known → no slot
    expect(content.glossary["world"]?.gloss).toBe("the earth, everyone"); // seeded
    expect(content.glossary["demo"]?.gloss).toBe(""); // unseeded → agent fills
    expect(content.tokens.filter((t) => t.isWord).map((t) => t.text)).toEqual([
      "hello",
      "world",
      "demo",
    ]);
    expect(content.schema).toBe("tsumugu/prepared-content@1");
  });
});

describe("verifyContent — OpenCC guard", () => {
  const simplified: PreparedContent = {
    schema: "tsumugu/prepared-content@1",
    lang: "zh-Hant",
    tokens: [
      { text: "发展", isWord: true },
      { text: "很", isWord: true },
      { text: "热闹", isWord: true },
    ],
    glossary: {
      发展: { term: "发展", gloss: "develop" },
      热闹: { term: "热闹", gloss: "lively" },
      很: { term: "很", gloss: "very" },
    },
  };

  it("detects and rewrites Simplified→Traditional in tokens + glossary", async () => {
    const store = new WordStore();
    const report = await verifyContent({ lang: "zh-Hant", pack: fakeZh, store, content: simplified });
    expect(report.openccChanged).toBe(true);
    // tokens normalized
    expect(report.normalized.tokens.map((t) => t.text)).toEqual(["發展", "很", "熱鬧"]);
    // glossary keys + fields normalized
    expect(report.normalized.glossary["發展"]?.term).toBe("發展");
    expect(report.normalized.glossary["熱鬧"]?.gloss).toBe("lively");
    // no Simplified remains anywhere
    const blob = JSON.stringify(report.normalized);
    expect([...blob].some((c) => c in S2T)).toBe(false);
  });

  it("normalizes Simplified inside a bridge box (etymon/reading/meaning/morphemes)", async () => {
    const store = new WordStore();
    const withBridge: PreparedContent = {
      schema: "tsumugu/prepared-content@1",
      lang: "zh-Hant",
      tokens: [{ text: "发展", isWord: true }],
      glossary: {
        发展: {
          term: "发展",
          gloss: "develop",
          bridge: {
            bridgeLang: "zh-Hant",
            etymon: "发展", // Simplified — must be rewritten
            bridgeReading: "phát triển",
            meaning: "热闹的发展", // Simplified inside meaning
            morphemes: [
              { surface: "phát", etymon: "发", gloss: "to develop" },
              { surface: "triển", etymon: "展", gloss: "to unfold" },
            ],
          },
        },
      },
    };
    const report = await verifyContent({ lang: "zh-Hant", pack: fakeZh, store, content: withBridge });
    expect(report.openccChanged).toBe(true);
    const bridge = report.normalized.glossary["發展"]?.bridge;
    expect(bridge?.etymon).toBe("發展");
    expect(bridge?.meaning).toBe("熱鬧的發展");
    expect(bridge?.morphemes?.map((m) => m.etymon)).toEqual(["發", "展"]);
    // no Simplified survives anywhere in the serialized output
    const blob = JSON.stringify(report.normalized);
    expect([...blob].some((c) => c in S2T)).toBe(false);
  });

  it("matches a Simplified --words target against normalized tokens (no spurious <3)", async () => {
    const store = new WordStore();
    const content: PreparedContent = {
      schema: "tsumugu/prepared-content@1",
      lang: "zh-Hant",
      tokens: [
        { text: "发展", isWord: true },
        { text: "发展", isWord: true },
        { text: "发展", isWord: true },
      ],
      glossary: { 发展: { term: "发展", gloss: "develop" } },
    };
    // raw Simplified target; tokens normalize to 發展 — count must still find 3
    const report = await verifyContent({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      content,
      targetWords: ["发展"],
    });
    expect(report.recycle).toEqual([{ word: "發展", count: 3, ok: true }]);
  });

  it("reports clean when there is nothing to convert", async () => {
    const store = new WordStore();
    const traditional: PreparedContent = {
      schema: "tsumugu/prepared-content@1",
      lang: "zh-Hant",
      tokens: [{ text: "發展", isWord: true }],
      glossary: { 發展: { term: "發展", gloss: "develop" } },
    };
    const report = await verifyContent({ lang: "zh-Hant", pack: fakeZh, store, content: traditional });
    expect(report.openccChanged).toBe(false);
    expect(report.openccChanges).toEqual([]);
  });
});

describe("verifyContent — CI, missing glossary, recycle", () => {
  it("flags unknown word tokens without a usable gloss and re-scores CI", async () => {
    const store = new WordStore();
    store.setStatus("demo", "hello", "known");
    const content: PreparedContent = {
      schema: "tsumugu/prepared-content@1",
      lang: "demo",
      ciTarget: 0.95,
      tokens: [
        { text: "hello", isWord: true },
        { text: "world", isWord: true },
        { text: "gap", isWord: true },
      ],
      glossary: {
        world: { term: "world", gloss: "the earth" }, // present
        gap: { term: "gap", gloss: "   " }, // blank → missing
      },
    };
    const report = await verifyContent({
      lang: "demo",
      pack: demoPack,
      store,
      content,
      targetWords: ["world"],
    });
    expect(report.missingGlossary).toEqual(["gap"]);
    // 1 of 3 word-tokens known (hello) → ~33%
    expect(report.ciMeasured).toBeCloseTo(1 / 3, 5);
    expect(report.meetsTarget).toBe(false);
    expect(report.recycle).toEqual([{ word: "world", count: 1, ok: false }]);
  });

  it("honors an explicit ciTarget (overrides content.ciTarget)", async () => {
    const store = new WordStore();
    store.setStatus("demo", "hello", "known");
    const content: PreparedContent = {
      schema: "tsumugu/prepared-content@1",
      lang: "demo",
      ciTarget: 0.1, // file target the CLI default would otherwise use
      tokens: [
        { text: "hello", isWord: true },
        { text: "world", isWord: true },
      ],
      glossary: { world: { term: "world", gloss: "the earth" } },
    };
    // 1 of 2 known → CI 50%. Passing ciTarget must override the file's 0.10.
    const low = await verifyContent({ lang: "demo", pack: demoPack, store, content, ciTarget: 0.1 });
    expect(low.ciTarget).toBe(0.1);
    expect(low.meetsTarget).toBe(true);
    const high = await verifyContent({ lang: "demo", pack: demoPack, store, content, ciTarget: 0.99 });
    expect(high.ciTarget).toBe(0.99);
    expect(high.meetsTarget).toBe(false);
  });
});

describe("selectAutonomousTargets", () => {
  it("returns due + active learning words, deduped, capped", () => {
    const store = new WordStore();
    const clock = { now: () => new Date("2030-01-01T00:00:00Z") };
    store.setStatus("vi", "đang", "l2");
    store.setStatus("vi", "nhanh", "l1");
    store.setStatus("vi", "biết", "known"); // not active
    // a due SRS word (seeded in the past)
    const e = ensureSrs({ lang: "vi", word: "phát triển", status: "l1" }, { now: () => new Date("2020-01-01") });
    store.upsert(e);
    const targets = selectAutonomousTargets(store, "vi", clock, 8);
    expect(targets).toContain("phát triển"); // due first
    expect(targets).toContain("đang");
    expect(targets).toContain("nhanh");
    expect(targets).not.toContain("biết"); // known, not active
    expect(new Set(targets).size).toBe(targets.length); // deduped
  });
});
