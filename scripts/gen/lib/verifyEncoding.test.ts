import { describe, it, expect } from "vitest";
import {
  WordStore,
  ENCODING_PAGE_SCHEMA,
  type LanguagePack,
  type Token,
  type EncodingPageDoc,
} from "@tsumugu/engine";
import { verifyEncodingPage } from "./verifyEncoding.js";

const S2T: Record<string, string> = { 发: "發", 热: "熱", 闹: "鬧" };

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

function baseDoc(overrides: Partial<EncodingPageDoc> = {}): EncodingPageDoc {
  return {
    schema: ENCODING_PAGE_SCHEMA,
    lang: "zh-Hant",
    term: "熱鬧",
    definitions: {
      zh: {
        gloss: "很熱鬧。",
        leveledVerdict: "leveled",
      },
    },
    examples: [
      { text: "夜市很熱鬧。", translation: "The night market is lively." },
      { text: "過年很熱鬧。", translation: "New Year is lively." },
      { text: "餐廳很熱鬧。", translation: "The restaurant is lively." },
    ],
    etymology: {
      parts: [{ char: "熱", gloss: "hot" }, { char: "鬧", gloss: "noisy" }],
      payoff: "hot + noisy",
      grounding: "mnemonic-device",
    },
    ...overrides,
  };
}

describe("verifyEncodingPage — blocking gates", () => {
  it("blocks on missing etymology grounding", async () => {
    const store = new WordStore();
    for (const w of ["夜", "市", "很", "過", "年", "餐", "廳"]) {
      store.setStatus("zh-Hant", w, "known");
    }
    const report = await verifyEncodingPage({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      doc: baseDoc({
        etymology: {
          parts: [{ char: "熱" }],
          payoff: "x",
          grounding: undefined as unknown as "mnemonic-device",
        },
      }),
    });
    expect(report.blocked).toBe(true);
    expect(report.groundingErrors.some((e) => e.includes("etymology"))).toBe(true);
  });

  it("blocks when an example scores below CI target", async () => {
    const store = new WordStore();
    // Only mark a few chars known — most tokens in examples stay unknown.
    store.setStatus("zh-Hant", "夜", "known");
    const report = await verifyEncodingPage({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      doc: baseDoc(),
      ciTarget: 0.95,
    });
    expect(report.blocked).toBe(true);
    expect(report.ciScores.some((s) => !s.meetsTarget)).toBe(true);
    expect(report.blockReasons.some((r) => r.startsWith("CI below target"))).toBe(true);
  });

  it("blocks when definitions.zh lacks leveledVerdict", async () => {
    const store = new WordStore();
    for (const w of ["夜", "市", "很", "過", "年", "餐", "廳", "熱", "鬧"]) {
      store.setStatus("zh-Hant", w, "known");
    }
    const report = await verifyEncodingPage({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      doc: baseDoc({
        definitions: { zh: { gloss: "很熱鬧。" } },
      }),
    });
    expect(report.blocked).toBe(true);
    expect(report.levelingErrors.some((e) => e.includes('leveledVerdict must be "leveled"'))).toBe(
      true,
    );
  });

  it("passes a fully gated fixture when CI and leveling are satisfied", async () => {
    const store = new WordStore();
    for (const w of ["夜", "市", "很", "過", "年", "餐", "廳", "熱", "鬧"]) {
      store.setStatus("zh-Hant", w, "known");
    }
    const report = await verifyEncodingPage({
      lang: "zh-Hant",
      pack: fakeZh,
      store,
      doc: baseDoc(),
      ciTarget: 0.95,
    });
    expect(report.blocked).toBe(false);
    expect(report.meetsTarget).toBe(true);
  });
});