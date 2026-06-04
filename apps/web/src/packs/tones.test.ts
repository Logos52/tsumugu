import { describe, it, expect } from "vitest";

import { toneClassesFromZhuyin, toneClassesFromViWord } from "./tones.js";

describe("toneClassesFromZhuyin", () => {
  it("maps falling-tone syllables", () => {
    expect(toneClassesFromZhuyin("ㄧㄝˋ ㄕˋ")).toEqual([4, 4]);
  });

  it("maps a leading neutral-tone mark to 5", () => {
    expect(toneClassesFromZhuyin("ㄖㄜˋ ˙ㄋㄠ")).toEqual([4, 5]);
  });

  it("maps third-tone (ˇ) syllables", () => {
    expect(toneClassesFromZhuyin("ㄋㄧˇ ㄏㄠˇ")).toEqual([3, 3]);
  });

  it("maps unmarked syllables to first tone", () => {
    expect(toneClassesFromZhuyin("ㄈㄚ ㄓㄢˇ")).toEqual([1, 3]);
  });

  it("maps rising-tone (ˊ) syllables", () => {
    expect(toneClassesFromZhuyin("ㄇㄧㄥˊ")).toEqual([2]);
  });

  it("uses only the Zhuyin part when a / pinyin variant is present", () => {
    expect(toneClassesFromZhuyin("ㄧㄝˋ ㄕˋ / yè shì")).toEqual([4, 4]);
  });

  it("returns undefined for empty / unparseable input", () => {
    expect(toneClassesFromZhuyin("")).toBeUndefined();
    expect(toneClassesFromZhuyin("   ")).toBeUndefined();
    expect(toneClassesFromZhuyin("/ yè shì")).toBeUndefined();
  });
});

describe("toneClassesFromViWord", () => {
  it("maps dot-below (nặng) and ngang", () => {
    expect(toneClassesFromViWord("Việt Nam")).toEqual([6, 1]);
  });

  it("maps acute (sắc) and hook-above (hỏi), ignoring vowel-quality marks", () => {
    expect(toneClassesFromViWord("phát triển")).toEqual([3, 4]);
  });

  it("maps all six tones", () => {
    // ngang, huyền(grave), sắc(acute), hỏi(hook), ngã(tilde), nặng(dot)
    expect(toneClassesFromViWord("ma mà má mả mã mạ")).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("ignores circumflex / breve / horn (vowel quality only)", () => {
    // â ă ơ carry quality marks but no tone mark → all ngang (1).
    expect(toneClassesFromViWord("â ă ơ")).toEqual([1, 1, 1]);
  });

  it("returns undefined for empty input", () => {
    expect(toneClassesFromViWord("")).toBeUndefined();
    expect(toneClassesFromViWord("   ")).toBeUndefined();
  });
});
