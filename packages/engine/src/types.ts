/**
 * Tsumugu core domain types — language-agnostic, DOM-free, data-free.
 *
 * This file is the LOCKED contract the rest of the engine builds against.
 * Everything here is plain data (JSON-serializable) or pure type. No DOM,
 * no filesystem, no language-specific data, no API keys. See PRD §5–§6.
 */

// ───────────────────────────────────────────────────────────────────────────
// Word-status model (PRD §5.2) — graded 1-4 / Known / Ignore.
// ───────────────────────────────────────────────────────────────────────────

/**
 * A word's known-ness. `"new"` is the implicit default for any word not yet
 * present in the store (strongest highlight). `l1..l4` are the learning
 * levels (fading highlight). `known`/`ignored` are terminal (no highlight).
 */
export type WordStatus =
  | "new" // 0 — never graded; strongest highlight
  | "l1" // 1 — "New"
  | "l2" // 2 — "Recognized"
  | "l3" // 3 — "Familiar"
  | "l4" // 4 — "Learned"
  | "known" // ✓ — fully known
  | "ignored"; // ✗ — ignored (names, numerals, deliberate skips)

/** Canonical ordering used for cycling / progress math. */
export const STATUS_ORDER: readonly WordStatus[] = [
  "new",
  "l1",
  "l2",
  "l3",
  "l4",
  "known",
  "ignored",
] as const;

/** Human-facing status labels. */
export const STATUS_LABELS: Record<WordStatus, string> = {
  new: "New",
  l1: "New",
  l2: "Recognized",
  l3: "Familiar",
  l4: "Learned",
  known: "Known",
  ignored: "Ignored",
};

/**
 * Numeric level for `new`/`l1..l4` (0..4), or `null` for terminal states.
 * Used by the CI scorer and coloring intensity.
 */
export const STATUS_LEVEL: Record<WordStatus, number | null> = {
  new: 0,
  l1: 1,
  l2: 2,
  l3: 3,
  l4: 4,
  known: null,
  ignored: null,
};

/** A status counts toward "known" for CI purposes (PRD §5.4, §5.9). */
export type KnownPolicy = {
  /** Statuses treated as comprehended. Default: `["l4","known","ignored"]`. */
  knownStatuses: readonly WordStatus[];
};

// ───────────────────────────────────────────────────────────────────────────
// Segmentation (PRD §6 "Segmentation (pluggable)").
// ───────────────────────────────────────────────────────────────────────────

/** A single segmented token with source offsets. */
export interface Token {
  /** The surface text of this token. */
  text: string;
  /** Inclusive start char offset in the source string. */
  start: number;
  /** Exclusive end char offset in the source string. */
  end: number;
  /** Word-like (lexical) vs punctuation / whitespace / numerals. */
  isWord: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// Phonetics & leveling (pack-provided; PACK-AUTHORING.md).
// ───────────────────────────────────────────────────────────────────────────

/** Reading-system layer (Zhuyin/Pinyin; vi Latin+tones; …). */
export interface PhoneticLayer {
  /** Identifier, e.g. "zhuyin", "pinyin", "vi-latin". */
  id: string;
  /** Reading for a word (e.g. "ㄋㄧˇ ㄏㄠˇ" / "nǐ hǎo"). */
  reading(word: string, dict?: DictEntry): string | undefined;
  /**
   * Optional per-syllable tone classes for tone coloring (PRD §5.8).
   * zh: 1–4 + 5 (neutral). Returns one class per syllable, or undefined.
   * Separate from status coloring; off by default in the UI.
   */
  toneClasses?(word: string, reading?: string): number[] | undefined;
}

/** Difficulty/frequency band (zh: TOCFL; vi: frequency + 6-level). */
export interface Level {
  /** Display band, e.g. "TOCFL-A1", "freq-1k". */
  band: string;
  /** Optional frequency rank (lower = more frequent). */
  rank?: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Dictionary entries (pack base + custom/override layer; PRD §5.3).
// ───────────────────────────────────────────────────────────────────────────

export interface Sense {
  gloss: string;
  pos?: string;
  register?: string;
}

/** A leveled or English definition (Encoding PRD §6.2; Dictionary PRD shared contract). */
export interface Definition {
  gloss: string;
  senses?: Sense[];
  explanation?: string;
  /** Band the zh definition was leveled under (e.g. "TOCFL-B1"). */
  levelCap?: string;
  /** Verdict from the Dictionary PRD leveling verifier; consumed, not produced here. */
  leveledVerdict?: "leveled" | "above-cap";
  /** Offending word named by the upstream leveling verdict. */
  offendingWord?: string;
}

/** A structured example sentence (Encoding PRD §5.3). */
export interface ExampleSentence {
  text: string;
  translation: string;
  reading?: string;
  audio?: string;
  source?: string;
  sense?: string;
}

/** Character-story / etymology block (Encoding PRD §5.4). */
export interface Etymology {
  parts: { char: string; reading?: string; gloss?: string; note?: string }[];
  payoff: string;
  grounding: "sourced" | "mnemonic-device" | "speculative";
  confidence?: number;
  source?: string;
}

export interface Mnemonic {
  text: string;
  grounding: "mnemonic-device" | "speculative";
  confidence?: number;
}

export interface Tricky {
  text: string;
  confusable?: string;
}

export interface RelatedLink {
  word: string;
  relation?: "antonym" | "confusable" | "neighbour";
}

/** A resolved dictionary entry. `source` distinguishes provenance/precedence. */
export interface DictEntry {
  term: string;
  /** Primary gloss (monolingual-leveled default, or L2 toggle). */
  gloss: string;
  /** Dual-definition payload (@2); preferred over legacy `gloss` when present. */
  definitions?: { en?: Definition; zh?: Definition };
  reading?: string;
  senses?: Sense[];
  pos?: string;
  /** Audio reference (URL or media id); audio itself is Web Speech at runtime. */
  audio?: string;
  /** Leveling band string (e.g. "TOCFL-A1"). */
  level?: string;
  /**
   * Provenance. Custom/override entries (user-authored, in the vault) take
   * precedence over packaged base entries. Generated = batch AI output.
   */
  source?: "packaged" | "custom" | "generated" | (string & {});
}

// ───────────────────────────────────────────────────────────────────────────
// Cross-language bridge (Hán-Việt; PRD §5.6).
// ───────────────────────────────────────────────────────────────────────────

/** A morpheme correspondence in a bridged word. */
export interface BridgeMorpheme {
  /** Surface morpheme in the target language (e.g. vi "phát"). */
  surface: string;
  /** Etymon in the bridge language (e.g. zh "發"). */
  etymon: string;
  reading?: string;
  gloss?: string;
}

/** Bridge information for one word (e.g. vi Sino word → Hanzi etymon). */
export interface BridgeInfo {
  /** Bridge language id (e.g. "zh-Hant"). */
  bridgeLang: string;
  /** Full etymon string in the bridge script (e.g. "發展"). */
  etymon?: string;
  /** Bridge reading (e.g. Hán-Việt reading "phát triển"). */
  bridgeReading?: string;
  morphemes?: BridgeMorpheme[];
  meaning?: string;
  /** 0..1 model confidence; low confidence is surfaced for correction. */
  confidence?: number;
  /** True once a human has confirmed/corrected this entry. */
  corrected?: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// SRS state (pull-based; ts-fsrs serialization; PRD §5; §7).
// ───────────────────────────────────────────────────────────────────────────

/** Serialized FSRS card state, persisted per word in the vault store. */
export interface SrsState {
  /** ISO datetime the card is next due. */
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  /** ts-fsrs State enum value (0=New,1=Learning,2=Review,3=Relearning). */
  state: number;
  /** ISO datetime of the last review, if any. */
  lastReview?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Word store (lives in the vault as JSON; PRD §5.2, §6.4, §8).
// ───────────────────────────────────────────────────────────────────────────

/** A cross-language reference (etymon link) to another store entry. */
export interface WordRef {
  lang: string;
  word: string;
}

/**
 * A link to the same word in an external tool, preserved verbatim so a status
 * decision is reversible and a future write-back can re-address the exact row.
 * The external SRS keys its word list on a 4-tuple `(dictForm, secondary,
 * partOfSpeech, language)`; Tsumugu keys `(lang, word)`, so several external rows
 * can collapse to one Tsumugu entry. Keeping the tuple here makes that collapse
 * reversible.
 */
export interface ExternalRef {
  source: "srs" | (string & {});
  /** External word-list composite key — the dictionary/lemma form. */
  dictForm: string;
  /** Secondary disambiguator (reading/sense index). */
  secondary: string;
  /** Part of speech. */
  partOfSpeech: string;
  /** External language code (as the external tool stores it). */
  language: string;
  /** External per-word change epoch (ms) — the external clock for conflict resolution. */
  mod: number;
}

/** One persisted entry, keyed by (lang, word). */
export interface WordEntry {
  lang: string;
  word: string;
  status: WordStatus;
  /** ISO datetime first encountered. */
  firstSeen?: string;
  /** ISO datetime last encountered. */
  lastSeen?: string;
  /** Number of times encountered while reading. */
  seenCount?: number;
  /** Flag-for-clarification (PRD §2.4) — collected for the next batch run. */
  flagged?: boolean;
  flagNote?: string;
  /** Custom/override dictionary fields (user-authored). */
  custom?: Partial<DictEntry>;
  /**
   * Provenance of the current `status` (PRD §5.7, two-way sync). Distinct from
   * `lastSeen`, which is stamped on every encounter: `statusUpdatedAt` moves
   * ONLY on a real status change, so it is a usable clock for reconciliation.
   */
  statusUpdatedAt?: string;
  /** What last set the status. */
  statusSource?: "tsumugu" | "srs" | "import" | (string & {});
  /** How the status was set (user grade vs SRS study vs bulk import). */
  statusOrigin?: "manual" | "study" | "import" | (string & {});
  /** Links to this word in external tools (for reversible write-back). */
  externalRefs?: ExternalRef[];
  /** FSRS scheduling state, if this word is in the SRS. */
  srs?: SrsState;
  /** Cross-language etymon links (PRD §5.6). */
  related?: WordRef[];
  tags?: string[];
  notes?: string;
}

/** The vault word-store document (one JSON file, syncs across machines). */
export interface WordStoreDoc {
  /** `@2` adds the per-word provenance envelope; `@1` files load unchanged. */
  schema: "tsumugu/word-store@1" | "tsumugu/word-store@2";
  /** ISO datetime of last write. */
  updatedAt?: string;
  entries: WordEntry[];
}

/** Current schema written on save. `@1` is still accepted on load (additive). */
export const WORD_STORE_SCHEMA = "tsumugu/word-store@2" as const;
/** The pre-provenance schema; load() accepts it and treats fields as absent. */
export const WORD_STORE_SCHEMA_V1 = "tsumugu/word-store@1" as const;

// ───────────────────────────────────────────────────────────────────────────
// Prepared content — the batch-generation output the reader consumes
// (PRD §5.3, §2.5). Unknown words are PRE-RESOLVED so hover is instant+offline.
// ───────────────────────────────────────────────────────────────────────────

/** A pre-baked resolution for one (usually unknown) word. */
export interface PrebakedEntry {
  term: string;
  gloss: string;
  /** Dual-definition payload (@2); preferred over legacy `gloss` when present. */
  definitions?: { en?: Definition; zh?: Definition };
  reading?: string;
  pos?: string;
  level?: string;
  /** Example sentences — legacy `string[]` or structured `ExampleSentence[]`. */
  examples?: string[] | ExampleSentence[];
  /** Pre-baked AI explanation (PRD §2.1) — shown on hover, NO live call. */
  explanation?: string;
  /** vi: the Hán-Việt bridge box (PRD §5.8). */
  bridge?: BridgeInfo;
}

/** A token in prepared content (segmentation already done by the generator). */
export interface PreparedToken {
  text: string;
  isWord: boolean;
}

/** A unit of reader content produced by a batch generation run. */
export interface PreparedContent {
  schema: "tsumugu/prepared-content@1" | "tsumugu/prepared-content@2";
  lang: string;
  title?: string;
  /** Source descriptor (clipped URL, transcript name, or "directed"/"auto"). */
  source?: string;
  /** CI target this was calibrated to (0..1), e.g. 0.95. */
  ciTarget?: number;
  /** CI coverage measured at generation time (0..1). */
  ciMeasured?: number;
  /** Ordered tokens (words + punctuation), ready to render. */
  tokens: PreparedToken[];
  /** word → pre-baked resolution. Keyed by surface form. */
  glossary: Record<string, PrebakedEntry>;
  /** ISO datetime generated. */
  generatedAt?: string;
}

export const PREPARED_CONTENT_SCHEMA = "tsumugu/prepared-content@1" as const;
/** Current prepared-content schema written by new generators. `@1` still accepted on load. */
export const PREPARED_CONTENT_SCHEMA_V2 = "tsumugu/prepared-content@2" as const;

// ───────────────────────────────────────────────────────────────────────────
// Encoding page — per-word memory artifact (Encoding PRD §6.2).
// ───────────────────────────────────────────────────────────────────────────

export const ENCODING_PAGE_SCHEMA = "tsumugu/encoding-page@1" as const;

/** Per-word encoding audio manifest (term + per-sentence Serena clips). */
export const ENCODING_AUDIO_SCHEMA = "tsumugu/encoding-audio@1" as const;

/** `gen encoding-audio` sidecar: term-level + indexed example-sentence audio paths. */
export interface EncodingAudioManifest {
  schema: typeof ENCODING_AUDIO_SCHEMA;
  lang: string;
  term: string;
  /** mp3 path relative to the manifest's directory. */
  termAudio?: string;
  /** 0-based example index → mp3 path relative to the manifest's directory. */
  sentences: Record<number, string>;
}

/** App-consumed per-word encoding artifact (Encoding PRD §6.2). */
export interface EncodingPageDoc {
  schema: typeof ENCODING_PAGE_SCHEMA;
  lang: string;
  /** NFC CJK term; == the wiki twin's `word:` audit key. */
  term: string;
  reading?: { zhuyin?: string; pinyin?: string };
  pos?: string;
  level?: string;
  audio?: string;
  definitions?: { en?: Definition; zh?: Definition };
  /** Generation-time fallback hint; app setting wins once ever set. */
  defaultDefinition?: "en" | "zh";
  examples?: ExampleSentence[];
  etymology?: Etymology;
  mnemonic?: Mnemonic;
  tricky?: Tricky;
  related?: RelatedLink[];
  vividExample?: ExampleSentence;
  bridge?: BridgeInfo;
  flagNote?: string;
  generatedAt?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// CI coverage report (PRD §5.4, §5.9).
// ───────────────────────────────────────────────────────────────────────────

export interface CiReport {
  lang: string;
  /** Total lexical (isWord) tokens considered. */
  totalWordTokens: number;
  /** Tokens whose word is "known" per the KnownPolicy. */
  knownWordTokens: number;
  /** knownWordTokens / totalWordTokens (0..1). */
  coverage: number;
  /** Target coverage this was checked against (0..1). */
  target: number;
  meetsTarget: boolean;
  /** Distinct unknown words with their occurrence counts (desc). */
  unknownWords: { word: string; count: number }[];
  /** Recycle check for directed target words (≥3× recommended; PRD §5.4). */
  targetRecycle?: { word: string; count: number; ok: boolean }[];
}

// ───────────────────────────────────────────────────────────────────────────
// Learner-outcome metrics (read-only; PRD §5.9).
// ───────────────────────────────────────────────────────────────────────────

export interface ProgressMetrics {
  lang: string;
  /** Count of entries per status. */
  byStatus: Record<WordStatus, number>;
  /** Words at l4/known/ignored (comprehended). */
  knownCount: number;
  /** Total tracked words for this language. */
  trackedCount: number;
  /** Words flagged for clarification. */
  flaggedCount: number;
  /** Words currently due in the SRS. */
  dueCount?: number;
}

// ───────────────────────────────────────────────────────────────────────────
// External-vocab cross-reference (PRD §5.7).
// ───────────────────────────────────────────────────────────────────────────

/** A normalized record imported from an external vocab source. */
export interface ExternalVocabRecord {
  source: "srs" | "anki" | (string & {});
  lang: string;
  word: string;
  /** Mapped Tsumugu status if derivable, else raw external status string. */
  status?: WordStatus;
  externalStatus?: string;
  reading?: string;
  gloss?: string;
  /** Free-form passthrough of the original record. */
  raw?: Record<string, unknown>;
}

/** Per-word reconciliation of store vs external sources. */
export interface ReconciledWord {
  lang: string;
  word: string;
  /** Status in the Tsumugu store, if present. */
  storeStatus?: WordStatus;
  /** Status(es) per external source. */
  external: { source: string; status?: WordStatus; externalStatus?: string }[];
  /** True if sources disagree with the store or each other. */
  conflict: boolean;
}

export interface ReconciliationReport {
  lang: string;
  reconciled: ReconciledWord[];
  conflicts: ReconciledWord[];
  /** Words present externally but missing from the store. */
  missingFromStore: ReconciledWord[];
}
