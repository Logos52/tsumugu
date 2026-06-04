/**
 * External-vocab cross-reference harness (PRD §5.7). Import a Migaku/Pleco/Anki
 * export, reconcile it against the word store, and (optionally, import-first)
 * apply external statuses. Write-back to the external tool is out of scope.
 */
import {
  migakuAdapter,
  reconcile,
  type ExternalVocabAdapter,
  type ExternalVocabRecord,
  type ReconciliationReport,
  type WordStore,
} from "@tsumugu/engine";

export function adapterFor(source: string): ExternalVocabAdapter {
  switch (source) {
    case "migaku":
      return migakuAdapter;
    default:
      throw new Error(
        `No adapter for source "${source}" yet. Supported: migaku (Pleco/Anki next).`,
      );
  }
}

export function importExternal(source: string, input: unknown): ExternalVocabRecord[] {
  return adapterFor(source).parse(input);
}

export function reconcileAgainstStore(
  lang: string,
  store: WordStore,
  records: ExternalVocabRecord[],
): ReconciliationReport {
  return reconcile(lang, store.all(lang), records);
}

export interface ApplyResult {
  imported: number;
  overwritten: number;
  skippedConflicts: number;
}

/**
 * Import-first apply: add words the store is missing (using the external
 * status), and—only with `overwriteConflicts`—overwrite where they disagree.
 */
export function applyToStore(
  store: WordStore,
  lang: string,
  records: ExternalVocabRecord[],
  opts: { overwriteConflicts?: boolean } = {},
): ApplyResult {
  let imported = 0;
  let overwritten = 0;
  let skippedConflicts = 0;
  for (const r of records) {
    if (r.lang !== lang || r.status === undefined) continue;
    const existing = store.get(lang, r.word);
    if (!existing) {
      store.setStatus(lang, r.word, r.status);
      imported++;
    } else if (existing.status !== r.status) {
      if (opts.overwriteConflicts) {
        store.setStatus(lang, r.word, r.status);
        overwritten++;
      } else {
        skippedConflicts++;
      }
    }
  }
  return { imported, overwritten, skippedConflicts };
}
