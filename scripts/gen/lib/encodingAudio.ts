/**
 * `gen encoding-audio` orchestration — pure logic (Encoding PRD Phase 5).
 *
 * Renders Serena (Qwen3-TTS) mp3s for the encoding page term + each example
 * sentence. Side-effect-free here; the CLI spawns the Python worker + ffmpeg.
 */

import {
  ENCODING_AUDIO_SCHEMA,
  parseEncodingPage,
  type EncodingAudioManifest,
  type EncodingPageDoc,
  type ExampleSentence,
} from "@tsumugu/engine";

export { ENCODING_AUDIO_SCHEMA };

/** Default audio output dir, relative to the manifest's directory. */
export const ENCODING_AUDIO_DIR = "audio/encoding";

/** Vault-relative manifest path for a term. */
export function encodingAudioManifestPath(lang: string, term: string): string {
  return `${lang}/encoding/${term.normalize("NFC")}.encoding-audio.json`;
}

export function sentenceFileName(term: string, index: number): string {
  return `${term.normalize("NFC")}-ex-${index}.mp3`;
}

export function termFileName(term: string): string {
  return `${term.normalize("NFC")}-term.mp3`;
}

export function sentenceAudioPath(term: string, index: number, audioRelDir = ENCODING_AUDIO_DIR): string {
  const dir = audioRelDir.replace(/\/+$/, "");
  return `${dir}/${sentenceFileName(term, index)}`;
}

export function termAudioPath(term: string, audioRelDir = ENCODING_AUDIO_DIR): string {
  const dir = audioRelDir.replace(/\/+$/, "");
  return `${dir}/${termFileName(term)}`;
}

/** Upper bound (seconds) for a sentence clip before retry. */
export function maxSentenceDurationSec(charCount: number): number {
  return 3.0 + 0.35 * charCount;
}

export interface EncodingAudioPlanItem {
  kind: "term" | "sentence";
  /** Sentence index when kind === "sentence". */
  index?: number;
  text: string;
  audio: string;
  render: boolean;
}

export function planEncodingAudio(opts: {
  doc: EncodingPageDoc;
  audioRelDir?: string;
  existing: ReadonlySet<string>;
  force: boolean;
  /** When false, skip term-only clip (sentences only). */
  includeTerm?: boolean;
}): EncodingAudioPlanItem[] {
  const { doc, force } = opts;
  const audioRelDir = opts.audioRelDir ?? ENCODING_AUDIO_DIR;
  const term = doc.term.normalize("NFC");
  const includeTerm = opts.includeTerm !== false;
  const plans: EncodingAudioPlanItem[] = [];

  if (includeTerm && term.length > 0) {
    const audio = termAudioPath(term, audioRelDir);
    plans.push({
      kind: "term",
      text: term,
      audio,
      render: force || !opts.existing.has(audio),
    });
  }

  const examples = doc.examples ?? [];
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i]!;
    const text = ex.text?.trim() ?? "";
    if (!text) continue;
    const audio = sentenceAudioPath(term, i, audioRelDir);
    plans.push({
      kind: "sentence",
      index: i,
      text,
      audio,
      render: force || !opts.existing.has(audio),
    });
  }
  return plans;
}

export interface BuildEncodingManifestOpts {
  existing?: EncodingAudioManifest | null;
  lang: string;
  term: string;
  termAudio?: string;
  sentences: Record<number, string>;
}

/** Merge this run's paths into any existing manifest. */
export function buildEncodingAudioManifest(opts: BuildEncodingManifestOpts): EncodingAudioManifest {
  const term = opts.term.normalize("NFC");
  const sentences: Record<number, string> = { ...(opts.existing?.sentences ?? {}) };
  for (const [k, v] of Object.entries(opts.sentences)) {
    sentences[Number(k)] = v;
  }
  const sorted: Record<number, string> = {};
  for (const k of Object.keys(sentences).map(Number).sort((a, b) => a - b)) {
    sorted[k] = sentences[k]!;
  }
  const m: EncodingAudioManifest = {
    schema: ENCODING_AUDIO_SCHEMA,
    lang: opts.lang,
    term,
    sentences: sorted,
  };
  const termAudio = opts.termAudio ?? opts.existing?.termAudio;
  if (termAudio) m.termAudio = termAudio;
  return m;
}

export interface EncodingAudioValidation {
  ok: boolean;
  missing: string[];
}

export function validateEncodingAudioManifest(
  m: EncodingAudioManifest,
  existing: ReadonlySet<string>,
): EncodingAudioValidation {
  const paths = new Set<string>();
  if (m.termAudio) paths.add(m.termAudio);
  for (const p of Object.values(m.sentences)) paths.add(p);
  const missing = [...paths].filter((p) => !existing.has(p));
  return { ok: missing.length === 0, missing };
}

/** Parse an encoding-page JSON file contents. */
export function loadEncodingPageFromText(raw: string): EncodingPageDoc | null {
  return parseEncodingPage(raw);
}

/** Non-empty example sentences from a doc (for planning). */
export function encodingExampleTexts(examples?: ExampleSentence[]): string[] {
  return (examples ?? []).map((e) => e.text?.trim() ?? "").filter((t) => t.length > 0);
}