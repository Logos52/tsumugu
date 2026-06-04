/**
 * Migaku word-export -> Tsumugu crossref input converter.
 *
 * Migaku's "Export Words" (study.migaku.com) produces JSON records shaped like
 * `{ word, reading, language, status }`, where `status` is NUMERIC (1=learning,
 * 2=known) and `language` is Migaku's own code. Tsumugu's crossref Migaku
 * adapter (packages/engine/src/crossref/migaku.ts) instead expects STRING
 * statuses (KNOWN/LEARNING/UNKNOWN/IGNORED) and filters by Tsumugu language ids
 * (zh-Hant, vi). This converter bridges the two: it normalizes status codes to
 * strings and maps Migaku language codes to Tsumugu ids, then emits the
 * `{ words: [...] }` shape `gen crossref --source migaku` consumes.
 *
 * Pure + dependency-free (the pipeline stays data-free): no dictionary lookups,
 * no network. Migaku's own reading is passed through as-is; readings/glosses are
 * otherwise the pack's job at read time. Unrecognized status codes and language
 * codes are NOT guessed — they are counted and reported so a real export that
 * uses a code we did not anticipate surfaces loudly instead of silently dropping.
 *
 * Run: pnpm migaku:convert --in migaku-export.json --out converted.json
 *        [--langs zh-Hant,vi] [--include known,learning,ignored]
 *        [--lang-map zh=zh-Hant,yue=zh-Hant]
 * Then: pnpm gen crossref --source migaku --in converted.json --lang zh-Hant \
 *        --store personal/vault/tsumugu/word-store.json --apply
 */

export type ExternalStatus = "KNOWN" | "LEARNING" | "UNKNOWN" | "IGNORED";

/** Migaku numeric knownness codes (study.migaku.com export). */
const NUMERIC_STATUS: Record<number, ExternalStatus> = {
  0: "UNKNOWN",
  1: "LEARNING",
  2: "KNOWN",
};

/** String knownness forms (older exports / stringified numerics / categories). */
const STRING_STATUS: Record<string, ExternalStatus> = {
  known: "KNOWN",
  "2": "KNOWN",
  learning: "LEARNING",
  "1": "LEARNING",
  unknown: "UNKNOWN",
  new: "UNKNOWN",
  "0": "UNKNOWN",
  ignored: "IGNORED",
};

/** Migaku language code -> Tsumugu language id. Override with --lang-map. */
export const DEFAULT_LANG_MAP: Record<string, string> = {
  zh: "zh-Hant",
  zho: "zh-Hant",
  cmn: "zh-Hant",
  "zh-tw": "zh-Hant",
  "zh-hant": "zh-Hant",
  "cmn-hant": "zh-Hant",
  "zh-hk": "zh-Hant",
  vi: "vi",
  vie: "vi",
  "vi-vn": "vi",
};

/** Statuses kept by default: importing UNKNOWN would seed every unlearned word. */
export const DEFAULT_INCLUDE: readonly ExternalStatus[] = ["KNOWN", "LEARNING", "IGNORED"];

export interface ConvertedWord {
  word: string;
  lang: string;
  status: ExternalStatus;
  reading?: string;
}

export interface ConvertOptions {
  /** Tsumugu language ids to keep (default: keep every mapped language). */
  langs?: string[];
  /** Statuses to keep (default {@link DEFAULT_INCLUDE}). */
  include?: ExternalStatus[];
  /** Extra/override Migaku-code -> Tsumugu-id mappings (merged over defaults). */
  langMap?: Record<string, string>;
}

export interface ConvertResult {
  words: ConvertedWord[];
  stats: {
    total: number;
    kept: number;
    byLang: Record<string, number>;
    byStatus: Record<string, number>;
    skippedNoWord: number;
    skippedLang: number;
    skippedStatus: number;
    /** Distinct Migaku language codes seen but not in the map (need a mapping). */
    unmappedLang: string[];
    /** Distinct raw status values seen but not recognized (need a mapping). */
    unmappedStatus: string[];
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** First non-empty string among the named fields (trimmed). */
function readString(rec: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
}

/** Pull the record array out of whatever shape Migaku handed us. */
function extractRecords(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (isPlainObject(input)) {
    if (Array.isArray(input["words"])) return input["words"] as unknown[];
    if (Array.isArray(input["cards"])) return input["cards"] as unknown[];
  }
  return [];
}

/** Normalize a Migaku status (number or string) to a canonical status. */
export function normalizeStatus(raw: unknown): ExternalStatus | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return NUMERIC_STATUS[raw];
  if (typeof raw === "string") return STRING_STATUS[raw.trim().toLowerCase()];
  return undefined;
}

/** Map a Migaku language code to a Tsumugu language id. */
export function mapLang(raw: string | undefined, map: Record<string, string>): string | undefined {
  if (raw === undefined) return undefined;
  return map[raw.trim().toLowerCase()];
}

/** Read a Migaku status field as a displayable raw token (number or string). */
function rawStatusToken(rec: Record<string, unknown>): string | undefined {
  for (const key of ["status", "knownness", "known"]) {
    const v = rec[key];
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function rawStatusValue(rec: Record<string, unknown>): unknown {
  for (const key of ["status", "knownness", "known"]) {
    const v = rec[key];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Convert a parsed Migaku export into Tsumugu crossref input. Pure and
 * deterministic; preserves first-seen order. Records with no usable word, a
 * language outside `langs`, or a status outside `include` are dropped and
 * accounted for in `stats`.
 */
export function convertMigaku(input: unknown, opts: ConvertOptions = {}): ConvertResult {
  const langMap = { ...DEFAULT_LANG_MAP, ...(opts.langMap ?? {}) };
  const include = new Set<ExternalStatus>(opts.include ?? DEFAULT_INCLUDE);
  const langFilter = opts.langs && opts.langs.length > 0 ? new Set(opts.langs) : null;

  const words: ConvertedWord[] = [];
  const byLang: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const unmappedLang = new Set<string>();
  const unmappedStatus = new Set<string>();
  let total = 0;
  let skippedNoWord = 0;
  let skippedLang = 0;
  let skippedStatus = 0;

  for (const raw of extractRecords(input)) {
    if (!isPlainObject(raw)) {
      total++;
      skippedNoWord++;
      continue;
    }
    total++;

    const word = readString(raw, "word", "term", "text", "expression");
    if (word === undefined) {
      skippedNoWord++;
      continue;
    }

    const rawLang = readString(raw, "language", "lang");
    const lang = mapLang(rawLang, langMap);
    if (lang === undefined) {
      skippedLang++;
      if (rawLang !== undefined) unmappedLang.add(rawLang.trim().toLowerCase());
      continue;
    }
    if (langFilter && !langFilter.has(lang)) {
      skippedLang++;
      continue;
    }

    const status = normalizeStatus(rawStatusValue(raw));
    if (status === undefined || !include.has(status)) {
      skippedStatus++;
      if (status === undefined) {
        const token = rawStatusToken(raw);
        if (token !== undefined) unmappedStatus.add(token);
      }
      continue;
    }

    const reading = readString(raw, "reading", "pronunciation");
    const entry: ConvertedWord = { word, lang, status };
    if (reading !== undefined) entry.reading = reading;
    words.push(entry);

    byLang[lang] = (byLang[lang] ?? 0) + 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

  return {
    words,
    stats: {
      total,
      kept: words.length,
      byLang,
      byStatus,
      skippedNoWord,
      skippedLang,
      skippedStatus,
      unmappedLang: [...unmappedLang].sort(),
      unmappedStatus: [...unmappedStatus].sort(),
    },
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseFlags(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined || !a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function splitList(v: string | true | undefined): string[] | undefined {
  if (typeof v !== "string") return undefined;
  return v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseLangMap(v: string | true | undefined): Record<string, string> | undefined {
  const pairs = splitList(v);
  if (!pairs) return undefined;
  const map: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const from = pair.slice(0, eq).trim().toLowerCase();
    const to = pair.slice(eq + 1).trim();
    if (from && to) map[from] = to;
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

async function main(): Promise<void> {
  const { readFile, writeFile, mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const flags = parseFlags(process.argv.slice(2));

  const inPath = typeof flags["in"] === "string" ? flags["in"] : undefined;
  const outPath = typeof flags["out"] === "string" ? flags["out"] : undefined;
  if (!inPath || !outPath) {
    console.error(
      "migaku:convert — Migaku word export -> Tsumugu crossref input\n" +
        "  pnpm migaku:convert --in <migaku-export.json> --out <converted.json> \\\n" +
        "      [--langs zh-Hant,vi] [--include known,learning,ignored] \\\n" +
        "      [--lang-map zh=zh-Hant,yue=zh-Hant]\n" +
        "Then: pnpm gen crossref --source migaku --in <converted.json> --lang zh-Hant --store <ws.json> --apply",
    );
    process.exit(inPath || outPath ? 1 : 0);
    return;
  }

  const includeRaw = splitList(flags["include"]);
  const include = includeRaw?.map((s) => s.toUpperCase() as ExternalStatus);

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(inPath, "utf8"));
  } catch (err) {
    console.error(`Could not read/parse ${inPath}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
    return;
  }

  const result = convertMigaku(parsed, {
    langs: splitList(flags["langs"]),
    include,
    langMap: parseLangMap(flags["lang-map"]),
  });

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify({ source: "migaku", generatedFrom: inPath, words: result.words }, null, 2) + "\n",
  );

  const s = result.stats;
  console.log(`migaku:convert ${inPath} -> ${outPath}`);
  console.log(`  read ${s.total}, kept ${s.kept}`);
  console.log(`  by lang:   ${JSON.stringify(s.byLang)}`);
  console.log(`  by status: ${JSON.stringify(s.byStatus)}`);
  console.log(
    `  skipped: ${s.skippedNoWord} no-word, ${s.skippedLang} other-lang, ${s.skippedStatus} other-status`,
  );
  if (s.unmappedLang.length) {
    console.log(`  ! unmapped language code(s): ${s.unmappedLang.join(", ")} — add via --lang-map`);
  }
  if (s.unmappedStatus.length) {
    console.log(`  ! unrecognized status value(s): ${s.unmappedStatus.join(", ")} — tell me and I'll map them`);
  }
  console.log(`Next: pnpm gen crossref --source migaku --in ${outPath} --lang zh-Hant --store <ws.json> --apply`);
}

async function isInvokedDirectly(): Promise<boolean> {
  if (process.argv[1] === undefined) return false;
  const { pathToFileURL } = await import("node:url");
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

void isInvokedDirectly().then((yes) => {
  if (yes) void main();
});
