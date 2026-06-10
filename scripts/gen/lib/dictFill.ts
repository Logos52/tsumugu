/**
 * Apply agent-authored dictionary fills to a prepared-content file.
 * Stamps @2, computes highlightSpans, merges definitions/examples/collocations.
 */
import {
  PREPARED_CONTENT_SCHEMA_V2,
  computeHighlightSpans,
  type Collocation,
  type Definitions,
  type ExampleSentence,
  type LanguagePack,
  type MonoDefinition,
  type PreparedContent,
  type PrebakedEntry,
} from "@tsumugu/engine";
import { seedCollocationSlots } from "./collocations.js";
import { resolveDefFloorBand } from "./defLevelData.js";
import { seedSharedExampleSlots } from "./examples.js";

export interface DictionaryWordFill {
  /** Leveled monolingual definition. */
  zh?: {
    gloss: string;
    illustration?: string;
    level?: string;
  };
  examples?: ExampleSentence[];
  collocations?: Collocation[];
}

export type DictionaryFillMap = Record<string, DictionaryWordFill>;

export function needsDictionaryFill(entry: PrebakedEntry): boolean {
  const zhGloss = entry.definitions?.zh?.gloss?.trim();
  const hasExamples = (entry.examples ?? []).some((e) => e.text.trim() !== "");
  const hasCollocations = (entry.collocations ?? []).some(
    (c) => c.phrase.trim() !== "",
  );
  return !zhGloss || !hasExamples || !hasCollocations;
}

export function listWordsNeedingFill(
  content: PreparedContent,
): { term: string; gloss: string; needs: string[] }[] {
  const out: { term: string; gloss: string; needs: string[] }[] = [];
  for (const entry of Object.values(content.glossary)) {
    const needs: string[] = [];
    if (!entry.definitions?.zh?.gloss?.trim()) needs.push("definitions.zh");
    if (!(entry.examples ?? []).some((e) => e.text.trim() !== "")) needs.push("examples");
    if (!(entry.collocations ?? []).some((c) => c.phrase.trim() !== "")) {
      needs.push("collocations");
    }
    if (needs.length) {
      out.push({ term: entry.term, gloss: entry.gloss, needs });
    }
  }
  return out;
}

function stampExamples(term: string, examples: ExampleSentence[]): ExampleSentence[] {
  return examples.map((ex) => {
    const spans =
      ex.highlightSpans && ex.highlightSpans.length > 0
        ? ex.highlightSpans
        : computeHighlightSpans(ex.text, term);
    return {
      ...ex,
      shared: ex.shared !== false,
      source: ex.source ?? "generated",
      highlightSpans: spans,
    };
  });
}

function stampCollocations(collocations: Collocation[]): Collocation[] {
  return collocations.map((c) => ({
    ...c,
    shared: c.shared !== false,
    source: c.source ?? "generated",
  }));
}

function buildZhDefinition(
  entry: PrebakedEntry,
  zh: DictionaryWordFill["zh"],
): MonoDefinition | undefined {
  if (!zh?.gloss?.trim()) return entry.definitions?.zh;
  const level = zh.level ?? entry.definitions?.zh?.level ?? "TOCFL-3";
  const out: MonoDefinition = {
    gloss: zh.gloss.trim(),
    level,
    monolingual: true,
    source: "generated",
  };
  if (zh.illustration?.trim()) out.illustration = zh.illustration.trim();
  return out;
}

/** Merge one word's fill into a glossary entry. */
export function applyFillToEntry(
  entry: PrebakedEntry,
  fill: DictionaryWordFill | undefined,
): PrebakedEntry {
  if (!fill) return entry;
  const out: PrebakedEntry = { ...entry };
  const definitions: Definitions = { ...entry.definitions };
  const zh = buildZhDefinition(entry, fill.zh);
  if (zh) definitions.zh = zh;
  if (definitions.en || definitions.zh) out.definitions = definitions;
  if (fill.examples?.length) {
    out.examples = stampExamples(entry.term, fill.examples);
  }
  if (fill.collocations?.length) {
    out.collocations = stampCollocations(fill.collocations);
  }
  // Monolingual fills: mirror zh gloss so missing-glossary checks pass without English.
  if (!out.gloss?.trim() && definitions.zh?.gloss?.trim()) {
    out.gloss = definitions.zh.gloss.trim();
  }
  return out;
}

/** Apply a fill map to prepared content and stamp schema @2. */
export function applyDictionaryFill(
  content: PreparedContent,
  fills: DictionaryFillMap,
): PreparedContent {
  const glossary: Record<string, PrebakedEntry> = {};
  for (const [word, entry] of Object.entries(content.glossary)) {
    glossary[word] = applyFillToEntry(entry, fills[word]);
  }
  return {
    ...content,
    schema: PREPARED_CONTENT_SCHEMA_V2,
    glossary,
  };
}

/** Word tokens in document order with no glossary row yet. */
export function listTokensMissingGlossary(content: PreparedContent): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of content.tokens) {
    if (!t.isWord || seen.has(t.text)) continue;
    seen.add(t.text);
    if (!content.glossary[t.text]) out.push(t.text);
  }
  return out;
}

/**
 * Seed glossary slots for word tokens that lack a row (segmentation leftovers,
 * partial prep). Uses the pack dictionary for English gloss anchors only.
 */
export async function expandGlossaryForTokens(opts: {
  content: PreparedContent;
  pack: LanguagePack;
  defFloorBand?: string;
}): Promise<{ content: PreparedContent; added: string[] }> {
  const { content, pack } = opts;
  const missing = listTokensMissingGlossary(content);
  if (missing.length === 0) return { content, added: [] };

  const defFloorBand =
    content.lang === "zh-Hant"
      ? resolveDefFloorBand(opts.defFloorBand)
      : undefined;
  const glossary: Record<string, PrebakedEntry> = { ...content.glossary };

  for (const word of missing) {
    const dict = await pack.dictionaryProvider(word);
    const level = await pack.levelingModel(word);
    const reading = dict?.reading ?? pack.phoneticLayer.reading(word, dict);
    const entry: PrebakedEntry = {
      term: word,
      gloss: dict?.gloss ?? "",
      examples: content.lang === "zh-Hant" ? seedSharedExampleSlots(word) : [],
    };
    if (content.lang === "zh-Hant") {
      entry.collocations = seedCollocationSlots(word);
    }
    if (reading !== undefined) entry.reading = reading;
    if (dict?.pos !== undefined) entry.pos = dict.pos;
    if (level?.band !== undefined) entry.level = level.band;
    if (defFloorBand !== undefined) {
      entry.definitions = {
        zh: {
          gloss: "",
          level: defFloorBand,
          monolingual: true,
          source: "generated",
        },
      };
    }
    glossary[word] = entry;
  }

  return {
    content: {
      ...content,
      schema: PREPARED_CONTENT_SCHEMA_V2,
      glossary,
    },
    added: missing,
  };
}