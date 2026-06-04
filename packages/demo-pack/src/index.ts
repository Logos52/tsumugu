/**
 * Demo pack skeleton — placeholder. Fleshed out in Phase 1 (engine core).
 *
 * Generic, data-free: whitespace segmentation + a toy dictionary so the
 * public engine clones and runs a demo with zero licensed data.
 */

import type { LanguagePack, Token, DictEntry } from "@tsumugu/engine";

const TOY_DICT: Record<string, DictEntry> = {
  hello: { term: "hello", gloss: "a greeting", reading: "/həˈloʊ/", source: "packaged" },
  world: { term: "world", gloss: "the earth, everyone", reading: "/wɜːrld/", source: "packaged" },
};

function whitespaceSegment(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /(\s+|[^\s\w]+|\w+)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const piece = m[0];
    tokens.push({
      text: piece,
      start: m.index,
      end: m.index + piece.length,
      isWord: /\w/u.test(piece),
    });
  }
  return tokens;
}

export const demoPack: LanguagePack = {
  id: "demo",
  name: "Demo (generic)",
  direction: "ltr",
  segmenter: whitespaceSegment,
  dictionaryProvider: (word) => TOY_DICT[word.toLowerCase()],
  phoneticLayer: {
    id: "none",
    reading: (word) => TOY_DICT[word.toLowerCase()]?.reading,
  },
  levelingModel: () => ({ band: "demo" }),
  ttsVoice: { lang: "en-US" },
};

export default demoPack;
