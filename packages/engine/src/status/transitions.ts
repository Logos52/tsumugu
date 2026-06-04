/**
 * Word-status transition helpers (PRD §5.2, §5.8).
 *
 * Pure functions over the canonical `STATUS_ORDER` from `types.ts`:
 * known-ness policy checks, ordered cycling, promote/demote, and numeric
 * level lookup. No DOM, no IO, no language-specific data.
 */

import type { KnownPolicy, WordStatus } from "../types.js";
import { STATUS_ORDER, STATUS_LEVEL } from "../types.js";

/**
 * Default "comprehended" set for CI/progress math (PRD §5.4, §5.9): a word is
 * treated as known once it reaches `l4`, or is explicitly `known`/`ignored`.
 */
export const DEFAULT_KNOWN_POLICY: KnownPolicy = {
  knownStatuses: ["l4", "known", "ignored"],
};

/**
 * Whether a status counts as "known" under a policy.
 *
 * Defaults to {@link DEFAULT_KNOWN_POLICY} (`l4`/`known`/`ignored`).
 */
export function isKnown(
  status: WordStatus,
  policy: KnownPolicy = DEFAULT_KNOWN_POLICY,
): boolean {
  return policy.knownStatuses.includes(status);
}

/**
 * Move a status one step along `STATUS_ORDER`.
 *
 * `dir = 1` promotes toward "more known", `dir = -1` demotes toward "newer".
 *
 * Behaviour at the ends is CLAMPED (not wrapping): stepping past the first or
 * last entry returns the boundary status unchanged. This keeps a single
 * keypress from ever jumping from `ignored` back to `new` (or vice versa).
 *
 * Note: `STATUS_ORDER` places `known` before `ignored`, so promoting `known`
 * yields `ignored`, and demoting `ignored` yields `known`. The terminal
 * states are still reachable in both directions via repeated steps.
 */
export function cycleStatus(status: WordStatus, dir: 1 | -1): WordStatus {
  const i = STATUS_ORDER.indexOf(status);
  // Defensive: an unknown status (should be impossible for a valid union
  // value) is treated as a no-op rather than throwing.
  if (i === -1) return status;
  const next = i + dir;
  if (next < 0 || next >= STATUS_ORDER.length) return status;
  // Indexed access is `T | undefined` under noUncheckedIndexedAccess; the
  // bounds check above guarantees it is defined, but guard for the compiler.
  return STATUS_ORDER[next] ?? status;
}

/** Step one status "up" toward known (clamped at the last entry). */
export function promote(status: WordStatus): WordStatus {
  return cycleStatus(status, 1);
}

/** Step one status "down" toward new (clamped at the first entry). */
export function demote(status: WordStatus): WordStatus {
  return cycleStatus(status, -1);
}

/**
 * Numeric learning level for a status: 0..4 for `new`/`l1..l4`, or `null`
 * for the terminal `known`/`ignored` states. Thin pass-through of
 * `STATUS_LEVEL` from `types.ts`.
 */
export function nextStatusLevel(status: WordStatus): number | null {
  return STATUS_LEVEL[status];
}
