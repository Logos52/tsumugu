import { describe, it, expect } from "vitest";
import type { BridgeInfo } from "../types.js";
import { BridgeRegistry, BRIDGE_SCHEMA } from "./index.js";

const phatTrien: BridgeInfo = {
  bridgeLang: "zh-Hant",
  etymon: "發展",
  bridgeReading: "phát triển",
  meaning: "to develop",
  confidence: 0.92,
  morphemes: [
    { surface: "phát", etymon: "發", reading: "fā", gloss: "emit" },
    { surface: "triển", etymon: "展", reading: "zhǎn", gloss: "unfold" },
  ],
};

const quocGia: BridgeInfo = {
  bridgeLang: "zh-Hant",
  etymon: "國家",
  bridgeReading: "quốc gia",
  meaning: "nation",
  morphemes: [
    { surface: "quốc", etymon: "國" },
    { surface: "gia", etymon: "家" },
  ],
};

describe("BridgeRegistry", () => {
  it("sets, gets, and reports presence", () => {
    const reg = new BridgeRegistry();
    expect(reg.has("vi", "phát triển")).toBe(false);
    expect(reg.get("vi", "phát triển")).toBeUndefined();

    reg.set("vi", "phát triển", phatTrien);
    expect(reg.has("vi", "phát triển")).toBe(true);
    expect(reg.get("vi", "phát triển")).toEqual(phatTrien);
  });

  it("keys (lang, word) unambiguously across the separator boundary", () => {
    // Regression for the composite key: a multi-word surface form must not
    // collide with a different (lang, word) split. ("vi a","b") vs ("vi","a b")
    // would collide under a naive space separator.
    const reg = new BridgeRegistry();
    reg.set("vi", "a b", quocGia);
    reg.set("vi a", "b", phatTrien);
    expect(reg.get("vi", "a b")).toEqual(quocGia);
    expect(reg.get("vi a", "b")).toEqual(phatTrien);
    expect(reg.size()).toBe(2);
    // Multi-word Vietnamese surface forms (which contain spaces) are distinct.
    reg.set("vi", "phát triển", phatTrien);
    reg.set("vi", "phát", quocGia);
    expect(reg.get("vi", "phát triển")).toEqual(phatTrien);
    expect(reg.get("vi", "phát")).toEqual(quocGia);
    expect(reg.size()).toBe(4);
  });

  it("size() and all() return zero/empty for an unknown language", () => {
    const reg = new BridgeRegistry();
    reg.set("vi", "phát triển", phatTrien);
    expect(reg.size("zz")).toBe(0);
    expect(reg.all("zz")).toEqual([]);
  });

  it("isolates entries by language (same word, different lang)", () => {
    const reg = new BridgeRegistry();
    reg.set("vi", "gia", quocGia);
    reg.set("ja", "gia", phatTrien);
    expect(reg.get("vi", "gia")).toEqual(quocGia);
    expect(reg.get("ja", "gia")).toEqual(phatTrien);
    expect(reg.size()).toBe(2);
    expect(reg.size("vi")).toBe(1);
  });

  it("set() overwrites and chains", () => {
    const reg = new BridgeRegistry();
    const ret = reg.set("vi", "x", phatTrien).set("vi", "x", quocGia);
    expect(ret).toBe(reg);
    expect(reg.get("vi", "x")).toEqual(quocGia);
    expect(reg.size()).toBe(1);
  });

  it("all() filters by language and returns copies", () => {
    const reg = new BridgeRegistry();
    reg.set("vi", "phát triển", phatTrien);
    reg.set("vi", "quốc gia", quocGia);
    reg.set("ja", "hatten", phatTrien);

    const allVi = reg.all("vi");
    expect(allVi.map((e) => e.word)).toEqual(["phát triển", "quốc gia"]);
    expect(reg.all()).toHaveLength(3);

    // Mutating a returned entry's top-level fields must not touch the registry.
    const first = allVi[0];
    expect(first).toBeDefined();
    if (first) first.word = "MUTATED";
    expect(reg.all("vi").map((e) => e.word)).toEqual([
      "phát triển",
      "quốc gia",
    ]);
  });

  it("all() preserves insertion order (deterministic)", () => {
    const reg = new BridgeRegistry();
    reg.set("vi", "c", quocGia);
    reg.set("vi", "a", quocGia);
    reg.set("vi", "b", quocGia);
    expect(reg.all().map((e) => e.word)).toEqual(["c", "a", "b"]);
  });

  it("markCorrected flips an existing entry to corrected:true", () => {
    const reg = new BridgeRegistry();
    reg.set("vi", "phát triển", phatTrien);
    expect(reg.get("vi", "phát triển")?.corrected).toBeUndefined();

    const ok = reg.markCorrected("vi", "phát triển");
    expect(ok).toBe(true);
    expect(reg.get("vi", "phát triển")?.corrected).toBe(true);
    // Other fields preserved.
    expect(reg.get("vi", "phát triển")?.etymon).toBe("發展");
  });

  it("markCorrected returns false for a missing entry without info", () => {
    const reg = new BridgeRegistry();
    expect(reg.markCorrected("vi", "absent")).toBe(false);
    expect(reg.has("vi", "absent")).toBe(false);
  });

  it("markCorrected with info replaces and forces corrected:true", () => {
    const reg = new BridgeRegistry();
    const replacement: BridgeInfo = {
      bridgeLang: "zh-Hant",
      etymon: "發展",
      meaning: "development (corrected)",
      corrected: false,
    };
    const ok = reg.markCorrected("vi", "phát triển", replacement);
    expect(ok).toBe(true);
    const got = reg.get("vi", "phát triển");
    expect(got?.meaning).toBe("development (corrected)");
    expect(got?.corrected).toBe(true);
    // The caller's object must NOT be mutated by the forced flag.
    expect(replacement.corrected).toBe(false);
  });

  it("markCorrected (flag-only) does not mutate the originally-set object", () => {
    const reg = new BridgeRegistry();
    const original: BridgeInfo = { bridgeLang: "zh-Hant", etymon: "發展" };
    reg.set("vi", "phát triển", original);
    reg.markCorrected("vi", "phát triển");
    expect(reg.get("vi", "phát triển")?.corrected).toBe(true);
    // The object the caller still holds is untouched.
    expect(original.corrected).toBeUndefined();
  });

  it("delete and clear", () => {
    const reg = new BridgeRegistry();
    reg.set("vi", "a", quocGia);
    reg.set("vi", "b", quocGia);
    expect(reg.delete("vi", "a")).toBe(true);
    expect(reg.delete("vi", "a")).toBe(false);
    expect(reg.size()).toBe(1);
    reg.clear();
    expect(reg.size()).toBe(0);
  });

  it("toDoc has the expected schema and entries", () => {
    const reg = new BridgeRegistry();
    reg.set("vi", "phát triển", phatTrien);
    const doc = reg.toDoc();
    expect(doc.schema).toBe(BRIDGE_SCHEMA);
    expect(doc.schema).toBe("tsumugu/bridge@1");
    expect(doc.entries).toEqual([
      { lang: "vi", word: "phát triển", info: phatTrien },
    ]);
  });

  it("round-trips through JSON losslessly", () => {
    const reg = new BridgeRegistry();
    reg.set("vi", "phát triển", phatTrien);
    reg.set("vi", "quốc gia", quocGia);
    reg.markCorrected("vi", "quốc gia");

    const text = reg.toJSON();
    // Persisted form must be plain JSON (no functions, no class instances).
    const parsed = JSON.parse(text) as unknown;
    expect(parsed).toEqual({
      schema: "tsumugu/bridge@1",
      entries: [
        { lang: "vi", word: "phát triển", info: phatTrien },
        { lang: "vi", word: "quốc gia", info: { ...quocGia, corrected: true } },
      ],
    });

    const restored = BridgeRegistry.fromJSON(text);
    expect(restored.get("vi", "phát triển")).toEqual(phatTrien);
    expect(restored.get("vi", "quốc gia")?.corrected).toBe(true);
    expect(restored.all()).toEqual(reg.all());
    // And the restored registry re-serializes identically.
    expect(restored.toJSON()).toBe(text);
  });

  it("fromDoc rejects an unexpected schema", () => {
    expect(() =>
      BridgeRegistry.fromDoc({
        schema: "tsumugu/bridge@999" as typeof BRIDGE_SCHEMA,
        entries: [],
      }),
    ).toThrow(/schema/);
  });

  it("fromJSON rejects non-object JSON", () => {
    expect(() => BridgeRegistry.fromJSON("42")).toThrow(/expected an object/);
    expect(() => BridgeRegistry.fromJSON("null")).toThrow(/expected an object/);
  });

  it("fromDoc skips malformed entries", () => {
    const doc = {
      schema: BRIDGE_SCHEMA,
      entries: [
        { lang: "vi", word: "ok", info: quocGia },
        { lang: "vi", word: 5, info: quocGia }, // bad word type
        { lang: "vi", info: quocGia }, // missing word
        { lang: "vi", word: "noinfo" }, // missing info
        null,
      ],
    } as unknown as Parameters<typeof BridgeRegistry.fromDoc>[0];
    const reg = BridgeRegistry.fromDoc(doc);
    expect(reg.size()).toBe(1);
    expect(reg.get("vi", "ok")).toEqual(quocGia);
  });

  it("fromDoc tolerates a missing entries array", () => {
    const reg = BridgeRegistry.fromDoc({
      schema: BRIDGE_SCHEMA,
    } as unknown as Parameters<typeof BridgeRegistry.fromDoc>[0]);
    expect(reg.size()).toBe(0);
  });
});
