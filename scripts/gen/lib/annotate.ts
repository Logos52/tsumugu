/**
 * Reading-layer annotation (READING-LAYER.md §7.1–7.2, Phase R1).
 *
 * Wraps every Han word in a Markdown page with a status span the wiki/reader
 * CSS colors, baking reading + gloss into `data-r`/`data-g` for the pure-CSS
 * hover popup. Pure presentation: the source text is never changed, only
 * wrapped. Status comes from the word-store; readings/glosses from the pack
 * dictionary. No live API; the engine writes a file the wiki consumes.
 *
 * Safe on Markdown because every structural token (`#`, `*`, `[`, `|`, fences)
 * is ASCII — we only ever touch runs of Han characters inside ordinary text,
 * skipping the frontmatter block, fenced code, and inline code. Re-runnable:
 * existing `tsg-w` spans are stripped first, so re-annotating after a
 * word-store change simply recolors.
 */

import type { LanguagePack, WordStore, DictEntry } from "@tsumugu/engine";
import { statusColorClass } from "@tsumugu/engine";

/** Han runs: CJK Unified (+ Ext A) and Compatibility Ideographs. */
const HAN_RUN = /[㐀-鿿豈-﫿]+/g;

/** Our own word spans, for idempotent re-annotation. Inner text is pure Han. */
const STRIP_RE = /<span class="tsg-w[^"]*"[^>]*>([^<]*)<\/span>/g;

/** Strip previously-baked annotation spans, returning clean Markdown. */
export function stripAnnotations(md: string): string {
  return md.replace(STRIP_RE, "$1");
}

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Condense a raw dictionary gloss to a hover-sized string. CC-CEDICT entries
 * pack every sense, bracketed pinyin, classifier notes, and 簡|繁 variant
 * pairs into one field; the popup wants the first couple of senses, clean.
 */
export function cleanGloss(raw: string, maxLen = 60): string {
  let g = raw
    .replace(/\bCL:[^;/]*/g, "") // classifier notes
    .replace(/\[[^\]]*\]/g, "") // bracketed pinyin, e.g. [yu2]
    .replace(/[㐀-鿿豈-﫿]+\|[㐀-鿿豈-﫿]+/g, ""); // 簡|繁 variant pairs
  const senses = g
    .split(/[;/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^variant of$/i.test(s));
  let out = senses.slice(0, 2).join("; ").replace(/\s{2,}/g, " ").trim();
  if (out.length > maxLen) out = out.slice(0, maxLen - 1).trimEnd() + "…";
  return out;
}

export interface AnnotateResult {
  md: string;
  /** Total Han word-tokens wrapped. */
  wordCount: number;
  /** Word-tokens highlighted (genuinely unknown under the active policy). */
  unknownCount: number;
  /** Distinct words wrapped. */
  distinct: number;
}

/**
 * How a not-yet-graded word is judged.
 *
 * - `"decodable"` (default): a word is unknown only if it carries a character
 *   you do not yet know — matching the CI metric, so a 95%-CI page highlights
 *   ~5% of words. Collapses jieba/Migaku segmentation seams (一個, 不會…) you
 *   plainly read but never graded as a unit.
 * - `"exact"`: strict LingQ/Migaku behavior — anything not graded `known`/`l4`/
 *   `ignored` is highlighted, segmentation seams and all.
 */
export type KnownPolicy = "decodable" | "exact";

const COMPREHENDED = new Set(["known", "l4", "ignored"]);

export async function annotateMarkdown(opts: {
  md: string;
  lang: string;
  pack: LanguagePack;
  store: WordStore;
  policy?: KnownPolicy;
}): Promise<AnnotateResult> {
  const { lang, pack, store } = opts;
  const policy: KnownPolicy = opts.policy ?? "decodable";
  const lines = stripAnnotations(opts.md).split("\n");

  // Characters you already know — the union of every char across your
  // comprehended words. A "decodable" word is one made only of these.
  const knownChars = new Set<string>();
  if (policy === "decodable") {
    for (const e of store.all(lang)) {
      if (COMPREHENDED.has(e.status)) for (const ch of e.word) knownChars.add(ch);
    }
  }
  const decodable = (word: string): boolean => {
    for (const ch of word) if (!knownChars.has(ch)) return false;
    return true;
  };

  const dictCache = new Map<string, DictEntry | undefined>();
  const distinct = new Set<string>();
  let wordCount = 0;
  let unknownCount = 0;

  async function lookup(word: string): Promise<DictEntry | undefined> {
    if (dictCache.has(word)) return dictCache.get(word);
    const entry = await pack.dictionaryProvider(word);
    dictCache.set(word, entry);
    return entry;
  }

  async function wrapRun(run: string): Promise<string> {
    const tokens = await pack.segmenter(run);
    let out = "";
    let cursor = 0;
    for (const t of tokens) {
      if (t.start > cursor) out += run.slice(cursor, t.start);
      if (t.isWord) {
        const word = t.text;
        const status = store.getStatus(lang, word);
        wordCount++;
        distinct.add(word);

        // Choose the effective class under the active known-policy.
        let cls: string;
        if (COMPREHENDED.has(status)) {
          cls = statusColorClass(status); // known/l4/ignored — no highlight
        } else if (status === "new" && policy === "decodable" && decodable(word)) {
          cls = "tsg-status-known"; // every char known → comprehended, no highlight
        } else {
          cls = statusColorClass(status); // genuinely unknown / actively learning
          unknownCount++;
        }

        const dict = await lookup(word);
        const gloss = dict?.gloss ? cleanGloss(dict.gloss) : "";
        const r = dict?.reading ? ` data-r="${escAttr(dict.reading)}"` : "";
        const g = gloss ? ` data-g="${escAttr(gloss)}"` : "";
        out += `<span class="tsg-w ${cls}"${r}${g}>${word}</span>`;
      } else {
        out += t.text;
      }
      cursor = t.end;
    }
    if (cursor < run.length) out += run.slice(cursor);
    return out;
  }

  /** Wrap Han runs in a plain-text fragment (no Markdown structure). */
  async function annotateText(text: string): Promise<string> {
    const runs: { start: number; end: number; run: string }[] = [];
    HAN_RUN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = HAN_RUN.exec(text)) !== null) {
      runs.push({ start: m.index, end: m.index + m[0].length, run: m[0] });
    }
    if (runs.length === 0) return text;
    let out = "";
    let last = 0;
    for (const r of runs) {
      out += text.slice(last, r.start);
      out += await wrapRun(r.run);
      last = r.end;
    }
    return out + text.slice(last);
  }

  /** Annotate a content line, leaving inline `code` spans untouched. */
  async function annotateLine(line: string): Promise<string> {
    const parts = line.split(/(`[^`]*`)/g);
    for (let p = 0; p < parts.length; p += 2) {
      parts[p] = await annotateText(parts[p] ?? "");
    }
    return parts.join("");
  }

  const out: string[] = [];
  let inFrontmatter = false;
  let frontmatterDone = false;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (i === 0 && !frontmatterDone && line.trim() === "---") {
      inFrontmatter = true;
      out.push(line);
      continue;
    }
    if (inFrontmatter) {
      out.push(line);
      if (line.trim() === "---") {
        inFrontmatter = false;
        frontmatterDone = true;
      }
      continue;
    }
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    out.push(await annotateLine(line));
  }

  return {
    md: out.join("\n"),
    wordCount,
    unknownCount,
    distinct: distinct.size,
  };
}
