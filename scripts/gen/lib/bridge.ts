/**
 * Hán-Việt bridge harness (PRD §5.6). The agent generates bridge entries from
 * prompts/bridge.md; this caches them into the BridgeRegistry JSON and runs
 * cross-seeding against the user's known Hanzi (from their store) to report how
 * much Vietnamese coverage their Chinese unlocks.
 */
import {
  BridgeRegistry,
  crossSeed,
  type WordStore,
  type WordStatus,
  type BridgeInfo,
  type CrossSeedResult,
} from "@tsumugu/engine";

const KNOWN: WordStatus[] = ["l4", "known"];

/** Decompose the user's known words in the bridge language into known Hanzi. */
export function knownHanziFromStore(store: WordStore, bridgeLang: string): Set<string> {
  const out = new Set<string>();
  for (const e of store.all(bridgeLang)) {
    if (KNOWN.includes(e.status)) for (const ch of e.word) out.add(ch);
  }
  return out;
}

export interface BridgeRecord {
  word: string;
  info: BridgeInfo;
}

export interface CacheResult {
  added: number;
  updated: number;
  crossSeed: CrossSeedResult;
}

/** Merge agent-produced bridge records into the registry + report cross-seeding. */
export function cacheBridges(
  registry: BridgeRegistry,
  targetLang: string,
  records: BridgeRecord[],
  knownEtyma: Set<string>,
): CacheResult {
  let added = 0;
  let updated = 0;
  for (const r of records) {
    if (registry.has(targetLang, r.word)) updated++;
    else added++;
    registry.set(targetLang, r.word, r.info);
  }
  return { added, updated, crossSeed: crossSeedFromRegistry(registry, targetLang, knownEtyma) };
}

/** Run cross-seeding over everything cached for a target language. */
export function crossSeedFromRegistry(
  registry: BridgeRegistry,
  targetLang: string,
  knownEtyma: Set<string>,
): CrossSeedResult {
  const entries = registry
    .all(targetLang)
    .map((e) => ({ word: e.word, bridge: e.info }));
  return crossSeed({ targetLang, entries, knownEtyma });
}

/** Skeleton BridgeInfo for a word the agent still needs to resolve. */
export function bridgeSkeleton(bridgeLang: string): BridgeInfo {
  return { bridgeLang, confidence: 0, corrected: false };
}
