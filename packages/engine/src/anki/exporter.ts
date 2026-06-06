/**
 * Client-side Anki `.apkg` exporter (genanki-style), DOM-free and deterministic.
 *
 * Builds a standard Anki 2.1 collection database in-memory with sql.js@1.14.1,
 * inserts one Basic note + one card per {@link AnkiNote}, exports it as
 * `collection.anki2`, adds an empty `media` map, and zips both into a `.apkg`
 * Uint8Array via fflate's `zipSync`.
 *
 * Determinism (no `Math.random`, no `Date.now`):
 *   - All model/deck/note/card ids are derived from `opts.now` (a fixed epoch-ms
 *     default) plus the note index, so two builds with the same `opts.now`
 *     produce byte-identical output.
 *   - Note guids are a deterministic base91 hash of `front + "\x1f" + back`,
 *     mirroring genanki's `guid_for`.
 *   - Note `csum` is `int(sha1(sortField)[:8], 16)`, per the Anki schema.
 *
 * LIMITATION: This runs with no real Anki client available, so we cannot
 * verify an actual import here. The schema below follows the documented
 * genanki / Anki 2.1 layout faithfully and is validated STRUCTURALLY in tests
 * (zip entries present, row counts in col/notes/cards). Treat real-Anki import
 * as externally verified.
 *
 * No DOM, no fs, no network. The host supplies the wasm binary or `locateFile`
 * when running in a browser; node tests need neither.
 */

import initSqlJs from "sql.js";
import type { SqlJsConfig } from "sql.js";
import { zipSync, strToU8 } from "fflate";
import { sha1Hex } from "./sha1.js";

/** A single front/back flashcard. */
export interface AnkiNote {
  front: string;
  back: string;
  tags?: string[];
}

/**
 * A media file embedded in the `.apkg`. The caller provides the bytes (the
 * engine stays fs-free); a note field references it via `[sound:<filename>]`
 * (audio) or `<img src="<filename>">` (image). Order is significant: media is
 * numbered 0..n-1 in array order for reproducible archives.
 */
export interface AnkiMedia {
  filename: string;
  bytes: Uint8Array;
}

/** A named deck of notes, with optional fixed deck/model ids and media. */
export interface AnkiDeck {
  name: string;
  notes: AnkiNote[];
  /** Override the deterministic deck id. */
  deckId?: number;
  /** Override the deterministic model (note type) id. */
  modelId?: number;
  /** Media files to embed; referenced from note fields by `[sound:filename]`. */
  media?: AnkiMedia[];
}

/** Export tuning. All time-derived ids come from `now` for determinism. */
export interface AnkiExportOptions {
  /**
   * Epoch milliseconds used to derive ids. Defaults to a FIXED constant so
   * exports are reproducible unless the host opts into a real time.
   */
  now?: number;
  /** Pre-fetched sql.js wasm binary (browser host). */
  sqlWasm?: ArrayBuffer | Uint8Array;
  /** Resolver for sql.js asset URLs (browser host). */
  locateFile?: (file: string) => string;
}

/** Fixed default `now`: 2025-01-01T00:00:00Z. Keeps exports reproducible. */
export const ANKI_DEFAULT_NOW = 1735689600000;

/**
 * Fixed zip entry mtime (epoch ms) for reproducible archives. fflate encodes a
 * DOS timestamp that must fall in 1980-2099, so we use 1980-01-01T00:00:00Z.
 */
const ZIP_FIXED_MTIME = 315532800000;

// genanki's base91 alphabet (printable ASCII minus a few). Used for guids.
const BASE91_TABLE =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" +
  "!#$%&()*+,-./:;<=>?@[]^_`{|}~";

/**
 * Deterministic guid for a note, matching genanki's `guid_for`: base91 encode
 * a non-negative integer hash of the joined fields. We derive the hash from
 * the SHA-1 hex of the fields (first 13 hex chars → < 2^52, safe in a double).
 */
function guidFor(...fields: string[]): string {
  const hex = sha1Hex(fields.join("__")).slice(0, 13);
  let num = parseInt(hex, 16);
  if (!Number.isFinite(num) || num < 0) num = 0;
  // base91 of the integer (genanki encodes from least-significant digit).
  const rev: string[] = [];
  const base = BASE91_TABLE.length;
  if (num === 0) {
    rev.push(BASE91_TABLE[0] as string);
  }
  while (num > 0) {
    const rem = num % base;
    rev.push(BASE91_TABLE[rem] as string);
    num = Math.floor(num / base);
  }
  rev.reverse();
  return rev.join("");
}

/** Anki note checksum: first 8 hex of SHA-1(sortField) as an int. */
function fieldChecksum(sortField: string): number {
  return parseInt(sha1Hex(sortField).slice(0, 8), 16);
}

/** Join fields with the Anki field separator (0x1f). */
function joinFields(...fields: string[]): string {
  return fields.join("\x1f");
}

/** First field, truncated/normalized as Anki's sort field (we keep it simple). */
function sortField(front: string): string {
  return front;
}

/**
 * Build the `col.models` JSON for a single "Basic" note type with Front/Back
 * fields and one card template. Mirrors the standard genanki Basic model.
 */
function buildModelsJson(modelId: number, deckId: number): string {
  const model = {
    [modelId]: {
      id: modelId,
      name: "Basic",
      type: 0,
      mod: 0,
      usn: -1,
      sortf: 0,
      did: deckId,
      tmpls: [
        {
          name: "Card 1",
          ord: 0,
          qfmt: "{{Front}}",
          afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
          bqfmt: "",
          bafmt: "",
          did: null,
          bfont: "",
          bsize: 0,
        },
      ],
      flds: [
        {
          name: "Front",
          ord: 0,
          sticky: false,
          rtl: false,
          font: "Arial",
          size: 20,
          media: [],
        },
        {
          name: "Back",
          ord: 1,
          sticky: false,
          rtl: false,
          font: "Arial",
          size: 20,
          media: [],
        },
      ],
      css:
        ".card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n" +
        " color: black;\n background-color: white;\n}\n",
      latexPre:
        "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n" +
        "\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n" +
        "\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
      latexPost: "\\end{document}",
      latexsvg: false,
      req: [[0, "any", [0]]],
      vers: [],
      tags: [],
    },
  };
  return JSON.stringify(model);
}

/** Build the `col.decks` JSON: the default deck (1) plus our target deck. */
function buildDecksJson(deckId: number, deckName: string): string {
  const commonConf = {
    collapsed: false,
    browserCollapsed: false,
    newToday: [0, 0],
    revToday: [0, 0],
    lrnToday: [0, 0],
    timeToday: [0, 0],
    dyn: 0,
    extendNew: 0,
    extendRev: 0,
    conf: 1,
    usn: 0,
    mod: 0,
    desc: "",
  };
  const decks = {
    "1": {
      ...commonConf,
      id: 1,
      name: "Default",
    },
    [String(deckId)]: {
      ...commonConf,
      id: deckId,
      name: deckName,
    },
  };
  return JSON.stringify(decks);
}

/** Build the `col.dconf` JSON: a single default deck-options group. */
function buildDconfJson(): string {
  const dconf = {
    "1": {
      id: 1,
      mod: 0,
      name: "Default",
      usn: -1,
      maxTaken: 60,
      autoplay: true,
      timer: 0,
      replayq: true,
      new: {
        bury: false,
        delays: [1, 10],
        initialFactor: 2500,
        ints: [1, 4, 0],
        order: 1,
        perDay: 20,
      },
      rev: {
        bury: false,
        ease4: 1.3,
        ivlFct: 1,
        maxIvl: 36500,
        perDay: 200,
        hardFactor: 1.2,
      },
      lapse: {
        delays: [10],
        leechAction: 1,
        leechFails: 8,
        minInt: 1,
        mult: 0,
      },
      dyn: false,
    },
  };
  return JSON.stringify(dconf);
}

/** Default `col.conf` JSON. */
function buildConfJson(deckId: number): string {
  const conf = {
    nextPos: 1,
    estTimes: true,
    activeDecks: [1],
    sortType: "noteFld",
    timeLim: 0,
    sortBackwards: false,
    addToCur: true,
    curDeck: deckId,
    newSpread: 0,
    dueCounts: true,
    curModel: null,
    collapseTime: 1200,
  };
  return JSON.stringify(conf);
}

/** The canonical Anki 2.1 collection schema DDL (genanki/anki). */
const SCHEMA_SQL = `
CREATE TABLE col (
  id integer primary key,
  crt integer not null,
  mod integer not null,
  scm integer not null,
  ver integer not null,
  dty integer not null,
  usn integer not null,
  ls integer not null,
  conf text not null,
  models text not null,
  decks text not null,
  dconf text not null,
  tags text not null
);
CREATE TABLE notes (
  id integer primary key,
  guid text not null,
  mid integer not null,
  mod integer not null,
  usn integer not null,
  tags text not null,
  flds text not null,
  sfld integer not null,
  csum integer not null,
  flags integer not null,
  data text not null
);
CREATE TABLE cards (
  id integer primary key,
  nid integer not null,
  did integer not null,
  ord integer not null,
  mod integer not null,
  usn integer not null,
  type integer not null,
  queue integer not null,
  due integer not null,
  ivl integer not null,
  factor integer not null,
  reps integer not null,
  lapses integer not null,
  left integer not null,
  odue integer not null,
  odid integer not null,
  flags integer not null,
  data text not null
);
CREATE TABLE revlog (
  id integer primary key,
  cid integer not null,
  usn integer not null,
  ease integer not null,
  ivl integer not null,
  lastIvl integer not null,
  factor integer not null,
  time integer not null,
  type integer not null
);
CREATE TABLE graves (
  usn integer not null,
  oid integer not null,
  type integer not null
);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`;

/** Build the sql.js init config from export options (only when needed). */
function buildSqlConfig(opts?: AnkiExportOptions): SqlJsConfig | undefined {
  const cfg: SqlJsConfig = {};
  let any = false;
  if (opts?.locateFile) {
    cfg.locateFile = opts.locateFile;
    any = true;
  }
  if (opts?.sqlWasm) {
    // emscripten's `wasmBinary` is typed as ArrayBuffer; normalize a Uint8Array
    // (whose backing buffer may be Shared) into a fresh ArrayBuffer copy that
    // covers exactly its bytes. sql.js accepts an ArrayBuffer at runtime.
    if (opts.sqlWasm instanceof Uint8Array) {
      const copy = new ArrayBuffer(opts.sqlWasm.byteLength);
      new Uint8Array(copy).set(opts.sqlWasm);
      cfg.wasmBinary = copy;
    } else {
      cfg.wasmBinary = opts.sqlWasm;
    }
    any = true;
  }
  return any ? cfg : undefined;
}

/**
 * Build a `.apkg` archive (Uint8Array) for the given deck.
 *
 * Deterministic given `opts.now`: building twice with the same options yields
 * byte-identical output.
 */
export async function buildApkg(
  deck: AnkiDeck,
  opts?: AnkiExportOptions,
): Promise<Uint8Array> {
  const now = opts?.now ?? ANKI_DEFAULT_NOW;
  // Seconds and ms anchors derived purely from `now`.
  const nowSec = Math.floor(now / 1000);

  const config = buildSqlConfig(opts);
  const SQL = await initSqlJs(config);
  const db = new SQL.Database();

  try {
    db.run(SCHEMA_SQL);

    // Deterministic ids. Model/deck default off `now`; per-row ids off `now+i`.
    const modelId = deck.modelId ?? now;
    const deckId = deck.deckId ?? now + 1;

    db.run(
      `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
       VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)`,
      [
        nowSec,
        now,
        now,
        buildConfJson(deckId),
        buildModelsJson(modelId, deckId),
        buildDecksJson(deckId, deck.name),
        buildDconfJson(),
        "{}",
      ],
    );

    const insertNote = db.prepare(
      `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
       VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')`,
    );
    const insertCard = db.prepare(
      `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
       VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')`,
    );

    try {
      for (let i = 0; i < deck.notes.length; i++) {
        const note = deck.notes[i];
        if (!note) continue;
        const front = note.front;
        const back = note.back;
        const noteId = now + i;
        const cardId = now + 1_000_000 + i;
        // Anki tags: space-delimited, leading/trailing space, no inner spaces.
        const tagStr =
          note.tags && note.tags.length > 0
            ? " " + note.tags.map((t) => t.replace(/\s+/g, "_")).join(" ") + " "
            : "";
        const flds = joinFields(front, back);
        const sfld = sortField(front);
        const csum = fieldChecksum(sfld);
        const guid = guidFor(front, back);

        insertNote.run([
          noteId,
          guid,
          modelId,
          now,
          tagStr,
          flds,
          sfld,
          csum,
        ]);
        // due = note position; use 1-based index to mirror nextPos growth.
        insertCard.run([cardId, noteId, deckId, now, i + 1]);
      }
    } finally {
      insertNote.free();
      insertCard.free();
    }

    const collectionBytes = db.export();

    const archive: Record<string, Uint8Array> = {
      "collection.anki2": collectionBytes,
    };
    // Media map: numeric index → filename. Bytes are stored under the numeric
    // name (genanki layout); a note field references the file via [sound:name].
    // Order is the caller's array order, so archives stay reproducible. With no
    // media this stays the empty `{}` map and the archive is byte-identical to
    // the media-free exports.
    const media = deck.media ?? [];
    const mediaMap: Record<string, string> = {};
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      if (!m) continue;
      mediaMap[String(i)] = m.filename;
      archive[String(i)] = m.bytes;
    }
    archive["media"] = strToU8(JSON.stringify(mediaMap));

    // Fixed mtime + no compression so the zip bytes are reproducible. fflate's
    // DOS timestamp must be in 1980-2099, so we anchor to a fixed in-range date
    // (1980-01-01T00:00:00Z) rather than the Unix epoch.
    return zipSync(archive, { level: 0, mtime: ZIP_FIXED_MTIME });
  } finally {
    db.close();
  }
}
