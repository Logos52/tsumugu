/**
 * Per-word audio (M3) — the reader's view of a `tsumugu/word-audio@1` sidecar
 * (`gen word-audio` output): a word → mp3 map so the hover 🔊 plays the Serena
 * voice instead of Web Speech. Pure parse/bind/lookup + a thin player; inert
 * until a manifest is present (then Web Speech remains the fallback per word).
 */

import type { VaultIO } from "@tsumugu/engine";
import { resolveAudioPath } from "./manifest.js";

export const WORD_AUDIO_SCHEMA = "tsumugu/word-audio@1";

export interface WordAudioManifest {
  schema: typeof WORD_AUDIO_SCHEMA;
  lang: string;
  voice: string;
  engine: string;
  generatedAt?: string;
  words: Record<string, string>;
}

export interface WordAudioBinding {
  manifest: WordAudioManifest;
  /** Vault-relative directory of the manifest; word paths resolve against it. */
  baseDir: string;
  byWord: ReadonlyMap<string, string>;
}

/** Parse + validate raw JSON, or null when it isn't a `tsumugu/word-audio@1` doc. */
export function parseWordAudio(raw: unknown): WordAudioManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== WORD_AUDIO_SCHEMA || typeof o.words !== "object" || o.words === null) return null;
  const words: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.words as Record<string, unknown>)) {
    if (typeof v === "string" && v.length > 0) words[k] = v;
  }
  const m: WordAudioManifest = {
    schema: WORD_AUDIO_SCHEMA,
    lang: typeof o.lang === "string" ? o.lang : "",
    voice: typeof o.voice === "string" ? o.voice : "",
    engine: typeof o.engine === "string" ? o.engine : "",
    words,
  };
  if (typeof o.generatedAt === "string") m.generatedAt = o.generatedAt;
  return m;
}

/** Bind a parsed manifest to its directory, precomputing the word index. */
export function bindWordAudio(manifest: WordAudioManifest, baseDir: string): WordAudioBinding {
  return { manifest, baseDir, byWord: new Map(Object.entries(manifest.words)) };
}

/** Resolved vault path for a word's clip, or null when the word isn't rendered. Pure. */
export function selectWordSrc(binding: WordAudioBinding, word: string): string | null {
  const rel = binding.byWord.get(word);
  return rel ? resolveAudioPath(binding.baseDir, rel) : null;
}

export interface WordAudioPlayer {
  /** Play a word's clip; falls back to Web Speech when there's no clip. */
  playWord(word: string): void;
  destroy(): void;
}

/** How many decoded word clips to keep alive. */
export const WORD_AUDIO_LRU = 24;

export function createWordAudioPlayer(deps: {
  vault: VaultIO;
  binding: WordAudioBinding;
  speak: (text: string) => void;
}): WordAudioPlayer {
  const { vault, binding, speak } = deps;
  const audio = new Audio();
  const cache = new Map<string, string>(); // resolved path → object URL (insertion-ordered LRU)
  let token = 0;
  let warned = false;

  function fallback(word: string): void {
    if (!warned) {
      console.warn("[word-audio] no clip for a word — falling back to Web Speech");
      warned = true;
    }
    speak(word);
  }

  async function loadUrl(path: string): Promise<string | null> {
    const hit = cache.get(path);
    if (hit !== undefined) {
      cache.delete(path);
      cache.set(path, hit);
      return hit;
    }
    if (!vault.readBytes) return null;
    let bytes: Uint8Array | null;
    try {
      bytes = await vault.readBytes(path);
    } catch {
      return null;
    }
    if (!bytes) return null;
    const part = new Uint8Array(bytes); // fresh ArrayBuffer-backed copy for Blob (see host/anki.ts)
    const url = URL.createObjectURL(new Blob([part.buffer]));
    cache.set(path, url);
    while (cache.size > WORD_AUDIO_LRU) {
      const oldest = cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      const u = cache.get(oldest);
      cache.delete(oldest);
      if (u) URL.revokeObjectURL(u);
    }
    return url;
  }

  return {
    playWord(word) {
      token++;
      const tk = token;
      const src = selectWordSrc(binding, word);
      if (!src) {
        fallback(word);
        return;
      }
      void loadUrl(src).then((url) => {
        if (tk !== token) return;
        if (!url) {
          fallback(word);
          return;
        }
        audio.src = url;
        audio.playbackRate = 1;
        void audio.play().catch(() => {
          if (tk === token) fallback(word);
        });
      });
    },
    destroy() {
      token++;
      audio.pause();
      for (const u of cache.values()) URL.revokeObjectURL(u);
      cache.clear();
    },
  };
}
