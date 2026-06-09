import { describe, it, expect } from "vitest";
import type { PreparedContent } from "@tsumugu/engine";
import {
  collectExamples,
  exampleAudioPath,
  planExamples,
  stampExampleAudio,
  EXAMPLE_AUDIO_DIR,
} from "./exampleAudio.js";

const content: PreparedContent = {
  schema: "tsumugu/prepared-content@2",
  lang: "zh-Hant",
  tokens: [
    { text: "熱鬧", isWord: true },
    { text: "，", isWord: false },
    { text: "夜市", isWord: true },
  ],
  glossary: {
    熱鬧: {
      term: "熱鬧",
      gloss: "lively",
      examples: [
        { text: "週末的夜市總是很熱鬧。", translation: "The night market is lively." },
        { text: "", translation: "skip" },
      ],
    },
    夜市: {
      term: "夜市",
      gloss: "night market",
      examples: [{ text: "我們去夜市吃小吃。", translation: "We went to the night market." }],
    },
  },
};

describe("exampleAudioPath", () => {
  it("is stable + hash-named under the audio dir", () => {
    const a = exampleAudioPath("週末的夜市總是很熱鬧。");
    expect(a).toBe(exampleAudioPath("週末的夜市總是很熱鬧。"));
    expect(a.startsWith(`${EXAMPLE_AUDIO_DIR}/`)).toBe(true);
    expect(a.endsWith(".mp3")).toBe(true);
  });
});

describe("collectExamples", () => {
  it("collects non-empty rows for selected words", () => {
    const refs = collectExamples(content, ["熱鬧", "夜市"]);
    expect(refs).toEqual([
      { word: "熱鬧", index: 0, text: "週末的夜市總是很熱鬧。" },
      { word: "夜市", index: 0, text: "我們去夜市吃小吃。" },
    ]);
  });
});

describe("planExamples — incremental skip", () => {
  it("renders missing, skips existing unless force", () => {
    const refs = collectExamples(content, ["熱鬧"]);
    const existing = new Set([exampleAudioPath(refs[0]!.text)]);
    const plan = planExamples(refs, EXAMPLE_AUDIO_DIR, existing, false);
    expect(plan[0]!.render).toBe(false);
    expect(planExamples(refs, EXAMPLE_AUDIO_DIR, existing, true)[0]!.render).toBe(true);
  });
});

describe("stampExampleAudio", () => {
  it("writes audio paths onto glossary examples without touching other fields", () => {
    const path = exampleAudioPath("週末的夜市總是很熱鬧。");
    const byWord = new Map<string, Map<number, string>>([
      ["熱鬧", new Map([[0, path]])],
    ]);
    const out = stampExampleAudio(content, byWord);
    expect(out.glossary["熱鬧"]!.examples![0]!.audio).toBe(path);
    expect(out.glossary["熱鬧"]!.examples![0]!.translation).toBe("The night market is lively.");
    expect(out.glossary["夜市"]!.examples![0]!.audio).toBeUndefined();
  });
});