/**
 * Encoding-page consumer (Encoding PRD §6.2).
 *
 * Validates and reads per-word `encoding-page@1` artifacts the app renders
 * offline. Pure, DOM-free, and data-free.
 */

import {
  ENCODING_PAGE_SCHEMA,
  type EncodingPageDoc,
} from "../types.js";

/** True when `x` is a plain (non-array, non-null) object. */
function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Runtime schema check for {@link EncodingPageDoc}.
 *
 * Validates the locked-down shape a batch generator emits:
 *  - `schema` is exactly {@link ENCODING_PAGE_SCHEMA}
 *  - `lang` and `term` are strings
 *
 * Nested content fields are not deeply validated here (they are batch output
 * and may legitimately carry extra fields); the required shape gates ingestion
 * at the boundary.
 */
export function isEncodingPageDoc(x: unknown): x is EncodingPageDoc {
  if (!isPlainObject(x)) return false;
  if (x.schema !== ENCODING_PAGE_SCHEMA) return false;
  if (typeof x.lang !== "string") return false;
  if (typeof x.term !== "string") return false;
  return true;
}

/**
 * Parse and validate an encoding-page artifact.
 *
 * Accepts either a JSON string (parsed first) or an already-parsed value.
 * Returns `null` when the input is not valid JSON or fails
 * {@link isEncodingPageDoc}.
 */
export function parseEncodingPage(json: string | unknown): EncodingPageDoc | null {
  let value: unknown = json;
  if (typeof json === "string") {
    try {
      value = JSON.parse(json);
    } catch {
      return null;
    }
  }
  if (!isEncodingPageDoc(value)) return null;
  return value;
}