/**
 * Example zh-Hant language pack — proves the pack interface + a REAL OpenCC
 * Simplified→Traditional guard end-to-end. Load it with the generation CLI:
 *
 *   pnpm gen verify --in foo.prepared.json --lang zh-Hant \
 *     --pack-module examples/packs/zh-hant-example/index.ts
 *
 * This is illustrative: the word list below is a tiny ORIGINAL sample, not a
 * redistributed dictionary. A real pack supplies CC-CEDICT / MoEDict + TOCFL
 * data from the user's PRIVATE folder (see PACK-AUTHORING.md), keeping licensed
 * data out of this Apache-2.0 repo. opencc-js itself is Apache-2.0.
 */
import { Converter } from "opencc-js";
import type { LanguagePack, Token, DictEntry, Level } from "@tsumugu/engine";

interface Word {
  gloss: string;
  reading: string;
  tocfl: string;
  pos?: string;
}

// Tiny illustrative lexicon (Traditional). Not a dictionary redistribution.
const DICT: Record<string, Word> = {
  你好: { gloss: "hello", reading: "nǐ hǎo", tocfl: "A1" },
  今晚: { gloss: "tonight", reading: "jīn wǎn", tocfl: "A2", pos: "noun" },
  我們: { gloss: "we; us", reading: "wǒ men", tocfl: "A1", pos: "pronoun" },
  去: { gloss: "to go", reading: "qù", tocfl: "A1", pos: "verb" },
  夜市: { gloss: "night market", reading: "yè shì", tocfl: "A2", pos: "noun" },
  吃: { gloss: "to eat", reading: "chī", tocfl: "A1", pos: "verb" },
  小吃: { gloss: "snacks; street food", reading: "xiǎo chī", tocfl: "A2", pos: "noun" },
  那裡: { gloss: "there", reading: "nà lǐ", tocfl: "A1", pos: "pronoun" },
  很: { gloss: "very", reading: "hěn", tocfl: "A1", pos: "adverb" },
  熱鬧: { gloss: "lively; bustling", reading: "rè nào", tocfl: "B1", pos: "adjective" },
  發展: { gloss: "to develop; development", reading: "fā zhǎn", tocfl: "B1", pos: "verb" },
  國家: { gloss: "country; nation", reading: "guó jiā", tocfl: "A2", pos: "noun" },
  個人: { gloss: "individual", reading: "gè rén", tocfl: "B1", pos: "noun" },
  圖書館: { gloss: "library", reading: "tú shū guǎn", tocfl: "A2", pos: "noun" },
  謝謝: { gloss: "thank you", reading: "xiè xie", tocfl: "A1" },
};

const MAX_LEN = Math.max(...Object.keys(DICT).map((w) => w.length));
const isHan = (ch: string): boolean => /\p{Script=Han}/u.test(ch);
const isSpace = (ch: string): boolean => /\s/.test(ch);

/** Client-side longest-match tokenizer (the demo for jieba-wasm later). */
function segment(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (isSpace(ch)) {
      let j = i + 1;
      while (j < text.length && isSpace(text[j]!)) j++;
      tokens.push({ text: text.slice(i, j), start: i, end: j, isWord: false });
      i = j;
    } else if (isHan(ch)) {
      let matched = "";
      for (let len = Math.min(MAX_LEN, text.length - i); len >= 1; len--) {
        const cand = text.slice(i, i + len);
        if (DICT[cand]) {
          matched = cand;
          break;
        }
      }
      const word = matched || ch; // single Han char fallback
      tokens.push({ text: word, start: i, end: i + word.length, isWord: true });
      i += word.length;
    } else {
      let j = i + 1;
      while (j < text.length && !isSpace(text[j]!) && !isHan(text[j]!)) j++;
      const seg = text.slice(i, j);
      tokens.push({ text: seg, start: i, end: j, isWord: /[\p{L}\p{N}]/u.test(seg) });
      i = j;
    }
  }
  return tokens;
}

// One OpenCC Simplified→Traditional (Taiwan) converter, created once.
const s2t = Converter({ from: "cn", to: "tw" });

const zhHantExamplePack: LanguagePack = {
  id: "zh-Hant",
  name: "Traditional Chinese (example pack)",
  direction: "ltr",
  segmenter: segment,
  dictionaryProvider: (word: string): DictEntry | undefined => {
    const w = DICT[word];
    if (!w) return undefined;
    const entry: DictEntry = { term: word, gloss: w.gloss, reading: w.reading, level: w.tocfl, source: "packaged" };
    if (w.pos !== undefined) entry.pos = w.pos;
    return entry;
  },
  phoneticLayer: {
    id: "pinyin",
    reading: (word: string): string | undefined => DICT[word]?.reading,
  },
  levelingModel: (word: string): Level | undefined => {
    const w = DICT[word];
    return w ? { band: `TOCFL-${w.tocfl}` } : undefined;
  },
  scriptNormalizer: (text: string): string => s2t(text),
  ttsVoice: { lang: "zh-TW" },
};

export default zhHantExamplePack;
export { zhHantExamplePack };
