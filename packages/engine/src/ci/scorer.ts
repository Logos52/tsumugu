/**
 * Comprehensible-input coverage scorer (PRD §5.4, §5.9).
 *
 * Pure, data-free, DOM-free. Given a token stream and a status lookup, this
 * computes what fraction of the lexical (word) tokens the learner already
 * comprehends, lists the unknown words by frequency, and (optionally) checks
 * whether directed target words recur enough times to stick (the "n+1 with
 * recycling" heuristic — ≥3 occurrences recommended; PRD §5.4).
 */

import type { WordStatus, KnownPolicy, CiReport } from "../types.js";

/** Default CI coverage target (PRD §5.4): 95% of word tokens comprehended. */
export const DEFAULT_CI_TARGET = 0.95;

/**
 * Default known-policy. Identical in value to the status module's default, but
 * defined locally so the CI scorer carries no cross-module dependency.
 *
 * `l4` ("Learned"), `known`, and `ignored` all count as comprehended: l4 is
 * effectively acquired, known is terminal, and ignored words (names, numerals,
 * deliberate skips) impose no comprehension cost.
 */
export const DEFAULT_KNOWN_POLICY: KnownPolicy = {
  knownStatuses: ["l4", "known", "ignored"],
};

/** A single token the scorer considers. Only `isWord` tokens count. */
export interface CiToken {
  text: string;
  isWord: boolean;
}

/** Options for {@link scoreCI}. */
export interface ScoreCiOptions {
  /** Language id, copied through to the report. */
  lang: string;
  /** Ordered token stream (words + punctuation/whitespace). */
  tokens: readonly CiToken[];
  /** Resolve a word's status. Words absent from the store are typically "new". */
  getStatus: (word: string) => WordStatus;
  /** Which statuses count as comprehended. Defaults to {@link DEFAULT_KNOWN_POLICY}. */
  policy?: KnownPolicy;
  /** Coverage target in 0..1. Defaults to {@link DEFAULT_CI_TARGET}. */
  target?: number;
  /** Directed target words to run the recycle check against (≥3× recommended). */
  targetWords?: readonly string[];
}

/**
 * Score comprehensible-input coverage for a token stream.
 *
 * Matching note: unknown-word grouping and the target-recycle check use EXACT
 * surface-form matching (no case folding or normalization). The engine is
 * language-agnostic and many scripts have no case; any folding/normalization
 * is the language pack's job before tokens reach this scorer. Callers wanting
 * case-insensitive behavior should lower-case `tokens[].text`, the status
 * lookup keys, and `targetWords` consistently before calling.
 */
export function scoreCI(opts: ScoreCiOptions): CiReport {
  const {
    lang,
    tokens,
    getStatus,
    policy = DEFAULT_KNOWN_POLICY,
    target = DEFAULT_CI_TARGET,
    targetWords,
  } = opts;

  const knownSet = new Set<WordStatus>(policy.knownStatuses);

  let totalWordTokens = 0;
  let knownWordTokens = 0;
  /** word → occurrence count, for non-known words only. */
  const unknownCounts = new Map<string, number>();

  for (const tok of tokens) {
    if (!tok.isWord) continue;
    totalWordTokens += 1;
    const status = getStatus(tok.text);
    if (knownSet.has(status)) {
      knownWordTokens += 1;
    } else {
      unknownCounts.set(tok.text, (unknownCounts.get(tok.text) ?? 0) + 1);
    }
  }

  const coverage = totalWordTokens === 0 ? 0 : knownWordTokens / totalWordTokens;
  const meetsTarget = coverage >= target;

  // Distinct unknown words, sorted by count desc then word asc (stable, total
  // ordering so output is deterministic).
  const unknownWords = [...unknownCounts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => (b.count - a.count) || compareWord(a.word, b.word));

  const report: CiReport = {
    lang,
    totalWordTokens,
    knownWordTokens,
    coverage,
    target,
    meetsTarget,
    unknownWords,
  };

  if (targetWords && targetWords.length > 0) {
    // Count occurrences of each target word among the WORD tokens (exact match).
    // Distinct target words preserve first-seen order in the input list.
    const wantCounts = new Map<string, number>();
    for (const w of targetWords) {
      if (!wantCounts.has(w)) wantCounts.set(w, 0);
    }
    for (const tok of tokens) {
      if (!tok.isWord) continue;
      if (wantCounts.has(tok.text)) {
        wantCounts.set(tok.text, (wantCounts.get(tok.text) ?? 0) + 1);
      }
    }
    report.targetRecycle = [...wantCounts.entries()].map(([word, count]) => ({
      word,
      count,
      ok: count >= 3,
    }));
  }

  return report;
}

/** Locale-independent, deterministic string comparison (code-unit order). */
function compareWord(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
