/**
 * Autonomous-mode target selection (PRD §4 use-case 3): pick the next words to
 * build a passage around — the user's active learning words plus anything due
 * in the SRS — so generated content recycles exactly what they're working on.
 */
import { getDue, type WordStore, type Clock, type WordStatus } from "@tsumugu/engine";

const ACTIVE: WordStatus[] = ["l1", "l2", "l3"];

export function selectAutonomousTargets(
  store: WordStore,
  lang: string,
  clock: Clock,
  limit = 8,
): string[] {
  const entries = store.all(lang);
  const due = getDue(entries, clock).map((e) => e.word);
  const active = entries.filter((e) => ACTIVE.includes(e.status)).map((e) => e.word);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of [...due, ...active]) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= limit) break;
  }
  return out;
}
