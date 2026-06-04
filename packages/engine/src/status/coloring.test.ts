import { describe, it, expect } from "vitest";
import { STATUS_ORDER } from "../types.js";
import type { WordStatus } from "../types.js";
import {
  statusIntensity,
  statusColorClass,
  STATUS_HOTKEYS,
  hotkeyToStatus,
} from "./coloring.js";

describe("statusIntensity", () => {
  it("fades from new (1.0) through l1..l4 to known/ignored (0)", () => {
    expect(statusIntensity("new")).toBe(1.0);
    expect(statusIntensity("l1")).toBe(0.8);
    expect(statusIntensity("l2")).toBe(0.6);
    expect(statusIntensity("l3")).toBe(0.4);
    expect(statusIntensity("l4")).toBe(0.2);
    expect(statusIntensity("known")).toBe(0);
    expect(statusIntensity("ignored")).toBe(0);
  });

  it("returns a value in [0, 1] for every status", () => {
    for (const status of STATUS_ORDER) {
      const v = statusIntensity(status);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("is monotonically non-increasing along the learning ramp", () => {
    const ramp: WordStatus[] = ["new", "l1", "l2", "l3", "l4", "known"];
    for (let i = 1; i < ramp.length; i++) {
      const prev = ramp[i - 1]!;
      const curr = ramp[i]!;
      expect(statusIntensity(curr)).toBeLessThanOrEqual(statusIntensity(prev));
    }
  });

  it("gives no highlight (0) exactly to the terminal states", () => {
    const zero = STATUS_ORDER.filter((s) => statusIntensity(s) === 0);
    expect(zero).toEqual(["known", "ignored"]);
  });
});

describe("statusColorClass", () => {
  it("produces the documented stable class names", () => {
    expect(statusColorClass("new")).toBe("tsg-status-new");
    expect(statusColorClass("l1")).toBe("tsg-status-l1");
    expect(statusColorClass("l2")).toBe("tsg-status-l2");
    expect(statusColorClass("l3")).toBe("tsg-status-l3");
    expect(statusColorClass("l4")).toBe("tsg-status-l4");
    expect(statusColorClass("known")).toBe("tsg-status-known");
    expect(statusColorClass("ignored")).toBe("tsg-status-ignored");
  });

  it("is prefixed and unique per status", () => {
    const classes = STATUS_ORDER.map(statusColorClass);
    for (const c of classes) expect(c.startsWith("tsg-status-")).toBe(true);
    expect(new Set(classes).size).toBe(STATUS_ORDER.length);
  });
});

describe("STATUS_HOTKEYS / hotkeyToStatus", () => {
  it("maps the documented keys", () => {
    expect(hotkeyToStatus("1")).toBe("l1");
    expect(hotkeyToStatus("2")).toBe("l2");
    expect(hotkeyToStatus("3")).toBe("l3");
    expect(hotkeyToStatus("4")).toBe("l4");
    expect(hotkeyToStatus("k")).toBe("known");
    expect(hotkeyToStatus("K")).toBe("known");
    expect(hotkeyToStatus("x")).toBe("ignored");
    expect(hotkeyToStatus("X")).toBe("ignored");
  });

  it("returns undefined for unmapped keys", () => {
    expect(hotkeyToStatus("0")).toBeUndefined();
    expect(hotkeyToStatus("5")).toBeUndefined();
    expect(hotkeyToStatus("n")).toBeUndefined();
    expect(hotkeyToStatus("")).toBeUndefined();
    expect(hotkeyToStatus(" ")).toBeUndefined();
    expect(hotkeyToStatus("Enter")).toBeUndefined();
  });

  it("has no hotkey for the implicit `new` default", () => {
    expect(Object.values(STATUS_HOTKEYS)).not.toContain("new");
  });

  it("the table and the lookup agree on every entry", () => {
    for (const [key, status] of Object.entries(STATUS_HOTKEYS)) {
      expect(hotkeyToStatus(key)).toBe(status);
    }
  });

  it("is case-sensitive for letters but covers both cases", () => {
    expect(STATUS_HOTKEYS["k"]).toBe("known");
    expect(STATUS_HOTKEYS["K"]).toBe("known");
    expect(STATUS_HOTKEYS["x"]).toBe("ignored");
    expect(STATUS_HOTKEYS["X"]).toBe("ignored");
  });

  it("does not leak inherited Object.prototype keys", () => {
    // A host may pass any string as a key (e.g. KeyboardEvent.key). Inherited
    // members must resolve to undefined, never to a Function/object.
    for (const proto of [
      "toString",
      "constructor",
      "__proto__",
      "hasOwnProperty",
      "valueOf",
      "isPrototypeOf",
      "propertyIsEnumerable",
    ]) {
      expect(hotkeyToStatus(proto)).toBeUndefined();
    }
  });

  it("maps to exactly the four learning levels plus known/ignored", () => {
    const values = new Set(Object.values(STATUS_HOTKEYS));
    expect(values).toEqual(new Set(["l1", "l2", "l3", "l4", "known", "ignored"]));
  });

  it("every mapped value is a member of the WordStatus union", () => {
    const valid = new Set<WordStatus>(STATUS_ORDER);
    for (const v of Object.values(STATUS_HOTKEYS)) {
      expect(valid.has(v)).toBe(true);
    }
  });

  it("is JSON-serializable (round-trips losslessly)", () => {
    const round = JSON.parse(
      JSON.stringify(STATUS_HOTKEYS),
    ) as typeof STATUS_HOTKEYS;
    expect(round).toEqual(STATUS_HOTKEYS);
  });
});
