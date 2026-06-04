/**
 * Public API for the comprehensible-input coverage scorer (PRD §5.4, §5.9).
 */

// DEFAULT_KNOWN_POLICY is the canonical export of the `status` module; the
// scorer keeps an identical internal copy but does not re-export it here, to
// avoid an ambiguous duplicate in the engine barrel.
export { scoreCI, DEFAULT_CI_TARGET } from "./scorer.js";
export type { CiToken, ScoreCiOptions } from "./scorer.js";
