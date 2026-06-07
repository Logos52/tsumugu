/**
 * `gen word-audio` orchestration — pure, unit-tested logic (PRD M3 per-word audio).
 *
 * Renders one Serena (Qwen3-TTS) mp3 per word so the reader's hover 🔊 plays the
 * good voice instead of Web Speech. Side-effect-free here: word selection,
 * stable hash-named paths, incremental planning, manifest build/merge/validate.
 * The CLI (`scripts/gen/cli.ts`) supplies the IO (the shared Python worker +
 * `ffmpeg`), reusing the voice-notes helpers.
 *
 * Caveat (documented): a word rendered out of context can mispronounce
 * polyphones (得/行/了). The stored zhuyin ruby + the in-context cue voice note
 * stay authoritative; Web Speech is the fallback for unrendered words.
 */

import { sha1Hex, type PreparedContent } from "@tsumugu/engine";

export const WORD_AUDIO_SCHEMA = "tsumugu/word-audio@1" as const;

/** Which words to render. */
export type WordSelectMode = "all" | "glossary";

/** The `tsumugu/word-audio@1` sidecar: word → mp3 path (relative to its dir). */
export interface WordAudioManifest {
  schema: typeof WORD_AUDIO_SCHEMA;
  lang: string;
  voice: string;
  engine: string;
  generatedAt?: string;
  words: Record<string, string>;
}

/** Default audio output dir, relative to the manifest's directory. */
export const WORD_AUDIO_DIR = "audio/words";

/**
 * Unique words to render: every distinct `isWord` token (`all`), or the glossary
 * keys — the studied unknowns (`glossary`). Order is first-seen; empties dropped.
 */
export function selectWords(content: PreparedContent, mode: WordSelectMode): string[] {
  if (mode === "glossary") {
    return Object.keys(content.glossary ?? {})
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of content.tokens) {
    if (!t.isWord) continue;
    const w = t.text.trim();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/**
 * Stable mp3 path for a word, hash-named so identical words dedup across runs and
 * readings (and the filename is filesystem/Anki-safe regardless of script).
 */
export function wordAudioPath(word: string, audioRelDir: string = WORD_AUDIO_DIR): string {
  return `${audioRelDir.replace(/\/+$/, "")}/${sha1Hex(word).slice(0, 16)}.mp3`;
}

/**
 * Plausible upper bound (seconds) for a word's clip. A bare single word can make
 * the TTS hallucinate a runaway utterance (e.g. 我 → 6 s); anything longer than
 * this for the character count is treated as a bad take and re-rendered.
 */
export function maxWordDurationSec(charCount: number): number {
  return 2.0 + 0.7 * charCount;
}

export interface WordPlanItem {
  word: string;
  /** mp3 path relative to the manifest dir. */
  audio: string;
  /** False when the mp3 already exists and `--force` is off. */
  render: boolean;
}

/** Per-word plan honoring incremental skip. Pure. */
export function planWords(
  words: readonly string[],
  audioRelDir: string,
  existing: ReadonlySet<string>,
  force: boolean,
): WordPlanItem[] {
  return words.map((word) => {
    const audio = wordAudioPath(word, audioRelDir);
    return { word, audio, render: force || !existing.has(audio) };
  });
}

export interface BuildWordManifestOpts {
  existing?: WordAudioManifest | null;
  lang: string;
  voice: string;
  engine: string;
  generatedAt: string;
  /** This run's word → path entries. */
  words: Record<string, string>;
}

/**
 * Merge this run's words into any existing manifest (preserving untouched words),
 * with keys sorted for deterministic output.
 */
export function buildWordManifest(opts: BuildWordManifestOpts): WordAudioManifest {
  const merged: Record<string, string> = { ...(opts.existing?.words ?? {}), ...opts.words };
  const words: Record<string, string> = {};
  for (const k of Object.keys(merged).sort()) words[k] = merged[k]!;
  return {
    schema: WORD_AUDIO_SCHEMA,
    lang: opts.lang,
    voice: opts.voice,
    engine: opts.engine,
    generatedAt: opts.generatedAt,
    words,
  };
}

export interface WordValidation {
  ok: boolean;
  missing: string[];
}

/** Every word's referenced mp3 must be present (`existing` = rel paths on disk). */
export function validateWordManifest(m: WordAudioManifest, existing: ReadonlySet<string>): WordValidation {
  const missing = [...new Set(Object.values(m.words))].filter((p) => !existing.has(p));
  return { ok: missing.length === 0, missing };
}
