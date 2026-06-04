/**
 * Reconcile the vault word-store against imported external vocab (PRD §5.7).
 *
 * Given the local store entries and a set of normalized external records (from
 * any adapter), produce a per-word view of where the store and the external
 * sources agree, disagree, or only one side knows about the word.
 *
 * Pure and deterministic: output ordering follows first-encounter order across
 * (store entries, then records), so the report is stable for a given input.
 */

import type {
  ExternalVocabRecord,
  ReconciledWord,
  ReconciliationReport,
  WordEntry,
  WordStatus,
} from "../types.js";

/** A single external source's view of a word, as embedded in a ReconciledWord. */
type ExternalView = {
  source: string;
  status?: WordStatus;
  externalStatus?: string;
};

/** Mutable accumulator for one word during reconciliation. */
interface Accum {
  lang: string;
  word: string;
  storeStatus?: WordStatus;
  external: ExternalView[];
}

/**
 * Reconcile store entries against external records for a single language.
 *
 * - `storeEntries` are filtered to `lang`; the last entry wins per (lang, word)
 *   so the report reflects the same precedence the store itself would use.
 * - `records` are filtered to `lang`; every matching record contributes an
 *   entry to that word's `external[]` list, preserving source order.
 * - `conflict`: true when the store HAS a status for the word AND at least one
 *   external source has a *defined* status that differs from it. An external
 *   record whose status is undefined (unmapped external label) never causes a
 *   conflict, since we can't claim disagreement we can't read.
 * - `missingFromStore`: words seen in `records` for this lang but with no store
 *   entry.
 */
export function reconcile(
  lang: string,
  storeEntries: WordEntry[],
  records: ExternalVocabRecord[],
): ReconciliationReport {
  // Preserve first-seen order while allowing later updates to overwrite.
  const order: string[] = [];
  const byWord = new Map<string, Accum>();

  const ensure = (word: string): Accum => {
    let acc = byWord.get(word);
    if (acc === undefined) {
      acc = { lang, word, external: [] };
      byWord.set(word, acc);
      order.push(word);
    }
    return acc;
  };

  // Store side first, so agreements/known words anchor the ordering.
  for (const entry of storeEntries) {
    if (entry.lang !== lang) continue;
    const acc = ensure(entry.word);
    acc.storeStatus = entry.status;
  }

  // External side.
  for (const rec of records) {
    if (rec.lang !== lang) continue;
    const acc = ensure(rec.word);
    const view: ExternalView = { source: rec.source };
    if (rec.status !== undefined) view.status = rec.status;
    if (rec.externalStatus !== undefined) view.externalStatus = rec.externalStatus;
    acc.external.push(view);
  }

  const reconciled: ReconciledWord[] = [];
  const conflicts: ReconciledWord[] = [];
  const missingFromStore: ReconciledWord[] = [];

  for (const word of order) {
    const acc = byWord.get(word);
    if (acc === undefined) continue; // unreachable; satisfies noUncheckedIndexedAccess

    const inStore = acc.storeStatus !== undefined;
    const conflict =
      inStore &&
      acc.external.some(
        (e) => e.status !== undefined && e.status !== acc.storeStatus,
      );

    const out: ReconciledWord = {
      lang: acc.lang,
      word: acc.word,
      external: acc.external,
      conflict,
    };
    if (acc.storeStatus !== undefined) out.storeStatus = acc.storeStatus;

    reconciled.push(out);
    if (conflict) conflicts.push(out);
    if (!inStore && acc.external.length > 0) missingFromStore.push(out);
  }

  return { lang, reconciled, conflicts, missingFromStore };
}
