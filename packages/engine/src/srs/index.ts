/**
 * Public API for the pull-based SRS module (PRD §5, §7).
 *
 * A thin, deterministic wrapper around ts-fsrs: state (de)serialization,
 * single-card review, and due-selection. No scheduler, no notifications.
 */

export {
  cardToState,
  stateToCard,
  initSrsState,
  ratingValue,
  reviewSrs,
  isDue,
  ensureSrs,
  getDue,
  REVIEW_STATUSES,
  prepareReviewQueue,
} from "./fsrs.js";

export { encodingCoverageStats } from "./encodingStats.js";

export type { SrsRating, PrepareReviewQueueResult } from "./fsrs.js";
export type { EncodingCoverageStats } from "./encodingStats.js";
