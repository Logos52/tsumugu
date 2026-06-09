/**
 * `gen encoding-audio` orchestration — pure skeleton (Encoding PRD Phase 5).
 *
 * Writes a `tsumugu/encoding-audio@1` manifest beside the encoding artifact.
 * TTS rendering is deferred to a follow-on pass (reuses the voice-notes worker).
 */

import { ENCODING_AUDIO_SCHEMA, type EncodingAudioManifest } from "@tsumugu/engine";

export { ENCODING_AUDIO_SCHEMA };

/** Default audio output dir, relative to the manifest's directory. */
export const ENCODING_AUDIO_DIR = "audio/encoding";

/** Vault-relative manifest path for a term. */
export function encodingAudioManifestPath(lang: string, term: string): string {
  return `${lang}/encoding/${term.normalize("NFC")}.encoding-audio.json`;
}

/** Build an empty manifest skeleton for a term (paths filled by the CLI later). */
export function buildEncodingAudioManifest(opts: {
  lang: string;
  term: string;
  sentenceCount?: number;
  generatedAt?: string;
}): EncodingAudioManifest {
  const sentences: Record<number, string> = {};
  const n = opts.sentenceCount ?? 0;
  for (let i = 0; i < n; i++) {
    sentences[i] = `${ENCODING_AUDIO_DIR}/${opts.term.normalize("NFC")}-ex-${i}.mp3`;
  }
  const m: EncodingAudioManifest = {
    schema: ENCODING_AUDIO_SCHEMA,
    lang: opts.lang,
    term: opts.term.normalize("NFC"),
    sentences,
  };
  if (opts.generatedAt) {
    // EncodingAudioManifest has no generatedAt in engine type — keep manifest minimal per schema.
    void opts.generatedAt;
  }
  return m;
}