// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

import { MemoryVault } from "../host/fsVault.js";
import {
  parseWordAudio,
  bindWordAudio,
  selectWordSrc,
  createWordAudioPlayer,
  WORD_AUDIO_SCHEMA,
  type WordAudioManifest,
} from "./wordAudio.js";

const good = {
  schema: WORD_AUDIO_SCHEMA,
  lang: "zh-Hant",
  voice: "Serena",
  engine: "qwen3@mlx-audio",
  generatedAt: "2026-06-07T00:00:00Z",
  words: { 你好: "audio/words/aaa.mp3", 世界: "audio/words/bbb.mp3" },
};
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("parseWordAudio", () => {
  it("parses a valid manifest and keeps provenance", () => {
    const m = parseWordAudio(good)!;
    expect(m.voice).toBe("Serena");
    expect(m.words["你好"]).toBe("audio/words/aaa.mp3");
    expect(m.generatedAt).toBe("2026-06-07T00:00:00Z");
  });
  it("returns null for a wrong/absent schema or non-object", () => {
    expect(parseWordAudio({ ...good, schema: "x" })).toBeNull();
    expect(parseWordAudio({ words: {} })).toBeNull();
    expect(parseWordAudio(null)).toBeNull();
  });
  it("drops non-string / empty word values", () => {
    const m = parseWordAudio({ ...good, words: { a: "x.mp3", b: 1, c: "" } })!;
    expect(m.words).toEqual({ a: "x.mp3" });
  });
});

describe("selectWordSrc", () => {
  const binding = bindWordAudio(parseWordAudio(good)!, "inbox/zh-Hant");
  it("resolves a rendered word against the manifest dir", () => {
    expect(selectWordSrc(binding, "你好")).toBe("inbox/zh-Hant/audio/words/aaa.mp3");
  });
  it("returns null for an unrendered word", () => {
    expect(selectWordSrc(binding, "沒有")).toBeNull();
  });
});

describe("createWordAudioPlayer", () => {
  function setup() {
    const vault = new MemoryVault();
    vault.writeBytes("base/audio/words/aaa.mp3", new Uint8Array([1, 2, 3]));
    const spoken: string[] = [];
    const player = createWordAudioPlayer({
      vault,
      binding: bindWordAudio(parseWordAudio(good)!, "base"),
      speak: (t) => spoken.push(t),
    });
    return { vault, spoken, player };
  }

  it("reads the word's clip at the resolved path", async () => {
    const { vault, player } = setup();
    const spy = vi.spyOn(vault, "readBytes");
    player.playWord("你好");
    await tick();
    expect(spy).toHaveBeenCalledWith("base/audio/words/aaa.mp3");
  });

  it("falls back to Web Speech for an unrendered word (no read attempt)", () => {
    const { vault, spoken, player } = setup();
    const spy = vi.spyOn(vault, "readBytes");
    player.playWord("沒有"); // not in the manifest
    expect(spoken).toEqual(["沒有"]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("falls back to Web Speech when the clip is unreadable", async () => {
    const { spoken, player } = setup();
    player.playWord("世界"); // in manifest, but bytes missing in the vault
    await tick();
    expect(spoken).toEqual(["世界"]);
  });
});
