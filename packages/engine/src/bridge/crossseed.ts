/**
 * Cross-seeding (PRD §5.6).
 *
 * Cross-seeding lifts target-language coverage using known etyma from the
 * bridge language. Example: a learner who already knows a set of Hanzi (e.g.
 * exported from Migaku) gets Vietnamese Sino-words "for free" when every
 * etymon behind that word is among the Hanzi they already know.
 *
 * Pure, deterministic, data-free. No DOM/network/filesystem.
 */

import type { BridgeInfo } from "../types.js";

/** A target word paired with its (optional) cached bridge info. */
export interface CrossSeedEntry {
  /** Surface form in the target language. */
  word: string;
  /** Bridge resolution for this word, if known. */
  bridge?: BridgeInfo;
}

/** Inputs to `crossSeed`. */
export interface CrossSeedArgs {
  /** Target language id being seeded (e.g. "vi"). */
  targetLang: string;
  /** Candidate target words with their bridge info. */
  entries: CrossSeedEntry[];
  /** Etyma already known in the bridge language (e.g. a set of Hanzi). */
  knownEtyma: Set<string>;
}

/** One successfully cross-seeded target word. */
export interface SeededWord {
  /** The seeded target-language surface form. */
  word: string;
  /**
   * The representative etymon for this word: the full `etymon` string when
   * present, else the concatenation of its morpheme etyma.
   */
  etymon: string;
  /** The matched known etyma (the morpheme etyma, or the single full etymon). */
  via: string[];
}

/** Result of a cross-seed pass. */
export interface CrossSeedResult {
  targetLang: string;
  /** Words that can be seeded as known via the bridge. */
  seeded: SeededWord[];
  /** Surface forms that could not be seeded. */
  unseeded: string[];
  /** Convenience: `seeded.length`. */
  seededCount: number;
  /** Convenience: number of input entries considered. */
  total: number;
}

/**
 * Decide whether a single bridge resolution is "seedable" against `knownEtyma`.
 *
 * Matching rule:
 *  - If the bridge has morphemes, EVERY morpheme's `etymon` must be present in
 *    `knownEtyma` (a Sino-word is only free when all of its component
 *    characters are known). `via` = the list of morpheme etyma, in order.
 *  - Otherwise, if the bridge has a full `etymon` string, that whole etymon
 *    must be present in `knownEtyma`. `via` = `[etymon]`.
 *  - If neither is usable, the word is not seedable.
 *
 * Empty/whitespace-only etyma never count as known.
 */
function evaluate(
  bridge: BridgeInfo | undefined,
): { etymon: string; via: string[] } | null {
  if (!bridge) return null;

  const morphemes = bridge.morphemes;
  if (morphemes && morphemes.length > 0) {
    const via: string[] = [];
    for (const m of morphemes) {
      const etymon = typeof m.etymon === "string" ? m.etymon.trim() : "";
      if (etymon === "") return null;
      via.push(etymon);
    }
    // Prefer the full etymon string for the representative label, but fall back
    // to the morpheme-derived form when it is missing OR blank (`?? ` alone
    // would keep an empty/whitespace `etymon` string, yielding a useless label).
    const full =
      typeof bridge.etymon === "string" ? bridge.etymon.trim() : "";
    return { etymon: full !== "" ? full : via.join(""), via };
  }

  const full = typeof bridge.etymon === "string" ? bridge.etymon.trim() : "";
  if (full === "") return null;
  return { etymon: full, via: [full] };
}

/**
 * Cross-seed a batch of target words against a set of known bridge etyma.
 *
 * A word is "seeded" when it has bridge info whose etyma are fully known:
 * every morpheme etymon (if morphemes are present), else the full etymon.
 */
export function crossSeed(args: CrossSeedArgs): CrossSeedResult {
  const { targetLang, entries, knownEtyma } = args;

  const seeded: SeededWord[] = [];
  const unseeded: string[] = [];

  for (const entry of entries) {
    const evaluated = evaluate(entry.bridge);
    if (evaluated && evaluated.via.every((e) => knownEtyma.has(e))) {
      seeded.push({
        word: entry.word,
        etymon: evaluated.etymon,
        via: evaluated.via,
      });
    } else {
      unseeded.push(entry.word);
    }
  }

  return {
    targetLang,
    seeded,
    unseeded,
    seededCount: seeded.length,
    total: entries.length,
  };
}
