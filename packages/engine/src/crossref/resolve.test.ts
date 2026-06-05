import { describe, it, expect } from "vitest";

import { resolveStatusUpdate } from "./resolve.js";

const OLD = "2020-01-01T00:00:00.000Z";
const NEW = "2025-01-01T00:00:00.000Z";

describe("resolveStatusUpdate", () => {
  it("keeps an equal status", () => {
    const d = resolveStatusUpdate({ current: "l3", incoming: "l3" });
    expect(d).toEqual({ action: "keep", status: "l3", code: "equal" });
  });

  // The bug this whole change exists to kill: a re-import must not demote a
  // word the user graded up.
  it("never-demote blocks a lower incoming status (the demote-on-reimport bug)", () => {
    const d = resolveStatusUpdate({
      current: "known",
      currentAt: NEW,
      incoming: "l3",
      incomingAt: OLD,
    });
    expect(d).toEqual({ action: "keep", status: "known", code: "never-demote" });
  });

  it("never-demote blocks even when the demote is newer", () => {
    const d = resolveStatusUpdate({
      current: "known",
      currentAt: OLD,
      incoming: "l3",
      incomingAt: NEW,
    });
    expect(d.action).toBe("keep");
    expect(d.code).toBe("never-demote");
  });

  it("newest-wins honors a strictly-newer demote (explicit opt-in)", () => {
    const d = resolveStatusUpdate({
      current: "known",
      currentAt: OLD,
      incoming: "l3",
      incomingAt: NEW,
      policy: "newest-wins",
    });
    expect(d).toEqual({ action: "set", status: "l3", code: "newer-wins" });
  });

  it("newest-wins will not demote without a usable clock", () => {
    const d = resolveStatusUpdate({
      current: "known",
      currentAt: OLD, // store has a clock, incoming does not
      incoming: "l3",
      policy: "newest-wins",
    });
    expect(d.action).toBe("keep");
  });

  it("seeds an un-graded word upward on a tie/unknown clock", () => {
    const d = resolveStatusUpdate({ current: "new", incoming: "known" });
    expect(d).toEqual({ action: "set", status: "known", code: "seed-promote" });
  });

  it("keeps an explicit grade that carries no clock (e.g. migrated @1) — no seed-promote", () => {
    // current is a real grade (l4) but has no statusUpdatedAt (the @1 schema had
    // no status clock). Incoming KNOWN with a clock must NOT silently promote it.
    const d = resolveStatusUpdate({ current: "l4", incoming: "known", incomingAt: NEW });
    expect(d).toEqual({ action: "keep", status: "l4", code: "ambiguous-keep" });
  });

  it("does NOT override an explicit local grade without a newer clock", () => {
    const d = resolveStatusUpdate({
      current: "l2",
      currentAt: OLD, // explicit grade → has a clock
      incoming: "known", // a promotion, but no evidence it is newer
    });
    expect(d).toEqual({ action: "keep", status: "l2", code: "ambiguous-keep" });
  });

  it("a strictly-newer promotion wins", () => {
    const d = resolveStatusUpdate({
      current: "l2",
      currentAt: OLD,
      incoming: "known",
      incomingAt: NEW,
    });
    expect(d).toEqual({ action: "set", status: "known", code: "newer-wins" });
  });

  it("a strictly-older promotion loses to the local grade", () => {
    const d = resolveStatusUpdate({
      current: "l2",
      currentAt: NEW,
      incoming: "known",
      incomingAt: OLD,
    });
    expect(d).toEqual({ action: "keep", status: "l2", code: "store-newer" });
  });

  it("treats known↔ignored as lateral (not a demote), decided by recency", () => {
    // ignored shares the terminal tier with known, so this is not blocked as a
    // demote; with no clock and an explicit current value, it is kept.
    const d = resolveStatusUpdate({ current: "known", currentAt: OLD, incoming: "ignored" });
    expect(d.action).toBe("keep");
    expect(d.code).toBe("ambiguous-keep");
    // …but a newer ignored wins.
    const d2 = resolveStatusUpdate({
      current: "known",
      currentAt: OLD,
      incoming: "ignored",
      incomingAt: NEW,
    });
    expect(d2).toEqual({ action: "set", status: "ignored", code: "newer-wins" });
  });
});
