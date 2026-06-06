import { describe, it, expect } from "vitest";
import { buildVoiceNotesDeck } from "./ankiDeck.js";
import { bindVoiceNotes, parseVoiceNotes, VOICE_NOTES_SCHEMA } from "./manifest.js";

const manifest = parseVoiceNotes(
  {
    schema: VOICE_NOTES_SCHEMA,
    lang: "zh-Hant",
    slug: "x",
    engine: "e",
    voice: "Serena",
    notes: [
      { cueIndex: 0, audio: "audio/x/cue-0000.mp3" },
      { cueIndex: 2, audio: "audio/x/cue-0002.mp3", audioSlow: "audio/x/cue-0002.slow.mp3" },
    ],
  },
  5,
)!;
const binding = bindVoiceNotes(manifest, "inbox/zh-Hant");
const cues = [
  { text: "你好,", tr: "Hi," },
  { text: "(no audio)" },
  { text: "再見。", tr: "Bye." },
];

describe("buildVoiceNotesDeck", () => {
  it("builds one note per voiced cue with [sound:] back + embedded media", async () => {
    const readBytes = async (path: string): Promise<Uint8Array | null> => {
      if (path === "inbox/zh-Hant/audio/x/cue-0000.mp3") return new Uint8Array([1]);
      if (path === "inbox/zh-Hant/audio/x/cue-0002.mp3") return new Uint8Array([2]);
      return null;
    };
    const deck = await buildVoiceNotesDeck({
      deckName: "Voice",
      tags: ["tsumugu", "voice"],
      cues,
      binding,
      readBytes,
    });
    expect(deck.name).toBe("Voice");
    expect(deck.notes).toEqual([
      { front: "你好,", back: "Hi,<br>[sound:cue-0000.mp3]", tags: ["tsumugu", "voice"] },
      { front: "再見。", back: "Bye.<br>[sound:cue-0002.mp3]", tags: ["tsumugu", "voice"] },
    ]);
    expect(deck.media).toEqual([
      { filename: "cue-0000.mp3", bytes: new Uint8Array([1]) },
      { filename: "cue-0002.mp3", bytes: new Uint8Array([2]) },
    ]);
  });

  it("skips cues whose audio is unreadable (graceful degrade)", async () => {
    const readBytes = async (path: string): Promise<Uint8Array | null> =>
      path.endsWith("cue-0000.mp3") ? new Uint8Array([1]) : null;
    const deck = await buildVoiceNotesDeck({ deckName: "Voice", cues, binding, readBytes });
    expect(deck.notes.map((n) => n.front)).toEqual(["你好,"]);
    expect((deck.media ?? []).map((m) => m.filename)).toEqual(["cue-0000.mp3"]);
    // No tags option → no tags key.
    expect(deck.notes[0]!.tags).toBeUndefined();
  });
});
