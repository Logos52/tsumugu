/**
 * Per-example-sentence audio (Dictionary PRD D4) — plays Serena clips referenced
 * by `examples[].audio` on prepared/encoding content. Paths are relative to the
 * reading's vault directory (`contentBaseDir`). Inert when absent; Web Speech
 * fallback per sentence.
 */

import type { VaultIO } from "@tsumugu/engine";
import { resolveAudioPath } from "./manifest.js";

/** Resolve a manifest-relative audio path against the reading directory. */
export function resolveExampleAudioSrc(contentBaseDir: string | null, audioRel?: string): string | null {
  if (!audioRel?.trim() || !contentBaseDir) return null;
  return resolveAudioPath(contentBaseDir, audioRel);
}

export interface ExampleAudioPlayer {
  /** Play a sentence clip; falls back to Web Speech when there's no clip. */
  playExample(audioRel: string | undefined, text: string): void;
  destroy(): void;
}

/** How many decoded example clips to keep alive. */
export const EXAMPLE_AUDIO_LRU = 16;

export function createExampleAudioPlayer(deps: {
  vault: VaultIO;
  contentBaseDir: string | null;
  speak: (text: string) => void;
}): ExampleAudioPlayer {
  const { vault, contentBaseDir, speak } = deps;
  const audio = new Audio();
  const cache = new Map<string, string>();
  let token = 0;
  let warned = false;

  function fallback(text: string): void {
    if (!warned) {
      console.warn("[example-audio] no clip for a sentence — falling back to Web Speech");
      warned = true;
    }
    if (text) speak(text);
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
    const part = new Uint8Array(bytes);
    const url = URL.createObjectURL(new Blob([part.buffer]));
    cache.set(path, url);
    while (cache.size > EXAMPLE_AUDIO_LRU) {
      const oldest = cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      const u = cache.get(oldest);
      cache.delete(oldest);
      if (u) URL.revokeObjectURL(u);
    }
    return url;
  }

  return {
    playExample(audioRel, text) {
      token++;
      const tk = token;
      const src = resolveExampleAudioSrc(contentBaseDir, audioRel);
      if (!src) {
        fallback(text);
        return;
      }
      void loadUrl(src).then((url) => {
        if (tk !== token) return;
        if (!url) {
          fallback(text);
          return;
        }
        audio.src = url;
        audio.playbackRate = 1;
        void audio.play().catch(() => {
          if (tk === token) fallback(text);
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