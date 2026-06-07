// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

import { MemoryVault } from "../host/fsVault.js";
import { createVoicePlayer, CHAIN_GAP_MS } from "./player.js";
import { bindVoiceNotes, parseVoiceNotes, VOICE_NOTES_SCHEMA } from "./manifest.js";

const cues = [{ text: "零cue" }, { text: "一cue" }, { text: "二cue" }];
const manifest = parseVoiceNotes(
  {
    schema: VOICE_NOTES_SCHEMA,
    lang: "zh-Hant",
    slug: "x",
    engine: "e",
    voice: "Serena",
    notes: [
      { cueIndex: 1, audio: "audio/x/cue-0001.mp3" }, // bytes present
      { cueIndex: 2, audio: "audio/x/cue-0002.mp3" }, // bytes MISSING
    ],
  },
  cues.length,
)!;

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function setup() {
  const vault = new MemoryVault();
  vault.writeBytes("base/audio/x/cue-0001.mp3", new Uint8Array([1, 2, 3]));
  const spoken: string[] = [];
  const player = createVoicePlayer({
    vault,
    binding: bindVoiceNotes(manifest, "base"),
    cues,
    speak: (t) => spoken.push(t),
  });
  return { vault, spoken, player };
}

describe("createVoicePlayer — blob IO + fallback", () => {
  it("falls back to Web Speech for a cue with no voice note (synchronously)", () => {
    const { spoken, player } = setup();
    player.playCue(0); // cue 0 has no manifest note
    expect(spoken).toEqual(["零cue"]);
  });

  it("falls back to Web Speech when the audio file is unreadable", async () => {
    const { spoken, player } = setup();
    player.playCue(2); // note present, but bytes missing → null
    await tick();
    expect(spoken).toEqual(["二cue"]);
  });

  it("reads bytes at the manifest-resolved path when the file exists", async () => {
    const { vault, player } = setup();
    const spy = vi.spyOn(vault, "readBytes");
    player.playCue(1);
    await tick();
    expect(spy).toHaveBeenCalledWith("base/audio/x/cue-0001.mp3");
  });

  it("prefers the slow take's path when slow is requested and one exists", async () => {
    const vault = new MemoryVault();
    const m = parseVoiceNotes(
      {
        schema: VOICE_NOTES_SCHEMA,
        lang: "zh-Hant",
        slug: "x",
        engine: "e",
        voice: "Serena",
        notes: [{ cueIndex: 0, audio: "a/cue-0000.mp3", audioSlow: "a/cue-0000.slow.mp3" }],
      },
      1,
    )!;
    vault.writeBytes("base/a/cue-0000.slow.mp3", new Uint8Array([9]));
    const spy = vi.spyOn(vault, "readBytes");
    const player = createVoicePlayer({
      vault,
      binding: bindVoiceNotes(m, "base"),
      cues: [{ text: "慢" }],
      speak: () => {},
    });
    player.playCue(0, { slow: true });
    await tick();
    expect(spy).toHaveBeenCalledWith("base/a/cue-0000.slow.mp3");
  });
});

describe("createVoicePlayer — playFrom chain (⏩ play-through)", () => {
  // A binding with NO notes → every take falls back to Web Speech synchronously,
  // so the chain steps purely on the gap timer (deterministic under fake timers).
  function chainPlayer() {
    const m = parseVoiceNotes(
      { schema: VOICE_NOTES_SCHEMA, lang: "zh-Hant", slug: "x", engine: "e", voice: "Serena", notes: [] },
      cues.length,
    )!;
    return createVoicePlayer({ vault: new MemoryVault(), binding: bindVoiceNotes(m, "base"), cues, speak: () => {} });
  }

  it("advances cue→cue across the gap, then fires onDone past the last cue", () => {
    vi.useFakeTimers();
    try {
      const advanced: number[] = [];
      const onDone = vi.fn();
      chainPlayer().playFrom(0, { onAdvance: (i) => advanced.push(i), onDone });
      expect(advanced).toEqual([0]); // first cue immediately
      vi.advanceTimersByTime(CHAIN_GAP_MS);
      expect(advanced).toEqual([0, 1]);
      vi.advanceTimersByTime(CHAIN_GAP_MS);
      expect(advanced).toEqual([0, 1, 2]);
      expect(onDone).not.toHaveBeenCalled();
      vi.advanceTimersByTime(CHAIN_GAP_MS); // step past the last cue
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stop() halts the chain — no further advance", () => {
    vi.useFakeTimers();
    try {
      const advanced: number[] = [];
      const player = chainPlayer();
      player.playFrom(0, { onAdvance: (i) => advanced.push(i) });
      expect(advanced).toEqual([0]);
      player.stop();
      vi.advanceTimersByTime(CHAIN_GAP_MS * 5);
      expect(advanced).toEqual([0]);
    } finally {
      vi.useRealTimers();
    }
  });
});
