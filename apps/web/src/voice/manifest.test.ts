import { describe, it, expect } from "vitest";
import {
  parseVoiceNotes,
  indexNotes,
  resolveAudioPath,
  bindVoiceNotes,
  VOICE_NOTES_SCHEMA,
  type VoiceNotesManifest,
} from "./manifest.js";

const good = {
  schema: VOICE_NOTES_SCHEMA,
  lang: "zh-Hant",
  slug: "x",
  engine: "qwen3@mlx-audio",
  voice: "Serena",
  generatedAt: "2026-06-06T00:00:00Z",
  notes: [
    { cueIndex: 2, audio: "audio/x/cue-0002.mp3" },
    { cueIndex: 0, audio: "audio/x/cue-0000.mp3", audioSlow: "audio/x/cue-0000.slow.mp3" },
  ],
};

describe("parseVoiceNotes", () => {
  it("parses a valid manifest, sorts notes, keeps audioSlow + provenance", () => {
    const m = parseVoiceNotes(good, 10)!;
    expect(m).not.toBeNull();
    expect(m.voice).toBe("Serena");
    expect(m.generatedAt).toBe("2026-06-06T00:00:00Z");
    expect(m.notes.map((n) => n.cueIndex)).toEqual([0, 2]); // sorted
    expect(m.notes[0]!.audioSlow).toBe("audio/x/cue-0000.slow.mp3");
    expect(m.notes[1]!.audioSlow).toBeUndefined();
  });

  it("returns null for a wrong/absent schema or non-object", () => {
    expect(parseVoiceNotes({ ...good, schema: "tsumugu/other@1" }, 10)).toBeNull();
    expect(parseVoiceNotes({ notes: [] }, 10)).toBeNull();
    expect(parseVoiceNotes(null, 10)).toBeNull();
    expect(parseVoiceNotes("nope", 10)).toBeNull();
  });

  it("drops notes with out-of-range, non-integer, or missing-audio entries", () => {
    const m = parseVoiceNotes(
      {
        ...good,
        notes: [
          { cueIndex: 0, audio: "a.mp3" },
          { cueIndex: 99, audio: "b.mp3" }, // out of range (cueCount 3)
          { cueIndex: 1.5, audio: "c.mp3" }, // non-integer
          { cueIndex: 2 }, // no audio
          { cueIndex: 2, audio: "" }, // empty audio
          "garbage",
        ],
      },
      3,
    )!;
    expect(m.notes.map((n) => n.cueIndex)).toEqual([0]);
  });

  it("duplicate cueIndex → last wins", () => {
    const m = parseVoiceNotes(
      { ...good, notes: [
        { cueIndex: 1, audio: "first.mp3" },
        { cueIndex: 1, audio: "second.mp3" },
      ] },
      5,
    )!;
    expect(m.notes).toEqual([{ cueIndex: 1, audio: "second.mp3" }]);
  });
});

describe("indexNotes", () => {
  it("maps cueIndex → note", () => {
    const m = parseVoiceNotes(good, 10)!;
    const map = indexNotes(m);
    expect(map.get(0)?.audio).toBe("audio/x/cue-0000.mp3");
    expect(map.get(2)?.audio).toBe("audio/x/cue-0002.mp3");
    expect(map.get(7)).toBeUndefined();
  });
});

describe("resolveAudioPath", () => {
  it("joins the manifest dir and the relative audio path", () => {
    expect(resolveAudioPath("inbox/zh-Hant", "audio/x/cue-0000.mp3")).toBe(
      "inbox/zh-Hant/audio/x/cue-0000.mp3",
    );
  });
  it("tolerates a trailing slash, a ./ prefix, and an empty base", () => {
    expect(resolveAudioPath("inbox/zh-Hant/", "./audio/c.mp3")).toBe("inbox/zh-Hant/audio/c.mp3");
    expect(resolveAudioPath("", "audio/c.mp3")).toBe("audio/c.mp3");
  });
});

describe("bindVoiceNotes", () => {
  it("captures the manifest, its dir, and a precomputed cue index", () => {
    const m: VoiceNotesManifest = parseVoiceNotes(good, 10)!;
    const b = bindVoiceNotes(m, "inbox/zh-Hant");
    expect(b.baseDir).toBe("inbox/zh-Hant");
    expect(b.byCue.get(0)?.audio).toBe("audio/x/cue-0000.mp3");
  });
});
