import { describe, it, expect } from "vitest";

import type { DictEntry } from "@tsumugu/engine";

import { createZhHantBrowserPack } from "./zhHant.js";
import type { BrowserDict } from "./index.js";

describe("createZhHantBrowserPack", () => {
  it("normalizes Simplified → Traditional via OpenCC", async () => {
    const pack = createZhHantBrowserPack();
    expect(await pack.scriptNormalizer?.("发展")).toBe("發展");
    expect(await pack.scriptNormalizer?.("学习中文")).toBe("學習中文");
    // s2twp Taiwan-idiom layer (not plain s2t): vocabulary, not just glyphs.
    expect(await pack.scriptNormalizer?.("软件")).toBe("軟體");
    expect(await pack.scriptNormalizer?.("信息")).toBe("資訊");
  });

  it("derives tone classes from a Zhuyin reading", () => {
    const pack = createZhHantBrowserPack();
    expect(pack.phoneticLayer.toneClasses?.("夜市", "ㄧㄝˋ ㄕˋ")).toEqual([4, 4]);
    // No reading → undefined (reader falls back to plain text).
    expect(pack.phoneticLayer.toneClasses?.("夜市")).toBeUndefined();
  });

  it("declares zh-TW as its TTS voice and ltr direction", () => {
    const pack = createZhHantBrowserPack();
    expect(pack.id).toBe("zh-Hant");
    expect(pack.direction).toBe("ltr");
    expect(pack.ttsVoice).toEqual({ lang: "zh-TW" });
  });

  it("reading() reads from the supplied dict entry", () => {
    const pack = createZhHantBrowserPack();
    const dict: DictEntry = { term: "你好", gloss: "hello", reading: "ㄋㄧˇ ㄏㄠˇ" };
    expect(pack.phoneticLayer.reading("你好", dict)).toBe("ㄋㄧˇ ㄏㄠˇ");
    expect(pack.phoneticLayer.reading("你好")).toBeUndefined();
  });

  it("dictionaryProvider routes to the optional BrowserDict", async () => {
    const dict: BrowserDict = {
      lookup: async (word) =>
        word === "夜市"
          ? { term: "夜市", gloss: "night market", reading: "ㄧㄝˋ ㄕˋ" }
          : undefined,
    };
    const pack = createZhHantBrowserPack({ dict });
    expect(await pack.dictionaryProvider("夜市")).toMatchObject({ gloss: "night market" });
    expect(await pack.dictionaryProvider("missing")).toBeUndefined();
  });

  it("dictionaryProvider yields undefined with no dict wired", async () => {
    const pack = createZhHantBrowserPack();
    expect(await pack.dictionaryProvider("夜市")).toBeUndefined();
  });

  it("the fallback segmenter tiles Han chars and whitespace", () => {
    const pack = createZhHantBrowserPack();
    const tokens = pack.segmenter("你好 abc");
    const text = Array.isArray(tokens) ? tokens : [];
    // Han chars split per character; offsets cover the whole input.
    expect(text.map((t) => t.text)).toEqual(["你", "好", " ", "abc"]);
    expect(text.map((t) => t.isWord)).toEqual([true, true, false, true]);
    expect(text[text.length - 1]?.end).toBe(6);
  });
});
