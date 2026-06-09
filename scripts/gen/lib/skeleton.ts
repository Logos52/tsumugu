/**
 * Build a PreparedContent *skeleton* from source text: segment with the pack,
 * find words the user does not yet know (vs the store), and create empty
 * glossary slots for them — seeded with whatever the pack's offline dictionary
 * already knows. The agent then fills the empty glosses/explanations via
 * `prompts/content-prep.md`. This is the deterministic, no-LLM half of prep.
 */
import {
  isKnown,
  PREPARED_CONTENT_SCHEMA,
  type LanguagePack,
  type WordStore,
  type PreparedContent,
  type PreparedToken,
  type PrebakedEntry,
  type KnownPolicy,
} from "@tsumugu/engine";
import {
  allowListWords,
  loadDefLevelIndex,
  resolveDefFloorBand,
  type DefLevelIndex,
} from "./defLevelData.js";
import { exampleTargetCount, seedSharedExampleSlots } from "./examples.js";
import { collocationTargetCount, seedCollocationSlots } from "./collocations.js";

export interface SkeletonOptions {
  lang: string;
  pack: LanguagePack;
  store: WordStore;
  text: string;
  title?: string;
  source?: string;
  ciTarget?: number;
  policy?: KnownPolicy;
  /** TOCFL floor band for monolingual zh defs (default TOCFL-3 / env). */
  defFloorBand?: string;
  /** Optional pre-loaded index (tests); zh-Hant loads private pack data by default. */
  defLevelIndex?: DefLevelIndex;
}

export interface SkeletonResult {
  content: PreparedContent;
  /** Distinct unknown words the agent must resolve (gloss/explanation empty). */
  unknownWords: string[];
  /** Defining-vocabulary allow-list for the floor band (zh-Hant monolingual fill). */
  allowList?: string[];
  /** Resolved floor band stamped on seeded `definitions.zh.level`. */
  defFloorBand?: string;
  /** Per-headword shared example slot counts (zh-Hant dictionary fill). */
  exampleTargetByWord?: Record<string, number>;
  /** Per-headword collocation slot counts (zh-Hant dictionary fill). */
  collocationTargetByWord?: Record<string, number>;
}

function resolveDefIndex(lang: string, explicit?: DefLevelIndex): DefLevelIndex | undefined {
  if (explicit !== undefined) return explicit;
  if (lang !== "zh-Hant") return undefined;
  try {
    return loadDefLevelIndex();
  } catch {
    return undefined;
  }
}

export async function buildSkeleton(opts: SkeletonOptions): Promise<SkeletonResult> {
  const tokens = await opts.pack.segmenter(opts.text);
  const preparedTokens: PreparedToken[] = tokens.map((t) => ({
    text: t.text,
    isWord: t.isWord,
  }));

  const unknown = new Set<string>();
  for (const t of tokens) {
    if (!t.isWord) continue;
    const status = opts.store.getStatus(opts.lang, t.text);
    if (!isKnown(status, opts.policy)) unknown.add(t.text);
  }

  const defFloorBand =
    opts.lang === "zh-Hant" ? resolveDefFloorBand(opts.defFloorBand) : undefined;
  const defIndex = resolveDefIndex(opts.lang, opts.defLevelIndex);
  const allowList =
    defFloorBand !== undefined && defIndex !== undefined
      ? allowListWords(defFloorBand, defIndex)
      : undefined;

  const exampleTargetByWord: Record<string, number> = {};
  const collocationTargetByWord: Record<string, number> = {};
  const glossary: Record<string, PrebakedEntry> = {};
  for (const word of unknown) {
    const dict = await opts.pack.dictionaryProvider(word);
    const level = await opts.pack.levelingModel(word);
    const reading = dict?.reading ?? opts.pack.phoneticLayer.reading(word, dict);
    const entry: PrebakedEntry = {
      term: word,
      gloss: dict?.gloss ?? "", // empty → agent fills
      explanation: "", // agent fills (leveled, monolingual by default)
      examples: opts.lang === "zh-Hant" ? seedSharedExampleSlots(word) : [],
    };
    if (opts.lang === "zh-Hant") {
      exampleTargetByWord[word] = exampleTargetCount(word);
      collocationTargetByWord[word] = collocationTargetCount(word);
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

  const content: PreparedContent = {
    schema: PREPARED_CONTENT_SCHEMA,
    lang: opts.lang,
    tokens: preparedTokens,
    glossary,
    ciTarget: opts.ciTarget ?? 0.95,
    source: opts.source ?? "gen-prep",
  };
  if (opts.title !== undefined) content.title = opts.title;

  return {
    content,
    unknownWords: [...unknown],
    ...(allowList !== undefined ? { allowList } : {}),
    ...(defFloorBand !== undefined ? { defFloorBand } : {}),
    ...(Object.keys(exampleTargetByWord).length
      ? { exampleTargetByWord }
      : {}),
    ...(Object.keys(collocationTargetByWord).length
      ? { collocationTargetByWord }
      : {}),
  };
}