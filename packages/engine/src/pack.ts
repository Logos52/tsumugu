/**
 * Language-pack interface + registry (PRD §6.2, PACK-AUTHORING.md).
 *
 * A pack teaches the engine one language. Packs are NOT part of this public,
 * data-free engine — they live in the user's private folder and reference
 * their own dictionary data. The engine ships only a generic demo pack.
 */

import type {
  Token,
  DictEntry,
  PhoneticLayer,
  Level,
  BridgeInfo,
} from "./types.js";

/** Web Speech API voice hint (resolved to a real voice by the web app). */
export interface TtsVoiceSpec {
  /** BCP-47 lang tag, e.g. "zh-TW", "vi-VN". */
  lang: string;
  /** Preferred SpeechSynthesisVoice.voiceURI, if any. */
  voiceURI?: string;
  rate?: number;
  pitch?: number;
}

/** Optional cross-language bridge provider (e.g. vi → Hán-Việt → Hanzi). */
export interface BridgeProvider {
  /** Bridge language id this provider maps into (e.g. "zh-Hant"). */
  bridgeLang: string;
  lookup(word: string): BridgeInfo | undefined | Promise<BridgeInfo | undefined>;
}

/**
 * A pluggable language pack. All members are language-specific; the engine
 * stays language-agnostic by calling through this interface only.
 */
export interface LanguagePack {
  /** Pack/language id, e.g. "zh-Hant", "vi", "demo". */
  id: string;
  /** Human-facing name. */
  name: string;
  /** Text direction (default "ltr"). */
  direction?: "ltr" | "rtl";

  /** Segment text into ordered tokens (words + punctuation). */
  segmenter(text: string): Token[] | Promise<Token[]>;

  /**
   * Resolve a word to a dictionary entry. Implementations should merge a
   * custom/override layer over the packaged base (custom wins).
   */
  dictionaryProvider(
    word: string,
  ): DictEntry | undefined | Promise<DictEntry | undefined>;

  /** Reading system (Zhuyin/Pinyin; Latin+tones; …). */
  phoneticLayer: PhoneticLayer;

  /** Difficulty/frequency band for a word. */
  levelingModel(word: string): Level | undefined | Promise<Level | undefined>;

  /**
   * Script normalizer. zh-Hant MUST map Simplified→Traditional (OpenCC).
   * Applied to any generated/imported text before display/storage.
   */
  scriptNormalizer?(text: string): string | Promise<string>;

  /** Default Web Speech voice for this language. */
  ttsVoice?: TtsVoiceSpec;

  /** Optional cross-language bridge. */
  bridge?: BridgeProvider;
}

/** Simple in-process registry of language packs. */
export class PackRegistry {
  private readonly packs = new Map<string, LanguagePack>();

  register(pack: LanguagePack): this {
    this.packs.set(pack.id, pack);
    return this;
  }

  get(id: string): LanguagePack | undefined {
    return this.packs.get(id);
  }

  /** Get a pack or throw if missing. */
  require(id: string): LanguagePack {
    const pack = this.packs.get(id);
    if (!pack) throw new Error(`No language pack registered for "${id}"`);
    return pack;
  }

  has(id: string): boolean {
    return this.packs.has(id);
  }

  list(): LanguagePack[] {
    return [...this.packs.values()];
  }

  ids(): string[] {
    return [...this.packs.keys()];
  }
}
