/**
 * SRS word-exporter adapter (PRD §5.7).
 *
 * An SRS word exporter produces JSON in a few shapes depending on version and
 * export path. This adapter is intentionally resilient: it accepts
 *   - a bare array of records, or
 *   - an object wrapping the array under `words` or `cards`.
 * Anything that isn't recognizable is skipped rather than throwing — import of a
 * third-party file must never crash the reader.
 *
 * Status mapping assumptions (SRS knownness → Tsumugu WordStatus),
 * case-insensitive:
 *   - "KNOWN" / "known"    → "known"
 *   - "LEARNING"           → "l3"      (a single learning bucket maps to
 *                                        "Familiar"; we have no finer signal)
 *   - "UNKNOWN" / "new"    → "new"
 *   - "IGNORED"            → "ignored"
 * Any other value leaves `status` undefined and is preserved verbatim in
 * `externalStatus` so reconciliation can surface it without guessing.
 *
 * Language: the interface's `parse(input)` signature is fixed, so we read `lang`
 * from each record (fields `lang` or `language`). When a record carries no
 * language we fall back to the module default `DEFAULT_LANG` ("und", the
 * ISO 639-2 "undetermined" code) rather than dropping the record.
 */

import type { ExternalVocabRecord, WordStatus } from "../types.js";
import type { ExternalVocabAdapter } from "./adapter.js";

/** ISO 639-2 "undetermined" — used when a record carries no language. */
export const DEFAULT_LANG = "und";

/**
 * Maps a raw SRS knownness string to a Tsumugu `WordStatus`.
 * Returns `undefined` for unrecognized values (caller keeps the raw string).
 */
export function mapKnownness(raw: string): WordStatus | undefined {
  switch (raw.trim().toLowerCase()) {
    case "known":
      return "known";
    case "learning":
      return "l3";
    case "unknown":
    case "new":
      return "new";
    case "ignored":
      return "ignored";
    default:
      return undefined;
  }
}

/** Narrow `unknown` to a plain record without trusting prototypes. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Read a string field by name, trimming; undefined if absent/non-string/empty. */
function readString(
  rec: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
}

/** Pull the record array out of whatever shape the export handed us. */
function extractRecords(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (isPlainObject(input)) {
    const words = input["words"];
    if (Array.isArray(words)) return words;
    const cards = input["cards"];
    if (Array.isArray(cards)) return cards;
  }
  return [];
}

/** Normalize one raw SRS record; returns undefined if it has no usable word. */
function toRecord(raw: unknown): ExternalVocabRecord | undefined {
  if (!isPlainObject(raw)) return undefined;

  const word = readString(raw, "word", "term", "text", "expression");
  if (word === undefined) return undefined;

  const lang = readString(raw, "lang", "language") ?? DEFAULT_LANG;
  const externalStatus = readString(raw, "status", "knownness", "known");
  const reading = readString(raw, "reading", "pronunciation");
  const gloss = readString(raw, "gloss", "meaning", "definition");

  const record: ExternalVocabRecord = {
    source: "srs",
    lang,
    word,
    raw,
  };

  if (externalStatus !== undefined) {
    record.externalStatus = externalStatus;
    const mapped = mapKnownness(externalStatus);
    if (mapped !== undefined) record.status = mapped;
  }
  if (reading !== undefined) record.reading = reading;
  if (gloss !== undefined) record.gloss = gloss;

  return record;
}

/** The SRS word-exporter adapter. */
export const srsAdapter: ExternalVocabAdapter = {
  source: "srs",
  parse(input: unknown): ExternalVocabRecord[] {
    const out: ExternalVocabRecord[] = [];
    for (const raw of extractRecords(input)) {
      const record = toRecord(raw);
      if (record !== undefined) out.push(record);
    }
    return out;
  },
};
