import { describe, it, expect } from "vitest";
import { bindVoiceNotes, VOICE_NOTES_SCHEMA, type VoiceNotesManifest } from "./manifest.js";
import {
  speakersOf,
  voiceForSpeaker,
  defaultAssignment,
  mergeAssignmentPref,
  composeBinding,
  describeAssignment,
  type VoiceTrack,
} from "./voices.js";

/** A track whose every cue clip lives under `audio/<id>/cue-NNNN.mp3`. */
function track(id: string, label: string, baseDir: string, cueIdxs: number[]): VoiceTrack {
  const manifest: VoiceNotesManifest = {
    schema: VOICE_NOTES_SCHEMA,
    lang: "zh-Hant",
    slug: "lesson",
    engine: "test",
    voice: label,
    notes: cueIdxs.map((i) => ({ cueIndex: i, audio: `audio/${id}/cue-${String(i).padStart(4, "0")}.mp3` })),
  };
  return { id, label, binding: bindVoiceNotes(manifest, baseDir) };
}

const SPEAKERS = ["A", "B", "A", "B"]; // a 甲/乙 dialogue

describe("speakersOf", () => {
  it("returns distinct non-empty speakers in first-seen order", () => {
    expect(speakersOf(["B", "A", "B", undefined, "A", ""])).toEqual(["B", "A"]);
  });
});

describe("defaultAssignment", () => {
  it("gives two speakers two voices, native first", () => {
    const tracks = [track("native", "Native TW", "inbox/zh", [0, 1, 2, 3]), track("serena", "Serena", "inbox/zh", [0, 1, 2, 3])];
    const a = defaultAssignment(tracks, SPEAKERS);
    expect(a.A).toBe("native");
    expect(a.B).toBe("serena");
    expect(a[""]).toBe("native");
  });
  it("falls back to a single voice when only one track", () => {
    const tracks = [track("serena", "Serena", "inbox/zh", [0, 1])];
    const a = defaultAssignment(tracks, SPEAKERS);
    expect(a.A).toBe("serena");
    expect(a.B).toBe("serena");
  });
});

describe("mergeAssignmentPref", () => {
  it("applies a saved pref but ignores ids no longer present", () => {
    const tracks = [track("native", "Native TW", "inbox/zh", [0]), track("serena", "Serena", "inbox/zh", [0])];
    const base = { A: "native", B: "serena", "": "native" };
    const merged = mergeAssignmentPref(base, { A: "serena", B: "ghost" }, tracks);
    expect(merged.A).toBe("serena"); // applied
    expect(merged.B).toBe("serena"); // "ghost" ignored → base kept
  });
});

describe("composeBinding", () => {
  const tracks = [
    track("native", "Native TW", "inbox/zh", [0, 1, 2, 3]),
    track("serena", "Serena", "other/dir", [0, 1, 2, 3]),
  ];

  it("pulls each cue from its speaker's track, audio pre-resolved to full path", () => {
    const a = { A: "native", B: "serena", "": "native" };
    const b = composeBinding(tracks, a, SPEAKERS)!;
    expect(b.baseDir).toBe(""); // composite resolves verbatim
    expect(b.byCue.get(0)!.audio).toBe("inbox/zh/audio/native/cue-0000.mp3"); // A → native
    expect(b.byCue.get(1)!.audio).toBe("other/dir/audio/serena/cue-0001.mp3"); // B → serena (other baseDir)
    expect(b.byCue.get(2)!.audio).toBe("inbox/zh/audio/native/cue-0002.mp3");
  });

  it("both-Serena collapses every cue to the Serena track", () => {
    const b = composeBinding(tracks, { A: "serena", B: "serena", "": "serena" }, SPEAKERS)!;
    expect(b.byCue.get(0)!.audio).toBe("other/dir/audio/serena/cue-0000.mp3");
    expect(b.byCue.get(1)!.audio).toBe("other/dir/audio/serena/cue-0001.mp3");
  });

  it("skips cues a chosen track has no clip for", () => {
    const sparse = [track("native", "Native TW", "inbox/zh", [0, 2]), track("serena", "Serena", "inbox/zh", [0, 1, 2, 3])];
    const b = composeBinding(sparse, { A: "native", B: "serena", "": "native" }, SPEAKERS)!;
    expect(b.byCue.has(2)).toBe(true); // native has cue 2
    expect(b.byCue.has(0)).toBe(true);
    // cue 1 is speaker B → serena, present; cue 3 is B → serena, present
    expect(b.byCue.has(1)).toBe(true);
  });

  it("returns null when nothing resolves", () => {
    expect(composeBinding([], {}, SPEAKERS)).toBeNull();
  });
});

describe("voiceForSpeaker / describeAssignment", () => {
  const tracks = [track("native", "Native TW", "inbox/zh", [0]), track("serena", "Serena", "inbox/zh", [0])];
  it("resolves with fallback to '' then first track", () => {
    expect(voiceForSpeaker({ A: "serena" }, tracks, "A")).toBe("serena");
    expect(voiceForSpeaker({ "": "native" }, tracks, "Z")).toBe("native");
    expect(voiceForSpeaker({}, tracks, "Z")).toBe("native"); // first track
  });
  it("describes a dialogue assignment", () => {
    expect(describeAssignment(tracks, { A: "native", B: "serena", "": "native" }, SPEAKERS)).toBe(
      "A→Native TW, B→Serena",
    );
  });
});
