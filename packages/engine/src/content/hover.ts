/**
 * Hover resolution (PRD §5.3, §2.1).
 *
 * Merges the layers that can describe a word — the user's custom override,
 * the batch-baked glossary entry, and the packaged dictionary entry — into
 * the single object the reader shows on hover. Fully offline: no layer here
 * triggers a live call. Pure and DOM-free.
 *
 * Field precedence is, per field, `custom > prebaked > dict`. `sources`
 * records which layers actually contributed at least one value, in
 * precedence order, so the UI can show provenance.
 */

import type {
  PrebakedEntry,
  DictEntry,
  BridgeInfo,
  Definition,
  ExampleSentence,
} from "../types.js";

/** Provenance label for a hover layer. */
export type HoverSource = "custom" | "prebaked" | "dict";

/**
 * The fully-resolved hover payload the reader renders. Optional fields are
 * present only when some layer supplied them.
 */
export interface ResolvedHover {
  term: string;
  /** Legacy single gloss — mirrors `definitions.en.gloss` when present. */
  gloss?: string;
  definitions?: { en?: Definition; zh?: Definition };
  reading?: string;
  examples?: ExampleSentence[] | string[];
  explanation?: string;
  bridge?: BridgeInfo;
  pos?: string;
  level?: string;
  /** Layers that contributed at least one field, in precedence order. */
  sources: HoverSource[];
}

/** Pick the first defined value across the layers, in precedence order. */
function pick<T>(...candidates: (T | undefined)[]): T | undefined {
  for (const c of candidates) {
    if (c !== undefined) return c;
  }
  return undefined;
}

function isStringExamples(
  examples: string[] | ExampleSentence[],
): examples is string[] {
  return examples.length > 0 && typeof examples[0] === "string";
}

/** Lift legacy `string[]` examples to structured rows on read. */
function normalizeExamples(
  examples: string[] | ExampleSentence[] | undefined,
): ExampleSentence[] | undefined {
  if (examples === undefined) return undefined;
  if (examples.length === 0) return [];
  if (isStringExamples(examples)) {
    return examples.map((text) => ({ text, translation: "" }));
  }
  return examples;
}

function resolveDefinitionEn(
  custom?: Partial<DictEntry>,
  prebaked?: PrebakedEntry,
  dict?: DictEntry,
): Definition | undefined {
  const picked = pick(
    custom?.definitions?.en,
    prebaked?.definitions?.en,
    dict?.definitions?.en,
  );
  const gloss = pick(custom?.gloss, prebaked?.gloss, dict?.gloss);
  const senses = pick(custom?.senses, picked?.senses, dict?.senses);

  if (picked) {
    if (senses !== undefined && picked.senses === undefined) {
      return { ...picked, senses };
    }
    return picked;
  }
  if (gloss !== undefined) {
    return senses !== undefined ? { gloss, senses } : { gloss };
  }
  return undefined;
}

function resolveDefinitionZh(
  custom?: Partial<DictEntry>,
  prebaked?: PrebakedEntry,
  dict?: DictEntry,
): Definition | undefined {
  return pick(
    custom?.definitions?.zh,
    prebaked?.definitions?.zh,
    dict?.definitions?.zh,
  );
}

function resolveDefinitions(
  custom?: Partial<DictEntry>,
  prebaked?: PrebakedEntry,
  dict?: DictEntry,
): { en?: Definition; zh?: Definition } | undefined {
  const en = resolveDefinitionEn(custom, prebaked, dict);
  const zh = resolveDefinitionZh(custom, prebaked, dict);
  if (en === undefined && zh === undefined) return undefined;
  const out: { en?: Definition; zh?: Definition } = {};
  if (en !== undefined) out.en = en;
  if (zh !== undefined) out.zh = zh;
  return out;
}

/**
 * Merge the available layers for one word into a {@link ResolvedHover}.
 *
 * Precedence per field: `custom > prebaked > dict`. The `word` argument is the
 * fallback `term` when no layer supplies one (e.g. a bare custom note). A layer
 * is listed in `sources` only when it is present *and* contributes at least one
 * resolved field — an empty `{}` custom object adds nothing and is not listed.
 */
export function mergeHover(args: {
  word: string;
  prebaked?: PrebakedEntry;
  custom?: Partial<DictEntry>;
  dict?: DictEntry;
}): ResolvedHover {
  const { word, prebaked, custom, dict } = args;

  const term = pick(custom?.term, prebaked?.term, dict?.term) ?? word;
  const definitions = resolveDefinitions(custom, prebaked, dict);
  const gloss = definitions?.en?.gloss ?? pick(custom?.gloss, prebaked?.gloss, dict?.gloss);
  const reading = pick(custom?.reading, prebaked?.reading, dict?.reading);
  const pos = pick(custom?.pos, prebaked?.pos, dict?.pos);
  const level = pick(custom?.level, prebaked?.level, dict?.level);
  const examples = normalizeExamples(prebaked?.examples);
  const explanation = prebaked?.explanation;
  const bridge = prebaked?.bridge;

  const hover: ResolvedHover = { term, sources: [] };
  if (gloss !== undefined) hover.gloss = gloss;
  if (definitions !== undefined) hover.definitions = definitions;
  if (reading !== undefined) hover.reading = reading;
  if (examples !== undefined) hover.examples = examples;
  if (explanation !== undefined) hover.explanation = explanation;
  if (bridge !== undefined) hover.bridge = bridge;
  if (pos !== undefined) hover.pos = pos;
  if (level !== undefined) hover.level = level;

  if (contributesCustom(custom, hover)) hover.sources.push("custom");
  if (contributesPrebaked(prebaked, custom, hover)) hover.sources.push("prebaked");
  if (contributesDict(dict, custom, prebaked, hover)) hover.sources.push("dict");

  return hover;
}

function definitionHasValue(def?: Definition): boolean {
  if (!def) return false;
  return (
    def.gloss !== undefined ||
    def.senses !== undefined ||
    def.explanation !== undefined ||
    def.levelCap !== undefined ||
    def.leveledVerdict !== undefined ||
    def.offendingWord !== undefined
  );
}

function definitionsHaveValue(
  defs?: { en?: Definition; zh?: Definition },
): boolean {
  if (!defs) return false;
  return definitionHasValue(defs.en) || definitionHasValue(defs.zh);
}

/** The lexical fields the custom layer can provide. */
function customHasValue(custom: Partial<DictEntry> | undefined): boolean {
  if (!custom) return false;
  return (
    custom.term !== undefined ||
    custom.gloss !== undefined ||
    custom.reading !== undefined ||
    custom.pos !== undefined ||
    custom.level !== undefined ||
    custom.senses !== undefined ||
    definitionsHaveValue(custom.definitions)
  );
}

/** Custom contributes when it has any usable field. */
function contributesCustom(
  custom: Partial<DictEntry> | undefined,
  _hover: ResolvedHover,
): boolean {
  return customHasValue(custom);
}

function prebakedLexicalFields(prebaked: PrebakedEntry): boolean {
  return (
    prebaked.term !== undefined ||
    prebaked.gloss !== undefined ||
    prebaked.reading !== undefined ||
    prebaked.pos !== undefined ||
    prebaked.level !== undefined ||
    definitionsHaveValue(prebaked.definitions)
  );
}

/**
 * Prebaked contributes when it owns a field outright (examples / explanation /
 * bridge), or supplies a lexical field that custom did not already provide.
 */
function contributesPrebaked(
  prebaked: PrebakedEntry | undefined,
  custom: Partial<DictEntry> | undefined,
  _hover: ResolvedHover,
): boolean {
  if (!prebaked) return false;
  if (
    prebaked.examples !== undefined ||
    prebaked.explanation !== undefined ||
    prebaked.bridge !== undefined
  ) {
    return true;
  }
  if (!prebakedLexicalFields(prebaked)) return false;
  return (
    (prebaked.term !== undefined && custom?.term === undefined) ||
    (prebaked.gloss !== undefined && custom?.gloss === undefined) ||
    (prebaked.reading !== undefined && custom?.reading === undefined) ||
    (prebaked.pos !== undefined && custom?.pos === undefined) ||
    (prebaked.level !== undefined && custom?.level === undefined) ||
    (definitionsHaveValue(prebaked.definitions) &&
      !definitionsHaveValue(custom?.definitions))
  );
}

function dictLexicalTaken(
  dict: DictEntry,
  custom: Partial<DictEntry> | undefined,
  prebaked: PrebakedEntry | undefined,
  key: "term" | "gloss" | "reading" | "pos" | "level",
): boolean {
  return custom?.[key] !== undefined || prebaked?.[key] !== undefined;
}

function dictDefinitionsTaken(
  custom: Partial<DictEntry> | undefined,
  prebaked: PrebakedEntry | undefined,
): { en: boolean; zh: boolean } {
  return {
    en:
      definitionHasValue(custom?.definitions?.en) ||
      definitionHasValue(prebaked?.definitions?.en),
    zh:
      definitionHasValue(custom?.definitions?.zh) ||
      definitionHasValue(prebaked?.definitions?.zh),
  };
}

/**
 * Dict contributes when it supplies a lexical field that neither custom nor
 * prebaked already provided.
 */
function contributesDict(
  dict: DictEntry | undefined,
  custom: Partial<DictEntry> | undefined,
  prebaked: PrebakedEntry | undefined,
  _hover: ResolvedHover,
): boolean {
  if (!dict) return false;
  const takenDefs = dictDefinitionsTaken(custom, prebaked);
  const sensesTaken =
    custom?.senses !== undefined ||
    definitionHasValue(custom?.definitions?.en) ||
    definitionHasValue(prebaked?.definitions?.en);
  return (
    (dict.term !== undefined && !dictLexicalTaken(dict, custom, prebaked, "term")) ||
    (dict.gloss !== undefined && !dictLexicalTaken(dict, custom, prebaked, "gloss")) ||
    (dict.reading !== undefined &&
      !dictLexicalTaken(dict, custom, prebaked, "reading")) ||
    (dict.pos !== undefined && !dictLexicalTaken(dict, custom, prebaked, "pos")) ||
    (dict.level !== undefined && !dictLexicalTaken(dict, custom, prebaked, "level")) ||
    (definitionHasValue(dict.definitions?.en) && !takenDefs.en) ||
    (definitionHasValue(dict.definitions?.zh) && !takenDefs.zh) ||
    (dict.senses !== undefined && !sensesTaken)
  );
}