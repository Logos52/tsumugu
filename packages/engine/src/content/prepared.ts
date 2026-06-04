/**
 * Prepared-content consumer (PRD §5.3, §2.5).
 *
 * The reader ingests batch-generated content files. Unknown words are
 * pre-resolved in a glossary so hover is instant and fully offline — there
 * is never a live API call at read time. This module validates and reads
 * those files; it is pure, DOM-free, and data-free.
 */

import {
  PREPARED_CONTENT_SCHEMA,
  type PreparedContent,
  type PreparedToken,
  type PrebakedEntry,
} from "../types.js";

/**
 * Structural type guard for one prepared token (`{ text, isWord }`).
 * Extra fields are tolerated; the two known fields must have the right type.
 */
function isPreparedToken(x: unknown): x is PreparedToken {
  if (typeof x !== "object" || x === null) return false;
  const t = x as Record<string, unknown>;
  return typeof t.text === "string" && typeof t.isWord === "boolean";
}

/** True when `x` is a plain (non-array, non-null) object. */
function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Runtime schema check for {@link PreparedContent}.
 *
 * Validates the locked-down shape a batch generator emits:
 *  - `schema` is exactly {@link PREPARED_CONTENT_SCHEMA}
 *  - `lang` is a string
 *  - `tokens` is an array of `{ text, isWord }`
 *  - `glossary` is a plain object (word → prebaked entry)
 *
 * Glossary *entries* are not deeply validated here (they are batch output and
 * may legitimately carry extra fields); {@link lookupPrebaked} returns them
 * as-is. The required shape gates ingestion at the boundary.
 */
export function isPreparedContent(x: unknown): x is PreparedContent {
  if (!isPlainObject(x)) return false;
  if (x.schema !== PREPARED_CONTENT_SCHEMA) return false;
  if (typeof x.lang !== "string") return false;
  if (!Array.isArray(x.tokens)) return false;
  if (!x.tokens.every(isPreparedToken)) return false;
  if (!isPlainObject(x.glossary)) return false;
  return true;
}

/**
 * Parse and validate prepared content.
 *
 * Accepts either a JSON string (parsed first) or an already-parsed value.
 * Throws an {@link Error} with a clear message when the input is not valid
 * JSON or fails {@link isPreparedContent}.
 */
export function parsePreparedContent(input: string | unknown): PreparedContent {
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid prepared content: not valid JSON (${reason})`);
    }
  }
  if (!isPreparedContent(value)) {
    throw new Error(
      `Invalid prepared content: expected schema "${PREPARED_CONTENT_SCHEMA}" ` +
        `with a string "lang", a "tokens" array of {text,isWord}, and a ` +
        `"glossary" object.`,
    );
  }
  return value;
}

/**
 * Look up a word's pre-baked resolution in the content glossary.
 *
 * Keyed by surface form (exact match). Returns `undefined` when the word is
 * absent — callers fall back to the dictionary / live layers. Uses a safe
 * own-property lookup so prototype keys (e.g. "toString") never match.
 */
export function lookupPrebaked(
  content: PreparedContent,
  word: string,
): PrebakedEntry | undefined {
  const { glossary } = content;
  if (!Object.prototype.hasOwnProperty.call(glossary, word)) return undefined;
  return glossary[word];
}

/** The lexical (word-like) tokens of the content, in document order. */
export function wordTokens(content: PreparedContent): PreparedToken[] {
  return content.tokens.filter((t) => t.isWord);
}
