/**
 * Browser language-pack registry.
 *
 * The pack ALGORITHMS here (tone parsing, OpenCC normalization, trivial
 * fallback segmentation) are public and bundled. Licensed dictionary DATA is
 * NOT bundled: when a vault is granted, an optional `BrowserDict` lazily reads
 * `tsumugu/packs/<lang>/dict.json` from the user's own folder at runtime. If
 * that file is absent the dict yields undefined and the reader falls back to
 * the pre-baked glossary in the prepared content.
 *
 * The reader consumes pre-segmented `PreparedContent`, so live segmentation is
 * never needed — the packs ship a trivial fallback segmenter only (no
 * jieba-wasm in the browser bundle).
 */

import {
  enDefinitionFromCedictGlosses,
  type DictEntry,
  type LanguagePack,
  type VaultIO,
} from "@tsumugu/engine";

import { createZhHantBrowserPack } from "./zhHant.js";
import { createViBrowserPack } from "./vi.js";

/**
 * An optional async dictionary the packs consult for live hover lookups.
 * Returns undefined when the word is unknown (or no data is available).
 */
export interface BrowserDict {
  lookup(word: string): Promise<DictEntry | undefined>;
}

/** Raw cedict-shaped entry: `{ "<word>": { py, g, s } }`. */
interface CedictRaw {
  /** Pinyin / reading. */
  py?: string;
  /** Gloss line(s) — string or CC-CEDICT string[]. */
  g?: string | string[];
  /** Simplified form (or other secondary field), unused for display. */
  s?: string;
}

/** Raw kaikki-shaped vi entry: `{ "<word>": { glosses, pos, ipa } }`. */
interface KaikkiRaw {
  glosses?: string[];
  pos?: string;
  ipa?: string;
}

type DictFileShape = Record<string, CedictRaw | KaikkiRaw>;

function cedictGlossLines(raw: CedictRaw): string[] {
  if (raw.g === undefined) return [];
  return Array.isArray(raw.g) ? raw.g : [raw.g];
}

/** Map a raw cedict-shaped record to a `DictEntry`. */
function fromCedict(word: string, raw: CedictRaw): DictEntry {
  const lines = cedictGlossLines(raw);
  const entry: DictEntry = {
    term: word,
    gloss: "",
    ...(raw.py ? { reading: raw.py } : {}),
    source: "packaged",
  };
  if (lines.length > 0) {
    const { en, senses, legacyGloss } = enDefinitionFromCedictGlosses(lines);
    entry.gloss = legacyGloss;
    entry.senses = senses;
    entry.definitions = { en };
  }
  return entry;
}

/** Map a raw kaikki-shaped record to a `DictEntry`. */
function fromKaikki(word: string, raw: KaikkiRaw): DictEntry {
  const gloss = raw.glosses && raw.glosses.length > 0 ? raw.glosses.join("; ") : "";
  return {
    term: word,
    gloss,
    ...(raw.ipa ? { reading: raw.ipa } : {}),
    ...(raw.pos ? { pos: raw.pos } : {}),
    source: "packaged",
  };
}

/**
 * A vault-backed dictionary for `lang`. Reads + parses
 * `tsumugu/packs/<lang>/dict.json` once (lazily, cached), then maps each
 * record to a `DictEntry`. Absent file / parse error → every lookup yields
 * undefined (graceful: the reader uses the pre-baked glossary instead).
 */
function vaultBackedDict(vault: VaultIO, lang: string): BrowserDict {
  const path = `tsumugu/packs/${lang}/dict.json`;
  const isVi = lang === "vi";
  let cache: Promise<DictFileShape | null> | null = null;

  const load = (): Promise<DictFileShape | null> => {
    if (!cache) {
      cache = vault
        .readText(path)
        .then((text) => {
          if (text == null) return null;
          try {
            return JSON.parse(text) as DictFileShape;
          } catch {
            return null;
          }
        })
        .catch(() => null);
    }
    return cache;
  };

  return {
    async lookup(word: string): Promise<DictEntry | undefined> {
      const data = await load();
      const raw = data?.[word];
      if (!raw) return undefined;
      return isVi ? fromKaikki(word, raw as KaikkiRaw) : fromCedict(word, raw as CedictRaw);
    },
  };
}

/**
 * Resolve a browser pack for a content language. Returns null for languages
 * with no browser pack (the caller falls back to the demo pack).
 *
 * When `opts.vault` is present, wires an optional vault-backed `BrowserDict`
 * so live hover lookups can read the user's own (licensed) dictionary data.
 */
export function packForLang(
  lang: string,
  opts?: { vault?: VaultIO | null },
): LanguagePack | null {
  const vault = opts?.vault ?? null;
  switch (lang) {
    case "zh-Hant":
      return createZhHantBrowserPack(
        vault ? { dict: vaultBackedDict(vault, "zh-Hant") } : {},
      );
    case "vi":
      return createViBrowserPack(
        vault ? { dict: vaultBackedDict(vault, "vi") } : {},
      );
    default:
      return null;
  }
}
