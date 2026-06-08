import { describe, it, expect } from "vitest";
import { WordStore, BridgeRegistry, type WordEntry, type DictEntry } from "@tsumugu/engine";
import { buildWikiPage, buildEncodingPage, wikiInputFromStore } from "./wiki.js";
import { cacheBridges, knownHanziFromStore } from "./bridge.js";
import { importExternal, reconcileAgainstStore, applyToStore } from "./crossref.js";

describe("wiki builders", () => {
  it("buildWikiPage emits frontmatter + sections + related wikilinks", () => {
    const md = buildWikiPage({
      term: "夜市",
      lang: "zh-Hant",
      status: "l2",
      reading: "yè shì",
      pos: "noun",
      level: "TOCFL-A2",
      related: ["小吃", "熱鬧"],
      examples: ["今晚我們去夜市。"],
    });
    expect(md).toMatch(/^---\n/);
    expect(md).toContain("term: 夜市");
    expect(md).toContain("status: l2");
    expect(md).toContain("lang: zh-Hant");
    expect(md).toContain("## Meaning");
    expect(md).toContain("## Character / etymology breakdown");
    expect(md).toContain("- [[小吃]]");
    expect(md).toContain("- 今晚我們去夜市。");
  });

  it("buildEncodingPage marks type: encoding, embeds the flag note, tags encoding", () => {
    const md = buildEncodingPage({
      term: "熱鬧",
      lang: "zh-Hant",
      status: "l1",
      flagNote: "keep confusing it with 鬧鐘",
      tags: ["topic/atmosphere"],
    });
    expect(md).toContain("type: encoding");
    expect(md).toContain("熱鬧 — encoding-layer page");
    expect(md).toContain("keep confusing it with 鬧鐘");
    expect(md).toMatch(/tags: \[.*encoding.*\]/);
  });

  it("wikiInputFromStore derives from a store entry + dict", () => {
    const entry: WordEntry = {
      lang: "zh-Hant",
      word: "夜市",
      status: "l2",
      firstSeen: "2026-06-01T10:00:00Z",
      related: [{ lang: "vi", word: "chợ đêm" }],
    };
    const dict: DictEntry = { term: "夜市", gloss: "night market", reading: "yè shì", source: "packaged" };
    const input = wikiInputFromStore(entry, dict, ["今晚去夜市。"]);
    expect(input.reading).toBe("yè shì");
    expect(input.meaning).toBe("night market");
    expect(input.firstSeen).toBe("2026-06-01");
    expect(input.related).toEqual(["chợ đêm"]);
    expect(input.examples).toEqual(["今晚去夜市。"]);
  });
});

describe("bridge cache + cross-seed", () => {
  it("caches agent bridge records and reports words unlocked by known Hanzi", () => {
    const store = new WordStore();
    store.setStatus("zh-Hant", "發展", "known"); // → known Hanzi 發, 展
    const knownEtyma = knownHanziFromStore(store, "zh-Hant");
    expect(knownEtyma.has("發")).toBe(true);
    expect(knownEtyma.has("展")).toBe(true);

    const registry = new BridgeRegistry();
    const res = cacheBridges(
      registry,
      "vi",
      [
        {
          word: "phát triển",
          info: {
            bridgeLang: "zh-Hant",
            etymon: "發展",
            morphemes: [
              { surface: "phát", etymon: "發" },
              { surface: "triển", etymon: "展" },
            ],
          },
        },
      ],
      knownEtyma,
    );
    expect(res.added).toBe(1);
    expect(res.crossSeed.seededCount).toBe(1);
    expect(res.crossSeed.seeded[0]?.word).toBe("phát triển");
    expect(registry.has("vi", "phát triển")).toBe(true);
  });
});

describe("crossref import + reconcile + apply", () => {
  const srs = {
    words: [
      { word: "夜市", lang: "zh-Hant", status: "KNOWN" },
      { word: "熱鬧", language: "zh-Hant", known: "LEARNING" },
      { word: "小吃", lang: "zh-Hant" }, // no status
    ],
  };

  it("parses SRS JSON and reconciles against the store", () => {
    const records = importExternal("srs", srs);
    expect(records).toHaveLength(3);
    expect(records.find((r) => r.word === "夜市")?.status).toBe("known");

    const store = new WordStore();
    store.setStatus("zh-Hant", "夜市", "l2"); // disagrees with external "known"
    const report = reconcileAgainstStore("zh-Hant", store, records);
    expect(report.conflicts.map((c) => c.word)).toContain("夜市");
    expect(report.missingFromStore.map((c) => c.word).sort()).toEqual(["小吃", "熱鬧"]);
  });

  it("seeds missing words and preserves an explicit local grade (no external clock)", () => {
    const records = importExternal("srs", srs);
    const store = new WordStore();
    store.setStatus("zh-Hant", "夜市", "l2"); // explicit local grade

    const r1 = applyToStore(store, "zh-Hant", records, {});
    expect(r1.imported).toBe(1); // 熱鬧 seeded (小吃 has no status → skipped)
    expect(store.getStatus("zh-Hant", "熱鬧")).toBe("l3"); // LEARNING → l3
    // 夜市: external "known" cannot override a more-specific local grade with no
    // timestamp evidence it is newer. Tsumugu is canonical.
    expect(store.getStatus("zh-Hant", "夜市")).toBe("l2");
    expect(r1.changed).toBe(0);
    expect(r1.kept).toBe(1);
  });

  it("never silently demotes a locally-known word, even under overwrite", () => {
    const lower = { words: [{ word: "夜市", lang: "zh-Hant", status: "LEARNING" }] };
    const records = importExternal("srs", lower);
    const store = new WordStore();
    store.setStatus("zh-Hant", "夜市", "known"); // user graded it up

    const r1 = applyToStore(store, "zh-Hant", records, {}); // never-demote
    expect(store.getStatus("zh-Hant", "夜市")).toBe("known");
    expect(r1.demotionsBlocked).toBe(1);

    // Even the legacy --overwrite (→ newest-wins) won't demote without a clock.
    const r2 = applyToStore(store, "zh-Hant", records, { overwriteConflicts: true });
    expect(store.getStatus("zh-Hant", "夜市")).toBe("known");
    expect(r2.changed).toBe(0);
  });

  it("lets a strictly-newer external change win (clock-aware)", () => {
    const clockAt = (iso: string) => ({ now: () => new Date(iso) });
    const store = new WordStore();
    // Old local grade…
    store.setStatus("zh-Hant", "夜市", "l2", clockAt("2020-01-01T00:00:00.000Z"));
    // …and a newer SRS change (its `mod` epoch passes through record.raw).
    const newer = {
      words: [
        { word: "夜市", lang: "zh-Hant", status: "KNOWN", mod: Date.parse("2025-01-01T00:00:00.000Z") },
      ],
    };
    const records = importExternal("srs", newer);
    const res = applyToStore(store, "zh-Hant", records, {}); // never-demote (a promote here)
    expect(store.getStatus("zh-Hant", "夜市")).toBe("known");
    expect(res.changed).toBe(1);
    const e = store.get("zh-Hant", "夜市");
    expect(e?.statusSource).toBe("srs");
    expect(e?.statusUpdatedAt).toBe("2025-01-01T00:00:00.000Z"); // dated by the SRS's mod
  });
});
