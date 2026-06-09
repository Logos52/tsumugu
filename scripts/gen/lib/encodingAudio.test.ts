import { describe, it, expect } from "vitest";
import {
  planEncodingAudio,
  buildEncodingAudioManifest,
  validateEncodingAudioManifest,
  sentenceAudioPath,
  termAudioPath,
  maxSentenceDurationSec,
} from "./encodingAudio.js";
import type { EncodingPageDoc } from "@tsumugu/engine";

const doc: EncodingPageDoc = {
  schema: "tsumugu/encoding-page@1",
  lang: "zh-Hant",
  term: "熱鬧",
  examples: [
    { text: "週末的夜市總是很熱鬧。", translation: "lively" },
    { text: "過年的時候，街上又熱鬧又開心。", translation: "joyful" },
  ],
};

describe("encodingAudio planning", () => {
  it("plans term + one mp3 per example", () => {
    const plans = planEncodingAudio({
      doc,
      existing: new Set(),
      force: false,
    });
    expect(plans).toHaveLength(3);
    expect(plans[0]!.kind).toBe("term");
    expect(plans[1]!.kind).toBe("sentence");
    expect(plans[1]!.audio).toBe(sentenceAudioPath("熱鬧", 0));
    expect(plans[2]!.index).toBe(1);
  });

  it("skips existing clips unless --force", () => {
    const existing = new Set([termAudioPath("熱鬧")]);
    const plans = planEncodingAudio({ doc, existing, force: false });
    expect(plans.find((p) => p.kind === "term")!.render).toBe(false);
    expect(plans.filter((p) => p.render)).toHaveLength(2);
  });

  it("builds and validates manifest", () => {
    const m = buildEncodingAudioManifest({
      lang: "zh-Hant",
      term: "熱鬧",
      termAudio: termAudioPath("熱鬧"),
      sentences: { 0: sentenceAudioPath("熱鬧", 0) },
    });
    expect(m.schema).toBe("tsumugu/encoding-audio@1");
    const ok = validateEncodingAudioManifest(m, new Set([m.termAudio!, m.sentences[0]!]));
    expect(ok.ok).toBe(true);
  });

  it("maxSentenceDurationSec scales with length", () => {
    expect(maxSentenceDurationSec(10)).toBeGreaterThan(maxSentenceDurationSec(2));
  });
});