/**
 * Public API of the `content` module — the prepared-content consumer and
 * offline hover resolver (PRD §5.3, §2.5, §2.1).
 */

export {
  isPreparedContent,
  parsePreparedContent,
  lookupPrebaked,
  wordTokens,
} from "./prepared.js";

export {
  normalizePreparedContent,
  normalizePrebakedEntry,
  normalizeExampleRows,
} from "./schema.js";
export type { RawPreparedContent, RawPrebakedEntry } from "./schema.js";

export { isEncodingPageDoc, parseEncodingPage } from "./encodingPage.js";

export { mergeHover } from "./hover.js";
export type { ResolvedHover, HoverSource } from "./hover.js";

export { enDefinitionFromCedictGlosses, senseFromCedictGloss } from "./cedict.js";

export {
  computeHighlightSpans,
  validateHighlightSpans,
  renderHighlightSpans,
} from "./highlightSpans.js";
export type { TextSpan, HighlightSpanValidation } from "./highlightSpans.js";
