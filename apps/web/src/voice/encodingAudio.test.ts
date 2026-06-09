// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { ENCODING_AUDIO_SCHEMA } from "@tsumugu/engine";
import { MemoryVault } from "../host/fsVault.js";
import {
  parseEncodingAudio,
  bindEncodingAudio,
  discoverEncodingAudio,
  encodingAudioManifestPath,
  resolveTermAudioPath,
  resolveSentenceAudioPath,
} from "./encodingAudio.js";

const good = {
  schema: ENCODING_AUDIO_SCHEMA,
  lang: "zh-Hant",
  term: "熱鬧",
  termAudio: "audio/term.mp3",
  sentences: { "0": "audio/ex-0.mp3", "2": "audio/ex-2.mp3" },
};

describe("parseEncodingAudio", () => {
  it("parses a valid manifest and coerces sentence keys to numbers", () => {
    const m = parseEncodingAudio(good)!;
    expect(m.term).toBe("熱鬧");
    expect(m.termAudio).toBe("audio/term.mp3");
    expect(m.sentences[0]).toBe("audio/ex-0.mp3");
    expect(m.sentences[2]).toBe("audio/ex-2.mp3");
    expect(m.sentences[1]).toBeUndefined();
  });

  it("returns null for wrong schema or missing fields", () => {
    expect(parseEncodingAudio({ ...good, schema: "x" })).toBeNull();
    expect(parseEncodingAudio({ schema: ENCODING_AUDIO_SCHEMA })).toBeNull();
    expect(parseEncodingAudio(null)).toBeNull();
  });
});

describe("discoverEncodingAudio", () => {
  it("loads a manifest from the vault at the contract path", async () => {
    const vault = new MemoryVault();
    const path = encodingAudioManifestPath("zh-Hant", "熱鬧");
    vault.writeText(path, JSON.stringify(good));
    const binding = await discoverEncodingAudio(vault, "zh-Hant", "熱鬧");
    expect(binding?.manifest.termAudio).toBe("audio/term.mp3");
    expect(binding?.baseDir).toBe("zh-Hant/encoding");
  });
});

describe("resolve audio paths", () => {
  const binding = bindEncodingAudio(parseEncodingAudio(good)!, "zh-Hant/encoding");

  it("prefers manifest term audio over doc.audio", () => {
    expect(
      resolveTermAudioPath(binding, {
        schema: ENCODING_AUDIO_SCHEMA,
        lang: "zh-Hant",
        term: "熱鬧",
        audio: "legacy/term.mp3",
      }),
    ).toBe("zh-Hant/encoding/audio/term.mp3");
  });

  it("resolves sentence audio by index with doc fallback", () => {
    expect(resolveSentenceAudioPath(binding, null, 0)).toBe("zh-Hant/encoding/audio/ex-0.mp3");
    expect(
      resolveSentenceAudioPath(binding, {
        schema: ENCODING_AUDIO_SCHEMA,
        lang: "zh-Hant",
        term: "熱鬧",
        examples: [{ text: "x", translation: "y", audio: "legacy/ex-1.mp3" }],
      }, 1),
    ).toBe("legacy/ex-1.mp3");
  });
});