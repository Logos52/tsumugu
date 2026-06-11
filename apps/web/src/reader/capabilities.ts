/**
 * Reading capabilities — the single source of truth for "what can this reading
 * do?" (PRD §13, FR-F1).
 *
 * There is one reader and one synced-player controller; what used to fork on
 * `hasVideo = !!transcript.videoId` now derives from a capability set computed
 * once at mount. Every transport control and layout choice reads a flag here,
 * never a raw `videoId` truthiness — so a reading that is BOTH video-backed and
 * voice-noted lights up the full union with no special-casing, and an audio-only
 * reading is treated as a first-class time source rather than "a video that
 * happens to be missing".
 *
 * Pure + unit-tested; the controller wires the runtime objects to these flags.
 */

/** Cues above this get lazy waveform init (DOM rows always; wavesurfer on scroll). */
export const CUE_WAVEFORM_LAZY_THRESHOLD = 80;

export interface CapabilityInputs {
  /** The transcript carries a `videoId` (an embeddable picture + a video clock). */
  hasVideoId: boolean;
  cueCount: number;
  sectionCount: number;
  /** A cue-aware voice player is bound (per-cue Serena/native audio). */
  hasVoicePlayer: boolean;
  /** A vault can serve audio bytes. */
  hasVault: boolean;
  /** A voice-notes binding is present. */
  hasVoiceNotes: boolean;
  /** How many voice tracks sit beside the reading (≥2 → a per-speaker picker). */
  voiceTrackCount: number;
}

export interface ReadingCapabilities {
  /** A video picture is embeddable — drives the theater/split layouts + a video clock. */
  hasPicture: boolean;
  /** The reading has timed cues to sync against. */
  hasCues: boolean;
  /** Per-cue voice transport + shadowing are available. */
  hasVoice: boolean;
  /** The segment-loop practice bar can load cue audio. */
  canPractice: boolean;
  /** Per-sentence inline waveforms (lazy-init when cue count is large). */
  canWaveforms: boolean;
  /** ≥2 voice tracks → a per-speaker (甲/乙) voice picker. */
  hasDualVoice: boolean;
  /** Topical sections ("now talking about…") are present. Orthogonal to medium. */
  hasSections: boolean;
  /**
   * Playback is voice-led by default. A reading with no video picture has only
   * its per-cue voice notes as audio, so it is always voice-led; a video reading
   * is video-led until `v` flips it to Serena playback (PRD §13.4).
   */
  defaultVoiceLed: boolean;
}

/** Resolve the capability set for a reading from its already-bound inputs. */
export function resolveCapabilities(i: CapabilityInputs): ReadingCapabilities {
  const canPractice = i.hasVoicePlayer && i.hasVault && i.hasVoiceNotes;
  return {
    hasPicture: i.hasVideoId,
    hasCues: i.cueCount > 0,
    hasVoice: i.hasVoicePlayer,
    canPractice,
    canWaveforms: canPractice && i.cueCount > 0,
    hasDualVoice: i.voiceTrackCount >= 2,
    hasSections: i.sectionCount > 0,
    defaultVoiceLed: !i.hasVideoId,
  };
}
