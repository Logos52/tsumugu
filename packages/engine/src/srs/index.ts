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
} from "./fsrs.js";

export type { SrsRating } from "./fsrs.js";
