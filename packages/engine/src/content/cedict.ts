/**
 * CC-CEDICT gloss normalization (Dictionary PRD §5.2).
 *
 * Pure string transforms — no bundled dictionary data.
 */

import type { EnDefinition, Sense } from "../types.js";

/** Split one CC-CEDICT gloss line on `/` into synonym parts. */
function splitSynonyms(line: string): string[] {
  return line
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Map one CC-CEDICT gloss line to a {@link Sense}. */
export function senseFromCedictGloss(line: string): Sense {
  const synonyms = splitSynonyms(line);
  if (synonyms.length <= 1) return { gloss: line.trim() };
  return { gloss: synonyms.join(" · ") };
}

/**
 * Build {@link EnDefinition} + legacy fields from CC-CEDICT `g[]`.
 *
 * - `definitions.en.gloss` — the first sense's gloss (synonyms joined with ` · `)
 * - `senses[]` — one row per CC-CEDICT gloss line (slash-delimited synonyms
 *   within a line are joined with ` · `)
 * - `legacyGloss` — semicolon-joined lines for back-compat `DictEntry.gloss`
 */
export function enDefinitionFromCedictGlosses(glosses: string[]): {
  en: EnDefinition;
  senses: Sense[];
  legacyGloss: string;
} {
  const senses = glosses.map(senseFromCedictGloss);
  const en: EnDefinition = {
    gloss: senses[0]?.gloss ?? "",
    senses,
  };
  return { en, senses, legacyGloss: glosses.join("; ") };
}