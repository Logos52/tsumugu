/**
 * Build an Anki sentence deck from a reading's voice notes (M1 B4): one note per
 * voiced cue, front = the sentence, back = its translation + `[sound:cue-NNNN.mp3]`,
 * with the audio bytes embedded as Anki media. For SRS shadowing on due lines.
 *
 * Pure given an injected `readBytes` (the host vault) — unit-tested. The engine
 * exporter embeds the media; this only assembles the deck. Cues whose audio is
 * unreadable are skipped (the export degrades rather than failing).
 */

import type { AnkiDeck, AnkiMedia } from "@tsumugu/engine";
import type { VoiceNotesBinding } from "./manifest.js";
import { resolveAudioPath } from "./manifest.js";

/** The cue fields a voice deck needs. */
export interface CueText {
  text: string;
  tr?: string;
}

export interface BuildVoiceDeckOpts {
  deckName: string;
  tags?: string[];
  cues: readonly CueText[];
  binding: VoiceNotesBinding;
  /** Host vault binary read (resolved vault path → bytes, or null). */
  readBytes: (path: string) => Promise<Uint8Array | null>;
}

/**
 * Assemble a sentence deck embedding each voiced cue's natural audio. Notes are
 * emitted in cue-index order (deterministic media numbering). The slow take is
 * intentionally left out of M1 Anki (natural speech is the SRS target).
 */
export async function buildVoiceNotesDeck(opts: BuildVoiceDeckOpts): Promise<AnkiDeck> {
  const { binding } = opts;
  const media: AnkiMedia[] = [];
  const seen = new Set<string>();
  const notes: AnkiDeck["notes"] = [];

  // manifest.notes is already sorted by cueIndex (parseVoiceNotes / buildManifest).
  for (const note of binding.manifest.notes) {
    const cue = opts.cues[note.cueIndex];
    if (!cue || !cue.text.trim()) continue;
    const bytes = await opts.readBytes(resolveAudioPath(binding.baseDir, note.audio));
    if (!bytes) continue; // unreadable audio → skip this cue

    const filename = note.audio.replace(/.*\//, ""); // basename, e.g. cue-0073.mp3
    if (!seen.has(filename)) {
      media.push({ filename, bytes });
      seen.add(filename);
    }
    const tr = cue.tr ? `${cue.tr}<br>` : "";
    notes.push({
      front: cue.text,
      back: `${tr}[sound:${filename}]`,
      ...(opts.tags ? { tags: opts.tags } : {}),
    });
  }

  return { name: opts.deckName, notes, media };
}
