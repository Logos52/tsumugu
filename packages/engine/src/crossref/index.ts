/**
 * crossref — external-vocab cross-reference (PRD §5.7).
 *
 * Import + reconcile external vocab sources (SRS/Anki) against the
 * vault word-store. Adapters normalize native exports into ExternalVocabRecord;
 * `reconcile` produces a ReconciliationReport of agreements, conflicts, and
 * words only the external source knows about; `resolveStatusUpdate` is the
 * clock-aware policy for deciding whether an import changes a stored status.
 */

export type { ExternalVocabAdapter } from "./adapter.js";
export {
  srsAdapter,
  mapKnownness,
  DEFAULT_LANG,
} from "./srs.js";
export { reconcile } from "./reconcile.js";
export { resolveStatusUpdate } from "./resolve.js";
export type {
  MonotonicityPolicy,
  StatusUpdateInput,
  StatusDecision,
  StatusDecisionCode,
} from "./resolve.js";
