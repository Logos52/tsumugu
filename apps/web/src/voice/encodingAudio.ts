/**
 * Encoding-layer audio — the encoding page's view of a `tsumugu/encoding-audio@1`
 * sidecar (`gen encoding-audio` output): term-level + per-sentence Serena clips.
 * Mirrors `wordAudio.ts`; inert until a manifest is present (Web Speech fallback).
 */

import type { EncodingAudioManifest, VaultIO } from "@tsumugu/engine";
import { ENCODING_AUDIO_SCHEMA } from "@tsumugu/engine";
import type { EncodingPageDoc } from "@tsumugu/engine";
import { resolveAudioPath } from "./manifest.js";

export { ENCODING_AUDIO_SCHEMA };

export interface EncodingAudioBinding {
  manifest: EncodingAudioManifest;
  /** Vault-relative directory of the manifest; audio paths resolve against it. */
  baseDir: string;
}

/** Vault-relative path for a per-word encoding-audio manifest. */
export function encodingAudioManifestPath(lang: string, term: string): string {
  return `${lang}/encoding/${term.normalize("NFC")}.encoding-audio.json`;
}

/** Parse + validate raw JSON, or null when it isn't a `tsumugu/encoding-audio@1` doc. */
export function parseEncodingAudio(raw: unknown): EncodingAudioManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== ENCODING_AUDIO_SCHEMA) return null;
  if (typeof o.lang !== "string" || typeof o.term !== "string") return null;
  if (typeof o.sentences !== "object" || o.sentences === null) return null;

  const sentences: Record<number, string> = {};
  for (const [k, v] of Object.entries(o.sentences as Record<string, unknown>)) {
    const idx = Number(k);
    if (!Number.isInteger(idx) || idx < 0) continue;
    if (typeof v === "string" && v.length > 0) sentences[idx] = v;
  }

  const m: EncodingAudioManifest = {
    schema: ENCODING_AUDIO_SCHEMA,
    lang: o.lang,
    term: o.term.normalize("NFC"),
    sentences,
  };
  if (typeof o.termAudio === "string" && o.termAudio.length > 0) m.termAudio = o.termAudio;
  return m;
}

/** Bind a parsed manifest to its directory. */
export function bindEncodingAudio(manifest: EncodingAudioManifest, baseDir: string): EncodingAudioBinding {
  return { manifest, baseDir };
}

/** Load an encoding-audio manifest from the vault, or null when absent/invalid. */
export async function discoverEncodingAudio(
  vault: VaultIO | null | undefined,
  lang: string,
  term: string,
): Promise<EncodingAudioBinding | null> {
  if (!vault?.readText) return null;
  const path = encodingAudioManifestPath(lang, term);
  let raw: string | null;
  try {
    raw = await vault.readText(path);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const manifest = parseEncodingAudio(parsed);
  if (!manifest) return null;
  const slash = path.lastIndexOf("/");
  const baseDir = slash >= 0 ? path.slice(0, slash) : "";
  return bindEncodingAudio(manifest, baseDir);
}

/** Resolved vault path for term audio: manifest → doc.audio fallback. */
export function resolveTermAudioPath(
  binding: EncodingAudioBinding | null,
  doc: EncodingPageDoc | null,
): string | null {
  if (binding?.manifest.termAudio) {
    return resolveAudioPath(binding.baseDir, binding.manifest.termAudio);
  }
  if (doc?.audio) return doc.audio;
  return null;
}

/** Resolved vault path for a sentence row: manifest → doc example audio fallback. */
export function resolveSentenceAudioPath(
  binding: EncodingAudioBinding | null,
  doc: EncodingPageDoc | null,
  index: number,
): string | null {
  const fromManifest = binding?.manifest.sentences[index];
  if (fromManifest) return resolveAudioPath(binding.baseDir, fromManifest);
  const fromDoc = doc?.examples?.[index]?.audio;
  return fromDoc ?? null;
}