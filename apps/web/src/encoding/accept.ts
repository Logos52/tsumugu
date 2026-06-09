/**
 * Load-time acceptance filters for encoding-page content (PRD §5.3, §5.5).
 *
 * Consumes Dictionary PRD verdicts and artifact shape at render time — drops
 * cards/rows that fail without surfacing user-facing errors.
 */

import type {
  Definition,
  Definitions,
  EnDefinition,
  EncodingPageDoc,
  Etymology,
  ExampleSentence,
  MonoDefinition,
  ResolvedHover,
} from "@tsumugu/engine";

export interface AcceptedDefinitions {
  en?: Definition | EnDefinition;
  zh?: Definition | MonoDefinition;
}

export interface AcceptedEncodingContent {
  definitions: AcceptedDefinitions;
  examples: ExampleSentence[];
  etymology?: Etymology;
}

function isNonEmpty(value?: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function devNote(message: string): void {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") return;
  console.debug(message);
}

/** Lift legacy `string[]` examples to structured rows. */
export function normalizeExampleRows(
  examples?: ExampleSentence[] | string[],
): ExampleSentence[] {
  if (!examples?.length) return [];
  if (typeof examples[0] === "string") {
    return (examples as string[]).map((text) => ({ text, translation: "" }));
  }
  return examples as ExampleSentence[];
}

function isMonoDefinition(def: Definition | MonoDefinition): def is MonoDefinition {
  return "monolingual" in def && def.monolingual === true;
}

function resolveRawDefinitions(
  doc: EncodingPageDoc | null,
  hoverDefs?: Definitions,
): { en?: Definition | EnDefinition; zh?: Definition | MonoDefinition } {
  if (doc?.definitions) {
    return {
      en: doc.definitions.en ?? hoverDefs?.en,
      zh: doc.definitions.zh ?? hoverDefs?.zh,
    };
  }
  return hoverDefs ?? {};
}

/**
 * 簡明中文 card acceptance.
 *
 * - Dictionary PRD {@link MonoDefinition}: accepted when `gloss` is non-empty.
 * - Encoding PRD {@link Definition}: accepted only when `leveledVerdict` is
 *   `"leveled"`.
 */
export function acceptZhDefinition(
  def?: Definition | MonoDefinition,
): Definition | MonoDefinition | undefined {
  if (!def) return undefined;
  if (isMonoDefinition(def)) {
    return def.gloss?.trim() ? def : undefined;
  }
  if (def.leveledVerdict === "leveled") return def;

  const reason =
    def.leveledVerdict === "above-cap"
      ? `above-cap${def.offendingWord ? ` (${def.offendingWord})` : ""}`
      : "missing leveledVerdict";
  devNote(`[encoding] dropped 簡明中文 definition: ${reason}`);
  return undefined;
}

/** Keep example rows with non-empty text and translation. */
export function acceptExampleRows(rows: ExampleSentence[] | undefined): ExampleSentence[] {
  if (!rows?.length) return [];
  return rows.filter((row) => isNonEmpty(row.text) && isNonEmpty(row.translation));
}

/**
 * Example-set acceptance: filter invalid rows, then return up to six accepted
 * rows. When the primary artifact has fewer than three accepted rows, append
 * filtered fallback examples from mergeHover (deduped by text).
 */
export function acceptExamples(
  primary: ExampleSentence[] | undefined,
  fallback?: ExampleSentence[],
): ExampleSentence[] {
  const accepted = acceptExampleRows(primary);
  const fallbackRows = acceptExampleRows(fallback);

  if (accepted.length >= 3 || fallbackRows.length === 0) {
    return accepted.slice(0, 6);
  }

  const seen = new Set(accepted.map((row) => row.text));
  const merged = [...accepted];
  for (const row of fallbackRows) {
    if (merged.length >= 6) break;
    if (seen.has(row.text)) continue;
    seen.add(row.text);
    merged.push(row);
  }
  return merged;
}

/** Character story acceptance: require a grounding tag. */
export function acceptEtymology(etymology?: Etymology): Etymology | undefined {
  if (!etymology?.grounding) return undefined;
  return etymology;
}

/** Apply all load-time acceptance filters for the encoding page. */
export function acceptEncodingContent(
  doc: EncodingPageDoc | null,
  hover: ResolvedHover,
): AcceptedEncodingContent {
  const raw = resolveRawDefinitions(doc, hover.definitions);
  const definitions: AcceptedDefinitions = {
    en: raw.en,
    zh: acceptZhDefinition(raw.zh),
  };

  const primaryExamples = doc?.examples ?? hover.examples;
  const fallbackExamples = doc?.examples !== undefined ? hover.examples : undefined;
  const examples = acceptExamples(primaryExamples, fallbackExamples);

  const etymology = acceptEtymology(doc?.etymology);

  return { definitions, examples, etymology };
}