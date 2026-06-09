/**
 * Encoding coverage detection + observational review stats (Phase 7).
 */

import {
  encodingCoverageStats,
  lookupPrebaked,
  type EncodingCoverageStats,
  type ExampleSentence,
} from "@tsumugu/engine";
import type { AppState } from "../state.js";
import { encodingArtifactPath } from "./encoding.js";

/** Vault-relative path for a per-word encoding artifact. */
export { encodingArtifactPath };

/** True when the vault holds `{lang}/encoding/{term}.encoding.json`. */
export async function hasEncodingArtifact(
  app: AppState,
  word: string,
  lang: string = app.studyLang,
): Promise<boolean> {
  if (!app.vault) return false;
  const path = encodingArtifactPath(lang, word);
  const raw = await app.vault.readText(path);
  return raw != null && raw.length > 0;
}

function prebakedHasRichExplanation(
  explanation?: string,
  examples?: ExampleSentence[],
): boolean {
  if (!explanation?.trim()) return false;
  if (!examples?.length) return false;
  return true;
}

/**
 * Pragmatic v1 heuristic: vault artifact, rich prebaked gloss, or a flagged note.
 */
export async function hasEncoding(
  app: AppState,
  word: string,
  lang: string = app.studyLang,
): Promise<boolean> {
  if (await hasEncodingArtifact(app, word, lang)) return true;

  const entry = app.getEntry(word);
  if (entry?.flagNote?.trim()) return true;

  const prebaked = app.content ? lookupPrebaked(app.content, word) : undefined;
  if (prebaked && prebakedHasRichExplanation(prebaked.explanation, prebaked.examples)) {
    return true;
  }

  return false;
}

/** Format FSRS stability for the observational stat line. */
export function formatStabilityDays(stability: number): string {
  if (stability >= 1) return `${stability.toFixed(1)}d`;
  return `${Math.round(stability * 24)}h`;
}

function formatAvgStability(value: number | null): string {
  if (value == null) return "—";
  return formatStabilityDays(value);
}

/** One-line observational stat for review empty/summary surfaces. */
export function formatEncodingCoverageLine(stats: EncodingCoverageStats): string {
  const enc = formatAvgStability(stats.encodedAvgStability);
  const bare = formatAvgStability(stats.bareAvgStability);
  return `encoded ${stats.encodedCount} · bare ${stats.bareCount} · stab encoded ${enc} / bare ${bare}`;
}

/** Compute encoding coverage stats for SRS-tracked words in the study language. */
export async function computeEncodingCoverageStats(
  app: AppState,
  lang: string = app.studyLang,
): Promise<EncodingCoverageStats> {
  const entries = app.store.all(lang).filter((e) => e.srs !== undefined);
  const flags = await Promise.all(
    entries.map((e) => hasEncoding(app, e.word, lang)),
  );
  const encoded = new Set<string>();
  entries.forEach((e, i) => {
    if (flags[i]) encoded.add(e.word);
  });
  return encodingCoverageStats(entries, (word) => encoded.has(word));
}