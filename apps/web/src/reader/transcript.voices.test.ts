// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

import type { PreparedToken } from "@tsumugu/engine";
import { mountTranscriptSync } from "./transcript.js";
import { CLS } from "../ui/classes.js";
import type { TranscriptDoc } from "./sync.js";
import { bindVoiceNotes, parseVoiceNotes, VOICE_NOTES_SCHEMA } from "../voice/manifest.js";
import type { VoiceTrack, SpeakerAssignment } from "../voice/voices.js";

/** 8 tokens, two cues — a 甲/乙 exchange. */
const tokens: PreparedToken[] = [
  { text: "你好", isWord: true },
  { text: "嗎", isWord: true },
  { text: "？", isWord: false },
  { text: "我", isWord: true },
  { text: "很", isWord: true },
  { text: "好", isWord: true },
  { text: "。", isWord: false },
  { text: "謝謝", isWord: true },
];
const transcript: TranscriptDoc = {
  cues: [
    { text: "你好嗎？", start: "00:00:00,000", end: "00:00:02,000", speaker: "A" },
    { text: "我很好。謝謝", start: "00:00:02,000", end: "00:00:04,000", speaker: "B" },
  ],
};

function track(id: string, label: string): VoiceTrack {
  const m = parseVoiceNotes(
    {
      schema: VOICE_NOTES_SCHEMA,
      lang: "zh-Hant",
      slug: "x",
      engine: "e",
      voice: label,
      notes: [
        { cueIndex: 0, audio: `audio/${id}/cue-0000.mp3` },
        { cueIndex: 1, audio: `audio/${id}/cue-0001.mp3` },
      ],
    },
    2,
  )!;
  return { id, label, binding: bindVoiceNotes(m, "base") };
}

function mount(opts: {
  voiceTracks?: VoiceTrack[];
  voiceAssignment?: SpeakerAssignment;
  onVoiceAssign?: (speaker: string, voiceId: string) => void;
}) {
  const host = document.createElement("div");
  const tokenEls = tokens.map(() => document.createElement("span"));
  mountTranscriptSync({
    host,
    tokens,
    transcript,
    tokenEls,
    ...(opts.voiceTracks ? { voiceTracks: opts.voiceTracks } : {}),
    ...(opts.voiceAssignment ? { voiceAssignment: opts.voiceAssignment } : {}),
    ...(opts.onVoiceAssign ? { onVoiceAssign: opts.onVoiceAssign } : {}),
  });
  return host;
}

const selects = (host: HTMLElement) => [...host.querySelectorAll<HTMLSelectElement>(`.${CLS.transport} select`)];

describe("per-speaker voice picker", () => {
  const TRACKS = [track("serena", "Serena"), track("native", "Native TW")];

  it("renders one selector per speaker, each showing the assigned voice", () => {
    const host = mount({
      voiceTracks: TRACKS,
      voiceAssignment: { A: "native", B: "serena", "": "native" },
      onVoiceAssign: () => {},
    });
    const sels = selects(host);
    expect(sels.length).toBe(2); // 甲 + 乙
    expect([...sels[0]!.options].map((o) => o.value)).toEqual(["serena", "native"]);
    expect(sels[0]!.value).toBe("native"); // 甲 → native
    expect(sels[1]!.value).toBe("serena"); // 乙 → serena
  });

  it("changing a selector reassigns that speaker's voice", () => {
    const calls: Array<[string, string]> = [];
    const host = mount({
      voiceTracks: TRACKS,
      voiceAssignment: { A: "native", B: "serena", "": "native" },
      onVoiceAssign: (sp, id) => calls.push([sp, id]),
    });
    const sel = selects(host)[0]!;
    sel.value = "serena";
    sel.dispatchEvent(new Event("change"));
    expect(calls).toEqual([["A", "serena"]]); // 甲 → Serena (both speakers Serena)
  });

  it("shows no picker with only one track", () => {
    const host = mount({ voiceTracks: [track("serena", "Serena")], onVoiceAssign: () => {} });
    expect(selects(host).length).toBe(0);
  });
});
