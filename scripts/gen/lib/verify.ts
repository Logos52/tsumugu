/**
 * Deterministic verification pass (PRD §5.3): OpenCC Simplified→Traditional
 * guard, CI re-score, missing-glossary check, and target-word recycle check.
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
} from "@tsumugu/engine";

export interface VerifyOptions {
  lang: string;
  pack: LanguagePack;
  store: WordStore;
  content: PreparedContent;
  targetWords?: string[];
  ciTarget?: number;
  policy?: KnownPolicy;
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
  if (e.examples)
    out.examples = await Promise.all(e.examples.map((x) => normalize(pack, x, changes)));
  if (e.bridge !== undefined) out.bridge = await normalizeBridge(pack, e.bridge, changes);
  return out;
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

  const normalized: PreparedContent = {
    ...content,
    tokens,
    glossary,
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
    normalized,
  };
}
