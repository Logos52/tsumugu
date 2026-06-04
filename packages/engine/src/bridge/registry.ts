/**
 * Cross-language bridge registry (PRD §5.6).
 *
 * The `BridgeRegistry` is the "cached + correctable private bridge dictionary":
 * an in-memory cache keyed by (lang, word) → BridgeInfo, serializable to/from a
 * stable JSON document for storage in the vault. The bridge data itself is
 * supplied by a pack's `BridgeProvider` (pack.ts); this registry only caches,
 * corrects, and persists those resolutions.
 *
 * DOM-free, data-free, deterministic. No filesystem/network — persistence is
 * the caller's job via the VaultIO port.
 */

import type { BridgeInfo } from "../types.js";

/** Schema tag for the persisted bridge document. */
export const BRIDGE_SCHEMA = "tsumugu/bridge@1" as const;

/** One persisted bridge cache row. */
export interface BridgeEntry {
  /** Target language id of the bridged word (e.g. "vi"). */
  lang: string;
  /** Surface form in the target language (e.g. "phát triển"). */
  word: string;
  /** Resolved bridge info (etymon, morphemes, reading, …). */
  info: BridgeInfo;
}

/** The on-disk shape of a serialized BridgeRegistry. */
export interface BridgeDoc {
  schema: typeof BRIDGE_SCHEMA;
  entries: BridgeEntry[];
}

/** Build the composite cache key for a (lang, word) pair. */
function keyOf(lang: string, word: string): string {
  // U+0000 (NUL) is the field separator: it cannot appear in a lang id or a
  // real surface form, so the composite key is collision-free even when
  // `word` contains spaces (e.g. Vietnamese "phát triển"). A space
  // separator would NOT be safe — multi-word surface forms are common.
  return `${lang}\u0000${word}`;
}

/**
 * A cached, correctable bridge dictionary keyed by (lang, word).
 *
 * Insertion order is preserved so that `toJSON()` / `all()` are deterministic.
 */
export class BridgeRegistry {
  private readonly map = new Map<string, BridgeEntry>();

  /** Cache (or overwrite) the bridge info for a (lang, word). */
  set(lang: string, word: string, info: BridgeInfo): this {
    this.map.set(keyOf(lang, word), { lang, word, info });
    return this;
  }

  /** Look up cached bridge info, or `undefined` if not present. */
  get(lang: string, word: string): BridgeInfo | undefined {
    return this.map.get(keyOf(lang, word))?.info;
  }

  /** Whether a (lang, word) is cached. */
  has(lang: string, word: string): boolean {
    return this.map.has(keyOf(lang, word));
  }

  /**
   * All cached entries, optionally filtered to a single target language.
   * Returns a fresh array in insertion order; entries are shallow copies so the
   * internal map cannot be mutated through the result.
   */
  all(lang?: string): BridgeEntry[] {
    const out: BridgeEntry[] = [];
    for (const entry of this.map.values()) {
      if (lang === undefined || entry.lang === lang) {
        out.push({ lang: entry.lang, word: entry.word, info: entry.info });
      }
    }
    return out;
  }

  /** Number of cached entries (optionally for one language). */
  size(lang?: string): number {
    if (lang === undefined) return this.map.size;
    let n = 0;
    for (const entry of this.map.values()) {
      if (entry.lang === lang) n++;
    }
    return n;
  }

  /**
   * Mark a (lang, word) as human-corrected.
   *
   * If `info` is supplied it replaces the cached info (with `corrected: true`
   * forced on). Otherwise the existing entry is flipped to `corrected: true`.
   * Returns `true` if an entry existed (or was created via `info`), else `false`.
   */
  markCorrected(lang: string, word: string, info?: BridgeInfo): boolean {
    const k = keyOf(lang, word);
    if (info !== undefined) {
      this.map.set(k, { lang, word, info: { ...info, corrected: true } });
      return true;
    }
    const existing = this.map.get(k);
    if (!existing) return false;
    this.map.set(k, {
      lang,
      word,
      info: { ...existing.info, corrected: true },
    });
    return true;
  }

  /** Remove a cached entry. Returns `true` if one was removed. */
  delete(lang: string, word: string): boolean {
    return this.map.delete(keyOf(lang, word));
  }

  /** Drop all cached entries. */
  clear(): void {
    this.map.clear();
  }

  /** Plain-object snapshot in the persisted `BridgeDoc` shape. */
  toDoc(): BridgeDoc {
    return { schema: BRIDGE_SCHEMA, entries: this.all() };
  }

  /** Serialize to a JSON string (stable, insertion-ordered). */
  toJSON(): string {
    return JSON.stringify(this.toDoc());
  }

  /** Build a registry from a parsed `BridgeDoc`. */
  static fromDoc(doc: BridgeDoc): BridgeRegistry {
    const reg = new BridgeRegistry();
    if (doc.schema !== BRIDGE_SCHEMA) {
      throw new Error(
        `Unexpected bridge schema "${String(doc.schema)}", expected "${BRIDGE_SCHEMA}"`,
      );
    }
    const entries = Array.isArray(doc.entries) ? doc.entries : [];
    for (const entry of entries) {
      if (
        entry &&
        typeof entry.lang === "string" &&
        typeof entry.word === "string" &&
        entry.info &&
        typeof entry.info === "object"
      ) {
        reg.set(entry.lang, entry.word, entry.info);
      }
    }
    return reg;
  }

  /** Parse a JSON string produced by `toJSON()` (or a compatible doc). */
  static fromJSON(text: string): BridgeRegistry {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid bridge JSON: expected an object");
    }
    return BridgeRegistry.fromDoc(parsed as BridgeDoc);
  }
}
