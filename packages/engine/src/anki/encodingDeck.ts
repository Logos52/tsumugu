/**
 * Encoding-layer → Anki note assembly (Encoding PRD Phase 5).
 *
 * Front = first accepted i+1 example sentence; back = minimal gloss + reading +
 * optional `[sound:…]` for term audio. Note guid is keyed on lang + NFC term so
 * regenerated sentences update the same card.
 */

import type { EncodingPageDoc, ExampleSentence } from "../types.js";
import type { AnkiDeck, AnkiNote } from "./exporter.js";

export interface BuildEncodingDeckOpts {
  doc: EncodingPageDoc;
  lang: string;
  /** Which definition gloss to show on the back. Defaults to doc.defaultDefinition ?? "en". */
  defaultDefinition?: "en" | "zh";
  /** Resolved vault-relative term audio path (encoding-audio manifest or doc.audio). */
  termAudioPath?: string;
}

/** Unicode-NFC-normalize a CJK term for stable keys. */
export function nfcTerm(term: string): string {
  return term.normalize("NFC");
}

/** Stable Anki guid seed: lang + NFC term (survives sentence regeneration). */
export function encodingGuidSeed(lang: string, term: string): string {
  return `${lang}\x1f${nfcTerm(term)}`;
}

function formatReading(doc: EncodingPageDoc): string {
  const parts: string[] = [];
  if (doc.reading?.zhuyin) parts.push(doc.reading.zhuyin);
  if (doc.reading?.pinyin) parts.push(doc.reading.pinyin);
  return parts.join(" · ");
}

function pickGloss(doc: EncodingPageDoc, pref: "en" | "zh"): string {
  if (pref === "zh" && doc.definitions?.zh?.gloss) return doc.definitions.zh.gloss;
  if (doc.definitions?.en?.gloss) return doc.definitions.en.gloss;
  return doc.definitions?.zh?.gloss ?? "(no gloss)";
}

/** First example with both Chinese text and English translation (load-time acceptance). */
export function firstAcceptedExample(examples?: ExampleSentence[]): ExampleSentence | null {
  if (!examples?.length) return null;
  for (const ex of examples) {
    if (ex.text?.trim() && ex.translation?.trim()) return ex;
  }
  return null;
}

/**
 * Assemble one encoding Anki note from a pre-baked artifact. Returns null when
 * no accepted example sentence is available.
 */
export function buildEncodingNote(opts: BuildEncodingDeckOpts): AnkiNote | null {
  const { doc, lang } = opts;
  const example = firstAcceptedExample(doc.examples);
  if (!example) return null;

  const pref = opts.defaultDefinition ?? doc.defaultDefinition ?? "en";
  const backParts = [pickGloss(doc, pref)];
  const reading = formatReading(doc);
  if (reading) backParts.push(reading);

  const audioPath = opts.termAudioPath ?? doc.audio;
  if (audioPath) {
    const filename = audioPath.replace(/.*\//, "");
    backParts.push(`[sound:${filename}]`);
  }

  return {
    front: example.text,
    back: backParts.join("<br>"),
    tags: ["tsumugu", lang, "encoding"],
    guidSeed: encodingGuidSeed(lang, doc.term),
  };
}

/** Build a single-note encoding deck (empty when no accepted example exists). */
export function buildEncodingDeck(opts: BuildEncodingDeckOpts): AnkiDeck {
  const note = buildEncodingNote(opts);
  return {
    name: `Tsumugu ${opts.lang} encoding`,
    notes: note ? [note] : [],
  };
}