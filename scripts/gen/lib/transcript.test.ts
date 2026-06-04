import { describe, it, expect } from "vitest";
import { WordStore } from "@tsumugu/engine";
import { demoPack } from "@tsumugu/demo-pack";
import { parseTranscript, buildTranscriptSkeleton } from "./transcript.js";

describe("parseTranscript — SRT", () => {
  const srt = [
    "1",
    "00:00:00,500 --> 00:00:03,000",
    "Hello there friend.",
    "",
    "2",
    "00:00:03,000 --> 00:00:06,000",
    "We go now.",
    "",
    "3",
    "00:00:06,000 --> 00:00:06,000",
    "We go now.", // consecutive duplicate → dropped
    "",
    "4",
    "00:00:06,500 --> 00:00:09,000",
    "Thanks <i>a lot</i>.", // tag stripped
  ].join("\n");

  it("parses cues with timestamps, strips tags, and dedups", () => {
    const { cues, text } = parseTranscript(srt);
    expect(cues.map((c) => c.text)).toEqual(["Hello there friend.", "We go now.", "Thanks a lot."]);
    expect(cues[0]).toEqual({ text: "Hello there friend.", start: "00:00:00,500", end: "00:00:03,000" });
    // line structure preserved: one cue per line
    expect(text).toBe("Hello there friend.\nWe go now.\nThanks a lot.");
  });

  it("auto-detects SRT", () => {
    expect(parseTranscript(srt, "auto").cues.length).toBe(3);
  });
});

describe("parseTranscript — VTT", () => {
  const vtt = [
    "WEBVTT",
    "",
    "NOTE this is a comment block",
    "ignored note body",
    "",
    "cue-1",
    "00:00:00.000 --> 00:00:02.000 align:start position:10%",
    "Hello <c>there</c> friend.",
    "",
    "00:00:02.000 --> 00:00:04.000",
    "We <00:00:02.500>go now.", // inline timestamp tag stripped
    "",
    "00:00:04.000 --> 00:00:06.000",
    "We go now.", // duplicate → dropped
  ].join("\n");

  it("strips the header, NOTE blocks, cue settings, and tags; dedups", () => {
    const { cues, text } = parseTranscript(vtt);
    expect(cues.map((c) => c.text)).toEqual(["Hello there friend.", "We go now."]);
    expect(cues[0]).toEqual({ text: "Hello there friend.", start: "00:00:00.000", end: "00:00:02.000" });
    expect(text).toBe("Hello there friend.\nWe go now.");
  });

  it("auto-detects VTT from the WEBVTT header", () => {
    expect(parseTranscript(vtt, "auto").cues[0]?.text).toBe("Hello there friend.");
  });

  it("joins multi-line cue text and collapses whitespace", () => {
    const multi = ["WEBVTT", "", "00:00:00.000 --> 00:00:02.000", "Hello", "there   friend."].join("\n");
    const { cues } = parseTranscript(multi);
    expect(cues[0]?.text).toBe("Hello there friend.");
  });
});

describe("parseTranscript — YouTube paste", () => {
  it("handles timestamp-on-its-own-line", () => {
    const yt = ["0:00", "Hello there friend.", "0:03", "We go now.", "0:03", "We go now."].join("\n");
    const { cues, text } = parseTranscript(yt);
    expect(cues.map((c) => c.text)).toEqual(["Hello there friend.", "We go now."]);
    expect(cues[0]).toEqual({ text: "Hello there friend.", start: "0:00" });
    expect(cues[1]).toEqual({ text: "We go now.", start: "0:03" });
    expect(text).toBe("Hello there friend.\nWe go now.");
  });

  it("handles timestamp-prefixing-the-text and H:MM:SS", () => {
    const yt = ["0:00 Hello there friend.", "1:02:03 We go now."].join("\n");
    const { cues } = parseTranscript(yt, "youtube");
    expect(cues).toEqual([
      { text: "Hello there friend.", start: "0:00" },
      { text: "We go now.", start: "1:02:03" },
    ]);
  });

  it("auto-detects YouTube paste from bare M:SS timestamps", () => {
    const yt = ["0:00", "Hello there friend."].join("\n");
    expect(parseTranscript(yt, "auto").cues[0]?.start).toBe("0:00");
  });
});

describe("parseTranscript — plain", () => {
  it("splits into one cue per non-empty line, no timestamps", () => {
    const plain = ["Hello there friend.", "", "We go now.", "We go now."].join("\n");
    const { cues, text } = parseTranscript(plain);
    expect(cues.map((c) => c.text)).toEqual(["Hello there friend.", "We go now."]);
    expect(cues.every((c) => c.start === undefined && c.end === undefined)).toBe(true);
    expect(text).toBe("Hello there friend.\nWe go now.");
  });

  it("auto-detects plain when there are no timecodes", () => {
    expect(parseTranscript("Just a sentence with no timing.", "auto").cues).toEqual([
      { text: "Just a sentence with no timing." },
    ]);
  });
});

describe("buildTranscriptSkeleton", () => {
  it("yields PreparedContent with newline separators and glossary slots for unknowns", async () => {
    const store = new WordStore();
    store.setStatus("demo", "hello", "known");
    const srt = [
      "1",
      "00:00:00,000 --> 00:00:02,000",
      "hello world",
      "",
      "2",
      "00:00:02,000 --> 00:00:04,000",
      "demo line",
    ].join("\n");

    const { content, unknownWords, cues } = await buildTranscriptSkeleton({
      lang: "demo",
      pack: demoPack,
      store,
      raw: srt,
    });

    // cues parsed + timed
    expect(cues.map((c) => c.text)).toEqual(["hello world", "demo line"]);
    expect(cues[0]?.start).toBe("00:00:00,000");

    // line break between cues is preserved as a non-word token
    expect(content.tokens.some((t) => !t.isWord && t.text.includes("\n"))).toBe(true);

    // word tokens across both cues
    expect(content.tokens.filter((t) => t.isWord).map((t) => t.text)).toEqual([
      "hello",
      "world",
      "demo",
      "line",
    ]);

    // unknowns get glossary slots; known "hello" does not
    expect(unknownWords.sort()).toEqual(["demo", "line", "world"]);
    expect(content.glossary["hello"]).toBeUndefined();
    expect(content.glossary["world"]?.gloss).toBe("the earth, everyone"); // seeded from demo dict
    expect(content.glossary["line"]?.gloss).toBe(""); // unseeded → agent fills
    expect(content.schema).toBe("tsumugu/prepared-content@1");
    expect(content.source).toBe("transcript");
  });
});
