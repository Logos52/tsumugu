// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

import type { PreparedToken } from "@tsumugu/engine";
import { mountTranscriptSync } from "./transcript.js";
import { CLS } from "../ui/classes.js";
import type { TranscriptDoc } from "./sync.js";
import type { SectionAudioPlayer } from "../voice/sectionAudio.js";

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
  sections: [
    { start: "00:00:00,000", end: "00:00:03,000", summary: "第一段摘要", tr: "first summary" },
    { start: "00:00:03,000", end: "00:00:06,000", summary: "第二段摘要", tr: "second summary" },
  ],
};

function mount(extra: { sectionPlayer?: SectionAudioPlayer | null; speak?: (t: string) => void }) {
  const host = document.createElement("div");
  const tokenEls = tokens.map(() => document.createElement("span"));
  const ctl = mountTranscriptSync({ host, tokens, transcript, tokenEls, ...extra });
  return { host, ctl };
}
const scrub = (host: HTMLElement, v: number): void => {
  const s = host.querySelector<HTMLInputElement>(`.${CLS.scrubber}`)!;
  s.value = String(v);
  s.dispatchEvent(new Event("input", { bubbles: true }));
};
const sectionText = (host: HTMLElement): string => host.querySelector(`.${CLS.section} span`)!.textContent ?? "";
const sectionTr = (host: HTMLElement): string => host.querySelector(`.${CLS.sectionTr}`)!.textContent ?? "";
const sectionPlayBtn = (host: HTMLElement): HTMLButtonElement =>
  [...host.querySelectorAll<HTMLButtonElement>(`.${CLS.section} .${CLS.btn}`)].find((b) => b.textContent === "🔊")!;

describe("transcript section summaries (zh-Hant) + 🔊", () => {
  it("shows the active section's summary in the reading's language", () => {
    const { host, ctl } = mount({});
    scrub(host, 1); // into section 0
    expect(sectionText(host)).toBe("第一段摘要");
    scrub(host, 4); // into section 1
    expect(sectionText(host)).toBe("第二段摘要");
    ctl.destroy();
  });

  it("reveals the English summary under the 譯 toggle", () => {
    const { host, ctl } = mount({});
    scrub(host, 1);
    expect(sectionTr(host)).toBe(""); // off by default
    ctl.setTranslationVisible(true);
    expect(sectionTr(host)).toBe("first summary");
    ctl.setTranslationVisible(false);
    expect(sectionTr(host)).toBe("");
    ctl.destroy();
  });

  it("the section 🔊 plays the active section's summary via the player", () => {
    const calls: Array<[number, string]> = [];
    const fakePlayer: SectionAudioPlayer = {
      playSection: (i, fb) => calls.push([i, fb]),
      destroy: () => {},
    };
    const { host, ctl } = mount({ sectionPlayer: fakePlayer });
    scrub(host, 4); // section 1 active
    sectionPlayBtn(host).click();
    expect(calls).toEqual([[1, "第二段摘要"]]);
    ctl.destroy();
  });

  it("falls back to speak() when no section player is present", () => {
    const spoken: string[] = [];
    const { host, ctl } = mount({ speak: (t) => spoken.push(t) });
    scrub(host, 1);
    sectionPlayBtn(host).click();
    expect(spoken).toEqual(["第一段摘要"]);
    ctl.destroy();
  });
});
