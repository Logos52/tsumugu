/**
 * Pull-based SRS wrapper around ts-fsrs (PRD §5, §7).
 *
 * This module owns the mapping between our persisted, JSON-serializable
 * {@link SrsState} (camelCase + ISO datetime strings) and ts-fsrs's in-memory
 * `Card` (snake_case + `Date`s + numeric enums). It exposes pure, deterministic
 * helpers for initializing, reviewing, and selecting due cards.
 *
 * There is NO scheduler and NO notifications here — selection is pull-based:
 * the host asks {@link getDue} for the cards that are due "now" and decides
 * what to do with them. Time always comes from an injected {@link Clock} so the
 * engine stays deterministic and testable.
 */

import {
  fsrs,
  createEmptyCard,
  generatorParameters,
  Rating,
  type Card,
  type Grade,
  type RecordLogItem,
} from "ts-fsrs";

import type { SrsState, WordEntry } from "../types.js";
import { type Clock, systemClock } from "../ports.js";

/**
 * Single module-level scheduler instance, with fuzz disabled for determinism.
 *
 * Constructing the scheduler does NOT read the clock, so this is safe to run at
 * module load. All clock reads happen later, via the injected {@link Clock}.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

/** A learner-facing review grade. Maps to ts-fsrs `Rating` (sans Manual). */
export type SrsRating = "again" | "hard" | "good" | "easy";

/** Map a {@link SrsRating} to the ts-fsrs `Rating` enum value. */
export function ratingValue(rating: SrsRating): Grade {
  switch (rating) {
    case "again":
      return Rating.Again;
    case "hard":
      return Rating.Hard;
    case "good":
      return Rating.Good;
    case "easy":
      return Rating.Easy;
  }
}

/**
 * Convert a ts-fsrs `Card` (snake_case, `Date`s, numeric `state`) into our
 * persisted {@link SrsState} (camelCase, ISO strings). `last_review` being
 * undefined maps to `lastReview` being absent from the object.
 */
export function cardToState(card: Card): SrsState {
  const state: SrsState = {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  };
  if (card.last_review !== undefined) {
    state.lastReview = card.last_review.toISOString();
  }
  return state;
}

/**
 * Convert a persisted {@link SrsState} back into a ts-fsrs `Card`. `lastReview`
 * being absent maps to `last_review` being undefined.
 */
export function stateToCard(state: SrsState): Card {
  const card: Card = {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
  };
  if (state.lastReview !== undefined) {
    card.last_review = new Date(state.lastReview);
  }
  return card;
}

/** Create a fresh (New) SRS state, due immediately at the clock's "now". */
export function initSrsState(clock: Clock = systemClock): SrsState {
  return cardToState(createEmptyCard(clock.now()));
}

/**
 * Apply a single review to an SRS state and return the updated state. Pure: the
 * input state is not mutated. Time comes from the injected {@link Clock}.
 */
export function reviewSrs(
  state: SrsState,
  rating: SrsRating,
  clock: Clock = systemClock,
): SrsState {
  const card = stateToCard(state);
  const result: RecordLogItem = scheduler.next(
    card,
    clock.now(),
    ratingValue(rating),
  );
  return cardToState(result.card);
}

/** True if the card's due time is at or before the clock's "now". */
export function isDue(state: SrsState, clock: Clock = systemClock): boolean {
  return Date.parse(state.due) <= clock.now().getTime();
}

/**
 * Ensure an entry has an SRS state, initializing it if absent. Returns the same
 * entry (mutated in place when it had no `srs`) for fluent use.
 */
export function ensureSrs(
  entry: WordEntry,
  clock: Clock = systemClock,
): WordEntry {
  if (entry.srs === undefined) {
    entry.srs = initSrsState(clock);
  }
  return entry;
}

/**
 * Select the entries that are currently due: those with an `srs` state whose
 * due time is at or before "now", sorted by due ascending (most overdue first).
 */
export function getDue(
  entries: WordEntry[],
  clock: Clock = systemClock,
): WordEntry[] {
  return entries
    .filter(
      (entry): entry is WordEntry & { srs: SrsState } =>
        entry.srs !== undefined && isDue(entry.srs, clock),
    )
    .sort((a, b) => Date.parse(a.srs.due) - Date.parse(b.srs.due));
}
