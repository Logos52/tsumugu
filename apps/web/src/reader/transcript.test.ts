// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

import { WordStore, type LanguagePack, type PreparedContent } from "@tsumugu/engine";

import { AppState } from "../state.js";
import { CLS } from "../ui/classes.js";
import { mountReader } from "./reader.js";
import type { TranscriptDoc } from "./sync.js";

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

/** 8 tokens; two cues partition them: c0 → [0,4), c1 → [4,8). */
function content(): PreparedContent {
  return {
    schema: "tsumugu/prepared-content@1",
    lang: "zh-Hant",
    tokens: [
      { text: "今晚", isWord: true },
      { text: "我們", isWord: true },
      { text: "去", isWord: true },
      { text: "，", isWord: false },
      { text: "那裡", isWord: true },
      { text: "很", isWord: true },
      { text: "熱鬧", isWord: true },
      { text: "。", isWord: false },
    ],
    glossary: {},
  };
}

const transcript: TranscriptDoc = {
  cues: [
    { text: "今晚我們去，", start: "00:00:00,000", end: "00:00:03,000" },
    { text: "那裡很熱鬧。", start: "00:00:03,000", end: "00:00:06,000" },
  ],
};

function build(withTranscript: boolean): AppState {
  return new AppState({
    pack: fakePack(),
    content: content(),
    store: new WordStore(),
    transcript: withTranscript ? transcript : null,
  });
}

const word = (root: HTMLElement, w: string): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-word="${w}"]`)!;

describe("transcript synced-reader", () => {
  it("mounts a player/scrubber panel only when a transcript is bound", () => {
    const root = document.createElement("div");
    const plain = mountReader(root, build(false));
    expect(root.querySelector(`.${CLS.transcript}`)).toBeNull();
    plain.unmount();

    const synced = mountReader(root, build(true));
    expect(root.querySelector(`.${CLS.transcript}`)).not.toBeNull();
    expect(root.querySelector(`.${CLS.scrubber}`)).not.toBeNull();
    synced.unmount();
  });

  it("highlights the playing cue's tokens as the scrubber moves", () => {
    const root = document.createElement("div");
    const view = mountReader(root, build(true));
    const scrubber = root.querySelector<HTMLInputElement>(`.${CLS.scrubber}`)!;

    // Seek into cue 1 (3–6s): 那裡/很/熱鬧 light up, cue-0 words do not.
    scrubber.value = "4";
    scrubber.dispatchEvent(new Event("input", { bubbles: true }));
    expect(word(root, "熱鬧").classList.contains(CLS.cueActive)).toBe(true);
    expect(word(root, "那裡").classList.contains(CLS.cueActive)).toBe(true);
    expect(word(root, "今晚").classList.contains(CLS.cueActive)).toBe(false);

    // Seek back into cue 0 (0–3s): the highlight moves, cue-1 clears.
    scrubber.value = "1";
    scrubber.dispatchEvent(new Event("input", { bubbles: true }));
    expect(word(root, "今晚").classList.contains(CLS.cueActive)).toBe(true);
    expect(word(root, "熱鬧").classList.contains(CLS.cueActive)).toBe(false);

    view.unmount();
    // Teardown removes the panel and clears the reader.
    expect(root.querySelector(`.${CLS.transcript}`)).toBeNull();
    expect(root.querySelector(`[data-word="今晚"]`)).toBeNull();
  });
});
