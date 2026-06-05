/**
 * Traditional-Chinese browser pack.
 *
 * Public algorithms only: a trivial fallback segmenter (the reader consumes
 * pre-segmented content, so this is just for completeness — NO jieba-wasm),
 * Zhuyin tone parsing, and OpenCC Simplified→Traditional normalization. The
 * licensed dictionary DATA is supplied at runtime via an optional `BrowserDict`
 * (vault-backed); nothing licensed is bundled.
 */

import { Converter } from "opencc-js";
import type { LanguagePack, Token } from "@tsumugu/engine";

import type { BrowserDict } from "./index.js";
import { toneClassesFromZhuyin } from "./tones.js";

/** Word-ish char test: Han, any letter, or any number. */
const WORD_RE = /\p{Script=Han}|\p{L}|\p{N}/u;
const HAN_RE = /\p{Script=Han}/u;
const SPACE_RE = /\s/u;

/**
 * Trivial fallback segmenter that tiles the full input: each Han char is its
 * own token, runs of non-Han non-space word chars group together, whitespace
 * and punctuation each form their own (non-word) runs. Offsets cover the input
 * with no gaps or overlaps.
 */
function fallbackSegment(text: string): Token[] {
  const tokens: Token[] = [];
  const chars = [...text];
  let offset = 0; // char-index offset, code-point aware
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (HAN_RE.test(ch)) {
      tokens.push({ text: ch, start: offset, end: offset + 1, isWord: true });
      offset += 1;
      i += 1;
      continue;
    }
    const isWordChar = (c: string): boolean => WORD_RE.test(c) && !HAN_RE.test(c);
    const isSpace = (c: string): boolean => SPACE_RE.test(c);
    const start = offset;
    let run = "";
    if (isWordChar(ch)) {
      while (i < chars.length && isWordChar(chars[i]!)) {
        run += chars[i];
        i += 1;
        offset += 1;
      }
      tokens.push({ text: run, start, end: offset, isWord: true });
    } else if (isSpace(ch)) {
      while (i < chars.length && isSpace(chars[i]!)) {
        run += chars[i];
        i += 1;
        offset += 1;
      }
      tokens.push({ text: run, start, end: offset, isWord: false });
    } else {
      // Punctuation / symbols: group contiguous non-word, non-space, non-Han.
      while (
        i < chars.length &&
        !isWordChar(chars[i]!) &&
        !isSpace(chars[i]!) &&
        !HAN_RE.test(chars[i]!)
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
 * Build the zh-Hant browser pack. `opts.dict` is an optional async dictionary
 * for live hover lookups (undefined → reader falls back to pre-baked content).
 */
export function createZhHantBrowserPack(opts?: { dict?: BrowserDict }): LanguagePack {
  const dict = opts?.dict;
  // Created once: Simplified→Traditional with the Taiwan-idiom layer (s2twp:
  // 軟件→軟體, 信息→資訊) — the OpenCC guard on all zh-Hant output. `twp`, not
  // plain `tw`, so no Mainland phrasing leaks onto any surface.
  const cn2tw = Converter({ from: "cn", to: "twp" });

  return {
    id: "zh-Hant",
    name: "Chinese (Traditional)",
    direction: "ltr",
    segmenter: fallbackSegment,
    dictionaryProvider: (word) => dict?.lookup(word),
    phoneticLayer: {
      id: "zhuyin",
      reading: (_word, dict) => dict?.reading,
      toneClasses: (_word, reading) =>
        reading ? toneClassesFromZhuyin(reading) : undefined,
    },
    levelingModel: () => undefined,
    scriptNormalizer: (text) => cn2tw(text),
    ttsVoice: { lang: "zh-TW" },
  };
}
