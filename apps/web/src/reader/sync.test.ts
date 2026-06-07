import { describe, it, expect } from "vitest";

import type { PreparedToken } from "@tsumugu/engine";
import {
  parseTimecode,
  cueIndexAtTime,
  alignCuesToTokens,
  shouldLoopBack,
  type TranscriptCue,
} from "./sync.js";

const w = (text: string): PreparedToken => ({ text, isWord: true });
const p = (text: string): PreparedToken => ({ text, isWord: false });

describe("parseTimecode", () => {
  it("parses HH:MM:SS,mmm (SRT comma) and dot forms", () => {
    expect(parseTimecode("00:00:03,000")).toBe(3);
    expect(parseTimecode("00:00:03.500")).toBe(3.5);
    expect(parseTimecode("01:02:03,500")).toBeCloseTo(3723.5, 3);
  });
  it("parses MM:SS and bare seconds", () => {
    expect(parseTimecode("02:05")).toBe(125);
    expect(parseTimecode("7.25")).toBe(7.25);
  });
  it("does not NaN-poison on junk", () => {
    expect(parseTimecode("")).toBe(0);
    expect(parseTimecode("aa:bb")).toBe(0);
  });
});

describe("cueIndexAtTime", () => {
  const cues: TranscriptCue[] = [
    { text: "一", start: "00:00:00,000", end: "00:00:02,000" },
    { text: "二", start: "00:00:02,000", end: "00:00:04,000" },
    { text: "三", start: "00:00:05,000", end: "00:00:06,000" },
  ];
  it("returns the active cue, half-open [start,end)", () => {
    expect(cueIndexAtTime(cues, 0)).toBe(0);
    expect(cueIndexAtTime(cues, 1.99)).toBe(0);
    expect(cueIndexAtTime(cues, 2)).toBe(1); // boundary belongs to the next cue
    expect(cueIndexAtTime(cues, 5.5)).toBe(2);
  });
  it("returns -1 in gaps and out of range", () => {
    expect(cueIndexAtTime(cues, 4.5)).toBe(-1); // gap
    expect(cueIndexAtTime(cues, 99)).toBe(-1);
  });
});

describe("alignCuesToTokens", () => {
  it("maps a single cue over all its tokens (words + punctuation)", () => {
    const tokens = [w("你好"), p("，"), w("世界"), p("。")];
    const cues: TranscriptCue[] = [
      { text: "你好，世界。", start: "00:00:00,000", end: "00:00:02,000" },
    ];
    expect(alignCuesToTokens(tokens, cues)).toEqual([
      { cueIndex: 0, startToken: 0, endToken: 4 },
    ]);
  });

  it("partitions consecutive cues into contiguous token ranges", () => {
    const tokens = [w("你好"), w("世界"), w("再見")];
    const cues: TranscriptCue[] = [
      { text: "你好", start: "00:00:00,000", end: "00:00:01,000" },
      { text: "世界再見", start: "00:00:01,000", end: "00:00:02,000" },
    ];
    expect(alignCuesToTokens(tokens, cues)).toEqual([
      { cueIndex: 0, startToken: 0, endToken: 1 },
      { cueIndex: 1, startToken: 1, endToken: 3 },
    ]);
  });

  it("absorbs zero-width newline/space tokens at a cue boundary", () => {
    const tokens = [w("你好"), p("\n"), w("世界")];
    const cues: TranscriptCue[] = [
      { text: "你好", start: "00:00:00,000", end: "00:00:01,000" },
      { text: "世界", start: "00:00:01,000", end: "00:00:02,000" },
    ];
    const ranges = alignCuesToTokens(tokens, cues);
    // The "\n" attaches to the first cue (it carries no characters).
    expect(ranges[0]).toEqual({ cueIndex: 0, startToken: 0, endToken: 2 });
    expect(ranges[1]).toEqual({ cueIndex: 1, startToken: 2, endToken: 3 });
  });

  it("tolerates whitespace differences between cue text and tokens", () => {
    const tokens = [w("hello"), p(" "), w("world")];
    const cues: TranscriptCue[] = [
      { text: "hello world", start: "00:00:00,000", end: "00:00:01,000" },
    ];
    expect(alignCuesToTokens(tokens, cues)).toEqual([
      { cueIndex: 0, startToken: 0, endToken: 3 },
    ]);
  });

  it("gives a trailing cue an empty range when tokens run out", () => {
    const tokens = [w("你好")];
    const cues: TranscriptCue[] = [
      { text: "你好", start: "00:00:00,000", end: "00:00:01,000" },
      { text: "世界", start: "00:00:01,000", end: "00:00:02,000" },
    ];
    const ranges = alignCuesToTokens(tokens, cues);
    expect(ranges[0]).toEqual({ cueIndex: 0, startToken: 0, endToken: 1 });
    expect(ranges[1]).toEqual({ cueIndex: 1, startToken: 1, endToken: 1 });
  });
});

describe("shouldLoopBack", () => {
  const b = { start: 2, end: 6 };
  it("is true once the clock reaches/passes the region end", () => {
    expect(shouldLoopBack(6, b)).toBe(true);
    expect(shouldLoopBack(6.5, b)).toBe(true);
  });
  it("is false before the end", () => {
    expect(shouldLoopBack(5.9, b)).toBe(false);
    expect(shouldLoopBack(2, b)).toBe(false);
  });
});
