/**
 * Prepared-content schema normalizer (Dictionary PRD §6.2).
 *
 * Accepts on-disk `@1` or `@2` payloads and returns a canonical in-memory `@2`
 * shape. This is the only module that knows how to upgrade legacy fields.
 */

import {
  PREPARED_CONTENT_SCHEMA_V2,
  type Collocation,
  type Definitions,
  type EnDefinition,
  type ExampleSentence,
  type MonoDefinition,
  type PreparedContent,
  type PrebakedEntry,
  type PreparedToken,
} from "../types.js";

/** Glossary entry shape as stored on disk before normalization. */
export interface RawPrebakedEntry {
  term: string;
  gloss: string;
  definitions?: Definitions;
  reading?: string;
  pos?: string;
  level?: string;
  /** Legacy @1 bare strings or structured @2 rows. */
  examples?: string[] | ExampleSentence[];
  collocations?: Collocation[];
  /** Legacy @1 leveled blurb — lifted to `definitions.en.explanation`. */
  explanation?: string;
  bridge?: PrebakedEntry["bridge"];
}

/** Prepared content as stored on disk before normalization. */
export interface RawPreparedContent {
  schema: PreparedContent["schema"];
  lang: string;
  title?: string;
  source?: string;
  ciTarget?: number;
  ciMeasured?: number;
  tokens: PreparedToken[];
  glossary: Record<string, RawPrebakedEntry>;
  generatedAt?: string;
}

function isStringExamples(
  examples: string[] | ExampleSentence[],
): examples is string[] {
  return examples.length > 0 && typeof examples[0] === "string";
}

/** Lift legacy `string[]` examples to structured rows. */
export function normalizeExampleRows(
  examples?: string[] | ExampleSentence[],
): ExampleSentence[] | undefined {
  if (examples === undefined) return undefined;
  if (examples.length === 0) return [];
  if (isStringExamples(examples)) {
    return examples.map((text) => ({ text, translation: "" }));
  }
  return examples;
}

function isMonoDefinition(def: unknown): def is MonoDefinition {
  if (typeof def !== "object" || def === null) return false;
  return (def as MonoDefinition).monolingual === true;
}

/** Upgrade Encoding-PRD zh `Definition` rows that used `levelCap` into {@link MonoDefinition}. */
function normalizeZhDefinition(def: unknown): MonoDefinition | undefined {
  if (typeof def !== "object" || def === null) return undefined;
  if (isMonoDefinition(def)) return def;

  const legacy = def as {
    gloss?: string;
    illustration?: string;
    level?: string;
    levelCap?: string;
    achievedLevel?: string;
    levelEscalated?: boolean;
    source?: string;
  };
  if (!legacy.gloss) return undefined;

  const level = legacy.level ?? legacy.levelCap;
  if (!level) return undefined;

  const out: MonoDefinition = {
    gloss: legacy.gloss,
    level,
    monolingual: true,
  };
  if (legacy.illustration !== undefined) out.illustration = legacy.illustration;
  if (legacy.achievedLevel !== undefined) out.achievedLevel = legacy.achievedLevel;
  if (legacy.levelEscalated !== undefined) out.levelEscalated = legacy.levelEscalated;
  if (legacy.source !== undefined) out.source = legacy.source;
  return out;
}

function buildEnDefinition(
  entry: RawPrebakedEntry,
  existing?: EnDefinition,
): EnDefinition | undefined {
  const gloss = existing?.gloss ?? entry.gloss;
  const explanation = existing?.explanation ?? entry.explanation;
  const senses = existing?.senses;

  if (!gloss && !explanation && !senses?.length) return undefined;

  const out: EnDefinition = { gloss: gloss ?? "" };
  if (explanation !== undefined) out.explanation = explanation;
  if (senses !== undefined) out.senses = senses;
  return out;
}

/**
 * Normalize one glossary entry to the canonical in-memory {@link PrebakedEntry}.
 *
 * - `@1`: fill `definitions.en.gloss` from legacy `gloss`; `definitions.en.explanation`
 *   from legacy `explanation`; `examples: string[]` → `[{text, translation:""}]`.
 * - `@2`: pass through structured fields, still normalizing legacy example strings
 *   and Encoding-PRD zh definitions when present.
 */
export function normalizePrebakedEntry(
  entry: RawPrebakedEntry,
  _schema: PreparedContent["schema"],
): PrebakedEntry {
  const examples = normalizeExampleRows(entry.examples);
  const en = buildEnDefinition(entry, entry.definitions?.en);
  const zh = entry.definitions?.zh
    ? normalizeZhDefinition(entry.definitions.zh)
    : undefined;

  const definitions: Definitions | undefined =
    en !== undefined || zh !== undefined ? {} : undefined;
  if (definitions) {
    if (en !== undefined) definitions.en = en;
    if (zh !== undefined) definitions.zh = zh;
  }

  const out: PrebakedEntry = {
    term: entry.term,
    gloss: en?.gloss ?? entry.gloss,
  };
  if (definitions !== undefined) out.definitions = definitions;
  if (entry.reading !== undefined) out.reading = entry.reading;
  if (entry.pos !== undefined) out.pos = entry.pos;
  if (entry.level !== undefined) out.level = entry.level;
  if (examples !== undefined) out.examples = examples;
  if (entry.collocations !== undefined) out.collocations = entry.collocations;
  if (entry.bridge !== undefined) out.bridge = entry.bridge;
  return out;
}

/**
 * Normalize prepared content to canonical in-memory `@2`.
 *
 * On-disk `@1` files load unchanged at the boundary, then upgrade here.
 */
export function normalizePreparedContent(raw: RawPreparedContent): PreparedContent {
  const glossary: Record<string, PrebakedEntry> = {};
  for (const [key, entry] of Object.entries(raw.glossary)) {
    glossary[key] = normalizePrebakedEntry(entry, raw.schema);
  }

  const out: PreparedContent = {
    schema: PREPARED_CONTENT_SCHEMA_V2,
    lang: raw.lang,
    tokens: raw.tokens,
    glossary,
  };
  if (raw.title !== undefined) out.title = raw.title;
  if (raw.source !== undefined) out.source = raw.source;
  if (raw.ciTarget !== undefined) out.ciTarget = raw.ciTarget;
  if (raw.ciMeasured !== undefined) out.ciMeasured = raw.ciMeasured;
  if (raw.generatedAt !== undefined) out.generatedAt = raw.generatedAt;
  return out;
}