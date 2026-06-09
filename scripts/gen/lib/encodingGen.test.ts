import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WordStore, parseEncodingPage } from "@tsumugu/engine";
import {
  buildEncodingPage,
  buildEncodingPageJson,
  encodingArtifactPaths,
  wikiInputFromStore,
} from "./wiki.js";
import { encodingFilename } from "./io.js";

describe("encoding gen artifacts", () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), "tsumugu-encoding-"));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("encodingFilename NFC-normalizes CJK terms", () => {
    expect(encodingFilename("熱鬧")).toBe("熱鬧");
    expect(encodingFilename("熱鬧")).toBe(encodingFilename("熱鬧".normalize("NFD")));
  });

  it("encodingFilename rejects hostile terms without slug override", () => {
    expect(() => encodingFilename("C++")).toThrow(/slug/i);
    expect(encodingFilename("C++", "cplusplus")).toBe("cplusplus");
  });

  it("writes both .md and .encoding.json at contract paths", async () => {
    const store = new WordStore();
    const entry = {
      lang: "zh-Hant",
      word: "熱鬧",
      status: "l2" as const,
      flagNote: "confuses with 鬧鐘",
      related: [{ lang: "zh-Hant", word: "夜市" }],
    };
    const input = wikiInputFromStore(entry, {
      term: "熱鬧",
      gloss: "lively",
      reading: "rènào",
      level: "TOCFL B1",
    });
    const wikiInput = { ...input, flagNote: entry.flagNote };
    const paths = encodingArtifactPaths(outDir, "zh-Hant", "熱鬧");

    expect(paths.mdPath).toBe(`${outDir}/zh-Hant/encoding/熱鬧.md`);
    expect(paths.jsonPath).toBe(`${outDir}/zh-Hant/encoding/熱鬧.encoding.json`);

    const { writeText, writeJson } = await import("./io.js");
    await writeText(paths.mdPath, buildEncodingPage(wikiInput));
    await writeJson(paths.jsonPath, buildEncodingPageJson(wikiInput));

    const md = await readFile(paths.mdPath, "utf8");
    const jsonRaw = await readFile(paths.jsonPath, "utf8");
    const doc = parseEncodingPage(jsonRaw);

    expect(md).toContain("word: 熱鬧");
    expect(md).toContain("type: encoding");
    expect(doc?.schema).toBe("tsumugu/encoding-page@1");
    expect(doc?.term).toBe("熱鬧");
    expect(doc?.flagNote).toBe("confuses with 鬧鐘");
    expect(doc?.definitions).toBeUndefined();
    expect(doc?.examples).toBeUndefined();
    expect(doc?.etymology).toBeUndefined();
  });
});