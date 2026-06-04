/**
 * Bundled demo content (compiled in — fully offline, no fetch). The English
 * sample exercises the demo pack's toy dictionary; the zh/vi samples show
 * pre-baked hover (and the Hán-Việt bridge) working with no language pack at
 * all, since unknown words are resolved at generation time.
 */
import type { PreparedContent } from "@tsumugu/engine";

const en: PreparedContent = {
  schema: "tsumugu/prepared-content@1",
  lang: "demo",
  title: "Demo (English) — hello world",
  source: "bundled",
  ciTarget: 0.95,
  tokens: [
    { text: "hello", isWord: true },
    { text: " ", isWord: false },
    { text: "world", isWord: true },
    { text: ", ", isWord: false },
    { text: "this", isWord: true },
    { text: " ", isWord: false },
    { text: "is", isWord: true },
    { text: " ", isWord: false },
    { text: "a", isWord: true },
    { text: " ", isWord: false },
    { text: "demo", isWord: true },
    { text: ".", isWord: false },
  ],
  glossary: {
    demo: {
      term: "demo",
      gloss: "a demonstration",
      explanation: "A short example that shows how something works.",
      examples: ["this is a demo."],
    },
    this: { term: "this", gloss: "the thing here" },
  },
};

const zh: PreparedContent = {
  schema: "tsumugu/prepared-content@1",
  lang: "zh-Hant",
  title: "夜市 — A night out",
  source: "bundled",
  ciTarget: 0.95,
  tokens: [
    { text: "今晚", isWord: true },
    { text: "我們", isWord: true },
    { text: "去", isWord: true },
    { text: "夜市", isWord: true },
    { text: "吃", isWord: true },
    { text: "小吃", isWord: true },
    { text: "，", isWord: false },
    { text: "那裡", isWord: true },
    { text: "很", isWord: true },
    { text: "熱鬧", isWord: true },
    { text: "。", isWord: false },
  ],
  glossary: {
    夜市: {
      term: "夜市",
      gloss: "night market",
      reading: "ㄧㄝˋ ㄕˋ / yè shì",
      pos: "noun",
      level: "TOCFL-A2",
      examples: ["今晚我們去夜市吃小吃。"],
      explanation: "晚上才開的市場，可以一邊走一邊吃東西、買東西，通常很熱鬧。",
    },
    小吃: {
      term: "小吃",
      gloss: "snacks; street food",
      reading: "ㄒㄧㄠˇ ㄔ / xiǎo chī",
      pos: "noun",
      level: "TOCFL-A2",
      explanation: "份量小、價格便宜的食物，常常在夜市或路邊賣。",
    },
    熱鬧: {
      term: "熱鬧",
      gloss: "lively; bustling",
      reading: "ㄖㄜˋ ㄋㄠˋ / rè nào",
      pos: "adjective",
      level: "TOCFL-B1",
      examples: ["那裡很熱鬧。"],
      explanation: "人多、聲音多、很有活力的樣子，跟「安靜」相反。",
    },
  },
};

const vi: PreparedContent = {
  schema: "tsumugu/prepared-content@1",
  lang: "vi",
  title: "Phát triển — vi through zh",
  source: "bundled",
  ciTarget: 0.95,
  tokens: [
    { text: "Việt Nam", isWord: true },
    { text: " ", isWord: false },
    { text: "đang", isWord: true },
    { text: " ", isWord: false },
    { text: "phát triển", isWord: true },
    { text: " ", isWord: false },
    { text: "nhanh", isWord: true },
    { text: ".", isWord: false },
  ],
  glossary: {
    "phát triển": {
      term: "phát triển",
      gloss: "to develop; to grow",
      reading: "phát triển",
      pos: "verb",
      explanation:
        "Sino-Vietnamese (Hán-Việt). You already know Chinese 發展: 發 phát = emit, 展 triển = unfold → develop.",
      examples: ["Việt Nam đang phát triển nhanh."],
      bridge: {
        bridgeLang: "zh-Hant",
        etymon: "發展",
        bridgeReading: "fā zhǎn / ㄈㄚ ㄓㄢˇ",
        meaning: "to develop; development",
        confidence: 0.95,
        corrected: false,
        morphemes: [
          { surface: "phát", etymon: "發", reading: "fā", gloss: "emit; set out" },
          { surface: "triển", etymon: "展", reading: "zhǎn", gloss: "unfold; extend" },
        ],
      },
    },
    đang: {
      term: "đang",
      gloss: "(progressive marker) currently …-ing",
      reading: "đang",
      pos: "particle",
      explanation: "Đặt trước động từ để chỉ hành động đang xảy ra (giống 正在).",
    },
  },
};

export interface Sample {
  id: string;
  label: string;
  content: PreparedContent;
}

export const SAMPLES: Sample[] = [
  { id: "en", label: "Demo (English)", content: en },
  { id: "zh", label: "中文 — 夜市 (zh-Hant)", content: zh },
  { id: "vi", label: "Tiếng Việt — phát triển", content: vi },
];
