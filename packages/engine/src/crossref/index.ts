/**
 * crossref — external-vocab cross-reference (PRD §5.7).
 *
 * Import + reconcile external vocab sources (Migaku/Pleco/Anki) against the
 * vault word-store. Adapters normalize native exports into ExternalVocabRecord;
 * `reconcile` produces a ReconciliationReport of agreements, conflicts, and
 * words only the external source knows about.
 */

export type { ExternalVocabAdapter } from "./adapter.js";
export {
  migakuAdapter,
  mapKnownness,
  DEFAULT_LANG,
} from "./migaku.js";
export { reconcile } from "./reconcile.js";
