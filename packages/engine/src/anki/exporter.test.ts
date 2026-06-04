import { describe, it, expect } from "vitest";
import initSqlJs from "sql.js";
import { unzipSync, strFromU8 } from "fflate";
import { buildApkg, ANKI_DEFAULT_NOW } from "./exporter.js";
import type { AnkiDeck } from "./exporter.js";

const DECK: AnkiDeck = {
  name: "Tsumugu::Test Deck",
  notes: [
    { front: "你好", back: "hello", tags: ["greeting", "lesson 1"] },
    { front: "再見", back: "goodbye" },
  ],
};

/** Count rows in a table of an exported collection.anki2 blob. */
function countRows(
  SQL: Awaited<ReturnType<typeof initSqlJs>>,
  bytes: Uint8Array,
  table: string,
): number {
  const db = new SQL.Database(bytes);
  try {
    const res = db.exec(`SELECT COUNT(*) FROM ${table}`);
    const first = res[0];
    const row = first?.values[0];
    const val = row?.[0];
    return typeof val === "number" ? val : Number(val);
  } finally {
    db.close();
  }
}

describe("buildApkg", () => {
  it("produces a zip with the expected Anki entries", async () => {
    const apkg = await buildApkg(DECK);
    expect(apkg).toBeInstanceOf(Uint8Array);
    expect(apkg.length).toBeGreaterThan(0);

    const unzipped = unzipSync(apkg);
    const keys = Object.keys(unzipped).sort();
    expect(keys).toContain("collection.anki2");
    expect(keys).toContain("media");

    // Media is an empty JSON map.
    const mediaEntry = unzipped["media"];
    expect(mediaEntry).toBeDefined();
    expect(strFromU8(mediaEntry as Uint8Array)).toBe("{}");
  });

  it("writes one collection row, two notes, and two cards", async () => {
    const apkg = await buildApkg(DECK);
    const unzipped = unzipSync(apkg);
    const collection = unzipped["collection.anki2"];
    expect(collection).toBeDefined();

    const SQL = await initSqlJs();
    const bytes = collection as Uint8Array;

    expect(countRows(SQL, bytes, "col")).toBe(1);
    expect(countRows(SQL, bytes, "notes")).toBe(2);
    expect(countRows(SQL, bytes, "cards")).toBe(2);
    expect(countRows(SQL, bytes, "revlog")).toBe(0);
    expect(countRows(SQL, bytes, "graves")).toBe(0);
  });

  it("stores fields, tags, deck name, and the Basic model", async () => {
    const apkg = await buildApkg(DECK);
    const unzipped = unzipSync(apkg);
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipped["collection.anki2"] as Uint8Array);
    try {
      // Notes: fields joined by 0x1f, tags space-wrapped with inner space → _.
      const notes = db.exec(
        "SELECT flds, tags, csum, guid FROM notes ORDER BY id",
      );
      const values = notes[0]?.values ?? [];
      expect(values.length).toBe(2);

      const firstFlds = values[0]?.[0] as string;
      expect(firstFlds).toBe("你好\x1fhello");
      const firstTags = values[0]?.[1] as string;
      expect(firstTags).toBe(" greeting lesson_1 ");
      const firstCsum = values[0]?.[2] as number;
      expect(Number.isInteger(firstCsum)).toBe(true);
      expect(firstCsum).toBeGreaterThan(0);
      const firstGuid = values[0]?.[3] as string;
      expect(firstGuid.length).toBeGreaterThan(0);

      // A note with no tags gets an empty tag string.
      const secondTags = values[1]?.[1] as string;
      expect(secondTags).toBe("");

      // col: deck name present, exactly one Basic model.
      const col = db.exec("SELECT decks, models FROM col");
      const decksJson = col[0]?.values[0]?.[0] as string;
      const modelsJson = col[0]?.values[0]?.[1] as string;
      expect(decksJson).toContain("Tsumugu::Test Deck");

      const models = JSON.parse(modelsJson) as Record<
        string,
        { name: string; flds: { name: string }[]; tmpls: unknown[] }
      >;
      const modelList = Object.values(models);
      expect(modelList.length).toBe(1);
      const model = modelList[0];
      expect(model?.name).toBe("Basic");
      expect(model?.flds.map((f) => f.name)).toEqual(["Front", "Back"]);
      expect(model?.tmpls.length).toBe(1);
    } finally {
      db.close();
    }
  });

  it("links each card to its note via the model + deck", async () => {
    const apkg = await buildApkg(DECK);
    const unzipped = unzipSync(apkg);
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipped["collection.anki2"] as Uint8Array);
    try {
      // Every card's nid must reference an existing note.
      const orphans = db.exec(
        "SELECT COUNT(*) FROM cards c LEFT JOIN notes n ON c.nid = n.id WHERE n.id IS NULL",
      );
      expect(orphans[0]?.values[0]?.[0]).toBe(0);

      // Every note's mid must equal the single model id in col.models.
      const col = db.exec("SELECT models FROM col");
      const models = JSON.parse(
        col[0]?.values[0]?.[0] as string,
      ) as Record<string, unknown>;
      const modelId = Number(Object.keys(models)[0]);
      const badMid = db.exec(
        `SELECT COUNT(*) FROM notes WHERE mid != ${modelId}`,
      );
      expect(badMid[0]?.values[0]?.[0]).toBe(0);
    } finally {
      db.close();
    }
  });

  it("is deterministic: same opts.now yields identical bytes", async () => {
    const a = await buildApkg(DECK, { now: ANKI_DEFAULT_NOW });
    const b = await buildApkg(DECK, { now: ANKI_DEFAULT_NOW });
    expect(a.length).toBe(b.length);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("uses ANKI_DEFAULT_NOW when no now is provided", async () => {
    const withDefault = await buildApkg(DECK);
    const explicit = await buildApkg(DECK, { now: ANKI_DEFAULT_NOW });
    expect(Buffer.from(withDefault).equals(Buffer.from(explicit))).toBe(true);
  });

  it("varies with a different now (distinct ids)", async () => {
    const a = await buildApkg(DECK, { now: ANKI_DEFAULT_NOW });
    const b = await buildApkg(DECK, { now: ANKI_DEFAULT_NOW + 5000 });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it("handles an empty deck (no notes/cards, valid archive)", async () => {
    const apkg = await buildApkg({ name: "Empty", notes: [] });
    const unzipped = unzipSync(apkg);
    expect(Object.keys(unzipped).sort()).toEqual(["collection.anki2", "media"]);

    const SQL = await initSqlJs();
    const bytes = unzipped["collection.anki2"] as Uint8Array;
    expect(countRows(SQL, bytes, "col")).toBe(1);
    expect(countRows(SQL, bytes, "notes")).toBe(0);
    expect(countRows(SQL, bytes, "cards")).toBe(0);
  });

  it("respects explicit deckId / modelId overrides", async () => {
    const apkg = await buildApkg(
      { name: "Override", notes: [{ front: "f", back: "b" }], deckId: 42, modelId: 99 },
      { now: ANKI_DEFAULT_NOW },
    );
    const unzipped = unzipSync(apkg);
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipped["collection.anki2"] as Uint8Array);
    try {
      const decks = JSON.parse(
        db.exec("SELECT decks FROM col")[0]?.values[0]?.[0] as string,
      ) as Record<string, { name: string }>;
      expect(decks["42"]?.name).toBe("Override");

      const models = JSON.parse(
        db.exec("SELECT models FROM col")[0]?.values[0]?.[0] as string,
      ) as Record<string, unknown>;
      expect(Object.keys(models)).toEqual(["99"]);

      const card = db.exec("SELECT did FROM cards");
      expect(card[0]?.values[0]?.[0]).toBe(42);
      const note = db.exec("SELECT mid FROM notes");
      expect(note[0]?.values[0]?.[0]).toBe(99);
    } finally {
      db.close();
    }
  });

  it("round-trips both fields and the back content, not just the front", async () => {
    const apkg = await buildApkg(DECK, { now: ANKI_DEFAULT_NOW });
    const unzipped = unzipSync(apkg);
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipped["collection.anki2"] as Uint8Array);
    try {
      const res = db.exec("SELECT flds, sfld FROM notes ORDER BY id");
      const rows = res[0]?.values ?? [];
      // Second note: "再見" / "goodbye".
      expect(rows[1]?.[0]).toBe("再見\x1fgoodbye");
      // sfld is the first field (sort field).
      expect(rows[1]?.[1]).toBe("再見");
      expect(rows[0]?.[1]).toBe("你好");
    } finally {
      db.close();
    }
  });

  it("writes valid JSON in every col config column", async () => {
    const apkg = await buildApkg(DECK, { now: ANKI_DEFAULT_NOW });
    const unzipped = unzipSync(apkg);
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipped["collection.anki2"] as Uint8Array);
    try {
      const res = db.exec(
        "SELECT conf, models, decks, dconf, tags, crt, mod FROM col",
      );
      const row = res[0]?.values[0];
      expect(row).toBeDefined();
      // conf / models / decks / dconf / tags must all be parseable JSON objects.
      for (let i = 0; i < 5; i++) {
        const json = row?.[i] as string;
        expect(() => JSON.parse(json)).not.toThrow();
        expect(typeof JSON.parse(json)).toBe("object");
      }
      // crt is the `now` anchor in SECONDS; mod is in ms.
      expect(row?.[5]).toBe(Math.floor(ANKI_DEFAULT_NOW / 1000));
      expect(row?.[6]).toBe(ANKI_DEFAULT_NOW);
      // decks always carries the Default deck (id 1) plus our deck.
      const decks = JSON.parse(row?.[2] as string) as Record<string, unknown>;
      expect(Object.keys(decks)).toContain("1");
    } finally {
      db.close();
    }
  });

  it("derives note/card/deck/model ids deterministically from now", async () => {
    const now = ANKI_DEFAULT_NOW;
    const apkg = await buildApkg(DECK, { now });
    const unzipped = unzipSync(apkg);
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipped["collection.anki2"] as Uint8Array);
    try {
      const noteIds = (db.exec("SELECT id FROM notes ORDER BY id")[0]?.values ??
        []).map((r) => r[0]);
      // now + i for each note index.
      expect(noteIds).toEqual([now, now + 1]);

      const cardIds = (db.exec("SELECT id FROM cards ORDER BY id")[0]?.values ??
        []).map((r) => r[0]);
      // now + 1_000_000 + i — disjoint from note ids.
      expect(cardIds).toEqual([now + 1_000_000, now + 1_000_001]);

      // Default deck/model ids derive from now (deck = now+1, model = now).
      const models = JSON.parse(
        db.exec("SELECT models FROM col")[0]?.values[0]?.[0] as string,
      ) as Record<string, unknown>;
      expect(Object.keys(models)).toEqual([String(now)]);

      const decks = JSON.parse(
        db.exec("SELECT decks FROM col")[0]?.values[0]?.[0] as string,
      ) as Record<string, unknown>;
      expect(Object.keys(decks).sort()).toEqual(["1", String(now + 1)].sort());
    } finally {
      db.close();
    }
  });

  it("gives identical notes the same guid and distinct notes different guids", async () => {
    const apkg = await buildApkg(
      {
        name: "Guids",
        notes: [
          { front: "x", back: "y" },
          { front: "x", back: "y" }, // identical → same guid
          { front: "x", back: "z" }, // different back → different guid
        ],
      },
      { now: ANKI_DEFAULT_NOW },
    );
    const unzipped = unzipSync(apkg);
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipped["collection.anki2"] as Uint8Array);
    try {
      const guids = (db.exec("SELECT guid FROM notes ORDER BY id")[0]?.values ??
        []).map((r) => r[0] as string);
      expect(guids.length).toBe(3);
      expect(guids[0]).toBe(guids[1]); // same front+back → same guid
      expect(guids[0]).not.toBe(guids[2]); // different back → different guid
      // guids are JSON/SQL-safe: no quote, backslash, or whitespace.
      for (const g of guids) {
        expect(g).toMatch(/^[^"\\\s]+$/);
        expect(g.length).toBeGreaterThan(0);
      }
    } finally {
      db.close();
    }
  });

  it("produces a non-negative integer csum for empty and unicode fronts", async () => {
    const apkg = await buildApkg(
      {
        name: "Csum",
        notes: [
          { front: "", back: "empty front" },
          { front: "你好世界", back: "hi" },
        ],
      },
      { now: ANKI_DEFAULT_NOW },
    );
    const unzipped = unzipSync(apkg);
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipped["collection.anki2"] as Uint8Array);
    try {
      const csums = (db.exec("SELECT csum FROM notes ORDER BY id")[0]?.values ??
        []).map((r) => r[0] as number);
      for (const c of csums) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
        // first-8-hex of sha1 < 2^32, always a safe integer.
        expect(c).toBeLessThanOrEqual(0xffffffff);
      }
    } finally {
      db.close();
    }
  });

  it("normalizes inner whitespace in tags to underscores", async () => {
    const apkg = await buildApkg(
      {
        name: "Tags",
        notes: [{ front: "f", back: "b", tags: ["multi word tag", "simple"] }],
      },
      { now: ANKI_DEFAULT_NOW },
    );
    const unzipped = unzipSync(apkg);
    const SQL = await initSqlJs();
    const db = new SQL.Database(unzipped["collection.anki2"] as Uint8Array);
    try {
      const tags = db.exec("SELECT tags FROM notes")[0]?.values[0]?.[0] as string;
      // Space-wrapped; inner spaces collapsed to underscores.
      expect(tags).toBe(" multi_word_tag simple ");
      // No token contains a raw inner space.
      for (const tok of tags.trim().split(" ").filter(Boolean)) {
        expect(tok).not.toContain(" ");
      }
    } finally {
      db.close();
    }
  });

  it("accepts a provided sqlWasm binary (browser-host path)", async () => {
    // Load the wasm the way a browser host would, then feed it back in.
    const { readFile } = await import("node:fs/promises");
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
    const wasm = await readFile(wasmPath);
    const wasmBytes = new Uint8Array(
      wasm.buffer,
      wasm.byteOffset,
      wasm.byteLength,
    );

    const apkg = await buildApkg(DECK, {
      now: ANKI_DEFAULT_NOW,
      sqlWasm: wasmBytes,
    });
    const unzipped = unzipSync(apkg);
    expect(Object.keys(unzipped)).toContain("collection.anki2");

    // Same output as the default node init path → deterministic across configs.
    const baseline = await buildApkg(DECK, { now: ANKI_DEFAULT_NOW });
    expect(Buffer.from(apkg).equals(Buffer.from(baseline))).toBe(true);
  });
});
