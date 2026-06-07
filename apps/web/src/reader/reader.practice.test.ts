// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

// wavesurfer needs Web Audio + canvas; mock it so the practice bar mounts headlessly.
vi.mock("wavesurfer.js", () => ({
  default: {
    create: () => ({
      registerPlugin: <T>(p: T): T => p,
      on: () => {},
      getDuration: () => 5,
      getCurrentTime: () => 0,
      setPlaybackRate: () => {},
      playPause: () => {},
      pause: () => {},
      destroy: () => {},
    }),
  },
}));
vi.mock("wavesurfer.js/plugins/regions", () => ({
  default: {
    create: () => ({
      enableDragSelection: () => () => {},
      getRegions: () => [],
      addRegion: (o: { start: number; end: number }) => ({
        start: o.start,
        end: o.end,
        play: () => {},
        setOptions: () => {},
        remove: () => {},
      }),
      on: () => {},
    }),
  },
}));

import { WordStore, type LanguagePack, type PreparedContent } from "@tsumugu/engine";
import { AppState } from "../state.js";
import { CLS } from "../ui/classes.js";
import { mountReader } from "./reader.js";
import { MemoryVault } from "../host/fsVault.js";
import { bindVoiceNotes, parseVoiceNotes, VOICE_NOTES_SCHEMA } from "../voice/manifest.js";
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

function build(): AppState {
  const vault = new MemoryVault();
  vault.writeBytes("base/audio/x/cue-0000.mp3", new Uint8Array([1, 2, 3]));
  vault.writeBytes("base/audio/x/cue-0001.mp3", new Uint8Array([1, 2, 3]));
  const manifest = parseVoiceNotes(
    {
      schema: VOICE_NOTES_SCHEMA,
      lang: "zh-Hant",
      slug: "x",
      engine: "e",
      voice: "Serena",
      notes: [
        { cueIndex: 0, audio: "audio/x/cue-0000.mp3" },
        { cueIndex: 1, audio: "audio/x/cue-0001.mp3" },
      ],
    },
    2,
  )!;
  return new AppState({
    pack: fakePack(),
    content: content(),
    store: new WordStore(),
    transcript,
    voiceNotes: bindVoiceNotes(manifest, "base"),
    vault,
  });
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const pressL = (): void => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "l", bubbles: true }));
};
const activeWord = (root: HTMLElement): string | undefined =>
  root.querySelector<HTMLElement>(`.${CLS.active}`)?.dataset.word;
const barBtn = (root: HTMLElement): HTMLButtonElement | undefined =>
  [...root.querySelectorAll<HTMLButtonElement>(`.${CLS.transport} .${CLS.btn}`)].find((b) => b.textContent === "🌊");

describe("reader: L collision (practice loop vs next-word)", () => {
  it("with the bar CLOSED, `l` advances to the next word", () => {
    const root = document.createElement("div");
    const view = mountReader(root, build());
    expect(activeWord(root)).toBe("今晚"); // initial
    pressL();
    expect(activeWord(root)).toBe("我們"); // next-word
    view.unmount();
  });

  it("with the bar OPEN, `l` loops the slice and does NOT advance the word", async () => {
    const root = document.createElement("div");
    const view = mountReader(root, build());
    expect(activeWord(root)).toBe("今晚");

    barBtn(root)!.click(); // open the practice bar
    await tick(); // factory (mocked wavesurfer) resolves

    pressL();
    expect(activeWord(root)).toBe("今晚"); // unchanged — `l` was claimed for loop
    // The loop is engaged (🔁 button active).
    const loopBtn = [...root.querySelectorAll<HTMLButtonElement>(`.${CLS.btn}`)].find((b) => b.textContent === "🔁");
    expect(loopBtn?.classList.contains(CLS.btnActive)).toBe(true);

    // Esc closes the bar; `l` returns to next-word.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    pressL();
    expect(activeWord(root)).toBe("我們");
    view.unmount();
  });
});

const cueActive = (root: HTMLElement, word: string): boolean =>
  root.querySelector<HTMLElement>(`[data-word="${word}"]`)?.classList.contains(CLS.cueActive) ?? false;

describe("reader: sentence navigation (M2.2)", () => {
  it("clicking a sentence's token makes that cue active", () => {
    const root = document.createElement("div");
    const view = mountReader(root, build());
    // 那裡 is in cue 1 (token index 4); click it.
    root.querySelector<HTMLElement>('[data-ti="4"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cueActive(root, "那裡")).toBe(true);
    expect(cueActive(root, "今晚")).toBe(false);
    view.unmount();
  });

  it("`,` / `.` step the active sentence", () => {
    const root = document.createElement("div");
    const view = mountReader(root, build());
    document.dispatchEvent(new KeyboardEvent("keydown", { key: ".", bubbles: true }));
    expect(cueActive(root, "那裡")).toBe(true); // next cue
    document.dispatchEvent(new KeyboardEvent("keydown", { key: ",", bubbles: true }));
    expect(cueActive(root, "今晚")).toBe(true); // back to first
    view.unmount();
  });
});
