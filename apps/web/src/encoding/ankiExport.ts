/**
 * Export encoding-layer words to Anki (Encoding PRD Phase 5): sentence-mining
 * cards with term-keyed guids and embedded term audio when present.
 */

import { buildEncodingDeck, parseEncodingPage, type AnkiDeck, type AnkiMedia } from "@tsumugu/engine";
import type { AppState } from "../state.js";
import { resolveDictDefault } from "../state.js";
import { exportAndDownloadApkg } from "../host/anki.js";
import { encodingArtifactPath } from "./encoding.js";
import {
  discoverEncodingAudio,
  resolveTermAudioPath,
} from "../voice/encodingAudio.js";

async function loadEncodingDoc(app: AppState, term: string) {
  const path = encodingArtifactPath(app.lang, term);
  const raw = await app.vault?.readText(path);
  if (!raw) return null;
  return parseEncodingPage(raw);
}

/**
 * Build an encoding Anki deck for the given words (or all learning words when
 * omitted), embedding term audio bytes when readable.
 */
export async function buildEncodingAnkiDeck(
  app: AppState,
  words?: string[],
): Promise<AnkiDeck | null> {
  const readBytes = app.vault?.readBytes;
  if (!readBytes) return null;

  const learning = new Set(["l1", "l2", "l3", "l4"]);
  const targetWords =
    words ??
    app.store
      .all(app.lang)
      .filter((e) => learning.has(e.status))
      .map((e) => e.word);

  if (targetWords.length === 0) return null;

  const defaultDefinition = resolveDictDefault(app.settings);
  const notes: AnkiDeck["notes"] = [];
  const media: AnkiMedia[] = [];
  const seenMedia = new Set<string>();

  for (const term of targetWords) {
    const doc = await loadEncodingDoc(app, term);
    if (!doc) continue;

    const audioBinding = await discoverEncodingAudio(app.vault, app.lang, term);
    const termAudioPath = resolveTermAudioPath(audioBinding, doc);
    const partial = buildEncodingDeck({
      doc,
      lang: app.lang,
      defaultDefinition,
      termAudioPath: termAudioPath ?? undefined,
    });
    const note = partial.notes[0];
    if (!note) continue;
    notes.push(note);

    if (termAudioPath && note.back.includes("[sound:")) {
      const filename = termAudioPath.replace(/.*\//, "");
      if (!seenMedia.has(filename)) {
        const bytes = await readBytes.call(app.vault, termAudioPath);
        if (bytes) {
          media.push({ filename, bytes });
          seenMedia.add(filename);
        }
      }
    }
  }

  if (notes.length === 0) return null;
  return {
    name: `Tsumugu ${app.lang} encoding`,
    notes,
    ...(media.length ? { media } : {}),
  };
}

/** Export encoding cards and download the `.apkg`. */
export async function exportEncodingAnki(app: AppState, words?: string[]): Promise<string | null> {
  const deck = await buildEncodingAnkiDeck(app, words);
  if (!deck) return null;
  await exportAndDownloadApkg(deck, `tsumugu-${app.lang}-encoding.apkg`);
  return `Exported ${deck.notes.length} encoding cards.`;
}