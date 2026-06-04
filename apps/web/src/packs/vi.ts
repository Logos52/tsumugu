/**
 * Vietnamese browser pack.
 *
 * Public algorithms only: a trivial fallback segmenter (the reader consumes
 * pre-segmented content) and diacritic-based tone parsing. The licensed
 * dictionary DATA is supplied at runtime via an optional `BrowserDict`
 * (vault-backed); nothing licensed is bundled. No script normalizer (vi is
 * already Latin).
 */

import type { LanguagePack, Token } from "@tsumugu/engine";

import type { BrowserDict } from "./index.js";
import { toneClassesFromViWord } from "./tones.js";

/** Word-ish char test (letters/numbers, including combining diacritics). */
const WORD_RE = /[\p{L}\p{N}\p{M}]/u;
const SPACE_RE = /\s/u;

/**
 * Trivial fallback segmenter that tiles the full input: runs of word chars
 * (letters/numbers/combining marks) are word tokens; whitespace and
 * punctuation runs are non-word tokens. Offsets cover the input with no gaps.
 * Note: multi-syllable vi words are split on spaces here, which is fine — the
 * reader uses pre-segmented content, so this segmenter is a completeness-only
 * fallback.
 */
function fallbackSegment(text: string): Token[] {
  const tokens: Token[] = [];
  const chars = [...text];
  let offset = 0;
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    const start = offset;
    let run = "";
    if (WORD_RE.test(ch)) {
      while (i < chars.length && WORD_RE.test(chars[i]!)) {
        run += chars[i];
        i += 1;
        offset += 1;
      }
      tokens.push({ text: run, start, end: offset, isWord: true });
    } else if (SPACE_RE.test(ch)) {
      while (i < chars.length && SPACE_RE.test(chars[i]!)) {
        run += chars[i];
        i += 1;
        offset += 1;
      }
      tokens.push({ text: run, start, end: offset, isWord: false });
    } else {
      while (
        i < chars.length &&
        !WORD_RE.test(chars[i]!) &&
        !SPACE_RE.test(chars[i]!)
      ) {
        run += chars[i];
        i += 1;
        offset += 1;
      }
      tokens.push({ text: run, start, end: offset, isWord: false });
    }
  }
  return tokens;
}

/**
 * Build the vi browser pack. `opts.dict` is an optional async dictionary for
 * live hover lookups (undefined → reader falls back to pre-baked content).
 */
export function createViBrowserPack(opts?: { dict?: BrowserDict }): LanguagePack {
  const dict = opts?.dict;
  return {
    id: "vi",
    name: "Vietnamese",
    direction: "ltr",
    segmenter: fallbackSegment,
    dictionaryProvider: (word) => dict?.lookup(word),
    phoneticLayer: {
      id: "vi-latin",
      reading: (word, dict) => dict?.reading ?? word,
      toneClasses: (word) => toneClassesFromViWord(word),
    },
    levelingModel: () => undefined,
    ttsVoice: { lang: "vi-VN" },
  };
}
