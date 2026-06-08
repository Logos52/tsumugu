/**
 * Clock-aware status reconciliation (PRD §5.7, two-way sync).
 *
 * The single policy both the reader and the crossref CLI use to decide whether
 * an incoming external status should change a stored one. Replaces the old
 * binary "overwrite or skip" that could silently DEMOTE a word the user graded
 * up. Pure & DOM-free; time is compared as canonical UTC ISO strings
 * (lexicographic compare is valid because every timestamp comes from
 * `Date#toISOString()` — fixed format, `Z` zone — so no `Date` use here).
 */

import type { WordStatus } from "../types.js";

/**
 * How an import is allowed to move known-ness:
 *  - `never-demote` (default): may raise known-ness, never lower it silently.
 *  - `newest-wins`: the strictly-newer side wins in either direction.
 */
export type MonotonicityPolicy = "never-demote" | "newest-wins";

export interface StatusUpdateInput {
  /** Current store status (use `"new"` for an untracked word). */
  current: WordStatus;
  /** When the store status last changed (ISO), if known. */
  currentAt?: string;
  /** Incoming external status. */
  incoming: WordStatus;
  /** When the external source changed it (ISO), if known. */
  incomingAt?: string;
  /** Monotonicity policy; defaults to `never-demote`. */
  policy?: MonotonicityPolicy;
}

/** Machine-readable reason a decision was reached. */
export type StatusDecisionCode =
  | "equal" // incoming === current
  | "newer-wins" // incoming is strictly newer
  | "store-newer" // store is strictly newer
  | "seed-promote" // store never explicitly graded; incoming raises known-ness
  | "never-demote" // a demote was blocked by policy
  | "ambiguous-keep"; // no usable clock and no safe promotion → keep store

export interface StatusDecision {
  /** `set` → write `status`; `keep` → leave the store as-is (`status` = current). */
  action: "set" | "keep";
  status: WordStatus;
  code: StatusDecisionCode;
}

/**
 * Known-ness rank along the learning ladder. `ignored` shares the terminal tier
 * with `known` so neither known↔ignored move is treated as a demote (they are
 * lateral terminal states, decided by recency, not the ladder).
 */
const KNOWN_RANK: Record<WordStatus, number> = {
  new: 0,
  l1: 1,
  l2: 2,
  l3: 3,
  l4: 4,
  known: 5,
  ignored: 5,
};

/** 1 if `a` strictly after `b`, -1 if before, 0 if equal or either is unknown. */
function compareTimes(a: string | undefined, b: string | undefined): number {
  if (!a || !b || a === b) return 0;
  return a > b ? 1 : -1;
}

/**
 * Decide whether an incoming external status should replace the stored one.
 *
 * Order of reasoning:
 *  1. Equal → keep.
 *  2. A demote under `never-demote` is blocked outright (the data-loss guard).
 *  3. With a usable clock on both sides, the strictly-newer side wins.
 *  4. Without one (tie / missing clock), only SEED: take the incoming value
 *     when the stored word was never graded (`current === "new"`) AND the
 *     incoming raises known-ness. An explicit local grade is never overwritten
 *     without timestamp evidence that the external is newer — Tsumugu is
 *     canonical; the external source is a timestamped input.
 */
export function resolveStatusUpdate(input: StatusUpdateInput): StatusDecision {
  const { current, currentAt, incoming, incomingAt } = input;
  const policy = input.policy ?? "never-demote";

  if (incoming === current) {
    return { action: "keep", status: current, code: "equal" };
  }

  const demoting = KNOWN_RANK[incoming] < KNOWN_RANK[current];
  if (demoting && policy === "never-demote") {
    return { action: "keep", status: current, code: "never-demote" };
  }

  const cmp = compareTimes(incomingAt, currentAt);
  if (cmp > 0) return { action: "set", status: incoming, code: "newer-wins" };
  if (cmp < 0) return { action: "keep", status: current, code: "store-newer" };

  // Tie / unknown clock: seed only a never-graded word (`current === "new"`),
  // and only upward. Gating on the status — not on `currentAt === undefined` —
  // keeps an explicit grade that carries no clock (e.g. migrated from the @1
  // schema, which had no status clock) instead of silently promoting it.
  if (current === "new" && KNOWN_RANK[incoming] > KNOWN_RANK[current]) {
    return { action: "set", status: incoming, code: "seed-promote" };
  }
  return { action: "keep", status: current, code: "ambiguous-keep" };
}
