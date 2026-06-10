/**
 * Lazy jieba-wasm segmentation for live Chinese text (encoding 例句, etc.).
 * The reader uses pre-tokenized content; this path is for on-the-fly strings only.
 *
 * jieba is dynamically imported so the ~4MB wasm never blocks app bootstrap.
 * Under Vite, `jieba-wasm` resolves to the bundler build (wasm inits on import).
 */

import type { LanguagePack, Token } from "@tsumugu/engine";

const WORD_RE = /\p{Script=Han}|\p{L}|\p{N}/u;

type JiebaToken = { word: string; start: number; end: number };
type TokenizeFn = (text: string, mode: string, hmm?: boolean | null) => JiebaToken[];

let tokenizePromise: Promise<TokenizeFn> | null = null;

function loadTokenize(): Promise<TokenizeFn> {
  if (!tokenizePromise) {
    tokenizePromise = import("jieba-wasm").then((mod) => mod.tokenize);
  }
  return tokenizePromise;
}

/** Map jieba tokens to engine `Token`s (code-unit offsets, same as the pack contract). */
async function jiebaToTokens(text: string): Promise<Token[]> {
  const tokenize = await loadTokenize();
  const raw = tokenize(text, "default", false);
  const tokens: Token[] = [];
  for (const piece of raw) {
    const slice = text.slice(piece.start, piece.end);
    tokens.push({
      text: slice,
      start: piece.start,
      end: piece.end,
      isWord: WORD_RE.test(slice),
    });
  }
  return tokens;
}

async function resolvePackTokens(text: string, pack: LanguagePack): Promise<Token[]> {
  const result = pack.segmenter(text);
  if (result instanceof Promise) return result;
  return result;
}

/** Segment `text` for the active pack — jieba for zh-Hant, pack fallback otherwise. */
export async function segmentLiveText(
  text: string,
  pack: LanguagePack,
): Promise<Token[]> {
  if (!text) return [];
  if (pack.id === "zh-Hant") {
    try {
      return await jiebaToTokens(text);
    } catch {
      return resolvePackTokens(text, pack);
    }
  }
  return resolvePackTokens(text, pack);
}