import { describe, it, expect } from "vitest";

import { classifyReadingDocs } from "./loadReading.js";

const content = {
  schema: "tsumugu/prepared-content@1",
  lang: "zh-Hant",
  tokens: [{ text: "你好", isWord: true }],
  glossary: {},
};
const cues = {
  schema: "tsumugu/transcript-cues@1",
  lang: "zh-Hant",
  videoId: "dQw4w9WgXcQ",
  cues: [{ text: "你好", start: "00:00:00,000", end: "00:00:01,000" }],
};

describe("classifyReadingDocs", () => {
  it("pairs prepared content with a transcript (incl. videoId)", () => {
    const p = classifyReadingDocs([content, cues]);
    expect(p.content?.lang).toBe("zh-Hant");
    expect(p.transcript?.videoId).toBe("dQw4w9WgXcQ");
    expect(p.transcript?.cues).toHaveLength(1);
  });

  it("loads content alone (no sidecar → no transcript)", () => {
    const p = classifyReadingDocs([content]);
    expect(p.content).toBeDefined();
    expect(p.transcript).toBeUndefined();
  });

  it("omits videoId when the sidecar has none (scrubber-only)", () => {
    const { videoId, ...noVideo } = cues;
    void videoId;
    const p = classifyReadingDocs([noVideo]);
    expect(p.transcript?.cues).toHaveLength(1);
    expect(p.transcript?.videoId).toBeUndefined();
  });

  it("ignores unrecognized / malformed docs", () => {
    expect(classifyReadingDocs([null, 42, { schema: "other" }, {}])).toEqual({});
  });
});
