import { describe, it, expect } from "vitest";
import type { PreparedContent } from "@tsumugu/engine";
import {
  selectWords,
  wordAudioPath,
  planWords,
  buildWordManifest,
  validateWordManifest,
  WORD_AUDIO_SCHEMA,
  WORD_AUDIO_DIR,
  type WordAudioManifest,
} from "./wordAudio.js";

const content: PreparedContent = {
  schema: "tsumugu/prepared-content@1",
  lang: "zh-Hant",
  tokens: [
    { text: "你好", isWord: true },
    { text: "，", isWord: false },
    { text: "世界", isWord: true },
    { text: "你好", isWord: true }, // duplicate
    { text: " ", isWord: false },
  ],
  glossary: { 世界: { term: "世界", gloss: "world", explanation: "", examples: [] } },
};

describe("selectWords", () => {
  it("all → unique isWord tokens in first-seen order", () => {
    expect(selectWords(content, "all")).toEqual(["你好", "世界"]);
  });
  it("glossary → glossary keys only", () => {
    expect(selectWords(content, "glossary")).toEqual(["世界"]);
  });
});

describe("wordAudioPath", () => {
  it("is stable + hash-named under the audio dir", () => {
    const a = wordAudioPath("你好");
    expect(a).toBe(wordAudioPath("你好")); // deterministic
    expect(a.startsWith(`${WORD_AUDIO_DIR}/`)).toBe(true);
    expect(a.endsWith(".mp3")).toBe(true);
    expect(wordAudioPath("世界")).not.toBe(a); // distinct words → distinct files
  });
});

describe("planWords — incremental skip", () => {
  it("renders missing, skips existing unless force", () => {
    const words = ["你好", "世界"];
    const existing = new Set([wordAudioPath("你好")]);
    const plan = planWords(words, WORD_AUDIO_DIR, existing, false);
    expect(plan.find((p) => p.word === "你好")!.render).toBe(false);
    expect(plan.find((p) => p.word === "世界")!.render).toBe(true);
    expect(planWords(words, WORD_AUDIO_DIR, existing, true).every((p) => p.render)).toBe(true);
  });
});

describe("buildWordManifest — merge + sorted", () => {
  const existing: WordAudioManifest = {
    schema: WORD_AUDIO_SCHEMA,
    lang: "zh-Hant",
    voice: "Serena",
    engine: "old",
    words: { 世界: "audio/words/aaa.mp3" },
  };
  it("merges, preserves untouched words, sorts keys, refreshes provenance", () => {
    const m = buildWordManifest({
      existing,
      lang: "zh-Hant",
      voice: "Serena",
      engine: "new",
      generatedAt: "2026-06-07T00:00:00Z",
      words: { 你好: "audio/words/bbb.mp3" },
    });
    expect(m.engine).toBe("new");
    expect(Object.keys(m.words)).toEqual(["世界", "你好"].sort()); // both present, sorted
    expect(m.words["世界"]).toBe("audio/words/aaa.mp3"); // preserved
  });
});

describe("validateWordManifest", () => {
  const m: WordAudioManifest = {
    schema: WORD_AUDIO_SCHEMA,
    lang: "zh-Hant",
    voice: "Serena",
    engine: "e",
    words: { a: "audio/words/1.mp3", b: "audio/words/2.mp3" },
  };
  it("passes when all present, reports missing otherwise", () => {
    expect(validateWordManifest(m, new Set(["audio/words/1.mp3", "audio/words/2.mp3"]))).toEqual({
      ok: true,
      missing: [],
    });
    expect(validateWordManifest(m, new Set(["audio/words/1.mp3"]))).toEqual({
      ok: false,
      missing: ["audio/words/2.mp3"],
    });
  });
});
