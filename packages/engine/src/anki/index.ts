/**
 * Anki `.apkg` exporter — public API barrel.
 *
 * Client-side, deterministic, DOM-free genanki-style export (sql.js + fflate).
 */

export { buildApkg, ANKI_DEFAULT_NOW, guidFor } from "./exporter.js";
export type { AnkiNote, AnkiDeck, AnkiMedia, AnkiExportOptions } from "./exporter.js";
export {
  buildEncodingDeck,
  buildEncodingNote,
  encodingGuidSeed,
  firstAcceptedExample,
  nfcTerm,
} from "./encodingDeck.js";
export type { BuildEncodingDeckOpts } from "./encodingDeck.js";
export { sha1Hex } from "./sha1.js";
