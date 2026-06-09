import { describe, it, expect } from "vitest";
import initSqlJs from "sql.js";
import { unzipSync } from "fflate";
import {
  ENCODING_PAGE_SCHEMA,
  buildApkg,
  guidFor,
  type EncodingPageDoc,
} from "@tsumugu/engine";
import {
  buildEncodingDeck,
  buildEncodingNote,
  encodingGuidSeed,
  firstAcceptedExample,
} from "./encodingDeck.js";

function makeDoc(over: Partial<EncodingPageDoc> = {}): EncodingPageDoc {
  return {
    schema: ENCODING_PAGE_SCHEMA,
    lang: "zh-Hant",
    term: "熱鬧",
    reading: { zhuyin: "ㄖㄜˋ ㄋㄠˋ", pinyin: "rènào" },
    definitions: {
      en: { gloss: "lively and noisy" },
      zh: { gloss: "人多、又吵又有活力", leveledVerdict: "leveled" },
    },
    examples: [
      { text: "週末的夜市總是很熱鬧。", translation: "The weekend night market is always lively." },
      { text: "過年的時候，街上又熱鬧又開心。", translation: "During New Year, the streets are lively." },
    ],
    audio: "zh-Hant/encoding/熱鬧/term.mp3",
    ...over,
  };
}

describe("firstAcceptedExample", () => {
  it("returns the first row with text and translation", () => {
    const ex = firstAcceptedExample(makeDoc().examples);
    expect(ex?.text).toBe("週末的夜市總是很熱鬧。");
  });

  it("skips rows missing a translation", () => {
    const ex = firstAcceptedExample([
      { text: "沒有翻譯。", translation: "" },
      { text: "有翻譯。", translation: "has translation" },
    ]);
    expect(ex?.text).toBe("有翻譯。");
  });
});

describe("buildEncodingNote", () => {
  it("uses the first accepted sentence on the front and gloss + reading on the back", () => {
    const note = buildEncodingNote({ doc: makeDoc(), lang: "zh-Hant" })!;
    expect(note.front).toBe("週末的夜市總是很熱鬧。");
    expect(note.back).toContain("lively and noisy");
    expect(note.back).toContain("ㄖㄜˋ ㄋㄠˋ · rènào");
    expect(note.back).toContain("[sound:term.mp3]");
    expect(note.tags).toEqual(["tsumugu", "zh-Hant", "encoding"]);
    expect(note.guidSeed).toBe(encodingGuidSeed("zh-Hant", "熱鬧"));
  });

  it("keeps the same guid seed when the example sentence changes", () => {
    const a = buildEncodingNote({ doc: makeDoc(), lang: "zh-Hant" });
    const b = buildEncodingNote({
      doc: makeDoc({
        examples: [
          { text: "這家餐廳每天都很熱鬧。", translation: "This restaurant is lively every day." },
        ],
      }),
      lang: "zh-Hant",
    });
    expect(a?.guidSeed).toBe(b?.guidSeed);
    expect(a?.front).not.toBe(b?.front);
    expect(guidFor(a!.guidSeed!)).toBe(guidFor(b!.guidSeed!));
  });
});

describe("buildEncodingDeck stable guid across sentence change", () => {
  it("re-exporting after regenerating the sentence keeps the same guid", async () => {
    const deckA = buildEncodingDeck({ doc: makeDoc(), lang: "zh-Hant" });
    const deckB = buildEncodingDeck({
      doc: makeDoc({
        examples: [
          { text: "大家一起吃飯，氣氛很熱鬧。", translation: "Everyone eats together; the mood is lively." },
        ],
      }),
      lang: "zh-Hant",
    });

    const apkgA = await buildApkg(deckA);
    const apkgB = await buildApkg(deckB);
    const SQL = await initSqlJs();

    function readGuid(bytes: Uint8Array): string {
      const db = new SQL.Database(unzipSync(bytes)["collection.anki2"] as Uint8Array);
      try {
        return db.exec("SELECT guid FROM notes")[0]?.values[0]?.[0] as string;
      } finally {
        db.close();
      }
    }

    expect(readGuid(apkgA)).toBe(readGuid(apkgB));
  });
});