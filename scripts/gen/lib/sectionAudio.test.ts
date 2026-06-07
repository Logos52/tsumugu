import { describe, it, expect } from "vitest";
import {
  selectSections,
  sectionAudioPath,
  planSections,
  buildSectionManifest,
  validateSectionManifest,
  SECTION_AUDIO_SCHEMA,
  SECTION_AUDIO_DIR,
  type SectionAudioManifest,
} from "./sectionAudio.js";

const sections = [{ summary: "甲" }, { summary: "" }, { summary: "丙" }];

describe("selectSections", () => {
  it("keeps only sections with a non-empty summary", () => {
    expect(selectSections(sections)).toEqual([0, 2]);
  });
});

describe("sectionAudioPath", () => {
  it("zero-pads under the sections dir", () => {
    expect(sectionAudioPath(2)).toBe(`${SECTION_AUDIO_DIR}/section-0002.mp3`);
  });
});

describe("planSections — incremental", () => {
  it("renders missing, skips existing unless force", () => {
    const existing = new Set([sectionAudioPath(0)]);
    const plan = planSections(sections, [0, 2], SECTION_AUDIO_DIR, existing, false);
    expect(plan.find((p) => p.index === 0)!.render).toBe(false);
    expect(plan.find((p) => p.index === 2)!.render).toBe(true);
    expect(planSections(sections, [0, 2], SECTION_AUDIO_DIR, existing, true).every((p) => p.render)).toBe(true);
  });
});

describe("buildSectionManifest — merge", () => {
  const existing: SectionAudioManifest = {
    schema: SECTION_AUDIO_SCHEMA,
    lang: "zh-Hant",
    voice: "Serena",
    engine: "old",
    notes: [{ sectionIndex: 5, audio: "audio/sections/section-0005.mp3" }],
  };
  it("merges + preserves untouched + sorts + refreshes provenance", () => {
    const m = buildSectionManifest({
      existing,
      lang: "zh-Hant",
      voice: "Serena",
      engine: "new",
      generatedAt: "2026-06-07T00:00:00Z",
      notes: [{ sectionIndex: 0, audio: "audio/sections/section-0000.mp3" }],
    });
    expect(m.engine).toBe("new");
    expect(m.notes.map((n) => n.sectionIndex)).toEqual([0, 5]);
  });
});

describe("validateSectionManifest", () => {
  const m: SectionAudioManifest = {
    schema: SECTION_AUDIO_SCHEMA,
    lang: "zh-Hant",
    voice: "Serena",
    engine: "e",
    notes: [
      { sectionIndex: 0, audio: "a.mp3" },
      { sectionIndex: 1, audio: "b.mp3" },
    ],
  };
  it("reports missing files", () => {
    expect(validateSectionManifest(m, new Set(["a.mp3", "b.mp3"]))).toEqual({ ok: true, missing: [] });
    expect(validateSectionManifest(m, new Set(["a.mp3"]))).toEqual({ ok: false, missing: ["b.mp3"] });
  });
});
