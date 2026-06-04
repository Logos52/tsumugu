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

import type { PrebakedEntry, DictEntry, BridgeInfo } from "../types.js";

/** Provenance label for a hover layer. */
export type HoverSource = "custom" | "prebaked" | "dict";

/**
 * The fully-resolved hover payload the reader renders. Optional fields are
 * present only when some layer supplied them.
 */
export interface ResolvedHover {
  term: string;
  gloss?: string;
  reading?: string;
  examples?: string[];
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

  // `examples` and `explanation` live only on the prebaked layer in the
  // domain types; `bridge` likewise. Custom/dict carry the lexical fields.
  const term = pick(custom?.term, prebaked?.term, dict?.term) ?? word;
  const gloss = pick(custom?.gloss, prebaked?.gloss, dict?.gloss);
  const reading = pick(custom?.reading, prebaked?.reading, dict?.reading);
  const pos = pick(custom?.pos, prebaked?.pos, dict?.pos);
  const level = pick(custom?.level, prebaked?.level, dict?.level);
  const examples = prebaked?.examples;
  const explanation = prebaked?.explanation;
  const bridge = prebaked?.bridge;

  const hover: ResolvedHover = { term, sources: [] };
  if (gloss !== undefined) hover.gloss = gloss;
  if (reading !== undefined) hover.reading = reading;
  if (examples !== undefined) hover.examples = examples;
  if (explanation !== undefined) hover.explanation = explanation;
  if (bridge !== undefined) hover.bridge = bridge;
  if (pos !== undefined) hover.pos = pos;
  if (level !== undefined) hover.level = level;

  // Record provenance in precedence order. A layer counts only if it
  // contributed an actual value to one of the resolved fields above.
  if (contributesCustom(custom, hover)) hover.sources.push("custom");
  if (contributesPrebaked(prebaked, custom, hover)) hover.sources.push("prebaked");
  if (contributesDict(dict, custom, prebaked, hover)) hover.sources.push("dict");

  return hover;
}

/** The lexical fields the custom layer can provide. */
function customHasValue(custom: Partial<DictEntry> | undefined): boolean {
  if (!custom) return false;
  return (
    custom.term !== undefined ||
    custom.gloss !== undefined ||
    custom.reading !== undefined ||
    custom.pos !== undefined ||
    custom.level !== undefined
  );
}

/** Custom contributes when it has any usable field. */
function contributesCustom(
  custom: Partial<DictEntry> | undefined,
  _hover: ResolvedHover,
): boolean {
  return customHasValue(custom);
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
  return (
    (prebaked.term !== undefined && custom?.term === undefined) ||
    (prebaked.gloss !== undefined && custom?.gloss === undefined) ||
    (prebaked.reading !== undefined && custom?.reading === undefined) ||
    (prebaked.pos !== undefined && custom?.pos === undefined) ||
    (prebaked.level !== undefined && custom?.level === undefined)
  );
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
  const taken = (
    key: "term" | "gloss" | "reading" | "pos" | "level",
  ): boolean => custom?.[key] !== undefined || prebaked?.[key] !== undefined;
  return (
    (dict.term !== undefined && !taken("term")) ||
    (dict.gloss !== undefined && !taken("gloss")) ||
    (dict.reading !== undefined && !taken("reading")) ||
    (dict.pos !== undefined && !taken("pos")) ||
    (dict.level !== undefined && !taken("level"))
  );
}
