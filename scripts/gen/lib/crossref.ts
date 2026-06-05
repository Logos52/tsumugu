/**
 * External-vocab cross-reference harness (PRD §5.7). Import a Migaku/Pleco/Anki
 * export, reconcile it against the word store, and (optionally, import-first)
 * apply external statuses. Write-back to the external tool is out of scope.
 *
 * Apply is clock-aware: it uses the engine's `resolveStatusUpdate` so an import
 * may seed/promote but (by default) never silently demotes a word the user
 * graded up — Tsumugu is canonical, Migaku is a timestamped input.
 */
import {
  migakuAdapter,
  reconcile,
  resolveStatusUpdate,
  type ExternalRef,
  type ExternalVocabAdapter,
  type ExternalVocabRecord,
  type MonotonicityPolicy,
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
  /** New words seeded into the store. */
  imported: number;
  /** Existing words whose status changed (promote or newer-wins). */
  changed: number;
  /** Would-be demotes prevented by the `never-demote` policy. */
  demotionsBlocked: number;
  /** Existing words left unchanged (equal, store-newer, or ambiguous). */
  kept: number;
  /** External 4-tuple links attached/refreshed (enriched imports only). */
  refsLinked: number;
}

/**
 * Migaku's `mod` epoch (always milliseconds) → ISO; undefined if absent or
 * outside a sane epoch-ms window (~2001..2096). Rejecting out-of-range values
 * (rather than rescaling a "small" number as seconds) avoids minting an
 * expanded-year ISO that would invert the resolver's lexicographic compare.
 */
function externalChangeIso(r: ExternalVocabRecord): string | undefined {
  const mod = r.raw?.["mod"];
  if (typeof mod !== "number" || !Number.isFinite(mod)) return undefined;
  if (mod < 1e12 || mod > 4e12) return undefined; // not a usable ms clock
  const d = new Date(mod);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Map a Migaku `wordHistory.origin` to a Tsumugu status origin. */
function externalOrigin(r: ExternalVocabRecord): "manual" | "study" | "import" {
  const o = String(r.raw?.["origin"] ?? "").toLowerCase();
  if (o === "manual") return "manual";
  if (o === "study") return "study";
  return "import";
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/**
 * Attach (or refresh) the Migaku 4-tuple on the entry so the (lang,word) ↔
 * 4-tuple collapse stays reversible. Only fires for enriched imports that carry
 * the tuple (the lossy word/lang/status export has none). Returns true if linked.
 */
function linkExternalRef(
  store: WordStore,
  lang: string,
  word: string,
  r: ExternalVocabRecord,
): boolean {
  const raw = r.raw ?? {};
  const hasTuple =
    raw["dictForm"] != null || raw["secondary"] != null || raw["partOfSpeech"] != null;
  if (!hasTuple) return false;
  const e = store.get(lang, word);
  if (!e) return false;
  const mod = raw["mod"];
  const ref: ExternalRef = {
    source: "migaku",
    dictForm: str(raw["dictForm"]) ?? word,
    secondary: str(raw["secondary"]) ?? "",
    partOfSpeech: str(raw["partOfSpeech"]) ?? "",
    language: str(raw["language"]) ?? r.lang,
    mod: typeof mod === "number" ? mod : 0,
  };
  const refs = e.externalRefs ?? [];
  const i = refs.findIndex(
    (x) =>
      x.source === ref.source &&
      x.dictForm === ref.dictForm &&
      x.secondary === ref.secondary &&
      x.partOfSpeech === ref.partOfSpeech &&
      x.language === ref.language,
  );
  // On refresh, keep a previously-recorded mod if this record has none, so a
  // later same-tuple record without a numeric mod can't zero the change-epoch.
  if (i >= 0) refs[i] = { ...ref, mod: typeof mod === "number" ? mod : refs[i]!.mod };
  else refs.push(ref);
  e.externalRefs = refs;
  return true;
}

/**
 * Import-first apply, clock-aware. Seeds missing words; for existing words it
 * defers to {@link resolveStatusUpdate} (default `never-demote`). The deprecated
 * `overwriteConflicts: true` maps to the `newest-wins` policy.
 */
export function applyToStore(
  store: WordStore,
  lang: string,
  records: ExternalVocabRecord[],
  opts: { policy?: MonotonicityPolicy; overwriteConflicts?: boolean } = {},
): ApplyResult {
  const policy: MonotonicityPolicy =
    opts.policy ?? (opts.overwriteConflicts ? "newest-wins" : "never-demote");
  let imported = 0;
  let changed = 0;
  let demotionsBlocked = 0;
  let kept = 0;
  let refsLinked = 0;

  for (const r of records) {
    if (r.lang !== lang || r.status === undefined) continue;
    const incomingAt = externalChangeIso(r);
    const prov = { source: "migaku" as const, origin: externalOrigin(r), at: incomingAt };
    const existing = store.get(lang, r.word);

    if (!existing) {
      store.setStatus(lang, r.word, r.status, undefined, prov);
      imported++;
    } else {
      const decision = resolveStatusUpdate({
        current: existing.status,
        currentAt: existing.statusUpdatedAt,
        incoming: r.status,
        incomingAt,
        policy,
      });
      if (decision.action === "set") {
        store.setStatus(lang, r.word, decision.status, undefined, prov);
        changed++;
      } else if (decision.code === "never-demote") {
        demotionsBlocked++;
      } else {
        kept++;
      }
    }

    if (linkExternalRef(store, lang, r.word, r)) refsLinked++;
  }
  return { imported, changed, demotionsBlocked, kept, refsLinked };
}
