// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

import type { PreparedToken, VaultIO } from "@tsumugu/engine";
import { mountTranscriptSync } from "./transcript.js";
import { CLS } from "../ui/classes.js";
import type { TranscriptDoc } from "./sync.js";
import type { VoicePlayer } from "../voice/player.js";
import { bindVoiceNotes, parseVoiceNotes, VOICE_NOTES_SCHEMA, type VoiceNotesBinding } from "../voice/manifest.js";
import type { PracticeBar, PracticeBarArgs, PracticeBarFactory } from "../voice/practiceBar.js";

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

/** A vault whose readBytes always returns one byte (enough to "have audio"). */
const fakeVault: VaultIO = {
  readText: async () => null,
  writeText: async () => {},
  readBytes: async () => new Uint8Array([1]),
};

/** A manifest binding with audio for both cues. */
function fakeBinding(): VoiceNotesBinding {
  const m = parseVoiceNotes(
    {
      schema: VOICE_NOTES_SCHEMA,
      lang: "zh-Hant",
      slug: "x",
      engine: "e",
      voice: "Serena",
      notes: [
        { cueIndex: 0, audio: "audio/x/cue-0000.mp3" },
        { cueIndex: 1, audio: "audio/x/cue-0001.mp3" },
      ],
    },
    2,
  )!;
  return bindVoiceNotes(m, "base");
}

/** A practice-bar stub recording calls; captures the args it was built with. */
function fakeBarFactory(calls: Call[], onArgs: (a: PracticeBarArgs) => void): PracticeBarFactory {
  return async (args) => {
    onArgs(args);
    let looping = false;
    const bar: PracticeBar = {
      setCue: (i) => calls.push(["setCue", i]),
      toggleLoop: () => {
        looping = !looping;
        calls.push(["loop", looping]);
      },
      nudge: (d) => calls.push(["nudge", d]),
      cycleSpeed: () => {
        calls.push(["speed"]);
        return 0.85;
      },
      playPause: () => calls.push(["play"]),
      isLooping: () => looping,
      destroy: () => calls.push(["destroy"]),
    };
    return bar;
  };
}

function mount(opts: {
  player?: VoicePlayer | null;
  voiceSlow?: boolean;
  onSlowToggle?: (slow: boolean) => void;
  vault?: VaultIO | null;
  voiceNotes?: VoiceNotesBinding | null;
  createPracticeBar?: PracticeBarFactory;
  onToggleTranslation?: () => void;
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
    ...(opts.vault !== undefined ? { vault: opts.vault } : {}),
    ...(opts.voiceNotes !== undefined ? { voiceNotes: opts.voiceNotes } : {}),
    ...(opts.createPracticeBar ? { createPracticeBar: opts.createPracticeBar } : {}),
    ...(opts.onToggleTranslation ? { onToggleTranslation: opts.onToggleTranslation } : {}),
  });
  return { host, tokenEls, ctl };
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

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

  it("⏩ doubles as its own stop: play-through, then a second click stops it", () => {
    const calls: Call[] = [];
    const { host, ctl } = mount({ player: fakePlayer(calls) });
    const from = btn(host, "⏩")!;
    from.click(); // start the play-through (the fake never fires onDone)
    expect(calls.at(-1)![0]).toBe("playFrom");
    expect(from.classList.contains(CLS.btnActive)).toBe(true);
    from.click(); // already chaining → stops
    expect(calls.some((c) => c[0] === "stop")).toBe(true);
    expect(from.classList.contains(CLS.btnActive)).toBe(false);
    ctl.destroy();
  });

  it("the 譯 transport button fires onToggleTranslation and reflects translation state", () => {
    const flips: number[] = [];
    const { host, ctl } = mount({ onToggleTranslation: () => flips.push(1) });
    const t = btn(host, "譯")!;
    expect(t.classList.contains(CLS.btnActive)).toBe(false); // hidden by default
    t.click();
    expect(flips.length).toBe(1); // the host owns the setting; we just request a flip
    ctl.setTranslationVisible(true); // host echoes the new setting back
    expect(t.classList.contains(CLS.btnActive)).toBe(true);
    ctl.setTranslationVisible(false);
    expect(t.classList.contains(CLS.btnActive)).toBe(false);
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

describe("transcript practice bar (M2.1/M3 auto-following) wiring", () => {
  function mountBar() {
    const calls: Call[] = [];
    let args: PracticeBarArgs | undefined;
    const m = mount({
      player: fakePlayer([]),
      vault: fakeVault,
      voiceNotes: fakeBinding(),
      createPracticeBar: fakeBarFactory(calls, (a) => (args = a)),
    });
    return { ...m, calls, getArgs: () => args };
  }

  it("shows the 🌊 button only when a player + vault + manifest are all present", () => {
    expect(btn(mount({ player: fakePlayer([]) }).host, "🌊")).toBeUndefined(); // no vault/manifest
    const withAll = mountBar();
    expect(btn(withAll.host, "🌊")).toBeDefined();
    withAll.ctl.destroy();
  });

  it("auto-shows the bar on mount, built on the current cue", async () => {
    const { host, ctl, getArgs } = mountBar();
    expect(ctl.isPracticeBarOpen()).toBe(true); // visible by default
    expect(btn(host, "🌊")!.classList.contains(CLS.btnActive)).toBe(true);
    expect((host.querySelector(`.${CLS.practiceBar}`) as HTMLElement).style.display).toBe("block");
    await tick(); // factory resolves
    expect(getArgs()?.initialCue).toBe(0);
    ctl.destroy();
  });

  it("🌊 toggles visibility (hide / show)", async () => {
    const { host, ctl } = mountBar();
    await tick();
    const barBtn = btn(host, "🌊")!;
    barBtn.click(); // hide
    expect(ctl.isPracticeBarOpen()).toBe(false);
    expect((host.querySelector(`.${CLS.practiceBar}`) as HTMLElement).style.display).toBe("none");
    barBtn.click(); // show
    expect(ctl.isPracticeBarOpen()).toBe(true);
    ctl.destroy();
  });

  it("follows the active sentence: seekToCue → bar.setCue(that cue)", async () => {
    const { calls, ctl } = mountBar();
    await tick(); // bar ready
    ctl.seekToCue(1);
    expect(calls.some((c) => c[0] === "setCue" && c[1] === 1)).toBe(true);
    ctl.destroy();
  });

  it("routes loop / nudge / speed / play to the bar", async () => {
    const { host, calls, ctl } = mountBar();
    await tick();
    ctl.practiceToggleLoop();
    expect(calls.some((c) => c[0] === "loop")).toBe(true);
    expect(btn(host, "🔁")!.classList.contains(CLS.btnActive)).toBe(true);
    ctl.practiceNudge(-1);
    expect(calls.at(-1)).toEqual(["nudge", -1]);
    btn(host, "1×")!.click();
    expect(btn(host, "0.85×")).toBeDefined();
    ctl.destroy();
  });
});

describe("transcript sentence navigation + video loop (M2.2)", () => {
  it("cueForToken maps token indices to their owning cue (or -1)", () => {
    const { ctl } = mount({}); // nav works without voice
    expect(ctl.cueForToken(0)).toBe(0);
    expect(ctl.cueForToken(3)).toBe(0);
    expect(ctl.cueForToken(4)).toBe(1);
    expect(ctl.cueForToken(7)).toBe(1);
    expect(ctl.cueForToken(99)).toBe(-1);
    ctl.destroy();
  });

  it("seekToCue activates that cue's tokens; prevCue/nextCue step", () => {
    const { tokenEls, ctl } = mount({});
    ctl.seekToCue(1);
    expect(tokenEls[4]!.classList.contains(CLS.cueActive)).toBe(true);
    expect(tokenEls[0]!.classList.contains(CLS.cueActive)).toBe(false);
    ctl.prevCue();
    expect(tokenEls[0]!.classList.contains(CLS.cueActive)).toBe(true);
    expect(tokenEls[4]!.classList.contains(CLS.cueActive)).toBe(false);
    ctl.nextCue();
    expect(tokenEls[4]!.classList.contains(CLS.cueActive)).toBe(true);
    ctl.destroy();
  });

  it("selectCue highlights the sentence WITHOUT moving the video", () => {
    const { host, tokenEls, ctl } = mount({});
    const scrubber = host.querySelector<HTMLInputElement>(`.${CLS.scrubber}`)!;
    expect(scrubber.value).toBe("0");
    ctl.selectCue(1);
    expect(tokenEls[4]!.classList.contains(CLS.cueActive)).toBe(true); // highlight moved
    expect(scrubber.value).toBe("0"); // …but the video clock did not seek
    ctl.destroy();
  });

  it("the 🔂 button toggles the video sentence-loop", () => {
    const { host, ctl } = mount({});
    const loopBtn = btn(host, "🔂")!;
    expect(ctl.isVideoLooping()).toBe(false);
    loopBtn.click();
    expect(ctl.isVideoLooping()).toBe(true);
    expect(loopBtn.classList.contains(CLS.btnActive)).toBe(true);
    loopBtn.click();
    expect(ctl.isVideoLooping()).toBe(false);
    expect(loopBtn.classList.contains(CLS.btnActive)).toBe(false);
    ctl.destroy();
  });
});
