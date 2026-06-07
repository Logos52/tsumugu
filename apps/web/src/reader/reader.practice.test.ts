// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

// wavesurfer needs Web Audio + canvas; mock it so the practice bar mounts headlessly.
vi.mock("wavesurfer.js", () => ({
  default: {
    create: () => ({
      registerPlugin: <T>(p: T): T => p,
      on: () => {},
      load: () => Promise.resolve(),
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

describe("reader: practice bar is auto-visible and does not claim `l`", () => {
  it("shows the bar by default (🌊 active) and `l` stays next-word", async () => {
    const root = document.createElement("div");
    const view = mountReader(root, build());
    await tick(); // bar factory (mocked wavesurfer) resolves

    // The 🌊 toggle is active (bar visible) by default.
    expect(barBtn(root)!.classList.contains(CLS.btnActive)).toBe(true);

    // `l` advances the word even with the bar visible (loop is the 🔁 button now).
    expect(activeWord(root)).toBe("今晚");
    pressL();
    expect(activeWord(root)).toBe("我們");
    pressL();
    expect(activeWord(root)).toBe("去");
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

  it("`,` / `.` and ↑ / ↓ step the active sentence", () => {
    const root = document.createElement("div");
    const view = mountReader(root, build());
    const key = (k: string) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    key("."); // next cue
    expect(cueActive(root, "那裡")).toBe(true);
    key(","); // back to first
    expect(cueActive(root, "今晚")).toBe(true);
    key("ArrowDown"); // next cue (arrow)
    expect(cueActive(root, "那裡")).toBe(true);
    key("ArrowUp"); // back (arrow)
    expect(cueActive(root, "今晚")).toBe(true);
    view.unmount();
  });
});
