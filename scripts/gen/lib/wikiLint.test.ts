import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { lintEncodingTwin } from "./wikiLint.js";
import { buildEncodingPage } from "./wiki.js";

const EXAMPLE_TWIN = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../examples/wiki/encoding/熱鬧.md",
);

describe("lintEncodingTwin", () => {
  it("熱鬧 twin passes", () => {
    const md = readFileSync(EXAMPLE_TWIN, "utf8");
    const result = lintEncodingTwin(md, { filename: "熱鬧" });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("missing word: fails", () => {
    const md = buildEncodingPage({ term: "熱鬧", lang: "zh-Hant" })
      .replace(/^word: .+\n/m, "");
    const result = lintEncodingTwin(md, { filename: "熱鬧" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("word:"))).toBe(true);
  });

  it("mismatched word/term fails", () => {
    const md = buildEncodingPage({ term: "熱鬧", lang: "zh-Hant" }).replace(
      "word: 熱鬧",
      "word: 夜市",
    );
    const result = lintEncodingTwin(md, { filename: "熱鬧" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("word") && e.includes("term"))).toBe(true);
  });

  it("rejects ## Meaning on encoding pages (D2)", () => {
    const md = readFileSync(EXAMPLE_TWIN, "utf8") + "\n## Meaning\nlively, bustling\n";
    const result = lintEncodingTwin(md, { filename: "熱鬧" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("## Meaning"))).toBe(true);
  });

  it("flags NFC filename mismatch", () => {
    const md = readFileSync(EXAMPLE_TWIN, "utf8");
    const result = lintEncodingTwin(md, { filename: "renao-lively" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("NFC filename"))).toBe(true);
  });
});