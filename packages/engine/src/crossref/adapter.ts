/**
 * External-vocab adapter contract (PRD §5.7).
 *
 * Each external source (SRS / Anki) ships an adapter that parses its
 * native export shape into normalized `ExternalVocabRecord[]`. The engine then
 * reconciles those records against the vault word-store.
 *
 * Knownness mapping is deliberately NOT centralized here: every source labels
 * its learning stages differently, so each adapter owns its own status mapping.
 */

import type { ExternalVocabRecord } from "../types.js";

/**
 * Parses one external vocab source's native export into normalized records.
 *
 * The interface is fixed: `parse` takes `unknown` (the raw, untrusted parsed
 * JSON) and returns normalized records. Adapters that need a fallback language
 * carry their own module-level default rather than extending this signature.
 */
export interface ExternalVocabAdapter {
  /** Stable source id, e.g. "srs", "anki". */
  source: string;
  /** Parse untrusted input into normalized records (never throws on shape). */
  parse(input: unknown): ExternalVocabRecord[];
}
