/**
 * `gen example-audio` orchestration — pure logic (Dictionary PRD Phase D4).
 *
 * Renders one Serena (Qwen3-TTS) mp3 per glossary example sentence and stamps
 * `examples[].audio` on the prepared content. Side-effect-free here; the CLI
 * spawns the Python worker + ffmpeg (reusing voice-notes helpers).
 */

import { sha1Hex, type ExampleSentence, type PreparedContent } from "@tsumugu/engine";
import { selectWords, type WordSelectMode } from "./wordAudio.js";
import { maxSentenceDurationSec } from "./encodingAudio.js";

export { maxSentenceDurationSec };

/** Default audio output dir, relative to the prepared file's directory. */
export const EXAMPLE_AUDIO_DIR = "audio/examples";

/** One example row selected for rendering. */
export interface ExampleRef {
  word: string;
  /** Index within `glossary[word].examples`. */
  index: number;
  text: string;
}

export interface ExamplePlanItem {
  word: string;
  index: number;
  text: string;
  /** mp3 path relative to the prepared file's directory. */
  audio: string;
  render: boolean;
}

/**
 * Stable mp3 path for an example sentence — hash-named so identical sentences
 * dedup across words and readings.
 */
export function exampleAudioPath(text: string, audioRelDir: string = EXAMPLE_AUDIO_DIR): string {
  const dir = audioRelDir.replace(/\/+$/, "");
  return `${dir}/${sha1Hex(text).slice(0, 16)}.mp3`;
}

/** Words to scan (same modes as `gen word-audio`). */
export function selectExampleWords(content: PreparedContent, mode: WordSelectMode): string[] {
  return selectWords(content, mode);
}

/** Non-empty example sentences for the given glossary words. */
export function collectExamples(content: PreparedContent, words: readonly string[]): ExampleRef[] {
  const out: ExampleRef[] = [];
  for (const word of words) {
    const rows = content.glossary[word]?.examples ?? [];
    for (let i = 0; i < rows.length; i++) {
      const text = rows[i]?.text?.trim() ?? "";
      if (!text) continue;
      out.push({ word, index: i, text });
    }
  }
  return out;
}

/** Per-example render plan honoring incremental skip. Pure. */
export function planExamples(
  refs: readonly ExampleRef[],
  audioRelDir: string,
  existing: ReadonlySet<string>,
  force: boolean,
): ExamplePlanItem[] {
  return refs.map((ref) => {
    const audio = exampleAudioPath(ref.text, audioRelDir);
    return {
      word: ref.word,
      index: ref.index,
      text: ref.text,
      audio,
      render: force || !existing.has(audio),
    };
  });
}

/**
 * Return a shallow copy of prepared content with `examples[].audio` stamped for
 * every planned path that exists on disk (word → index → rel path).
 */
export function stampExampleAudio(
  content: PreparedContent,
  audioByWord: ReadonlyMap<string, ReadonlyMap<number, string>>,
): PreparedContent {
  if (audioByWord.size === 0) return content;
  const glossary = { ...content.glossary };
  for (const [word, byIndex] of audioByWord) {
    const entry = glossary[word];
    if (!entry?.examples?.length) continue;
    const examples: ExampleSentence[] = entry.examples.map((ex, i) => {
      const audio = byIndex.get(i);
      return audio ? { ...ex, audio } : ex;
    });
    glossary[word] = { ...entry, examples };
  }
  return { ...content, glossary };
}