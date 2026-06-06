import { describe, it, expect } from "vitest";
import { selectPlayback } from "./player.js";
import type { VoiceNote } from "./manifest.js";

const withSlow: VoiceNote = { cueIndex: 0, audio: "a.mp3", audioSlow: "a.slow.mp3" };
const noSlow: VoiceNote = { cueIndex: 1, audio: "b.mp3" };

describe("selectPlayback — slow/fallback matrix", () => {
  it("slow + audioSlow → plays the slow take at rate 1", () => {
    expect(selectPlayback(withSlow, true)).toEqual({ rel: "a.slow.mp3", rate: 1 });
  });
  it("slow + no audioSlow → plays the natural take pitch-corrected at 0.85", () => {
    expect(selectPlayback(noSlow, true)).toEqual({ rel: "b.mp3", rate: 0.85 });
  });
  it("natural → plays the natural take at rate 1", () => {
    expect(selectPlayback(withSlow, false)).toEqual({ rel: "a.mp3", rate: 1 });
    expect(selectPlayback(noSlow, false)).toEqual({ rel: "b.mp3", rate: 1 });
  });
  it("no note → null (caller falls back to Web Speech)", () => {
    expect(selectPlayback(undefined, false)).toBeNull();
    expect(selectPlayback(undefined, true)).toBeNull();
  });
});
