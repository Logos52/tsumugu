import { describe, it, expect } from "vitest";
import { STATUS_ORDER, STATUS_LEVEL } from "../types.js";
import type { WordStatus } from "../types.js";
import {
  DEFAULT_KNOWN_POLICY,
  isKnown,
  cycleStatus,
  promote,
  demote,
  nextStatusLevel,
} from "./transitions.js";

describe("DEFAULT_KNOWN_POLICY", () => {
  it("treats l4/known/ignored as known", () => {
    expect(DEFAULT_KNOWN_POLICY.knownStatuses).toEqual([
      "l4",
      "known",
      "ignored",
    ]);
  });

  it("is JSON-serializable (round-trips)", () => {
    const round = JSON.parse(
      JSON.stringify(DEFAULT_KNOWN_POLICY),
    ) as typeof DEFAULT_KNOWN_POLICY;
    expect(round).toEqual(DEFAULT_KNOWN_POLICY);
  });
});

describe("isKnown", () => {
  it("uses the default policy when none is given", () => {
    expect(isKnown("new")).toBe(false);
    expect(isKnown("l1")).toBe(false);
    expect(isKnown("l2")).toBe(false);
    expect(isKnown("l3")).toBe(false);
    expect(isKnown("l4")).toBe(true);
    expect(isKnown("known")).toBe(true);
    expect(isKnown("ignored")).toBe(true);
  });

  it("honors a custom policy", () => {
    const strict = { knownStatuses: ["known"] as const };
    expect(isKnown("l4", strict)).toBe(false);
    expect(isKnown("ignored", strict)).toBe(false);
    expect(isKnown("known", strict)).toBe(true);
  });

  it("an empty policy treats nothing as known", () => {
    const none = { knownStatuses: [] };
    for (const s of STATUS_ORDER) expect(isKnown(s, none)).toBe(false);
  });

  it("a custom policy fully overrides the default (no union)", () => {
    // A policy listing only `new` must NOT also treat the default
    // l4/known/ignored as known.
    const onlyNew = { knownStatuses: ["new"] as const };
    expect(isKnown("new", onlyNew)).toBe(true);
    expect(isKnown("l4", onlyNew)).toBe(false);
    expect(isKnown("known", onlyNew)).toBe(false);
    expect(isKnown("ignored", onlyNew)).toBe(false);
  });

  it("does not mutate the default policy or the passed policy", () => {
    const snapshot = [...DEFAULT_KNOWN_POLICY.knownStatuses];
    const custom = { knownStatuses: ["l3", "l4"] as WordStatus[] };
    const customSnapshot = [...custom.knownStatuses];
    isKnown("l3", custom);
    isKnown("new");
    expect([...DEFAULT_KNOWN_POLICY.knownStatuses]).toEqual(snapshot);
    expect(custom.knownStatuses).toEqual(customSnapshot);
  });
});

describe("cycleStatus", () => {
  it("promotes one step along STATUS_ORDER", () => {
    expect(cycleStatus("new", 1)).toBe("l1");
    expect(cycleStatus("l1", 1)).toBe("l2");
    expect(cycleStatus("l2", 1)).toBe("l3");
    expect(cycleStatus("l3", 1)).toBe("l4");
    expect(cycleStatus("l4", 1)).toBe("known");
    expect(cycleStatus("known", 1)).toBe("ignored");
  });

  it("demotes one step along STATUS_ORDER", () => {
    expect(cycleStatus("ignored", -1)).toBe("known");
    expect(cycleStatus("known", -1)).toBe("l4");
    expect(cycleStatus("l4", -1)).toBe("l3");
    expect(cycleStatus("l3", -1)).toBe("l2");
    expect(cycleStatus("l2", -1)).toBe("l1");
    expect(cycleStatus("l1", -1)).toBe("new");
  });

  it("clamps at the ends (does NOT wrap)", () => {
    expect(cycleStatus("new", -1)).toBe("new");
    expect(cycleStatus("ignored", 1)).toBe("ignored");
  });

  it("walking +1 from new traverses the whole order then clamps", () => {
    let s: WordStatus = "new";
    const visited: WordStatus[] = [s];
    for (let i = 0; i < STATUS_ORDER.length + 2; i++) {
      s = cycleStatus(s, 1);
      visited.push(s);
    }
    // First STATUS_ORDER.length distinct values match the canonical order…
    expect(visited.slice(0, STATUS_ORDER.length)).toEqual([...STATUS_ORDER]);
    // …and then it stays pinned at the last entry.
    expect(s).toBe(STATUS_ORDER[STATUS_ORDER.length - 1]);
  });

  it("walking -1 from the last entry returns the reversed order then clamps", () => {
    const last = STATUS_ORDER[STATUS_ORDER.length - 1]!;
    let s: WordStatus = last;
    const visited: WordStatus[] = [s];
    for (let i = 0; i < STATUS_ORDER.length + 2; i++) {
      s = cycleStatus(s, -1);
      visited.push(s);
    }
    expect(visited.slice(0, STATUS_ORDER.length)).toEqual(
      [...STATUS_ORDER].reverse(),
    );
    expect(s).toBe(STATUS_ORDER[0]);
  });

  it("promote then demote is identity in the interior", () => {
    const interior: WordStatus[] = ["l1", "l2", "l3", "l4", "known"];
    for (const s of interior) {
      expect(cycleStatus(cycleStatus(s, 1), -1)).toBe(s);
      expect(cycleStatus(cycleStatus(s, -1), 1)).toBe(s);
    }
  });
});

describe("promote / demote", () => {
  it("are sugar over cycleStatus", () => {
    for (const s of STATUS_ORDER) {
      expect(promote(s)).toBe(cycleStatus(s, 1));
      expect(demote(s)).toBe(cycleStatus(s, -1));
    }
  });

  it("clamp at the boundaries", () => {
    expect(demote("new")).toBe("new");
    expect(promote("ignored")).toBe("ignored");
  });
});

describe("nextStatusLevel", () => {
  it("mirrors STATUS_LEVEL", () => {
    for (const s of STATUS_ORDER) {
      expect(nextStatusLevel(s)).toBe(STATUS_LEVEL[s]);
    }
  });

  it("is 0..4 for the ramp and null for terminal states", () => {
    expect(nextStatusLevel("new")).toBe(0);
    expect(nextStatusLevel("l1")).toBe(1);
    expect(nextStatusLevel("l2")).toBe(2);
    expect(nextStatusLevel("l3")).toBe(3);
    expect(nextStatusLevel("l4")).toBe(4);
    expect(nextStatusLevel("known")).toBeNull();
    expect(nextStatusLevel("ignored")).toBeNull();
  });

  it("returns null (not undefined) for terminal states", () => {
    // Distinguishes "no numeric level" (null, serializable) from a missing
    // key (undefined, which JSON would drop).
    expect(nextStatusLevel("known")).not.toBeUndefined();
    expect(nextStatusLevel("ignored")).not.toBeUndefined();
    expect(nextStatusLevel("known")).toBe(null);
  });

  it("ramp levels survive a JSON round-trip", () => {
    const ramp = ["new", "l1", "l2", "l3", "l4", "known", "ignored"] as const;
    const levels = ramp.map(nextStatusLevel);
    const round = JSON.parse(JSON.stringify(levels)) as (number | null)[];
    expect(round).toEqual(levels);
  });
});
