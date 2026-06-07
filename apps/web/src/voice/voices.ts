/**
 * Per-speaker voice assignment (PRD §8 voice, dual-voice extension).
 *
 * A reading can have more than one voice-notes track beside it — e.g. a native
 * human recording (`<slug>.voice-notes.native.json`) and a Serena TTS take
 * (`<slug>.voice-notes.json`). This module is the pure core that maps each cue's
 * SPEAKER to a chosen voice and COMPOSES one ordinary {@link VoiceNotesBinding}
 * the existing player consumes unchanged: per cue, the note is taken from that
 * speaker's track, with its audio pre-resolved to a full vault-relative path so
 * the composite needs no single baseDir.
 *
 * All functions are pure + unit-tested; the reader wires discovery, the UI
 * control, and remount-on-change around them.
 */

import type { VoiceNote, VoiceNotesBinding, VoiceNotesManifest } from "./manifest.js";
import { bindVoiceNotes, resolveAudioPath } from "./manifest.js";

/** One discovered voice track: a stable id, a human label, and its binding. */
export interface VoiceTrack {
  /** Stable id used in assignments (e.g. "native", "serena"). */
  id: string;
  /** Human label for the picker (e.g. "Native TW", "Serena"). */
  label: string;
  binding: VoiceNotesBinding;
}

/** speaker key → voice track id. The empty key "" covers cues with no speaker. */
export type SpeakerAssignment = Record<string, string>;

/** Distinct non-empty speaker keys across the cues, in first-seen order. */
export function speakersOf(cueSpeakers: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of cueSpeakers) {
    const k = (s ?? "").trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/** The voice id for a speaker under an assignment, falling back sensibly. */
export function voiceForSpeaker(
  assignment: SpeakerAssignment,
  tracks: readonly VoiceTrack[],
  speaker: string | undefined,
): string | null {
  const k = (speaker ?? "").trim();
  return assignment[k] ?? assignment[""] ?? tracks[0]?.id ?? null;
}

/**
 * A sensible default assignment. With ≥2 tracks AND ≥2 speakers, give each
 * speaker a distinct voice (the first speaker prefers a "native" track) so a
 * dialogue sounds like two people. Otherwise everyone shares the first track.
 */
export function defaultAssignment(
  tracks: readonly VoiceTrack[],
  cueSpeakers: readonly (string | undefined)[],
): SpeakerAssignment {
  const speakers = speakersOf(cueSpeakers);
  const first = tracks[0];
  if (!first) return {};
  if (tracks.length < 2 || speakers.length < 2) {
    const a: SpeakerAssignment = { "": first.id };
    for (const s of speakers) a[s] = first.id;
    return a;
  }
  const native = tracks.find((t) => t.id === "native") ?? first;
  const other = tracks.find((t) => t.id !== native.id) ?? first;
  const rotation = [native.id, other.id];
  const a: SpeakerAssignment = { "": native.id };
  speakers.forEach((s, i) => {
    a[s] = rotation[i % rotation.length]!;
  });
  return a;
}

/**
 * Overlay a saved preference onto a base assignment, keeping only ids that still
 * exist among the current tracks. Lets the last toggle stick across readings.
 */
export function mergeAssignmentPref(
  base: SpeakerAssignment,
  pref: SpeakerAssignment | null | undefined,
  tracks: readonly VoiceTrack[],
): SpeakerAssignment {
  if (!pref) return base;
  const ids = new Set(tracks.map((t) => t.id));
  const out: SpeakerAssignment = { ...base };
  for (const [k, v] of Object.entries(pref)) {
    if (ids.has(v)) out[k] = v;
  }
  return out;
}

/**
 * Compose one binding from the per-speaker assignment. Each cue's note comes from
 * its speaker's track; audio is pre-resolved to a full vault-relative path and
 * the composite baseDir collapses to "" — so the player resolves paths verbatim
 * and never needs a per-track baseDir. Returns null when no track has any audio.
 */
export function composeBinding(
  tracks: readonly VoiceTrack[],
  assignment: SpeakerAssignment,
  cueSpeakers: readonly (string | undefined)[],
): VoiceNotesBinding | null {
  if (tracks.length === 0) return null;
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const notes: VoiceNote[] = [];
  for (let i = 0; i < cueSpeakers.length; i++) {
    const id = voiceForSpeaker(assignment, tracks, cueSpeakers[i]);
    const track = id ? byId.get(id) : undefined;
    const note = track?.binding.byCue.get(i);
    if (!track || !note) continue;
    const out: VoiceNote = { cueIndex: i, audio: resolveAudioPath(track.binding.baseDir, note.audio) };
    if (note.audioSlow) out.audioSlow = resolveAudioPath(track.binding.baseDir, note.audioSlow);
    notes.push(out);
  }
  if (notes.length === 0) return null;
  const head = tracks[0]!.binding.manifest;
  const manifest: VoiceNotesManifest = {
    schema: head.schema,
    lang: head.lang,
    slug: head.slug,
    engine: "composite",
    voice: describeAssignment(tracks, assignment, cueSpeakers),
    notes,
  };
  return bindVoiceNotes(manifest, "");
}

/** A short "甲→Native, 乙→Serena" label for the composed manifest / status. */
export function describeAssignment(
  tracks: readonly VoiceTrack[],
  assignment: SpeakerAssignment,
  cueSpeakers: readonly (string | undefined)[],
): string {
  const labelOf = (id: string | null) => tracks.find((t) => t.id === id)?.label ?? id ?? "?";
  const speakers = speakersOf(cueSpeakers);
  if (speakers.length === 0) return labelOf(voiceForSpeaker(assignment, tracks, ""));
  return speakers.map((s) => `${s}→${labelOf(voiceForSpeaker(assignment, tracks, s))}`).join(", ");
}
