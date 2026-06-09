import { describe, it, expect } from "vitest";
import type { LanguagePack, WordStore, WordStatus } from "@tsumugu/engine";
import { annotateMarkdown, stripAnnotations, cleanGloss } from "./annotate.js";

/** Fake segmenter: longest-match against a tiny lexicon, else single char. */
const LEX = ["夜市", "封閉", "那裡", "指南", "夜店", "飢渴"];
const fakePack = {
  id: "zh-Hant",
  name: "fake",
  segmenter(text: string) {
    const tokens: { text: string; start: number; end: number; isWord: boolean }[] = [];
    let i = 0;
    while (i < text.length) {
      const word = LEX.find((w) => text.startsWith(w, i)) ?? text.charAt(i);
      tokens.push({ text: word, start: i, end: i + word.length, isWord: true });
      i += word.length;
    }
    return tokens;
  },
  dictionaryProvider(word: string) {
    if (word === "封閉") return { term: "封閉", gloss: "closed-off", reading: "ㄈㄥㄅㄧˋ" };
    if (word === "夜市") return { term: "夜市", gloss: 'night "market"', reading: "ㄧㄝˋㄕˋ" };
    return undefined;
  },
} as unknown as LanguagePack;

const statuses: Record<string, WordStatus> = { 夜市: "known", 封閉: "new" };
// Comprehended words define the known-char set: 夜, 市, 店.
const entries = [
  { lang: "zh-Hant", word: "夜市", status: "known" as WordStatus },
  { lang: "zh-Hant", word: "店", status: "known" as WordStatus },
];
const fakeStore = {
  getStatus: (_lang: string, word: string): WordStatus => statuses[word] ?? "new",
  all: (_lang?: string) => entries,
} as unknown as WordStore;

const run = (md: string) => annotateMarkdown({ md, lang: "zh-Hant", pack: fakePack, store: fakeStore });

describe("annotateMarkdown", () => {
  it("wraps Han words with status class + hover data attrs", async () => {
    const { md } = await run("我去夜市，那裡很封閉。");
    expect(md).toContain('<span class="tsg-w tsg-status-known" data-r="ㄧㄝˋㄕˋ" data-g="night &quot;market&quot;">夜市</span>');
    expect(md).toContain('<span class="tsg-w tsg-status-new" data-r="ㄈㄥㄅㄧˋ" data-g="closed-off">封閉</span>');
    // CJK punctuation stays outside spans
    expect(md).toContain("。");
    expect(md).toContain("，");
  });

  it("counts word tokens and highlights (non known/ignored)", async () => {
    const res = await run("夜市封閉");
    expect(res.wordCount).toBe(2);
    expect(res.unknownCount).toBe(1); // 夜市 known → not highlighted; 封閉 new → highlighted
    expect(res.distinct).toBe(2);
  });

  it("leaves frontmatter untouched", async () => {
    const md = ["---", "title: 夜市指南", "---", "", "去夜市"].join("\n");
    const { md: out } = await run(md);
    expect(out).toContain("title: 夜市指南"); // not wrapped
    expect(out).toContain('>夜市</span>'); // body wrapped
  });

  it("leaves fenced and inline code untouched", async () => {
    const md = ["```", "夜市", "```", "", "看 `夜市` 與 封閉"].join("\n");
    const { md: out } = await run(md);
    expect(out).toContain("```\n夜市\n```"); // fenced block intact
    expect(out).toContain("`夜市`"); // inline code intact
    expect(out).toContain('>封閉</span>'); // surrounding text wrapped
  });

  it("does not touch ASCII / Markdown syntax (links, bold, tables)", async () => {
    const md = "**封閉** 見 [[夜市]] | 封閉 |";
    const { md: out } = await run(md);
    expect(out).toContain("**"); // bold markers intact
    expect(out).toContain("[[夜市]]".replace("夜市", '<span class="tsg-w tsg-status-known" data-r="ㄧㄝˋㄕˋ" data-g="night &quot;market&quot;">夜市</span>'));
    expect(out).toContain("| "); // table pipe intact
  });

  it("is idempotent — re-annotating yields the same output", async () => {
    const once = (await run("我去夜市看封閉")).md;
    const twice = (await run(once)).md;
    expect(twice).toBe(once);
  });

  it("cleanGloss condenses CC-CEDICT noise to a hover-sized string", () => {
    // bracketed pinyin, 簡|繁 pair, and multiple senses
    expect(cleanGloss("variant of 歟|欤[yu2]; (formal) and; together with")).toBe(
      "(formal) and; together with",
    );
    expect(cleanGloss("market/fair", 60)).toBe("market; fair");
    const long = cleanGloss("a".repeat(100), 20);
    expect(long.length).toBeLessThanOrEqual(20);
    expect(long.endsWith("…")).toBe(true);
  });

  it("stripAnnotations recovers the clean text", async () => {
    const { md } = await run("夜市封閉");
    expect(stripAnnotations(md)).toBe("夜市封閉");
  });

  it("decodable policy (default): a word of all-known chars is not highlighted", async () => {
    // 夜店 = 夜 + 店, both known chars → decodable, no highlight.
    // 飢渴 carries unknown chars → highlighted.
    const res = await run("夜店飢渴");
    expect(res.md).toContain('<span class="tsg-w tsg-status-known"');
    expect(res.md).toContain('>夜店</span>');
    expect(res.md).toContain('<span class="tsg-w tsg-status-new"');
    expect(res.md).toContain('>飢渴</span>');
    expect(res.unknownCount).toBe(1); // only 飢渴
  });

  it("exact policy: any non-graded word is highlighted, seams and all", async () => {
    const res = await annotateMarkdown({
      md: "夜店飢渴",
      lang: "zh-Hant",
      pack: fakePack,
      store: fakeStore,
      policy: "exact",
    });
    expect(res.md).toContain('<span class="tsg-w tsg-status-new">夜店</span>');
    expect(res.unknownCount).toBe(2); // 夜店 + 飢渴
  });
});
