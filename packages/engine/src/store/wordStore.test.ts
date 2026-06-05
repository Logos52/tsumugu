import { describe, it, expect } from "vitest";
import { WordStore, progressMetrics } from "./index.js";
import type { Clock } from "../ports.js";
import type { VaultIO } from "../ports.js";
import type { SrsState, WordEntry } from "../types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** A clock that returns a fixed instant, mutable between calls. */
function fixedClock(iso: string): Clock & { set(iso: string): void } {
  let current = new Date(iso);
  return {
    now: () => current,
    set: (next: string) => {
      current = new Date(next);
    },
  };
}

/** A minimal in-memory VaultIO for persistence tests. */
function memVault(seed: Record<string, string> = {}): VaultIO & {
  files: Map<string, string>;
} {
  const files = new Map<string, string>(Object.entries(seed));
  return {
    files,
    async readText(path: string): Promise<string | null> {
      return files.has(path) ? (files.get(path) as string) : null;
    },
    async writeText(path: string, data: string): Promise<void> {
      files.set(path, data);
    },
  };
}

const T0 = "2026-01-01T00:00:00.000Z";
const T1 = "2026-02-02T10:30:00.000Z";

// ── Reads & defaults ─────────────────────────────────────────────────────────

describe("WordStore reads & defaults", () => {
  it("getStatus returns 'new' for untracked words", () => {
    const s = new WordStore();
    expect(s.getStatus("zh", "你好")).toBe("new");
    expect(s.get("zh", "你好")).toBeUndefined();
    expect(s.has("zh", "你好")).toBe(false);
  });

  it("all() and size() filter by language", () => {
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "貓", status: "l2" });
    s.upsert({ lang: "zh", word: "狗", status: "new" });
    s.upsert({ lang: "vi", word: "mèo", status: "l1" });

    expect(s.size()).toBe(3);
    expect(s.size("zh")).toBe(2);
    expect(s.size("vi")).toBe(1);
    expect(s.all("zh").map((e) => e.word)).toEqual(["貓", "狗"]);
    expect(s.all().length).toBe(3);
  });

  it("distinguishes same word across languages", () => {
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "中", status: "known" });
    s.upsert({ lang: "ja", word: "中", status: "l1" });
    expect(s.getStatus("zh", "中")).toBe("known");
    expect(s.getStatus("ja", "中")).toBe("l1");
  });

  it("keys words that contain spaces distinctly", () => {
    // The NUL separator avoids collisions a space separator would cause.
    const s = new WordStore();
    s.upsert({ lang: "en", word: "ice cream", status: "l1" });
    s.upsert({ lang: "en", word: "ice", status: "l3" });
    expect(s.getStatus("en", "ice cream")).toBe("l1");
    expect(s.getStatus("en", "ice")).toBe("l3");
  });
});

// ── recordSeen ───────────────────────────────────────────────────────────────

describe("recordSeen", () => {
  it("creates a new entry with firstSeen/lastSeen and seenCount 1", () => {
    const s = new WordStore();
    const clock = fixedClock(T0);
    const e = s.recordSeen("zh", "山", clock);
    expect(e.status).toBe("new");
    expect(e.firstSeen).toBe(T0);
    expect(e.lastSeen).toBe(T0);
    expect(e.seenCount).toBe(1);
  });

  it("keeps firstSeen but advances lastSeen and increments seenCount", () => {
    const s = new WordStore();
    const clock = fixedClock(T0);
    s.recordSeen("zh", "山", clock);
    clock.set(T1);
    const e = s.recordSeen("zh", "山", clock);
    expect(e.firstSeen).toBe(T0);
    expect(e.lastSeen).toBe(T1);
    expect(e.seenCount).toBe(2);
  });

  it("does not downgrade an existing status", () => {
    const s = new WordStore();
    s.setStatus("zh", "水", "l3", fixedClock(T0));
    const e = s.recordSeen("zh", "水", fixedClock(T1));
    expect(e.status).toBe("l3");
    expect(e.seenCount).toBe(1);
  });

  it("defaults to systemClock when no clock passed (smoke)", () => {
    const s = new WordStore();
    const before = Date.now();
    const e = s.recordSeen("zh", "火");
    const after = Date.now();
    expect(e.firstSeen).toBeDefined();
    const t = new Date(e.firstSeen as string).getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });

  it("preserves custom/srs/related on an already-tracked entry", () => {
    const s = new WordStore();
    s.setCustom("zh", "山", { gloss: "mountain" });
    s.link({ lang: "zh", word: "山" }, { lang: "vi", word: "sơn" });
    const e = s.recordSeen("zh", "山", fixedClock(T0));
    expect(e.custom).toEqual({ gloss: "mountain" });
    expect(e.related).toEqual([{ lang: "vi", word: "sơn" }]);
    expect(e.seenCount).toBe(1);
  });
});

// ── setStatus / flag / unflag ────────────────────────────────────────────────

describe("setStatus, flag, unflag", () => {
  it("setStatus creates-or-updates and stamps lastSeen", () => {
    const s = new WordStore();
    const e = s.setStatus("zh", "天", "known", fixedClock(T1));
    expect(e.status).toBe("known");
    expect(e.lastSeen).toBe(T1);
  });

  it("flag sets flagged and optional note; unflag clears both", () => {
    const s = new WordStore();
    const flagged = s.flag("zh", "難", "ambiguous reading");
    expect(flagged.flagged).toBe(true);
    expect(flagged.flagNote).toBe("ambiguous reading");

    const cleared = s.unflag("zh", "難");
    expect(cleared.flagged).toBe(false);
    expect(cleared.flagNote).toBeUndefined();
    expect("flagNote" in cleared).toBe(false);
  });

  it("flag without a note leaves flagNote unset", () => {
    const s = new WordStore();
    const e = s.flag("zh", "雨");
    expect(e.flagged).toBe(true);
    expect("flagNote" in e).toBe(false);
  });

  it("flagged() filters by language", () => {
    const s = new WordStore();
    s.flag("zh", "甲");
    s.flag("zh", "乙");
    s.flag("vi", "alpha");
    expect(s.flagged("zh").map((e) => e.word)).toEqual(["甲", "乙"]);
    expect(s.flagged().length).toBe(3);
    expect(s.flagged("vi").length).toBe(1);
  });
});

// ── setCustom / setSrs ───────────────────────────────────────────────────────

describe("setCustom and setSrs", () => {
  it("setCustom merges custom fields cumulatively", () => {
    const s = new WordStore();
    s.setCustom("zh", "橋", { gloss: "bridge" });
    const e = s.setCustom("zh", "橋", { reading: "qiáo" });
    expect(e.custom).toEqual({ gloss: "bridge", reading: "qiáo" });
  });

  it("setCustom overrides an existing key", () => {
    const s = new WordStore();
    s.setCustom("zh", "橋", { gloss: "bridge", source: "custom" });
    const e = s.setCustom("zh", "橋", { gloss: "footbridge" });
    expect(e.custom?.gloss).toBe("footbridge");
    expect(e.custom?.source).toBe("custom");
  });

  it("setCustom with an empty partial leaves prior custom intact", () => {
    const s = new WordStore();
    s.setCustom("zh", "橋", { gloss: "bridge" });
    const e = s.setCustom("zh", "橋", {});
    expect(e.custom).toEqual({ gloss: "bridge" });
  });

  it("setCustom on a fresh word creates a 'new' entry", () => {
    const s = new WordStore();
    const e = s.setCustom("zh", "新", { gloss: "new" });
    expect(e.status).toBe("new");
    expect(e.custom).toEqual({ gloss: "new" });
  });

  it("setSrs replaces the srs state", () => {
    const s = new WordStore();
    const srs: SrsState = {
      due: T1,
      stability: 4.2,
      difficulty: 6.1,
      elapsedDays: 0,
      scheduledDays: 3,
      reps: 1,
      lapses: 0,
      state: 1,
    };
    const e = s.setSrs("zh", "記", srs);
    expect(e.srs).toEqual(srs);
  });
});

// ── link ─────────────────────────────────────────────────────────────────────

describe("link (cross-language related)", () => {
  it("adds the relation to both entries", () => {
    const s = new WordStore();
    s.link({ lang: "vi", word: "phát triển" }, { lang: "zh", word: "發展" });
    const vi = s.get("vi", "phát triển");
    const zh = s.get("zh", "發展");
    expect(vi?.related).toEqual([{ lang: "zh", word: "發展" }]);
    expect(zh?.related).toEqual([{ lang: "vi", word: "phát triển" }]);
  });

  it("is idempotent (no duplicate relations)", () => {
    const s = new WordStore();
    const a = { lang: "vi", word: "phát triển" };
    const b = { lang: "zh", word: "發展" };
    s.link(a, b);
    s.link(a, b);
    s.link(b, a);
    expect(s.get("vi", "phát triển")?.related?.length).toBe(1);
    expect(s.get("zh", "發展")?.related?.length).toBe(1);
  });

  it("preserves existing entry state and appends multiple relations", () => {
    const s = new WordStore();
    s.setStatus("vi", "x", "l2", fixedClock(T0));
    s.link({ lang: "vi", word: "x" }, { lang: "zh", word: "甲" });
    s.link({ lang: "vi", word: "x" }, { lang: "ja", word: "乙" });
    const x = s.get("vi", "x");
    expect(x?.status).toBe("l2");
    expect(x?.related).toEqual([
      { lang: "zh", word: "甲" },
      { lang: "ja", word: "乙" },
    ]);
  });

  it("stores a copy of the ref, not the caller's object", () => {
    // Mutating the ref the caller passed must not corrupt stored related[].
    const s = new WordStore();
    const b = { lang: "zh", word: "發展" };
    s.link({ lang: "vi", word: "phát triển" }, b);
    b.word = "MUTATED";
    expect(s.get("vi", "phát triển")?.related).toEqual([
      { lang: "zh", word: "發展" },
    ]);
  });

  it("links a word to itself idempotently (single self-relation)", () => {
    const s = new WordStore();
    const self = { lang: "zh", word: "中" };
    s.link(self, self);
    s.link(self, self);
    // Both addRelated calls target the same entry with the same ref, so the
    // second is deduped; a single self-relation remains.
    expect(s.get("zh", "中")?.related).toEqual([{ lang: "zh", word: "中" }]);
  });

  it("does not clobber custom/srs/related already on a linked entry", () => {
    const s = new WordStore();
    s.setCustom("vi", "x", { gloss: "keep me" });
    s.link({ lang: "vi", word: "x" }, { lang: "zh", word: "甲" });
    expect(s.get("vi", "x")?.custom).toEqual({ gloss: "keep me" });
  });
});

// ── upsert / remove ──────────────────────────────────────────────────────────

describe("upsert and remove", () => {
  it("upsert replaces an existing entry", () => {
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "風", status: "l1" });
    s.upsert({ lang: "zh", word: "風", status: "known", seenCount: 9 });
    const e = s.get("zh", "風");
    expect(e?.status).toBe("known");
    expect(e?.seenCount).toBe(9);
    expect(s.size("zh")).toBe(1);
  });

  it("remove deletes and reports presence", () => {
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "去", status: "new" });
    expect(s.remove("zh", "去")).toBe(true);
    expect(s.remove("zh", "去")).toBe(false);
    expect(s.has("zh", "去")).toBe(false);
  });

  it("getStatus reverts to 'new' after remove", () => {
    const s = new WordStore();
    s.setStatus("zh", "去", "known", fixedClock(T0));
    expect(s.getStatus("zh", "去")).toBe("known");
    s.remove("zh", "去");
    expect(s.getStatus("zh", "去")).toBe("new");
    expect(s.get("zh", "去")).toBeUndefined();
  });
});

// ── Serialization & round-trip ───────────────────────────────────────────────

describe("serialization", () => {
  it("toDoc carries the schema and an ISO updatedAt", () => {
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "雲", status: "l4" });
    const doc = s.toDoc(fixedClock(T1));
    expect(doc.schema).toBe("tsumugu/word-store@2");
    expect(doc.updatedAt).toBe(T1);
    expect(doc.entries).toHaveLength(1);
  });

  it("round-trips through toJSON → fromJSON with deep-equal entries", () => {
    const s = new WordStore();
    const clock = fixedClock(T0);
    s.recordSeen("zh", "發展", clock);
    s.setStatus("zh", "發展", "l3", clock);
    s.setCustom("zh", "發展", { gloss: "develop", reading: "fā zhǎn" });
    s.setSrs("zh", "發展", {
      due: T1,
      stability: 2,
      difficulty: 5,
      elapsedDays: 1,
      scheduledDays: 2,
      reps: 3,
      lapses: 1,
      state: 2,
      lastReview: T0,
    });
    s.flag("zh", "發展", "check tone");
    s.link({ lang: "zh", word: "發展" }, { lang: "vi", word: "phát triển" });
    s.recordSeen("vi", "phát triển", clock);

    const json = s.toJSON(clock);
    const restored = WordStore.fromJSON(json);

    // Entry-level deep equality, order-independent.
    const sortByKey = (a: WordEntry, b: WordEntry) =>
      `${a.lang}/${a.word}`.localeCompare(`${b.lang}/${b.word}`);
    expect([...restored.all()].sort(sortByKey)).toEqual(
      [...s.all()].sort(sortByKey),
    );

    // Spot-check a restored entry is fully intact.
    const e = restored.get("zh", "發展");
    expect(e).toEqual(s.get("zh", "發展"));
    expect(e?.related).toEqual([{ lang: "vi", word: "phát triển" }]);
  });

  it("fromDoc tolerates a missing entries array and malformed rows", () => {
    const restored = WordStore.fromDoc({
      schema: "tsumugu/word-store@1",
      // @ts-expect-error — intentionally exercising defensive runtime path
      entries: undefined,
    });
    expect(restored.all()).toEqual([]);

    const restored2 = WordStore.fromDoc({
      schema: "tsumugu/word-store@1",
      entries: [
        { lang: "zh", word: "好", status: "l1" },
        // @ts-expect-error — malformed row, missing word
        { lang: "zh", status: "l1" },
      ],
    });
    expect(restored2.all().map((e) => e.word)).toEqual(["好"]);
  });

  it("produces JSON-serializable output (no functions/undefined cycles)", () => {
    const s = new WordStore();
    s.recordSeen("zh", "test", fixedClock(T0));
    const json = s.toJSON(fixedClock(T0));
    const parsed = JSON.parse(json) as unknown;
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
  });

  it("re-serialization is stable at a fixed clock (entries unchanged)", () => {
    const s = new WordStore();
    s.upsert({
      lang: "zh",
      word: "穩",
      status: "ignored",
      flagged: true,
      flagNote: "proper noun",
      tags: ["name"],
      notes: "stable check",
    });
    const clock = fixedClock(T1);
    const first = s.toJSON(clock);
    const restored = WordStore.fromJSON(first);
    const second = restored.toJSON(clock);
    expect(second).toBe(first);
  });

  it("toDoc entries reflect live store contents", () => {
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "一", status: "l1" });
    s.upsert({ lang: "vi", word: "một", status: "l2" });
    const doc = s.toDoc(fixedClock(T0));
    expect(doc.entries.map((e) => e.word)).toEqual(["一", "một"]);
  });

  it("fromJSON of an empty store yields an empty store", () => {
    const empty = new WordStore();
    const restored = WordStore.fromJSON(empty.toJSON(fixedClock(T0)));
    expect(restored.all()).toEqual([]);
    expect(restored.size()).toBe(0);
  });
});

// ── Persistence via VaultIO ──────────────────────────────────────────────────

describe("load / save via VaultIO", () => {
  it("save writes toJSON to the given path", async () => {
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "書", status: "l2" });
    const io = memVault();
    await s.save(io, "store.json", fixedClock(T1));
    const written = io.files.get("store.json");
    expect(written).toBeDefined();
    const parsed = JSON.parse(written as string) as { updatedAt: string };
    expect(parsed.updatedAt).toBe(T1);
  });

  it("load reads and replaces store contents", async () => {
    const seed = new WordStore();
    seed.upsert({ lang: "zh", word: "讀", status: "l4" });
    const io = memVault({ "store.json": seed.toJSON(fixedClock(T0)) });

    const s = new WordStore();
    s.upsert({ lang: "zh", word: "stale", status: "new" }); // should be cleared
    await s.load(io, "store.json");

    expect(s.has("zh", "stale")).toBe(false);
    expect(s.getStatus("zh", "讀")).toBe("l4");
  });

  it("load on a missing file leaves the store empty (no throw)", async () => {
    const io = memVault();
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "x", status: "l1" });
    await s.load(io, "does-not-exist.json");
    expect(s.all()).toEqual([]);
  });

  it("save → load round-trips through the vault", async () => {
    const io = memVault();
    const a = new WordStore();
    a.recordSeen("zh", "海", fixedClock(T0));
    a.setStatus("zh", "海", "known", fixedClock(T0));
    await a.save(io, "vault/words.json", fixedClock(T0));

    const b = new WordStore();
    await b.load(io, "vault/words.json");
    expect(b.get("zh", "海")).toEqual(a.get("zh", "海"));
  });
});

// ── progressMetrics ──────────────────────────────────────────────────────────

describe("progressMetrics", () => {
  it("tallies byStatus, knownCount, trackedCount, flaggedCount", () => {
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "a", status: "new" });
    s.upsert({ lang: "zh", word: "b", status: "l1" });
    s.upsert({ lang: "zh", word: "c", status: "l4" }); // known
    s.upsert({ lang: "zh", word: "d", status: "known" }); // known
    s.upsert({ lang: "zh", word: "e", status: "ignored" }); // known
    s.upsert({ lang: "zh", word: "f", status: "l2", flagged: true });
    s.upsert({ lang: "vi", word: "z", status: "known" }); // other lang

    const m = progressMetrics(s, "zh");
    expect(m.lang).toBe("zh");
    expect(m.trackedCount).toBe(6);
    expect(m.knownCount).toBe(3); // l4 + known + ignored
    expect(m.flaggedCount).toBe(1);
    expect(m.byStatus).toEqual({
      new: 1,
      l1: 1,
      l2: 1,
      l3: 0,
      l4: 1,
      known: 1,
      ignored: 1,
    });
  });

  it("counts l3 as tracked-but-not-known and ignores other languages", () => {
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "g", status: "l3" });
    s.upsert({ lang: "vi", word: "g", status: "known", flagged: true });
    const m = progressMetrics(s, "zh");
    expect(m.trackedCount).toBe(1);
    expect(m.knownCount).toBe(0); // l3 is not in the known set
    expect(m.flaggedCount).toBe(0); // the flagged 'vi' word is excluded
    expect(m.byStatus.l3).toBe(1);
    expect(m.byStatus.known).toBe(0);
  });

  it("does not expose dueCount (left undefined per spec)", () => {
    const s = new WordStore();
    s.upsert({ lang: "zh", word: "h", status: "l1" });
    const m = progressMetrics(s, "zh");
    expect(m.dueCount).toBeUndefined();
  });

  it("returns a fully-zeroed byStatus for an unknown language", () => {
    const s = new WordStore();
    const m = progressMetrics(s, "ko");
    expect(m.trackedCount).toBe(0);
    expect(m.knownCount).toBe(0);
    expect(m.flaggedCount).toBe(0);
    expect(m.byStatus).toEqual({
      new: 0,
      l1: 0,
      l2: 0,
      l3: 0,
      l4: 0,
      known: 0,
      ignored: 0,
    });
  });
});
