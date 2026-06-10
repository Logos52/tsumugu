/**
 * Example-sentence verification (Dictionary PRD §5.4, D3).
 */
import {
  isKnown,
  validateHighlightSpans,
  type ExampleSentence,
  type KnownPolicy,
  type LanguagePack,
  type PrebakedEntry,
  type WordStore,
} from "@tsumugu/engine";
import { checkDefLevel, type DefLevelViolation } from "./defLevel.js";
import type { DefLevelIndex } from "./defLevelData.js";
import {
  EXAMPLE_COUNT_MAX,
  EXAMPLE_COUNT_MIN,
  isFilledExample,
  isOverlayExample,
  isSharedExample,
} from "./examples.js";

export interface ExampleEntryStats {
  term: string;
  exampleCount: number;
  sharedCount: number;
  overlayCount: number;
  headwordMissing: number[];
  highlightSpanErrors: { index: number; errors: string[] }[];
  exampleLevelViolations: DefLevelViolation[];
  sharedFlagErrors: string[];
  countOk: boolean;
}

export interface ExampleVerifyResult {
  byEntry: Record<string, ExampleEntryStats>;
  exampleLevelViolations: DefLevelViolation[];
  /** Known-word recycle ratio over overlay rows only; null when no overlay or no store tokens. */
  overlayRecycleRatio: number | null;
  hasErrors: boolean;
}

function entryNeedsExamples(entry: PrebakedEntry): boolean {
  const zhGloss = entry.definitions?.zh?.gloss?.trim();
  if (zhGloss) return true;
  return (entry.examples ?? []).some(isFilledExample);
}

function sharedExamples(examples: ExampleSentence[]): ExampleSentence[] {
  return examples.filter(isSharedExample);
}

function filledSharedExamples(examples: ExampleSentence[]): ExampleSentence[] {
  return sharedExamples(examples).filter(isFilledExample);
}

function filledOverlayExamples(examples: ExampleSentence[]): ExampleSentence[] {
  return examples.filter((ex) => isOverlayExample(ex) && isFilledExample(ex));
}

export async function overlayKnownWordRecycleRatio(
  examples: ExampleSentence[],
  term: string,
  pack: LanguagePack,
  store: WordStore,
  lang: string,
  policy?: KnownPolicy,
): Promise<number | null> {
  const overlay = filledOverlayExamples(examples);
  if (overlay.length === 0) return null;

  let known = 0;
  let total = 0;
  for (const ex of overlay) {
    const tokens = await pack.segmenter(ex.text);
    for (const t of tokens) {
      if (!t.isWord) continue;
      if (t.text === term) continue;
      total += 1;
      if (isKnown(store.getStatus(lang, t.text), policy)) known += 1;
    }
  }
  return total === 0 ? null : known / total;
}

/** Skip band checks on morphemes that appear inside the contiguous headword substring. */
function isSubMorphemeOfTermInText(word: string, term: string, text: string): boolean {
  if (word === term || term === "" || !text.includes(term)) return false;
  return term.includes(word);
}

function verifyEntryExamples(
  entry: PrebakedEntry,
  defIndex: DefLevelIndex | undefined,
): ExampleEntryStats {
  const term = entry.term;
  const examples = entry.examples ?? [];
  const ceiling = entry.definitions?.zh?.level ?? "TOCFL-3";
  const sharedFilled = filledSharedExamples(examples);
  const overlayFilled = filledOverlayExamples(examples);

  const headwordMissing: number[] = [];
  const highlightSpanErrors: { index: number; errors: string[] }[] = [];
  const exampleLevelViolations: DefLevelViolation[] = [];
  const sharedFlagErrors: string[] = [];

  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i]!;
    if (!isFilledExample(ex)) continue;

    if (!ex.text.includes(term)) {
      headwordMissing.push(i);
    }

    const spanCheck = validateHighlightSpans(ex.text, term, ex.highlightSpans);
    if (!spanCheck.ok) {
      highlightSpanErrors.push({ index: i, errors: spanCheck.errors });
    }

    if (isSharedExample(ex) && ex.shared !== true) {
      sharedFlagErrors.push(`examples[${i}]: shared base row must set shared:true`);
    }
    if (isOverlayExample(ex) && ex.shared !== false) {
      sharedFlagErrors.push(`examples[${i}]: overlay row must set shared:false`);
    }

    if (defIndex && ex.text.trim()) {
      const exCheck = checkDefLevel({
        text: ex.text,
        ceiling,
        index: defIndex,
        field: `examples[${i}].text`,
      });
      exampleLevelViolations.push(
        ...exCheck.violations.filter(
          (v) => v.word !== term && !isSubMorphemeOfTermInText(v.word, term, ex.text),
        ),
      );
    }
  }

  const count = sharedFilled.length;
  const countOk = count >= EXAMPLE_COUNT_MIN && count <= EXAMPLE_COUNT_MAX;

  return {
    term,
    exampleCount: count,
    sharedCount: sharedFilled.length,
    overlayCount: overlayFilled.length,
    headwordMissing,
    highlightSpanErrors,
    exampleLevelViolations,
    sharedFlagErrors,
    countOk,
  };
}

export async function verifyExamples(opts: {
  glossary: Record<string, PrebakedEntry>;
  lang: string;
  pack: LanguagePack;
  store: WordStore;
  defIndex?: DefLevelIndex;
  policy?: KnownPolicy;
}): Promise<ExampleVerifyResult> {
  const byEntry: Record<string, ExampleEntryStats> = {};
  const exampleLevelViolations: DefLevelViolation[] = [];
  let overlayKnown = 0;
  let overlayTotal = 0;
  let overlayRows = 0;
  let hasErrors = false;

  for (const [key, entry] of Object.entries(opts.glossary)) {
    if (opts.lang !== "zh-Hant" || !entryNeedsExamples(entry)) continue;

    const stats = verifyEntryExamples(entry, opts.defIndex);
    byEntry[key] = stats;
    exampleLevelViolations.push(...stats.exampleLevelViolations);

    if (!stats.countOk) hasErrors = true;
    if (stats.headwordMissing.length) hasErrors = true;
    if (stats.highlightSpanErrors.length) hasErrors = true;
    if (stats.sharedFlagErrors.length) hasErrors = true;
    if (stats.exampleLevelViolations.length) hasErrors = true;

    const ratio = await overlayKnownWordRecycleRatio(
      entry.examples ?? [],
      entry.term,
      opts.pack,
      opts.store,
      opts.lang,
      opts.policy,
    );
    if (ratio !== null) {
      overlayRows += filledOverlayExamples(entry.examples ?? []).length;
      const overlay = filledOverlayExamples(entry.examples ?? []);
      for (const ex of overlay) {
        const tokens = await opts.pack.segmenter(ex.text);
        for (const t of tokens) {
          if (!t.isWord || t.text === entry.term) continue;
          overlayTotal += 1;
          if (isKnown(opts.store.getStatus(opts.lang, t.text), opts.policy)) {
            overlayKnown += 1;
          }
        }
      }
    }
  }

  const overlayRecycleRatio =
    overlayRows === 0 || overlayTotal === 0 ? null : overlayKnown / overlayTotal;

  return {
    byEntry,
    exampleLevelViolations,
    overlayRecycleRatio,
    hasErrors,
  };
}