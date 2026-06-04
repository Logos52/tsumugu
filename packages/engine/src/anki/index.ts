/**
 * Anki `.apkg` exporter — public API barrel.
 *
 * Client-side, deterministic, DOM-free genanki-style export (sql.js + fflate).
 */

export { buildApkg, ANKI_DEFAULT_NOW } from "./exporter.js";
export type { AnkiNote, AnkiDeck, AnkiExportOptions } from "./exporter.js";
export { sha1Hex } from "./sha1.js";
