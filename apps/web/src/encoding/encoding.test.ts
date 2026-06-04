// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { WordStore, type LanguagePack, type PreparedContent } from "@tsumugu/engine";
import { AppState } from "../state.js";
import { mountEncoding } from "./encoding.js";

const fakePack: LanguagePack = {
  id: "vi",
  name: "fake vi",
  segmenter: () => [],
  dictionaryProvider: () => undefined,
  phoneticLayer: { id: "none", reading: () => undefined },
  levelingModel: () => undefined,
};

const content: PreparedContent = {
  schema: "tsumugu/prepared-content@1",
  lang: "vi",
  tokens: [{ text: "phát triển", isWord: true }],
  glossary: {
    "phát triển": {
      term: "phát triển",
      gloss: "to develop",
      reading: "phát triển",
      explanation: "Sino-Vietnamese from 發展.",
      examples: ["Việt Nam đang phát triển."],
      bridge: {
        bridgeLang: "zh-Hant",
        etymon: "發展",
        bridgeReading: "fā zhǎn",
        morphemes: [{ surface: "phát", etymon: "發", gloss: "emit" }],
      },
    },
  },
};

function appWith(): AppState {
  const store = new WordStore();
  store.upsert({
    lang: "vi",
    word: "phát triển",
    status: "l1",
    flagNote: "keep mixing up the tones",
    related: [{ lang: "zh-Hant", word: "發展" }],
  });
  return new AppState({ pack: fakePack, store, content });
}

describe("mountEncoding", () => {
  it("renders an offline encoding page from store + pre-baked data", async () => {
    const root = document.createElement("div");
    mountEncoding(root, appWith(), "phát triển");
    await Promise.resolve();
    await Promise.resolve();
    const text = root.textContent ?? "";
    expect(text).toContain("phát triển");
    expect(text).toContain("Sino-Vietnamese from 發展"); // explanation
    expect(text).toContain("keep mixing up the tones"); // flag note
    expect(text).toContain("發展"); // bridge etymon
    expect(text).toContain("Việt Nam đang phát triển"); // example
    // related link routes to another encoding page
    const link = root.querySelector('a[href^="#/encoding/"]');
    expect(link).not.toBeNull();
  });

  it("back button clears the hash", () => {
    location.hash = "#/encoding/x";
    const root = document.createElement("div");
    mountEncoding(root, appWith(), "phát triển");
    const back = root.querySelector("button");
    back?.dispatchEvent(new Event("click"));
    expect(location.hash).toBe("");
  });
});
