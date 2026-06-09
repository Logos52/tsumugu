import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createExampleAudioPlayer,
  resolveExampleAudioSrc,
} from "./exampleAudio.js";

describe("resolveExampleAudioSrc", () => {
  it("resolves against contentBaseDir", () => {
    expect(resolveExampleAudioSrc("inbox/zh-Hant", "audio/examples/ab.mp3")).toBe(
      "inbox/zh-Hant/audio/examples/ab.mp3",
    );
  });

  it("returns null when base dir or audio is absent", () => {
    expect(resolveExampleAudioSrc(null, "audio/examples/ab.mp3")).toBeNull();
    expect(resolveExampleAudioSrc("inbox", undefined)).toBeNull();
  });
});

describe("createExampleAudioPlayer", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "Audio",
      class {
        src = "";
        playbackRate = 1;
        play = vi.fn().mockResolvedValue(undefined);
        pause = vi.fn();
      },
    );
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:ex"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("falls back to Web Speech when no audio path", () => {
    const speak = vi.fn();
    const player = createExampleAudioPlayer({
      vault: { readBytes: vi.fn() },
      contentBaseDir: "inbox",
      speak,
    });
    player.playExample(undefined, "你好");
    expect(speak).toHaveBeenCalledWith("你好");
    player.destroy();
  });

  it("plays vault bytes when a clip exists", async () => {
    const speak = vi.fn();
    const readBytes = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const player = createExampleAudioPlayer({
      vault: { readBytes },
      contentBaseDir: "inbox",
      speak,
    });
    player.playExample("audio/examples/x.mp3", "你好");
    await Promise.resolve();
    expect(readBytes).toHaveBeenCalledWith("inbox/audio/examples/x.mp3");
    expect(speak).not.toHaveBeenCalled();
    player.destroy();
  });
});