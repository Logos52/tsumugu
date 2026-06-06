// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

import type { PreparedToken } from "@tsumugu/engine";
import { mountTranscriptSync } from "./transcript.js";
import { CLS } from "../ui/classes.js";
import type { TranscriptDoc } from "./sync.js";
import type { VoicePlayer } from "../voice/player.js";

/** 8 tokens, two cues: c0 → [0,4) at 0–3s, c1 → [4,8) at 3–6s. */
const tokens: PreparedToken[] = [
  { text: "今晚", isWord: true },
  { text: "我們", isWord: true },
  { text: "去", isWord: true },
  { text: "，", isWord: false },
  { text: "那裡", isWord: true },
  { text: "很", isWord: true },
  { text: "熱鬧", isWord: true },
  { text: "。", isWord: false },
];
const transcript: TranscriptDoc = {
  cues: [
    { text: "今晚我們去，", start: "00:00:00,000", end: "00:00:03,000" },
    { text: "那裡很熱鬧。", start: "00:00:03,000", end: "00:00:06,000" },
  ],
};

type Call = [string, ...unknown[]];

/** A VoicePlayer stub that records calls (no real audio). */
function fakePlayer(calls: Call[]): VoicePlayer {
  return {
    playCue: (i, opts) => calls.push(["playCue", i, opts]),
    playFrom: (i, opts) => calls.push(["playFrom", i, opts]),
    stop: () => calls.push(["stop"]),
    destroy: () => calls.push(["destroy"]),
  };
}

function mount(opts: {
  player?: VoicePlayer | null;
  voiceSlow?: boolean;
  onSlowToggle?: (slow: boolean) => void;
}) {
  const host = document.createElement("div");
  const tokenEls = tokens.map(() => document.createElement("span"));
  const ctl = mountTranscriptSync({
    host,
    tokens,
    transcript,
    tokenEls,
    player: opts.player ?? null,
    ...(opts.voiceSlow !== undefined ? { voiceSlow: opts.voiceSlow } : {}),
    ...(opts.onSlowToggle ? { onSlowToggle: opts.onSlowToggle } : {}),
  });
  return { host, tokenEls, ctl };
}

/** Find a transport button by its exact label text. */
function btn(host: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>(`.${CLS.transport} .${CLS.btn}`)].find(
    (b) => b.textContent === text,
  );
}

describe("transcript voice transport + shadowing wiring", () => {
  it("shows no voice buttons when there is no player", () => {
    const { host, ctl } = mount({ player: null });
    expect(btn(host, "🔊")).toBeUndefined();
    expect(btn(host, "跟讀")).toBeUndefined();
    // The base play button is still there.
    expect(btn(host, "▶")).toBeDefined();
    // Voice methods are safe no-ops without a player.
    expect(() => ctl.playCurrentCueVoice()).not.toThrow();
    expect(ctl.isShadowing()).toBe(false);
    ctl.destroy();
  });

  it("renders the voice transport when a player is present", () => {
    const { host, ctl } = mount({ player: fakePlayer([]) });
    for (const label of ["🔊", "⏩", "⏹", "🐢", "跟讀"]) {
      expect(btn(host, label), label).toBeDefined();
    }
    ctl.destroy();
  });

  it("play / play-from / stop buttons drive the player at the current cue", () => {
    const calls: Call[] = [];
    const { host, ctl } = mount({ player: fakePlayer(calls) });
    btn(host, "🔊")!.click();
    btn(host, "⏩")!.click();
    btn(host, "⏹")!.click();
    expect(calls[0]).toEqual(["playCue", 0, { slow: false }]);
    expect(calls[1]![0]).toBe("playFrom");
    expect(calls[1]![1]).toBe(0);
    expect(calls.some((c) => c[0] === "stop")).toBe(true);
    ctl.destroy();
  });

  it("the slow toggle flips state, persists via onSlowToggle, and is applied to playback", () => {
    const calls: Call[] = [];
    const persisted: boolean[] = [];
    const { host, ctl } = mount({
      player: fakePlayer(calls),
      voiceSlow: false,
      onSlowToggle: (s) => persisted.push(s),
    });
    const slowBtn = btn(host, "🐢")!;
    expect(slowBtn.classList.contains(CLS.btnActive)).toBe(false);
    slowBtn.click();
    expect(slowBtn.classList.contains(CLS.btnActive)).toBe(true);
    expect(persisted).toEqual([true]);
    btn(host, "🔊")!.click();
    expect(calls.at(-1)).toEqual(["playCue", 0, { slow: true }]);
    ctl.destroy();
  });

  it("starts at the configured slow preference", () => {
    const { host, ctl } = mount({ player: fakePlayer([]), voiceSlow: true });
    expect(btn(host, "🐢")!.classList.contains(CLS.btnActive)).toBe(true);
    ctl.destroy();
  });

  it("shadowing: 跟讀 starts on the current cue, Space-advances, and Esc-exits", () => {
    const calls: Call[] = [];
    const { host, ctl } = mount({ player: fakePlayer(calls) });
    const shadowBtn = btn(host, "跟讀")!;

    shadowBtn.click(); // start
    expect(ctl.isShadowing()).toBe(true);
    expect(shadowBtn.classList.contains(CLS.btnActive)).toBe(true);
    expect(calls[0]![0]).toBe("playCue");
    expect(calls[0]![1]).toBe(0); // current cue
    // The shadowing take carries an onEnded callback (drives playing→waiting).
    expect(typeof (calls[0]![2] as { onEnded?: unknown }).onEnded).toBe("function");

    ctl.shadowAdvance(); // Space → next cue
    expect(calls.at(-1)![0]).toBe("playCue");
    expect(calls.at(-1)![1]).toBe(1);

    ctl.toggleShadowing(); // Esc/toggle → exit
    expect(ctl.isShadowing()).toBe(false);
    expect(shadowBtn.classList.contains(CLS.btnActive)).toBe(false);
    expect(calls.at(-1)![0]).toBe("stop");
    ctl.destroy();
  });

  it("pauses local playback when a voice note starts (no double audio)", () => {
    const { host, ctl } = mount({ player: fakePlayer([]) });
    const playBtn = btn(host, "▶")!;
    playBtn.click(); // start the local clock (▶ → ⏸)
    expect(playBtn.textContent).toBe("⏸");
    ctl.playCurrentCueVoice(); // voice takes over → video/clock pauses
    expect(playBtn.textContent).toBe("▶");
  });

  it("advancing past the last cue ends shadowing (done → idle)", () => {
    const calls: Call[] = [];
    const { ctl } = mount({ player: fakePlayer(calls) });
    ctl.toggleShadowing(); // start at cue 0
    ctl.shadowAdvance(); // → cue 1 (last)
    expect(ctl.isShadowing()).toBe(true);
    ctl.shadowAdvance(); // past the end → done
    expect(ctl.isShadowing()).toBe(false);
    ctl.destroy();
  });
});
