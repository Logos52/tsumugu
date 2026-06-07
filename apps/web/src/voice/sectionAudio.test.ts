// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

import { MemoryVault } from "../host/fsVault.js";
import {
  parseSectionAudio,
  bindSectionAudio,
  selectSectionSrc,
  createSectionAudioPlayer,
  SECTION_AUDIO_SCHEMA,
} from "./sectionAudio.js";

const good = {
  schema: SECTION_AUDIO_SCHEMA,
  lang: "zh-Hant",
  voice: "Serena",
  engine: "qwen3@mlx-audio",
  notes: [
    { sectionIndex: 0, audio: "audio/sections/section-0000.mp3" },
    { sectionIndex: 2, audio: "audio/sections/section-0002.mp3" },
  ],
};
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("parseSectionAudio", () => {
  it("parses valid notes, sorts, filters out-of-range / bad entries", () => {
    const m = parseSectionAudio({ ...good, notes: [...good.notes, { sectionIndex: 99, audio: "x" }, { sectionIndex: 1 }] }, 3)!;
    expect(m.notes.map((n) => n.sectionIndex)).toEqual([0, 2]); // 99 out of range, 1 has no audio
  });
  it("returns null for wrong schema / non-object", () => {
    expect(parseSectionAudio({ ...good, schema: "x" }, 3)).toBeNull();
    expect(parseSectionAudio(null, 3)).toBeNull();
  });
});

describe("selectSectionSrc", () => {
  const b = bindSectionAudio(parseSectionAudio(good, 3)!, "inbox/zh-Hant");
  it("resolves a rendered section against the manifest dir", () => {
    expect(selectSectionSrc(b, 0)).toBe("inbox/zh-Hant/audio/sections/section-0000.mp3");
  });
  it("returns null for an unrendered section", () => {
    expect(selectSectionSrc(b, 1)).toBeNull();
  });
});

describe("createSectionAudioPlayer", () => {
  function setup() {
    const vault = new MemoryVault();
    vault.writeBytes("base/audio/sections/section-0000.mp3", new Uint8Array([1, 2, 3]));
    const spoken: string[] = [];
    const player = createSectionAudioPlayer({
      vault,
      binding: bindSectionAudio(parseSectionAudio(good, 3)!, "base"),
      speak: (t) => spoken.push(t),
    });
    return { vault, spoken, player };
  }

  it("reads the clip at the resolved path", async () => {
    const { vault, player } = setup();
    const spy = vi.spyOn(vault, "readBytes");
    player.playSection(0, "甲");
    await tick();
    expect(spy).toHaveBeenCalledWith("base/audio/sections/section-0000.mp3");
  });

  it("speaks the fallback text for a section with no clip", () => {
    const { spoken, player } = setup();
    player.playSection(1, "乙的摘要"); // not in the manifest
    expect(spoken).toEqual(["乙的摘要"]);
  });

  it("falls back to Web Speech when the clip is unreadable", async () => {
    const { spoken, player } = setup();
    player.playSection(2, "丙的摘要"); // note present, bytes missing
    await tick();
    expect(spoken).toEqual(["丙的摘要"]);
  });

  it("loops the clip when opts.loop is set, and stop() pauses it", async () => {
    const { player } = setup();
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
    player.playSection(0, "甲", { loop: true }); // exercises the loop path
    await tick();
    player.stop();
    expect(pause).toHaveBeenCalled();
    pause.mockRestore();
  });
});
