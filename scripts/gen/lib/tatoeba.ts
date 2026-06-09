/**
 * Tatoeba sentence mining (Dictionary PRD §5.4) — minimal stub.
 *
 * License routing (three regimes):
 * - CC0 sentences → may sit in a CC0-labeled shared asset
 * - CC-BY 2.0 FR sentences → separate attributed asset (never commingled under CC0)
 * - LLM-generated fallback → our output, outside BY-SA zone
 *
 * Full mining needs a local Tatoeba export. Place a filtered CSV/JSONL under
 * `packs/private/zh-hant/data/tatoeba/` (gitignored) and pass `dataPath` to
 * `mineTatoeba`. Until then this module returns empty buckets and documents
 * the routing contract.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export type TatoebaLicense = "CC0" | "CC-BY";

export interface TatoebaSentence {
  id: number;
  text: string;
  translation?: string;
  license: TatoebaLicense;
  /** Sentence-granular attribution (tatoeba.org link + license + author). */
  attribution?: string;
}

export interface TatoebaMineOptions {
  headword: string;
  floorBand: string;
  /** Optional local Tatoeba slice (one JSON object per line or CSV export). */
  dataPath?: string;
}

export interface TatoebaMineResult {
  cc0: TatoebaSentence[];
  ccBy: TatoebaSentence[];
  /** True when no data file was read (stub path). */
  stubbed: boolean;
  note: string;
}

const DEFAULT_DATA_HINT =
  "packs/private/zh-hant/data/tatoeba/sentences.zh-Hant.jsonl";

function routeLicense(raw: string | undefined): TatoebaLicense {
  const norm = (raw ?? "").toUpperCase();
  if (norm.includes("CC0") || norm.includes("PUBLIC DOMAIN")) return "CC0";
  return "CC-BY";
}

function parseJsonlLine(line: string): TatoebaSentence | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const row = JSON.parse(trimmed) as Record<string, unknown>;
    const text = String(row.text ?? row.sentence ?? "");
    if (!text) return null;
    const license = routeLicense(
      typeof row.license === "string" ? row.license : String(row.license ?? ""),
    );
    const id = Number(row.id ?? row.sentence_id ?? 0);
    const translation =
      typeof row.translation === "string" ? row.translation : undefined;
    const attribution =
      typeof row.attribution === "string" ? row.attribution : undefined;
    return { id, text, translation, license, attribution };
  } catch {
    return null;
  }
}

/**
 * Mine Tatoeba for in-band sentences containing `headword`.
 * Band + headword-sense filtering are applied by the caller after mining.
 */
export async function mineTatoeba(opts: TatoebaMineOptions): Promise<TatoebaMineResult> {
  const dataPath = opts.dataPath ?? DEFAULT_DATA_HINT;
  if (!existsSync(dataPath)) {
    return {
      cc0: [],
      ccBy: [],
      stubbed: true,
      note:
        `Tatoeba fetch stubbed — no data at ${dataPath}. ` +
        "Drop a zh-Hant JSONL export there to enable CC0/CC-BY routing.",
    };
  }

  const raw = await readFile(dataPath, "utf8");
  const cc0: TatoebaSentence[] = [];
  const ccBy: TatoebaSentence[] = [];

  for (const line of raw.split("\n")) {
    const row = parseJsonlLine(line);
    if (!row || !row.text.includes(opts.headword)) continue;
    if (row.license === "CC0") cc0.push(row);
    else ccBy.push(row);
  }

  return {
    cc0,
    ccBy,
    stubbed: false,
    note: `Mined ${cc0.length} CC0 + ${ccBy.length} CC-BY sentence(s) for ${opts.headword}.`,
  };
}

/** Route mined sentences into license buckets (never commingle CC-BY under CC0). */
export function routeTatoebaByLicense(
  sentences: TatoebaSentence[],
): { cc0: TatoebaSentence[]; ccBy: TatoebaSentence[] } {
  const cc0: TatoebaSentence[] = [];
  const ccBy: TatoebaSentence[] = [];
  for (const s of sentences) {
    if (s.license === "CC0") cc0.push(s);
    else ccBy.push(s);
  }
  return { cc0, ccBy };
}