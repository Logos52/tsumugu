/**
 * Blocking verification gates for encoding-page@1 artifacts (Encoding PRD §5.5).
 * OpenCC guard, per-string CI scorer, grounding lint, selection criteria,
 * and consumed leveling verdict — no LLM.
 */
import {
  scoreCI,
  isKnown,
  type LanguagePack,
  type WordStore,
  type EncodingPageDoc,
  type ExampleSentence,
  type Definition,
  type KnownPolicy,
} from "@tsumugu/engine";

export interface VerifyEncodingOptions {
  lang: string;
  pack: LanguagePack;
  store: WordStore;
  doc: EncodingPageDoc;
  ciTarget?: number;
  policy?: KnownPolicy;
}

export interface StringCiScore {
  label: string;
  text: string;
  coverage: number;
  meetsTarget: boolean;
  unknownWords: { word: string; count: number }[];
}

export interface VerifyEncodingReport {
  ciTarget: number;
  meetsTarget: boolean;
  ciScores: StringCiScore[];
  openccChanges: { before: string; after: string }[];
  openccChanged: boolean;
  groundingErrors: string[];
  selectionErrors: string[];
  levelingErrors: string[];
  /** Fraction of example word-tokens that are known (excluding the headword). */
  knownWordRecycleRatio: number | null;
  normalized: EncodingPageDoc;
  blocked: boolean;
  blockReasons: string[];
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

async function normalizeDefinition(
  pack: LanguagePack,
  def: Definition | undefined,
  changes: { before: string; after: string }[],
): Promise<Definition | undefined> {
  if (!def) return undefined;
  const out: Definition = { ...def, gloss: await normalize(pack, def.gloss, changes) };
  if (def.explanation !== undefined) {
    out.explanation = await normalize(pack, def.explanation, changes);
  }
  return out;
}

async function normalizeExample(
  pack: LanguagePack,
  ex: ExampleSentence,
  changes: { before: string; after: string }[],
): Promise<ExampleSentence> {
  return {
    ...ex,
    text: await normalize(pack, ex.text, changes),
    ...(ex.translation !== undefined
      ? { translation: await normalize(pack, ex.translation, changes) }
      : {}),
    ...(ex.reading !== undefined ? { reading: await normalize(pack, ex.reading, changes) } : {}),
  };
}

function groundingErrors(doc: EncodingPageDoc): string[] {
  const errors: string[] = [];
  if (doc.etymology && !doc.etymology.grounding) {
    errors.push("etymology: missing grounding tag (sourced | mnemonic-device | speculative)");
  }
  if (doc.mnemonic && !doc.mnemonic.grounding) {
    errors.push("mnemonic: missing grounding tag (mnemonic-device | speculative)");
  }
  return errors;
}

function levelingErrors(doc: EncodingPageDoc): string[] {
  const zh = doc.definitions?.zh;
  if (!zh) return ["definitions.zh: missing (required for leveled monolingual card)"];
  if (zh.leveledVerdict !== "leveled") {
    const detail = zh.offendingWord
      ? ` (offending word: ${zh.offendingWord})`
      : zh.leveledVerdict
        ? ` (verdict: ${zh.leveledVerdict})`
        : "";
    return [`definitions.zh: leveledVerdict must be "leveled"${detail}`];
  }
  return [];
}

function normalizeExampleText(text: string): string {
  return text.replace(/\s+/g, "").trim();
}

function selectionErrors(doc: EncodingPageDoc): string[] {
  const errors: string[] = [];
  const examples = doc.examples ?? [];

  if (examples.length < 3 || examples.length > 6) {
    errors.push(`examples: count must be 3–6 (got ${examples.length})`);
  }

  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i]!;
    if (!ex.translation?.trim()) {
      errors.push(`examples[${i}]: missing translation`);
    }
  }

  const seen = new Map<string, number>();
  for (let i = 0; i < examples.length; i++) {
    const norm = normalizeExampleText(examples[i]!.text);
    if (!norm) continue;
    const prev = seen.get(norm);
    if (prev !== undefined) {
      errors.push(`examples[${i}]: near-identical text to examples[${prev}]`);
    } else {
      seen.set(norm, i);
    }
  }

  return errors;
}

async function scoreString(
  text: string,
  label: string,
  opts: {
    lang: string;
    pack: LanguagePack;
    store: WordStore;
    term: string;
    ciTarget: number;
    policy?: KnownPolicy;
  },
): Promise<StringCiScore> {
  const tokens = await opts.pack.segmenter(text);
  const prepared = tokens.map((t) => ({ text: t.text, isWord: t.isWord }));
  const getStatus = (word: string) => {
    // Headword is the one permitted unknown — treat as known for CI scoring.
    if (word === opts.term) return "known" as const;
    return opts.store.getStatus(opts.lang, word);
  };
  const ci = scoreCI({
    lang: opts.lang,
    tokens: prepared,
    getStatus,
    target: opts.ciTarget,
    ...(opts.policy ? { policy: opts.policy } : {}),
  });
  return {
    label,
    text,
    coverage: ci.coverage,
    meetsTarget: ci.meetsTarget,
    unknownWords: ci.unknownWords,
  };
}

async function knownWordRecycleRatio(
  doc: EncodingPageDoc,
  pack: LanguagePack,
  store: WordStore,
  lang: string,
  policy?: KnownPolicy,
): Promise<number | null> {
  const examples = doc.examples ?? [];
  if (examples.length === 0) return null;

  let known = 0;
  let total = 0;
  for (const ex of examples) {
    const tokens = await pack.segmenter(ex.text);
    for (const t of tokens) {
      if (!t.isWord) continue;
      if (t.text === doc.term) continue;
      total += 1;
      if (isKnown(store.getStatus(lang, t.text), policy)) known += 1;
    }
  }
  return total === 0 ? null : known / total;
}

export async function verifyEncodingPage(opts: VerifyEncodingOptions): Promise<VerifyEncodingReport> {
  const { pack, store, doc, lang } = opts;
  const ciTarget = opts.ciTarget ?? 0.95;
  const changes: { before: string; after: string }[] = [];

  const normalized: EncodingPageDoc = {
    ...doc,
    term: await normalize(pack, doc.term, changes),
    ...(doc.flagNote !== undefined
      ? { flagNote: await normalize(pack, doc.flagNote, changes) }
      : {}),
    definitions: {
      en: await normalizeDefinition(pack, doc.definitions?.en, changes),
      zh: await normalizeDefinition(pack, doc.definitions?.zh, changes),
    },
    examples: doc.examples
      ? await Promise.all(doc.examples.map((ex) => normalizeExample(pack, ex, changes)))
      : undefined,
  };

  const ciScores: StringCiScore[] = [];
  const zh = normalized.definitions?.zh;
  if (zh) {
    const zhText = [zh.gloss, zh.explanation].filter(Boolean).join("");
    if (zhText) {
      ciScores.push(
        await scoreString(zhText, "definitions.zh", {
          lang,
          pack,
          store,
          term: normalized.term,
          ciTarget,
          ...(opts.policy ? { policy: opts.policy } : {}),
        }),
      );
    }
  }

  const examples = normalized.examples ?? [];
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i]!;
    if (ex.text.trim()) {
      ciScores.push(
        await scoreString(ex.text, `examples[${i}]`, {
          lang,
          pack,
          store,
          term: normalized.term,
          ciTarget,
          ...(opts.policy ? { policy: opts.policy } : {}),
        }),
      );
    }
  }

  const gErrors = groundingErrors(normalized);
  const sErrors = selectionErrors(normalized);
  const lErrors = levelingErrors(normalized);
  const belowCi = ciScores.filter((s) => !s.meetsTarget);
  const meetsTarget = belowCi.length === 0;
  const recycle = await knownWordRecycleRatio(normalized, pack, store, lang, opts.policy);

  const blockReasons: string[] = [];
  if (changes.length > 0) blockReasons.push("OpenCC: Simplified characters detected");
  if (!meetsTarget) {
    for (const s of belowCi) {
      blockReasons.push(
        `CI below target: ${s.label} ${(s.coverage * 100).toFixed(0)}% < ${(ciTarget * 100).toFixed(0)}%` +
          (s.unknownWords.length ? ` (unknown: ${s.unknownWords.map((u) => u.word).join("、")})` : ""),
      );
    }
  }
  blockReasons.push(...gErrors, ...sErrors, ...lErrors);

  return {
    ciTarget,
    meetsTarget,
    ciScores,
    openccChanges: changes,
    openccChanged: changes.length > 0,
    groundingErrors: gErrors,
    selectionErrors: sErrors,
    levelingErrors: lErrors,
    knownWordRecycleRatio: recycle,
    normalized,
    blocked: blockReasons.length > 0,
    blockReasons,
  };
}