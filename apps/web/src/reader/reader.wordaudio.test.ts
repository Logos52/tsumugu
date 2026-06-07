// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

import { WordStore, type LanguagePack, type PreparedContent } from "@tsumugu/engine";
import { AppState } from "../state.js";
import { mountReader } from "./reader.js";
import { MemoryVault } from "../host/fsVault.js";
import { parseWordAudio, bindWordAudio, WORD_AUDIO_SCHEMA } from "../voice/wordAudio.js";

function fakePack(): LanguagePack {
  return {
    id: "zh-Hant",
    name: "Chinese (Traditional)",
    segmenter: () => [],
    dictionaryProvider: () => undefined,
    phoneticLayer: { id: "zhuyin", reading: () => undefined, toneClasses: () => undefined },
    levelingModel: () => undefined,
  };
}
function content(): PreparedContent {
  return {
    schema: "tsumugu/prepared-content@1",
    lang: "zh-Hant",
    tokens: [
      { text: "今晚", isWord: true },
      { text: "很", isWord: true },
      { text: "熱鬧", isWord: true },
    ],
    glossary: {},
  };
}
const WORD_PATH = "audio/words/jinwan.mp3";

function build(withWordAudio: boolean): AppState {
  const vault = new MemoryVault();
  vault.writeBytes(`base/${WORD_PATH}`, new Uint8Array([1, 2, 3]));
  const app = new AppState({ pack: fakePack(), content: content(), store: new WordStore(), vault });
  if (withWordAudio) {
    const m = parseWordAudio({
      schema: WORD_AUDIO_SCHEMA,
      lang: "zh-Hant",
      voice: "Serena",
      engine: "e",
      words: { 今晚: WORD_PATH }, // only 今晚 is rendered
    })!;
    app.setWordAudio(bindWordAudio(m, "base"));
  }
  return app;
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Open the hover popup for a word and return its 🔊 button. */
async function speakBtnFor(root: HTMLElement, word: string): Promise<HTMLButtonElement> {
  root.querySelector<HTMLElement>(`[data-word="${word}"]`)!.dispatchEvent(new FocusEvent("focus"));
  await tick(); // dictionaryProvider promise resolves → renderPopup builds the 🔊 button
  return [...root.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "🔊")!;
}

describe("reader hover 🔊 — per-word audio (M3)", () => {
  it("plays the word's Serena clip when a word-audio manifest is bound", async () => {
    const root = document.createElement("div");
    const app = build(true);
    const speakSpy = vi.spyOn(app, "speak");
    const readSpy = vi.spyOn(app.vault!, "readBytes");
    const view = mountReader(root, app);

    (await speakBtnFor(root, "今晚")).click();
    await tick();
    expect(readSpy).toHaveBeenCalledWith(`base/${WORD_PATH}`);
    expect(speakSpy).not.toHaveBeenCalled(); // word audio used, not Web Speech
    view.unmount();
  });

  it("falls back to Web Speech for a word with no clip", async () => {
    const root = document.createElement("div");
    const app = build(true);
    const speakSpy = vi.spyOn(app, "speak");
    const view = mountReader(root, app);

    (await speakBtnFor(root, "熱鬧")).click(); // not in the manifest
    await tick();
    expect(speakSpy).toHaveBeenCalledWith("熱鬧");
    view.unmount();
  });

  it("uses Web Speech when no manifest is bound at all", async () => {
    const root = document.createElement("div");
    const app = build(false);
    const speakSpy = vi.spyOn(app, "speak");
    const view = mountReader(root, app);

    (await speakBtnFor(root, "今晚")).click();
    expect(speakSpy).toHaveBeenCalledWith("今晚");
    view.unmount();
  });
});
