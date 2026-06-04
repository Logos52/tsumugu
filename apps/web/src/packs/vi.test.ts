import { describe, it, expect } from "vitest";

import { createViBrowserPack } from "./vi.js";
import { packForLang } from "./index.js";
import { MemoryVault } from "../host/index.js";

describe("createViBrowserPack", () => {
  it("declares vi-VN as its TTS voice, vi id, ltr, no scriptNormalizer", () => {
    const pack = createViBrowserPack();
    expect(pack.id).toBe("vi");
    expect(pack.direction).toBe("ltr");
    expect(pack.ttsVoice).toEqual({ lang: "vi-VN" });
    expect(pack.scriptNormalizer).toBeUndefined();
  });

  it("derives tone classes from the word's diacritics", () => {
    const pack = createViBrowserPack();
    expect(pack.phoneticLayer.toneClasses?.("Việt Nam")).toEqual([6, 1]);
    expect(pack.phoneticLayer.toneClasses?.("phát triển")).toEqual([3, 4]);
  });

  it("reading() falls back to the word when the dict has no reading", () => {
    const pack = createViBrowserPack();
    expect(pack.phoneticLayer.reading("đang")).toBe("đang");
    expect(
      pack.phoneticLayer.reading("đang", {
        term: "đang",
        gloss: "(progressive)",
        reading: "ʔɗaːŋ",
      }),
    ).toBe("ʔɗaːŋ");
  });

  it("the fallback segmenter tiles words and punctuation", () => {
    const pack = createViBrowserPack();
    const tokens = pack.segmenter("Việt Nam.");
    const arr = Array.isArray(tokens) ? tokens : [];
    expect(arr.map((t) => t.text)).toEqual(["Việt", " ", "Nam", "."]);
    expect(arr.map((t) => t.isWord)).toEqual([true, false, true, false]);
  });
});

describe("packForLang", () => {
  it("returns null for languages without a browser pack", () => {
    expect(packForLang("demo")).toBeNull();
    expect(packForLang("")).toBeNull();
  });

  it("returns the right pack per language", () => {
    expect(packForLang("zh-Hant")?.id).toBe("zh-Hant");
    expect(packForLang("vi")?.id).toBe("vi");
  });

  it("wires a vault-backed dict that reads kaikki-shaped vi data", async () => {
    const vault = new MemoryVault();
    await vault.writeText(
      "tsumugu/packs/vi/dict.json",
      JSON.stringify({
        "phát triển": { glosses: ["to develop", "to grow"], pos: "verb", ipa: "fát ǐən" },
      }),
    );
    const pack = packForLang("vi", { vault })!;
    const entry = await pack.dictionaryProvider("phát triển");
    expect(entry).toMatchObject({
      term: "phát triển",
      gloss: "to develop; to grow",
      pos: "verb",
      reading: "fát ǐən",
    });
    // Missing word and missing file both yield undefined (graceful fallback).
    expect(await pack.dictionaryProvider("không có")).toBeUndefined();
  });

  it("a vault-backed dict yields undefined when the file is absent", async () => {
    const vault = new MemoryVault(); // no dict.json written
    const pack = packForLang("zh-Hant", { vault })!;
    expect(await pack.dictionaryProvider("夜市")).toBeUndefined();
  });

  it("wires a vault-backed dict that reads cedict-shaped zh data", async () => {
    const vault = new MemoryVault();
    await vault.writeText(
      "tsumugu/packs/zh-Hant/dict.json",
      JSON.stringify({ 夜市: { py: "ㄧㄝˋ ㄕˋ", g: "night market", s: "夜市" } }),
    );
    const pack = packForLang("zh-Hant", { vault })!;
    expect(await pack.dictionaryProvider("夜市")).toMatchObject({
      term: "夜市",
      gloss: "night market",
      reading: "ㄧㄝˋ ㄕˋ",
    });
  });
});
