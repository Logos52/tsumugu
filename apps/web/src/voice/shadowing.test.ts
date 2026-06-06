import { describe, it, expect } from "vitest";
import {
  shadowReducer,
  shadowCue,
  shadowActive,
  SHADOW_IDLE,
  type ShadowState,
} from "./shadowing.js";

const N = 3; // cueCount for these transitions

describe("shadowReducer", () => {
  it("start → playing the chosen cue", () => {
    expect(shadowReducer(SHADOW_IDLE, { type: "start", cue: 0 }, N)).toEqual({ phase: "playing", cue: 0 });
  });

  it("start with an out-of-range cue → idle", () => {
    expect(shadowReducer(SHADOW_IDLE, { type: "start", cue: 9 }, N)).toEqual(SHADOW_IDLE);
    expect(shadowReducer(SHADOW_IDLE, { type: "start", cue: -1 }, N)).toEqual(SHADOW_IDLE);
  });

  it("audioEnded while playing → waiting (highlight stays, user's turn)", () => {
    const s = shadowReducer({ phase: "playing", cue: 1 }, { type: "audioEnded" }, N);
    expect(s).toEqual({ phase: "waiting", cue: 1 });
  });

  it("advance (Space) from waiting → next cue playing", () => {
    const s = shadowReducer({ phase: "waiting", cue: 0 }, { type: "advance" }, N);
    expect(s).toEqual({ phase: "playing", cue: 1 });
  });

  it("advance from playing also skips ahead (user hits Space early)", () => {
    const s = shadowReducer({ phase: "playing", cue: 0 }, { type: "advance" }, N);
    expect(s).toEqual({ phase: "playing", cue: 1 });
  });

  it("advance past the last cue → done", () => {
    expect(shadowReducer({ phase: "waiting", cue: 2 }, { type: "advance" }, N)).toEqual({ phase: "done" });
  });

  it("exit from any phase → idle", () => {
    expect(shadowReducer({ phase: "playing", cue: 1 }, { type: "exit" }, N)).toEqual(SHADOW_IDLE);
    expect(shadowReducer({ phase: "waiting", cue: 2 }, { type: "exit" }, N)).toEqual(SHADOW_IDLE);
    expect(shadowReducer({ phase: "done" }, { type: "exit" }, N)).toEqual(SHADOW_IDLE);
  });

  it("ignores no-op events (audioEnded when waiting/idle, advance when idle/done)", () => {
    const waiting: ShadowState = { phase: "waiting", cue: 1 };
    expect(shadowReducer(waiting, { type: "audioEnded" }, N)).toBe(waiting);
    expect(shadowReducer(SHADOW_IDLE, { type: "audioEnded" }, N)).toBe(SHADOW_IDLE);
    expect(shadowReducer(SHADOW_IDLE, { type: "advance" }, N)).toBe(SHADOW_IDLE);
    expect(shadowReducer({ phase: "done" }, { type: "advance" }, N)).toEqual({ phase: "done" });
  });

  it("runs a full 3-cue loop start→repeat→advance→…→done", () => {
    let s: ShadowState = SHADOW_IDLE;
    s = shadowReducer(s, { type: "start", cue: 0 }, N); // playing 0
    s = shadowReducer(s, { type: "audioEnded" }, N); // waiting 0
    expect(shadowCue(s)).toBe(0);
    s = shadowReducer(s, { type: "advance" }, N); // playing 1
    s = shadowReducer(s, { type: "audioEnded" }, N); // waiting 1
    s = shadowReducer(s, { type: "advance" }, N); // playing 2
    s = shadowReducer(s, { type: "audioEnded" }, N); // waiting 2
    expect(shadowActive(s)).toBe(true);
    s = shadowReducer(s, { type: "advance" }, N); // done
    expect(s).toEqual({ phase: "done" });
  });
});
