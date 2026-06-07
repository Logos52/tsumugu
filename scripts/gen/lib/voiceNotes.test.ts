import { describe, it, expect } from "vitest";
import {
  deriveSlug,
  cueFileName,
  audioRelPath,
  selectCues,
  parseSlowSpec,
  slowSelection,
  planWork,
  buildWorkerJob,
  ffmpegArgs,
  buildManifest,
  makeNote,
  validateManifest,
  VOICE_NOTES_SCHEMA,
  DEFAULT_SLOW_INSTRUCT,
  type VoiceCue,
  type VoiceNotesManifest,
} from "./voiceNotes.js";

const cue = (text: string): VoiceCue => ({ text });
// 30 / 12 char fixtures for the `over:N` threshold.
const LONG = "一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十"; // 30 chars
const SHORT = "你好世界"; // 4 chars

describe("deriveSlug", () => {
  it("strips the cues-sidecar suffixes and any directory", () => {
    expect(deriveSlug("personal/inbox/zh-Hant/why-friendship-differs.prepared.cues.json")).toBe(
      "why-friendship-differs",
    );
    expect(deriveSlug("personal/inbox/zh-Hant/why-friendship-differs.prepared.json")).toBe(
      "why-friendship-differs",
    );
    expect(deriveSlug("foo.cues.json")).toBe("foo");
    expect(deriveSlug("bar.json")).toBe("bar");
  });
});

describe("cueFileName / audioRelPath", () => {
  it("zero-pads to 4 digits and marks slow takes", () => {
    expect(cueFileName(73, false)).toBe("cue-0073.mp3");
    expect(cueFileName(73, true)).toBe("cue-0073.slow.mp3");
    expect(cueFileName(7, false, "wav")).toBe("cue-0007.wav");
  });
  it("joins under the audio dir, trimming a trailing slash", () => {
    expect(audioRelPath("audio/slug/", 5, false)).toBe("audio/slug/cue-0005.mp3");
    expect(audioRelPath("audio/slug", 5, true)).toBe("audio/slug/cue-0005.slow.mp3");
  });
});

describe("selectCues", () => {
  const cues = [cue("a"), cue(""), cue("  "), cue("b"), cue("c")];
  it("takes all non-empty cues by default", () => {
    expect(selectCues(cues, {})).toEqual([0, 3, 4]);
  });
  it("--limit takes the first N non-empty cues", () => {
    expect(selectCues(cues, { limit: 2 })).toEqual([0, 3]);
  });
  it("--cues keeps explicit indices, dropping empty-text and out-of-range", () => {
    expect(selectCues(cues, { cues: [4, 1, 99, 0] })).toEqual([4, 0]);
  });
});

describe("parseSlowSpec + slowSelection", () => {
  it("parses the three forms and none", () => {
    expect(parseSlowSpec(undefined)).toEqual({ kind: "none" });
    expect(parseSlowSpec("all")).toEqual({ kind: "all" });
    expect(parseSlowSpec("over:30")).toEqual({ kind: "over", n: 30 });
    expect(parseSlowSpec("cues:73, 647")).toEqual({ kind: "cues", set: new Set([73, 647]) });
  });
  it("rejects garbage", () => {
    expect(() => parseSlowSpec("sometimes")).toThrow();
  });
  it("over:N counts characters (code points) at/above the threshold", () => {
    const cues = [cue(SHORT), cue(LONG)];
    expect(slowSelection(cues, [0, 1], parseSlowSpec("over:30"))).toEqual(new Set([1]));
    expect(slowSelection(cues, [0, 1], parseSlowSpec("over:4"))).toEqual(new Set([0, 1]));
  });
  it("all selects every selected non-empty cue; cues selects the named subset", () => {
    const cues = [cue("a"), cue("b"), cue("c")];
    expect(slowSelection(cues, [0, 1, 2], { kind: "all" })).toEqual(new Set([0, 1, 2]));
    expect(slowSelection(cues, [0, 1, 2], parseSlowSpec("cues:1"))).toEqual(new Set([1]));
  });
});

describe("planWork — incremental skip + force", () => {
  const cues = [cue("a"), cue("b"), cue("c")];
  const base = { cues, audioRelDir: "audio/s", force: false };

  it("renders all when nothing exists; sets slow flags from slowSet", () => {
    const plans = planWork({ ...base, selected: [0, 1], slowSet: new Set([1]), existing: new Set() });
    expect(plans).toEqual([
      { index: 0, text: "a", audio: "audio/s/cue-0000.mp3", renderNatural: true, renderSlow: false },
      {
        index: 1,
        text: "b",
        audio: "audio/s/cue-0001.mp3",
        audioSlow: "audio/s/cue-0001.slow.mp3",
        renderNatural: true,
        renderSlow: true,
      },
    ]);
  });

  it("skips takes whose mp3 already exists", () => {
    const existing = new Set(["audio/s/cue-0000.mp3", "audio/s/cue-0001.slow.mp3"]);
    const plans = planWork({ ...base, selected: [0, 1], slowSet: new Set([1]), existing });
    expect(plans[0]!.renderNatural).toBe(false); // natural exists
    expect(plans[1]!.renderNatural).toBe(true); // natural missing
    expect(plans[1]!.renderSlow).toBe(false); // slow exists
  });

  it("--force re-renders even existing files", () => {
    const existing = new Set(["audio/s/cue-0000.mp3"]);
    const plans = planWork({ ...base, force: true, selected: [0], slowSet: new Set(), existing });
    expect(plans[0]!.renderNatural).toBe(true);
  });
});

describe("buildWorkerJob", () => {
  const cues = [cue("a"), cue("b")];
  const plans = planWork({
    cues,
    selected: [0, 1],
    slowSet: new Set([1]),
    audioRelDir: "audio/s",
    existing: new Set(["audio/s/cue-0000.mp3"]), // cue 0 natural already done
    force: false,
  });

  it("emits a natural item per cue needing it and a slow (instruct) item per slow take", () => {
    const job = buildWorkerJob(plans, {
      model: "M",
      voice: "Serena",
      language: "Chinese",
      slowInstruct: DEFAULT_SLOW_INSTRUCT,
      wavDir: "/tmp/wav/",
    });
    expect(job).toEqual({
      model: "M",
      voice: "Serena",
      language: "Chinese",
      items: [
        // cue 0 natural is skipped (exists); cue 1 natural + cue 1 slow render.
        { index: 1, text: "b", instruct: null, outWav: "/tmp/wav/cue-0001.wav" },
        { index: 1, text: "b", instruct: DEFAULT_SLOW_INSTRUCT, outWav: "/tmp/wav/cue-0001.slow.wav" },
      ],
    });
  });
});

describe("ffmpegArgs", () => {
  it("encodes mono mp3 at the chosen bitrate, overwriting", () => {
    expect(ffmpegArgs("/t/a.wav", "/t/a.mp3")).toEqual([
      "-loglevel", "error", "-y", "-i", "/t/a.wav", "-ac", "1", "-b:a", "96k", "/t/a.mp3",
    ]);
  });
});

describe("buildManifest — merge preserves untouched cues", () => {
  const existing: VoiceNotesManifest = {
    schema: VOICE_NOTES_SCHEMA,
    lang: "zh-Hant",
    slug: "s",
    engine: "old-engine",
    voice: "Serena",
    notes: [
      { cueIndex: 0, audio: "audio/s/cue-0000.mp3" },
      { cueIndex: 5, audio: "audio/s/cue-0005.mp3" },
    ],
  };

  it("creates a fresh manifest from notes when none exists", () => {
    const m = buildManifest({
      slug: "s",
      lang: "zh-Hant",
      engine: "E",
      voice: "Serena",
      generatedAt: "2026-06-06T00:00:00Z",
      notes: [makeNote(1, "audio/s/cue-0001.mp3")],
    });
    expect(m.schema).toBe(VOICE_NOTES_SCHEMA);
    expect(m.engine).toBe("E");
    expect(m.notes).toEqual([{ cueIndex: 1, audio: "audio/s/cue-0001.mp3" }]);
  });

  it("merges a partial re-run: untouched cues kept, refreshed provenance, sorted", () => {
    const m = buildManifest({
      existing,
      slug: "s",
      lang: "zh-Hant",
      engine: "new-engine",
      voice: "Serena",
      generatedAt: "2026-06-06T00:00:00Z",
      notes: [makeNote(2, "audio/s/cue-0002.mp3"), makeNote(0, "audio/s/cue-0000.mp3", "audio/s/cue-0000.slow.mp3")],
    });
    expect(m.engine).toBe("new-engine");
    expect(m.notes.map((n) => n.cueIndex)).toEqual([0, 2, 5]); // sorted; cue 5 preserved
    // cue 0 updated to gain a slow take.
    expect(m.notes.find((n) => n.cueIndex === 0)).toEqual({
      cueIndex: 0,
      audio: "audio/s/cue-0000.mp3",
      audioSlow: "audio/s/cue-0000.slow.mp3",
    });
  });
});

describe("validateManifest", () => {
  const manifest: VoiceNotesManifest = {
    schema: VOICE_NOTES_SCHEMA,
    lang: "zh-Hant",
    slug: "s",
    engine: "E",
    voice: "Serena",
    notes: [
      { cueIndex: 0, audio: "audio/s/cue-0000.mp3" },
      { cueIndex: 1, audio: "audio/s/cue-0001.mp3", audioSlow: "audio/s/cue-0001.slow.mp3" },
    ],
  };
  it("passes when every referenced file exists", () => {
    const existing = new Set([
      "audio/s/cue-0000.mp3",
      "audio/s/cue-0001.mp3",
      "audio/s/cue-0001.slow.mp3",
    ]);
    expect(validateManifest(manifest, existing)).toEqual({ ok: true, missing: [] });
  });
  it("reports every missing audio + audioSlow path", () => {
    const existing = new Set(["audio/s/cue-0000.mp3"]);
    expect(validateManifest(manifest, existing)).toEqual({
      ok: false,
      missing: ["audio/s/cue-0001.mp3", "audio/s/cue-0001.slow.mp3"],
    });
  });
});
