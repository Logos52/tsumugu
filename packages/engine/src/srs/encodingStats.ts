/**
 * Observational encoding-coverage stats (PRD-Encoding-Layer Phase 7).
 *
 * Compares FSRS stability/lapses for words classified as "encoded" vs "bare".
 * Pure and vault-free — the host injects `hasEncoding`.
 */

import type { WordEntry } from "../types.js";

export interface EncodingCoverageStats {
  /** Words with an encoding artifact or rich prebaked explanation. */
  encodedCount: number;
  bareCount: number;
  encodedAvgStability: number | null;
  bareAvgStability: number | null;
  encodedAvgLapses: number | null;
  bareAvgLapses: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Split SRS-tracked entries by encoding coverage and aggregate FSRS metrics.
 * Entries without `srs` are skipped — there is no stability/lapse signal.
 */
export function encodingCoverageStats(
  entries: WordEntry[],
  hasEncoding: (word: string) => boolean,
): EncodingCoverageStats {
  const encodedStabilities: number[] = [];
  const bareStabilities: number[] = [];
  const encodedLapses: number[] = [];
  const bareLapses: number[] = [];

  for (const entry of entries) {
    if (entry.srs === undefined) continue;
    const bucket = hasEncoding(entry.word);
    if (bucket) {
      encodedStabilities.push(entry.srs.stability);
      encodedLapses.push(entry.srs.lapses);
    } else {
      bareStabilities.push(entry.srs.stability);
      bareLapses.push(entry.srs.lapses);
    }
  }

  return {
    encodedCount: encodedStabilities.length,
    bareCount: bareStabilities.length,
    encodedAvgStability: average(encodedStabilities),
    bareAvgStability: average(bareStabilities),
    encodedAvgLapses: average(encodedLapses),
    bareAvgLapses: average(bareLapses),
  };
}