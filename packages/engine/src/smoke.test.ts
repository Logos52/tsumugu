import { describe, it, expect } from "vitest";
import { STATUS_ORDER, STATUS_LEVEL, PackRegistry } from "./index.js";

describe("engine skeleton", () => {
  it("exposes the status model", () => {
    expect(STATUS_ORDER).toContain("known");
    expect(STATUS_LEVEL.l3).toBe(3);
    expect(STATUS_LEVEL.known).toBeNull();
  });

  it("registers packs", () => {
    const reg = new PackRegistry();
    expect(reg.has("demo")).toBe(false);
  });
});
