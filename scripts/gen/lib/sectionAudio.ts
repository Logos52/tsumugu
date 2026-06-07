/**
 * `gen section-audio` orchestration — pure, unit-tested logic. Renders one Serena
 * mp3 per transcript section summary so the reader's section 🔊 plays the good
 * voice. Mirrors `voiceNotes.ts` / `wordAudio.ts`; the CLI supplies the IO
 * (shared Python worker + ffmpeg).
 */

/** The fields of a transcript section this helper needs. */
export interface SectionLike {
  summary?: string;
}

export interface SectionAudioNote {
  sectionIndex: number;
  audio: string;
}

export const SECTION_AUDIO_SCHEMA = "tsumugu/section-audio@1" as const;
export const SECTION_AUDIO_DIR = "audio/sections";

export interface SectionAudioManifest {
  schema: typeof SECTION_AUDIO_SCHEMA;
  lang: string;
  voice: string;
  engine: string;
  generatedAt?: string;
  notes: SectionAudioNote[];
}

/** Indices of sections that have a non-empty summary. */
export function selectSections(sections: readonly SectionLike[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < sections.length; i++) {
    if ((sections[i]?.summary ?? "").trim().length > 0) out.push(i);
  }
  return out;
}

/** mp3 path for a section, relative to the manifest dir. */
export function sectionAudioPath(index: number, audioRelDir: string = SECTION_AUDIO_DIR): string {
  return `${audioRelDir.replace(/\/+$/, "")}/section-${String(index).padStart(4, "0")}.mp3`;
}

export interface SectionPlanItem {
  index: number;
  text: string;
  audio: string;
  render: boolean;
}

export function planSections(
  sections: readonly SectionLike[],
  indices: readonly number[],
  audioRelDir: string,
  existing: ReadonlySet<string>,
  force: boolean,
): SectionPlanItem[] {
  const out: SectionPlanItem[] = [];
  for (const i of indices) {
    const text = (sections[i]?.summary ?? "").trim();
    if (!text) continue;
    const audio = sectionAudioPath(i, audioRelDir);
    out.push({ index: i, text, audio, render: force || !existing.has(audio) });
  }
  return out;
}

export interface BuildSectionManifestOpts {
  existing?: SectionAudioManifest | null;
  lang: string;
  voice: string;
  engine: string;
  generatedAt: string;
  notes: SectionAudioNote[];
}

/** Merge this run's notes into any existing manifest, preserving untouched ones, sorted. */
export function buildSectionManifest(opts: BuildSectionManifestOpts): SectionAudioManifest {
  const byIndex = new Map<number, SectionAudioNote>();
  for (const n of opts.existing?.notes ?? []) byIndex.set(n.sectionIndex, n);
  for (const n of opts.notes) byIndex.set(n.sectionIndex, n);
  const notes = [...byIndex.values()].sort((a, b) => a.sectionIndex - b.sectionIndex);
  return {
    schema: SECTION_AUDIO_SCHEMA,
    lang: opts.lang,
    voice: opts.voice,
    engine: opts.engine,
    generatedAt: opts.generatedAt,
    notes,
  };
}

export interface SectionValidation {
  ok: boolean;
  missing: string[];
}

export function validateSectionManifest(m: SectionAudioManifest, existing: ReadonlySet<string>): SectionValidation {
  const missing = m.notes.map((n) => n.audio).filter((p) => !existing.has(p));
  return { ok: missing.length === 0, missing };
}
