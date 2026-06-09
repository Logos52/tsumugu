/**
 * Deterministic verification pass (PRD §5.3): OpenCC Simplified→Traditional
 * guard, CI re-score, missing-glossary check, target-word recycle check,
 * monolingual zh band verification, circularity/emptiness, and license assertion.
 * No LLM — pure machine checks the model's output must survive.
 */
import {
  scoreCI,
  isKnown,
  type LanguagePack,
  type WordStore,
  type PreparedContent,
  type PrebakedEntry,
  type BridgeInfo,
  type BridgeMorpheme,
  type KnownPolicy,
  type MonoDefinition,
} from "@tsumugu/engine";
import { checkDefLevel, type DefLevelViolation } from "./defLevel.js";
import {
  loadDefLevelIndex,
  tocflOrdinal,
  type DefLevelIndex,
} from "./defLevelData.js";
import { isCircularZhDef, isEmptyZhDef } from "./zhDefGuards.js";
import {
  assertMonolingualSeedLicenses,
  type ProvenanceManifest,
} from "./licenseAssert.js";
import { verifyExamples, type ExampleEntryStats } from "./exampleVerify.js";

export interface DefLevelEntryStats {
  term: string;
  ceiling: string;
  achievedLevel?: string;
  levelEscalated?: boolean;
  violationCount: number;
  circular: boolean;
  empty: boolean;
}

export interface VerifyOptions {
  lang: string;
  pack: LanguagePack;
  store: WordStore;
  content: PreparedContent;
  targetWords?: string[];
  ciTarget?: number;
  policy?: KnownPolicy;
  /** Optional pre-loaded band index (tests). */
  defLevelIndex?: DefLevelIndex;
  /** Monolingual-generation provenance manifest for license assertion. */
  provenance?: ProvenanceManifest;
}

export interface VerifyReport {
  ciMeasured: number;
  ciTarget: number;
  meetsTarget: boolean;
  /** Strings the script normalizer rewrote (Simplified→Traditional). */
  openccChanges: { before: string; after: string }[];
  openccChanged: boolean;
  /** Unknown word tokens with no usable glossary gloss (agent must fill). */
  missingGlossary: string[];
  /** Recycle check for directed target words (≥3× recommended). */
  recycle: { word: string; count: number; ok: boolean }[];
  /** Band-ceiling violations across zh definition + example fields. */
  defLevelViolations: DefLevelViolation[];
  /** Per-entry band / guard stats (zh-Hant entries with `definitions.zh`). */
  defLevelByEntry: Record<string, DefLevelEntryStats>;
  /** Entries with circular zh definitions. */
  zhDefCircular: string[];
  /** Entries with empty zh definitions. */
  zhDefEmpty: string[];
  /** License assertion hard-fail messages. */
  licenseErrors: string[];
  /** Fraction of zh defs with zero band violations (0..1; 1 when none checked). */
  defLevelPassRate: number;
  /** Per-entry example stats (zh-Hant dictionary path). */
  exampleByEntry: Record<string, ExampleEntryStats>;
  /** Band violations in example sentence text. */
  exampleLevelViolations: DefLevelViolation[];
  /** Known-word recycle ratio over overlay (`shared:false`) rows only. */
  exampleOverlayRecycleRatio: number | null;
  /** True when example count/headword/highlight/shared checks fail. */
  exampleErrors: boolean;
  /** Content with all strings normalized + `ciMeasured` set. Use with --fix. */
  normalized: PreparedContent;
}

async function normalize(
  pack: LanguagePack,
  s: string,
  changes: { before: string; after: string }[],
): Promise<string> {
  if (!pack.scriptNormalizer || s === "") return s;
  const after = await pack.scriptNormalizer(s);
  if (after !== s) changes.push({ before: s, after });
  return after;
}

async function normalizeMonoDefinition(
  pack: LanguagePack,
  zh: MonoDefinition,
  changes: { before: string; after: string }[],
): Promise<MonoDefinition> {
  const out: MonoDefinition = {
    ...zh,
    gloss: await normalize(pack, zh.gloss, changes),
  };
  if (zh.illustration !== undefined) {
    out.illustration = await normalize(pack, zh.illustration, changes);
  }
  return out;
}

async function normalizeBridge(
  pack: LanguagePack,
  b: BridgeInfo,
  changes: { before: string; after: string }[],
): Promise<BridgeInfo> {
  const out: BridgeInfo = { ...b };
  if (b.etymon !== undefined) out.etymon = await normalize(pack, b.etymon, changes);
  if (b.bridgeReading !== undefined)
    out.bridgeReading = await normalize(pack, b.bridgeReading, changes);
  if (b.meaning !== undefined) out.meaning = await normalize(pack, b.meaning, changes);
  if (b.morphemes)
    out.morphemes = await Promise.all(
      b.morphemes.map(async (m): Promise<BridgeMorpheme> => {
        const mo: BridgeMorpheme = {
          ...m,
          surface: await normalize(pack, m.surface, changes),
          etymon: await normalize(pack, m.etymon, changes),
        };
        if (m.reading !== undefined) mo.reading = await normalize(pack, m.reading, changes);
        if (m.gloss !== undefined) mo.gloss = await normalize(pack, m.gloss, changes);
        return mo;
      }),
    );
  return out;
}

async function normalizeEntry(
  pack: LanguagePack,
  e: PrebakedEntry,
  changes: { before: string; after: string }[],
): Promise<PrebakedEntry> {
  const out: PrebakedEntry = {
    ...e,
    term: await normalize(pack, e.term, changes),
    gloss: await normalize(pack, e.gloss, changes),
  };
  if (e.reading !== undefined) out.reading = await normalize(pack, e.reading, changes);
  if (e.explanation !== undefined)
    out.explanation = await normalize(pack, e.explanation, changes);
  if (e.definitions) {
    out.definitions = { ...e.definitions };
    if (e.definitions.en) {
      const en = { ...e.definitions.en };
      en.gloss = await normalize(pack, en.gloss, changes);
      if (en.explanation !== undefined)
        en.explanation = await normalize(pack, en.explanation, changes);
      out.definitions.en = en;
    }
    if (e.definitions.zh) {
      out.definitions.zh = await normalizeMonoDefinition(pack, e.definitions.zh, changes);
    }
  }
  if (e.examples) {
    out.examples = await Promise.all(
      e.examples.map(async (ex) => ({
        ...ex,
        text: await normalize(pack, ex.text, changes),
        translation: await normalize(pack, ex.translation, changes),
        reading:
          ex.reading !== undefined
            ? await normalize(pack, ex.reading, changes)
            : undefined,
      })),
    );
  }
  if (e.collocations) {
    out.collocations = await Promise.all(
      e.collocations.map(async (c) => ({
        ...c,
        phrase: await normalize(pack, c.phrase, changes),
        translation: await normalize(pack, c.translation, changes),
      })),
    );
  }
  if (e.bridge !== undefined) out.bridge = await normalizeBridge(pack, e.bridge, changes);
  return out;
}

function resolveDefIndex(lang: string, explicit?: DefLevelIndex): DefLevelIndex | undefined {
  if (explicit !== undefined) return explicit;
  if (lang !== "zh-Hant") return undefined;
  try {
    return loadDefLevelIndex();
  } catch {
    return undefined;
  }
}

function verifyZhDefs(
  glossary: Record<string, PrebakedEntry>,
  lang: string,
  defIndex: DefLevelIndex | undefined,
): {
  violations: DefLevelViolation[];
  byEntry: Record<string, DefLevelEntryStats>;
  circular: string[];
  empty: string[];
  passRate: number;
  stamped: Record<string, PrebakedEntry>;
} {
  const violations: DefLevelViolation[] = [];
  const byEntry: Record<string, DefLevelEntryStats> = {};
  const circular: string[] = [];
  const empty: string[] = [];
  const stamped: Record<string, PrebakedEntry> = { ...glossary };

  if (defIndex === undefined) {
    return { violations, byEntry, circular, empty, passRate: 1, stamped };
  }

  let checked = 0;
  let passed = 0;

  for (const [key, entry] of Object.entries(glossary)) {
    const zh = entry.definitions?.zh;
    if (zh === undefined) continue;

    const ceiling = zh.level;
    const term = entry.term;
    const circ = isCircularZhDef(term, zh.gloss, zh.illustration);
    const emp = isEmptyZhDef(term, zh.gloss);
    if (circ) circular.push(term);
    if (emp) empty.push(term);
    if (emp) {
      byEntry[key] = {
        term,
        ceiling,
        violationCount: 0,
        circular: circ,
        empty: true,
      };
      continue;
    }

    checked += 1;

    const entryViolations: DefLevelViolation[] = [];

    const glossCheck = checkDefLevel({
      text: zh.gloss,
      ceiling,
      index: defIndex,
      field: "definitions.zh.gloss",
    });
    entryViolations.push(...glossCheck.violations);

    let achievedOrd = tocflOrdinal(glossCheck.achievedLevel);
    if (zh.illustration !== undefined && zh.illustration.trim() !== "") {
      const illCheck = checkDefLevel({
        text: zh.illustration,
        ceiling,
        index: defIndex,
        field: "definitions.zh.illustration",
      });
      entryViolations.push(...illCheck.violations);
      achievedOrd = Math.max(achievedOrd, tocflOrdinal(illCheck.achievedLevel));
    }

    if (entry.examples) {
      for (let i = 0; i < entry.examples.length; i++) {
        const ex = entry.examples[i]!;
        if (ex.text.trim() === "") continue;
        const exCheck = checkDefLevel({
          text: ex.text,
          ceiling,
          index: defIndex,
          field: `examples[${i}].text`,
        });
        const exViolations = exCheck.violations.filter((v) => v.word !== term);
        entryViolations.push(...exViolations);
        achievedOrd = Math.max(achievedOrd, tocflOrdinal(exCheck.achievedLevel));
      }
    }

    if (entry.collocations) {
      for (let i = 0; i < entry.collocations.length; i++) {
        const col = entry.collocations[i]!;
        if (col.phrase.trim() === "") continue;
        const colCheck = checkDefLevel({
          text: col.phrase,
          ceiling,
          index: defIndex,
          field: `collocations[${i}].phrase`,
        });
        entryViolations.push(...colCheck.violations);
        achievedOrd = Math.max(achievedOrd, tocflOrdinal(colCheck.achievedLevel));
      }
    }

    const achievedLevel = `TOCFL-${Math.min(7, Math.max(1, achievedOrd))}`;
    const levelEscalated =
      tocflOrdinal(achievedLevel) > tocflOrdinal(ceiling) || entryViolations.length > 0;

    if (entryViolations.length === 0) passed += 1;
    violations.push(...entryViolations);

    byEntry[key] = {
      term,
      ceiling,
      achievedLevel,
      levelEscalated,
      violationCount: entryViolations.length,
      circular: circ,
      empty: emp,
    };

    stamped[key] = {
      ...entry,
      definitions: {
        ...entry.definitions,
        zh: {
          ...zh,
          achievedLevel,
          levelEscalated,
        },
      },
    };
  }

  const passRate = checked === 0 ? 1 : passed / checked;
  return { violations, byEntry, circular, empty, passRate, stamped };
}

export async function verifyContent(opts: VerifyOptions): Promise<VerifyReport> {
  const { pack, store, content, lang } = opts;
  const ciTarget = opts.ciTarget ?? content.ciTarget ?? 0.95;
  const changes: { before: string; after: string }[] = [];

  // OpenCC guard over every displayed string (tokens + glossary).
  const tokens = await Promise.all(
    content.tokens.map(async (t) => ({
      text: await normalize(pack, t.text, changes),
      isWord: t.isWord,
    })),
  );
  const glossary: Record<string, PrebakedEntry> = {};
  for (const [key, entry] of Object.entries(content.glossary)) {
    const nk = await normalize(pack, key, changes);
    glossary[nk] = await normalizeEntry(pack, entry, changes);
  }

  // Normalize directed target words into the same script as the (already
  // normalized) tokens, so a Simplified `--words` arg still matches and the
  // recycle count is not spuriously 0.
  const targetWords = opts.targetWords
    ? await Promise.all(opts.targetWords.map((w) => normalize(pack, w, changes)))
    : undefined;

  // CI re-score against the store.
  const ci = scoreCI({
    lang,
    tokens,
    getStatus: (w) => store.getStatus(lang, w),
    ...(opts.policy ? { policy: opts.policy } : {}),
    target: ciTarget,
    ...(targetWords ? { targetWords } : {}),
  });

  // Missing-glossary: every unknown word token needs a non-empty gloss.
  const missing = new Set<string>();
  for (const t of tokens) {
    if (!t.isWord) continue;
    if (isKnown(store.getStatus(lang, t.text), opts.policy)) continue;
    const g = glossary[t.text];
    if (!g || g.gloss.trim() === "") missing.add(t.text);
  }

  const recycle = (ci.targetRecycle ?? []).map((r) => ({
    word: r.word,
    count: r.count,
    ok: r.ok,
  }));

  const defIndex = resolveDefIndex(lang, opts.defLevelIndex);
  const zhDef = verifyZhDefs(glossary, lang, defIndex);
  const exampleReport = await verifyExamples({
    glossary: zhDef.stamped,
    lang,
    pack,
    store,
    ...(defIndex !== undefined ? { defIndex } : {}),
    ...(opts.policy ? { policy: opts.policy } : {}),
  });

  const licenseResult = opts.provenance
    ? assertMonolingualSeedLicenses(opts.provenance)
    : { ok: true, errors: [], notes: [] };

  const normalized: PreparedContent = {
    ...content,
    tokens,
    glossary: zhDef.stamped,
    ciMeasured: ci.coverage,
  };

  return {
    ciMeasured: ci.coverage,
    ciTarget,
    meetsTarget: ci.coverage >= ciTarget,
    openccChanges: changes,
    openccChanged: changes.length > 0,
    missingGlossary: [...missing],
    recycle,
    defLevelViolations: zhDef.violations,
    defLevelByEntry: zhDef.byEntry,
    zhDefCircular: zhDef.circular,
    zhDefEmpty: zhDef.empty,
    licenseErrors: licenseResult.errors,
    defLevelPassRate: zhDef.passRate,
    exampleByEntry: exampleReport.byEntry,
    exampleLevelViolations: exampleReport.exampleLevelViolations,
    exampleOverlayRecycleRatio: exampleReport.overlayRecycleRatio,
    exampleErrors: exampleReport.hasErrors,
    normalized,
  };
}