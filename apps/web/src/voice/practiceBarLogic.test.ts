import { describe, it, expect } from "vitest";
import {
  loopBounds,
  nearestEdge,
  nudgeEdge,
  cycleSpeed,
  SPEED_PRESETS,
  MIN_REGION_SEC,
} from "./practiceBarLogic.js";

describe("loopBounds", () => {
  it("uses the region when present", () => {
    expect(loopBounds({ start: 1, end: 2 }, 10)).toEqual({ start: 1, end: 2 });
  });
  it("falls back to the whole cue when no region", () => {
    expect(loopBounds(null, 7.5)).toEqual({ start: 0, end: 7.5 });
  });
});

describe("nearestEdge", () => {
  const b = { start: 2, end: 6 };
  it("picks the closer edge to the playhead", () => {
    expect(nearestEdge(b, 2.5)).toBe("start");
    expect(nearestEdge(b, 5.5)).toBe("end");
  });
  it("ties go to start", () => {
    expect(nearestEdge(b, 4)).toBe("start");
  });
});

describe("nudgeEdge", () => {
  const b = { start: 2, end: 6 };
  it("moves the start edge and clamps at 0", () => {
    expect(nudgeEdge(b, "start", -0.5, 10)).toEqual({ start: 1.5, end: 6 });
    expect(nudgeEdge(b, "start", -100, 10)).toEqual({ start: 0, end: 6 });
  });
  it("moves the end edge and clamps at duration", () => {
    expect(nudgeEdge(b, "end", 0.5, 10)).toEqual({ start: 2, end: 6.5 });
    expect(nudgeEdge(b, "end", 100, 10)).toEqual({ start: 2, end: 10 });
  });
  it("keeps the start at least MIN_REGION_SEC before the end", () => {
    const r = nudgeEdge(b, "start", 100, 10); // try to shove start past end
    expect(r.start).toBeCloseTo(6 - MIN_REGION_SEC, 5);
    expect(r.end).toBe(6);
  });
  it("keeps the end at least MIN_REGION_SEC after the start", () => {
    const r = nudgeEdge(b, "end", -100, 10);
    expect(r.end).toBeCloseTo(2 + MIN_REGION_SEC, 5);
    expect(r.start).toBe(2);
  });
});

describe("cycleSpeed", () => {
  it("cycles through the presets and wraps", () => {
    expect(cycleSpeed(1)).toBe(0.85);
    expect(cycleSpeed(0.85)).toBe(0.75);
    expect(cycleSpeed(0.75)).toBe(1); // wrap
  });
  it("unknown current → first preset", () => {
    expect(cycleSpeed(1.5)).toBe(SPEED_PRESETS[0]);
  });
});
