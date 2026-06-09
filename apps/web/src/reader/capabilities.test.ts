import { describe, it, expect } from "vitest";

import { resolveCapabilities, CUE_WAVEFORM_LIMIT, type CapabilityInputs } from "./capabilities.js";

/** A reading with cues but nothing else bound (the baseline). */
const base: CapabilityInputs = {
  hasVideoId: false,
  cueCount: 10,
  sectionCount: 0,
  hasVoicePlayer: false,
  hasVault: false,
  hasVoiceNotes: false,
  voiceTrackCount: 0,
};

describe("resolveCapabilities", () => {
  it("a bare video reading: picture + cues, no voice features, video-led", () => {
    const c = resolveCapabilities({ ...base, hasVideoId: true });
    expect(c.hasPicture).toBe(true);
    expect(c.hasCues).toBe(true);
    expect(c.hasVoice).toBe(false);
    expect(c.canPractice).toBe(false);
    expect(c.hasDualVoice).toBe(false);
    expect(c.defaultVoiceLed).toBe(false); // video-led until `v`
  });

  it("an audio-only voice reading: no picture, voice features on, voice-led by default", () => {
    const c = resolveCapabilities({
      ...base,
      hasVoicePlayer: true,
      hasVault: true,
      hasVoiceNotes: true,
      voiceTrackCount: 1,
    });
    expect(c.hasPicture).toBe(false);
    expect(c.hasVoice).toBe(true);
    expect(c.canPractice).toBe(true);
    expect(c.canWaveforms).toBe(true); // 10 cues ≤ limit
    expect(c.hasDualVoice).toBe(false);
    expect(c.defaultVoiceLed).toBe(true); // no picture → always voice-led
  });

  it("a mixed reading (video + dual-voice) lights up the full union, still video-led", () => {
    const c = resolveCapabilities({
      ...base,
      hasVideoId: true,
      hasVoicePlayer: true,
      hasVault: true,
      hasVoiceNotes: true,
      voiceTrackCount: 2,
      sectionCount: 3,
    });
    expect(c.hasPicture).toBe(true);
    expect(c.hasVoice).toBe(true);
    expect(c.canPractice).toBe(true);
    expect(c.hasDualVoice).toBe(true);
    expect(c.hasSections).toBe(true);
    expect(c.defaultVoiceLed).toBe(false); // a video reading starts video-led even with voice notes
  });

  it("canPractice needs player AND vault AND notes together", () => {
    expect(resolveCapabilities({ ...base, hasVoicePlayer: true, hasVault: true }).canPractice).toBe(false);
    expect(resolveCapabilities({ ...base, hasVoicePlayer: true, hasVoiceNotes: true }).canPractice).toBe(false);
    expect(resolveCapabilities({ ...base, hasVault: true, hasVoiceNotes: true }).canPractice).toBe(false);
  });

  it("waveforms switch off past the cue limit (and require practice audio)", () => {
    const practice = { hasVoicePlayer: true, hasVault: true, hasVoiceNotes: true };
    expect(resolveCapabilities({ ...base, ...practice, cueCount: CUE_WAVEFORM_LIMIT }).canWaveforms).toBe(true);
    expect(resolveCapabilities({ ...base, ...practice, cueCount: CUE_WAVEFORM_LIMIT + 1 }).canWaveforms).toBe(false);
    expect(resolveCapabilities({ ...base, cueCount: 10 }).canWaveforms).toBe(false); // no practice audio
  });

  it("sections and cues are presence flags driven by count", () => {
    expect(resolveCapabilities({ ...base, cueCount: 0 }).hasCues).toBe(false);
    expect(resolveCapabilities({ ...base, sectionCount: 0 }).hasSections).toBe(false);
    expect(resolveCapabilities({ ...base, sectionCount: 1 }).hasSections).toBe(true);
  });
});
