/**
 * Band-ceiling verifier for monolingual zh definitions (PRD §5.3 Stage 4).
 * Distinct from the CI metric — measures defining-vocabulary band, not learner known-words.
 */
import { tokenize, add_word } from "jieba-wasm";
import {
  type DefLevelIndex,
  buildAllowList,
  resolveTokenBand,
  tocflBandFromOrdinal,
  tocflOrdinal,
} from "./defLevelData.js";

const WORD_RE = /[\p{Script=Han}\p{L}\p{N}]/u;

export interface DefLevelViolation {
  /** Offending token. */
  word: string;
  /** Resolved band (`TOCFL-N` or `unrankable`). */
  band: string;
  /** Ceiling the text was checked against. */
  ceiling: string;
  /** Source field within the entry. */
  field: string;
}

export interface CheckDefLevelResult {
  violations: DefLevelViolation[];
  /** Measured max token band present, as `TOCFL-N`. */
  achievedLevel: string;
  /** True when measured band exceeds the requested ceiling. */
  levelEscalated: boolean;
  /** Distinct Han/word tokens that fed the lookup (debug). */
  tokens: string[];
}

export interface CheckDefLevelOptions {
  text: string;
  ceiling: string;
  index: DefLevelIndex;
  field?: string;
  /** Injectable segmenter for tests; defaults to jieba seeded + HMM-off. */
  segmenter?: (text: string, index: DefLevelIndex) => string[];
}

let jiebaSeededFor: DefLevelIndex | undefined;

function seedJieba(index: DefLevelIndex): void {
  if (jiebaSeededFor === index) return;
  const words = index.cedictWords ?? Object.keys(index.tocfl);
  for (const word of words) {
    if (word.length >= 2) add_word(word, index.freq[word] ?? undefined, undefined);
  }
  jiebaSeededFor = index;
}

/** D2 baseline: jieba-wasm with CC-CEDICT/TOCFL seeding, HMM off (PRD §12 Q5). */
export function segmentDefText(text: string, index: DefLevelIndex): string[] {
  if (text === "") return [];
  seedJieba(index);
  const raw = tokenize(text, "default", false);
  return raw.filter((t) => WORD_RE.test(t.word)).map((t) => t.word);
}

/** Greedy longest-match decomposition against the band-N allow-list. */
export function decomposesIntoAllowList(
  token: string,
  allowList: Set<string>,
  maxLen = 12,
): boolean {
  if (allowList.has(token)) return true;
  if (token.length < 2) return false;

  let i = 0;
  while (i < token.length) {
    let matched = 0;
    for (let len = Math.min(maxLen, token.length - i); len >= 1; len--) {
      if (allowList.has(token.slice(i, i + len))) {
        matched = len;
        break;
      }
    }
    if (matched === 0) return false;
    i += matched;
  }
  return true;
}

/**
 * Band-check one zh string: segment → resolve bands → decomposition credit → violations.
 */
export function checkDefLevel(opts: CheckDefLevelOptions): CheckDefLevelResult {
  const { text, ceiling, index, field = "text" } = opts;
  const segment = opts.segmenter ?? segmentDefText;
  const tokens = segment(text, index);
  const allowList = buildAllowList(ceiling, index);
  const ceilingOrd = tocflOrdinal(ceiling);

  const violations: DefLevelViolation[] = [];
  let maxOrd = 0;

  for (const token of tokens) {
    const band = resolveTokenBand(token, index);
    const ord = tocflOrdinal(band);
    if (ord !== 99) maxOrd = Math.max(maxOrd, ord);
    else maxOrd = Math.max(maxOrd, 7);

    const withinCeiling = ord !== 99 && ord <= ceilingOrd;
    const credited =
      !withinCeiling && decomposesIntoAllowList(token, allowList);

    if (!withinCeiling && !credited) {
      violations.push({ word: token, band, ceiling, field });
    }
  }

  const achievedLevel = tocflBandFromOrdinal(maxOrd === 0 ? ceilingOrd : maxOrd);
  const levelEscalated = tocflOrdinal(achievedLevel) > ceilingOrd || violations.length > 0;

  return { violations, achievedLevel, levelEscalated, tokens };
}

/** Reset jieba seed marker (tests). */
export function resetDefLevelSegmenter(): void {
  jiebaSeededFor = undefined;
}