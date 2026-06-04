import { describe, it, expect } from "vitest";
import { createEmptyCard, Rating, State } from "ts-fsrs";

import type { Clock } from "../ports.js";
import type { SrsState, WordEntry } from "../types.js";
import {
  cardToState,
  stateToCard,
  initSrsState,
  ratingValue,
  reviewSrs,
  isDue,
  ensureSrs,
  getDue,
  type SrsRating,
} from "./index.js";

/** A fixed clock pinned to a given ISO instant. */
function fixedClock(iso: string): Clock {
  const at = new Date(iso);
  return { now: () => new Date(at.getTime()) };
}

const T0 = "2026-06-04T12:00:00.000Z";

function makeEntry(word: string, srs?: SrsState): WordEntry {
  const entry: WordEntry = { lang: "demo", word, status: "new" };
  if (srs !== undefined) entry.srs = srs;
  return entry;
}

describe("ratingValue", () => {
  it("maps each SrsRating to the ts-fsrs Rating enum", () => {
    expect(ratingValue("again")).toBe(Rating.Again);
    expect(ratingValue("hard")).toBe(Rating.Hard);
    expect(ratingValue("good")).toBe(Rating.Good);
    expect(ratingValue("easy")).toBe(Rating.Easy);
  });

  it("never produces Manual (0)", () => {
    const ratings: SrsRating[] = ["again", "hard", "good", "easy"];
    for (const r of ratings) {
      expect(ratingValue(r)).not.toBe(Rating.Manual);
    }
  });
});

describe("cardToState / stateToCard", () => {
  it("converts a fresh card to camelCase + ISO state", () => {
    const card = createEmptyCard(new Date(T0));
    const state = cardToState(card);

    expect(state.due).toBe(card.due.toISOString());
    expect(state.stability).toBe(card.stability);
    expect(state.difficulty).toBe(card.difficulty);
    expect(state.elapsedDays).toBe(card.elapsed_days);
    expect(state.scheduledDays).toBe(card.scheduled_days);
    expect(state.reps).toBe(card.reps);
    expect(state.lapses).toBe(card.lapses);
    expect(state.state).toBe(card.state);
    // A fresh card has no prior review.
    expect(state.lastReview).toBeUndefined();
    expect("lastReview" in state).toBe(false);
  });

  it("omits lastReview when last_review is undefined", () => {
    const card = createEmptyCard(new Date(T0));
    expect(card.last_review).toBeUndefined();
    const state = cardToState(card);
    expect(Object.prototype.hasOwnProperty.call(state, "lastReview")).toBe(
      false,
    );
  });

  it("includes lastReview when last_review is set", () => {
    const card = createEmptyCard(new Date(T0));
    card.last_review = new Date(T0);
    const state = cardToState(card);
    expect(state.lastReview).toBe(new Date(T0).toISOString());
  });

  it("round-trips card -> state -> card (no last_review)", () => {
    const card = createEmptyCard(new Date(T0));
    const back = stateToCard(cardToState(card));

    expect(back.due.getTime()).toBe(card.due.getTime());
    expect(back.stability).toBe(card.stability);
    expect(back.difficulty).toBe(card.difficulty);
    expect(back.elapsed_days).toBe(card.elapsed_days);
    expect(back.scheduled_days).toBe(card.scheduled_days);
    expect(back.reps).toBe(card.reps);
    expect(back.lapses).toBe(card.lapses);
    expect(back.state).toBe(card.state);
    expect(back.last_review).toBeUndefined();
  });

  it("round-trips a reviewed card -> state -> card (with last_review)", () => {
    const reviewed = reviewSrs(initSrsState(fixedClock(T0)), "good", fixedClock(T0));
    expect(reviewed.lastReview).toBeDefined();

    const card = stateToCard(reviewed);
    expect(card.last_review).toBeInstanceOf(Date);
    const back = cardToState(card);
    expect(back).toEqual(reviewed);
  });

  it("survives a JSON serialization round-trip", () => {
    const state = reviewSrs(initSrsState(fixedClock(T0)), "hard", fixedClock(T0));
    const roundTripped: SrsState = JSON.parse(JSON.stringify(state));
    expect(roundTripped).toEqual(state);
    // And re-hydrates into a usable card.
    const card = stateToCard(roundTripped);
    expect(card.due).toBeInstanceOf(Date);
    expect(Number.isNaN(card.due.getTime())).toBe(false);
  });

  it("preserves a non-New numeric state and present lastReview (hand-built SrsState)", () => {
    // A realistic mid-lifecycle persisted card (Review state, prior review),
    // with float stability/difficulty and sub-second precision on timestamps.
    const persisted: SrsState = {
      due: "2026-07-15T08:30:15.123Z",
      stability: 12.3456,
      difficulty: 6.789,
      elapsedDays: 11,
      scheduledDays: 41,
      reps: 4,
      lapses: 1,
      state: State.Review,
      lastReview: "2026-06-04T12:00:00.500Z",
    };
    const card = stateToCard(persisted);
    // snake_case + Date mapping is exact.
    expect(card.state).toBe(2);
    expect(card.stability).toBe(12.3456);
    expect(card.difficulty).toBe(6.789);
    expect(card.elapsed_days).toBe(11);
    expect(card.scheduled_days).toBe(41);
    expect(card.reps).toBe(4);
    expect(card.lapses).toBe(1);
    expect(card.due).toBeInstanceOf(Date);
    expect(card.due.toISOString()).toBe("2026-07-15T08:30:15.123Z");
    expect(card.last_review?.toISOString()).toBe("2026-06-04T12:00:00.500Z");
    // And it round-trips losslessly back to the original state.
    expect(cardToState(card)).toEqual(persisted);
  });

  it("preserves a non-zero state enum value through cardToState", () => {
    const card = createEmptyCard(new Date(T0));
    card.state = State.Relearning;
    expect(cardToState(card).state).toBe(3);
  });

  it("emits exactly the SrsState contract keys (no ts-fsrs field leakage)", () => {
    const fresh = cardToState(createEmptyCard(new Date(T0)));
    expect(Object.keys(fresh).sort()).toEqual(
      [
        "difficulty",
        "due",
        "elapsedDays",
        "lapses",
        "reps",
        "scheduledDays",
        "stability",
        "state",
      ].sort(),
    );
    const reviewed = reviewSrs(initSrsState(fixedClock(T0)), "good", fixedClock(T0));
    expect(Object.keys(reviewed).sort()).toEqual(
      [
        "difficulty",
        "due",
        "elapsedDays",
        "lapses",
        "lastReview",
        "reps",
        "scheduledDays",
        "stability",
        "state",
      ].sort(),
    );
    // All persisted values are JSON-primitive (string | number).
    for (const v of Object.values(reviewed)) {
      expect(["string", "number"]).toContain(typeof v);
    }
  });
});

describe("review of a hydrated (persisted) non-New card", () => {
  it("advances a persisted Review card on a lapse, deterministically", () => {
    // The real vault flow: load a persisted Review-state SrsState, then review.
    const persisted: SrsState = {
      due: "2026-06-20T12:00:00.000Z",
      stability: 5,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 5,
      reps: 1,
      lapses: 0,
      state: State.Review,
      lastReview: "2026-06-04T12:00:00.000Z",
    };
    const clock = fixedClock("2026-06-20T12:00:00.000Z");
    const a = reviewSrs(persisted, "again", clock);
    const b = reviewSrs(persisted, "again", clock);
    expect(a).toEqual(b); // deterministic (fuzz off)
    // An "again" on a Review card lapses into Relearning and increments lapses.
    expect(a.lapses).toBe(persisted.lapses + 1);
    expect(a.reps).toBe(persisted.reps + 1);
    expect(a.state).toBe(State.Relearning);
    expect(a.lastReview).toBe(new Date("2026-06-20T12:00:00.000Z").toISOString());
    // Input is untouched.
    expect(persisted.lapses).toBe(0);
    expect(persisted.state).toBe(State.Review);
  });

  it("returns a distinct object reference from the input", () => {
    const init = initSrsState(fixedClock(T0));
    const out = reviewSrs(init, "good", fixedClock(T0));
    expect(out).not.toBe(init);
  });
});

describe("initSrsState", () => {
  it("creates a New card due at the clock's now", () => {
    const state = initSrsState(fixedClock(T0));
    expect(state.state).toBe(State.New);
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(0);
    expect(state.due).toBe(new Date(T0).toISOString());
    expect(state.lastReview).toBeUndefined();
  });

  it("is deterministic for a fixed clock", () => {
    expect(initSrsState(fixedClock(T0))).toEqual(initSrsState(fixedClock(T0)));
  });
});

describe("reviewSrs", () => {
  it("does not mutate the input state", () => {
    const before = initSrsState(fixedClock(T0));
    const snapshot = JSON.parse(JSON.stringify(before));
    reviewSrs(before, "good", fixedClock(T0));
    expect(before).toEqual(snapshot);
  });

  it("moves due forward and records reps + lastReview on 'good'", () => {
    const init = initSrsState(fixedClock(T0));
    const reviewed = reviewSrs(init, "good", fixedClock(T0));

    expect(Date.parse(reviewed.due)).toBeGreaterThan(Date.parse(init.due));
    expect(reviewed.reps).toBe(init.reps + 1);
    expect(reviewed.lastReview).toBe(new Date(T0).toISOString());
    expect(reviewed.state).not.toBe(State.New);
  });

  it("is deterministic (fuzz disabled) for a fixed clock", () => {
    const init = initSrsState(fixedClock(T0));
    const a = reviewSrs(init, "good", fixedClock(T0));
    const b = reviewSrs(init, "good", fixedClock(T0));
    expect(a).toEqual(b);
  });

  it("schedules 'easy' farther out than 'again'", () => {
    const init = initSrsState(fixedClock(T0));
    const again = reviewSrs(init, "again", fixedClock(T0));
    const easy = reviewSrs(init, "easy", fixedClock(T0));
    expect(Date.parse(easy.due)).toBeGreaterThan(Date.parse(again.due));
  });

  it("supports a sequence of reviews", () => {
    const clock1 = fixedClock(T0);
    let state = initSrsState(clock1);
    state = reviewSrs(state, "good", clock1);
    // Review again ten days later.
    const clock2 = fixedClock("2026-06-14T12:00:00.000Z");
    const next = reviewSrs(state, "good", clock2);
    expect(next.reps).toBe(2);
    expect(Date.parse(next.due)).toBeGreaterThan(Date.parse(state.due));
  });
});

describe("isDue", () => {
  it("a freshly initialized card is due now", () => {
    const state = initSrsState(fixedClock(T0));
    expect(isDue(state, fixedClock(T0))).toBe(true);
  });

  it("is due when now equals the due instant exactly (boundary)", () => {
    const state = initSrsState(fixedClock(T0));
    expect(isDue(state, fixedClock(state.due))).toBe(true);
  });

  it("a reviewed card is not due immediately after review", () => {
    const clock = fixedClock(T0);
    const reviewed = reviewSrs(initSrsState(clock), "good", clock);
    expect(isDue(reviewed, clock)).toBe(false);
  });

  it("becomes due again once the clock passes its due time", () => {
    const reviewed = reviewSrs(initSrsState(fixedClock(T0)), "good", fixedClock(T0));
    const after = new Date(Date.parse(reviewed.due) + 1000).toISOString();
    expect(isDue(reviewed, fixedClock(after))).toBe(true);
  });
});

describe("ensureSrs", () => {
  it("adds an SRS state when absent and returns the same entry", () => {
    const entry = makeEntry("你好");
    const out = ensureSrs(entry, fixedClock(T0));
    expect(out).toBe(entry);
    expect(out.srs).toBeDefined();
    expect(out.srs?.due).toBe(new Date(T0).toISOString());
  });

  it("leaves an existing SRS state untouched", () => {
    const existing = reviewSrs(initSrsState(fixedClock(T0)), "good", fixedClock(T0));
    const entry = makeEntry("世界", existing);
    const out = ensureSrs(entry, fixedClock("2027-01-01T00:00:00.000Z"));
    expect(out.srs).toBe(existing);
  });
});

describe("getDue", () => {
  it("returns only entries with an srs state that are due, sorted by due asc", () => {
    const clockNow = fixedClock("2026-07-01T00:00:00.000Z");

    // Due in the past (overdue).
    const overdue = makeEntry("a", {
      ...initSrsState(fixedClock(T0)),
      due: "2026-06-01T00:00:00.000Z",
    });
    // Due even earlier — should sort first.
    const mostOverdue = makeEntry("b", {
      ...initSrsState(fixedClock(T0)),
      due: "2026-05-01T00:00:00.000Z",
    });
    // Due in the future — excluded.
    const future = makeEntry("c", {
      ...initSrsState(fixedClock(T0)),
      due: "2026-08-01T00:00:00.000Z",
    });
    // No srs at all — excluded.
    const untracked = makeEntry("d");

    const due = getDue([overdue, future, untracked, mostOverdue], clockNow);
    expect(due.map((e) => e.word)).toEqual(["b", "a"]);
  });

  it("returns an empty array when nothing is due", () => {
    const future = makeEntry("x", {
      ...initSrsState(fixedClock(T0)),
      due: "2099-01-01T00:00:00.000Z",
    });
    expect(getDue([future], fixedClock(T0))).toEqual([]);
  });

  it("includes freshly ensured (New) entries as due now", () => {
    const e1 = ensureSrs(makeEntry("p"), fixedClock(T0));
    const e2 = ensureSrs(makeEntry("q"), fixedClock(T0));
    const due = getDue([e1, e2], fixedClock(T0));
    expect(due).toHaveLength(2);
  });

  it("does not mutate the input array order", () => {
    const a = makeEntry("a", {
      ...initSrsState(fixedClock(T0)),
      due: "2026-06-02T00:00:00.000Z",
    });
    const b = makeEntry("b", {
      ...initSrsState(fixedClock(T0)),
      due: "2026-06-01T00:00:00.000Z",
    });
    const input = [a, b];
    getDue(input, fixedClock("2026-07-01T00:00:00.000Z"));
    expect(input).toEqual([a, b]);
  });

  it("includes an entry due exactly at now (boundary parity with isDue)", () => {
    const at = "2026-06-10T00:00:00.000Z";
    const entry = makeEntry("boundary", {
      ...initSrsState(fixedClock(T0)),
      due: at,
    });
    const due = getDue([entry], fixedClock(at));
    expect(due).toHaveLength(1);
    expect(due[0]).toBe(entry);
  });

  it("excludes an entry due one millisecond in the future", () => {
    const now = "2026-06-10T00:00:00.000Z";
    const entry = makeEntry("soon", {
      ...initSrsState(fixedClock(T0)),
      due: "2026-06-10T00:00:00.001Z",
    });
    expect(getDue([entry], fixedClock(now))).toEqual([]);
  });

  it("returns the original entry references (no copies)", () => {
    const a = makeEntry("a", {
      ...initSrsState(fixedClock(T0)),
      due: "2026-06-01T00:00:00.000Z",
    });
    const due = getDue([a], fixedClock("2026-07-01T00:00:00.000Z"));
    expect(due[0]).toBe(a);
  });

  it("returns a new array, not the input array", () => {
    const input: WordEntry[] = [];
    expect(getDue(input, fixedClock(T0))).not.toBe(input);
  });
});
