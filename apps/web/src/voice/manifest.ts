/**
 * Voice-notes manifest — the reader's view of a `tsumugu/voice-notes@1` sidecar
 * (`gen voice-notes` output). Pure + unit-tested: parse/validate, resolve audio
 * paths against the manifest's directory, and index notes by cue.
 *
 * This module is inert until a manifest is actually present beside a reading; the
 * reader attaches the result to {@link AppState} and the player consumes it.
 */

export const VOICE_NOTES_SCHEMA = "tsumugu/voice-notes@1";

/** One manifest entry: the audio for a cue (+ an optional slow take). */
export interface VoiceNote {
  cueIndex: number;
  /** mp3/wav path relative to the manifest's directory. */
  audio: string;
  /** Optional instruct-rendered slow take, same relative-path convention. */
  audioSlow?: string;
}

/** The parsed sidecar. */
export interface VoiceNotesManifest {
  schema: typeof VOICE_NOTES_SCHEMA;
  lang: string;
  slug: string;
  engine: string;
  voice: string;
  generatedAt?: string;
  notes: VoiceNote[];
}

/**
 * Parse + validate raw JSON into a manifest, or return null when it isn't a
 * `tsumugu/voice-notes@1` doc. Notes with a non-integer / out-of-range `cueIndex`
 * (vs the loaded cues) or no `audio` are dropped; duplicate cueIndex → last wins.
 * Missing audio FILES are tolerated here — they surface only at play time.
 */
export function parseVoiceNotes(raw: unknown, cueCount: number): VoiceNotesManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== VOICE_NOTES_SCHEMA || !Array.isArray(o.notes)) return null;

  const byIndex = new Map<number, VoiceNote>();
  for (const entry of o.notes) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const idx = r.cueIndex;
    if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= cueCount) continue;
    if (typeof r.audio !== "string" || r.audio.length === 0) continue;
    const note: VoiceNote = { cueIndex: idx, audio: r.audio };
    if (typeof r.audioSlow === "string" && r.audioSlow.length > 0) note.audioSlow = r.audioSlow;
    byIndex.set(idx, note); // last wins
  }
  const notes = [...byIndex.values()].sort((a, b) => a.cueIndex - b.cueIndex);

  const m: VoiceNotesManifest = {
    schema: VOICE_NOTES_SCHEMA,
    lang: typeof o.lang === "string" ? o.lang : "",
    slug: typeof o.slug === "string" ? o.slug : "",
    engine: typeof o.engine === "string" ? o.engine : "",
    voice: typeof o.voice === "string" ? o.voice : "",
    notes,
  };
  if (typeof o.generatedAt === "string") m.generatedAt = o.generatedAt;
  return m;
}

/** Index notes by cue for O(1) lookup. */
export function indexNotes(manifest: VoiceNotesManifest): ReadonlyMap<number, VoiceNote> {
  const map = new Map<number, VoiceNote>();
  for (const n of manifest.notes) map.set(n.cueIndex, n);
  return map;
}

/**
 * Resolve a manifest-relative audio path against the manifest's vault-relative
 * directory (e.g. baseDir `inbox/zh-Hant`, rel `audio/x/cue-0000.mp3`).
 */
export function resolveAudioPath(baseDir: string, rel: string): string {
  const b = baseDir.replace(/\/+$/, "");
  const r = rel.replace(/^\.?\/+/, "");
  return b ? `${b}/${r}` : r;
}

/** A manifest bound to a loaded reading: where its audio lives + a cue index. */
export interface VoiceNotesBinding {
  manifest: VoiceNotesManifest;
  /** Vault-relative directory of the manifest; audio paths resolve against it. */
  baseDir: string;
  byCue: ReadonlyMap<number, VoiceNote>;
}

/** Bind a parsed manifest to its directory, precomputing the cue index. */
export function bindVoiceNotes(manifest: VoiceNotesManifest, baseDir: string): VoiceNotesBinding {
  return { manifest, baseDir, byCue: indexNotes(manifest) };
}
