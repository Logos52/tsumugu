/**
 * Section-summary audio — the reader's view of a `tsumugu/section-audio@1`
 * sidecar (`gen section-audio` output): one Serena mp3 per topical section
 * summary, played by the 🔊 on the "now talking about…" line. Mirrors the
 * word-audio module; inert without a manifest (Web Speech fallback).
 */

import type { VaultIO } from "@tsumugu/engine";
import { resolveAudioPath } from "./manifest.js";

export const SECTION_AUDIO_SCHEMA = "tsumugu/section-audio@1";

export interface SectionAudioNote {
  sectionIndex: number;
  audio: string;
}

export interface SectionAudioManifest {
  schema: typeof SECTION_AUDIO_SCHEMA;
  lang: string;
  voice: string;
  engine: string;
  generatedAt?: string;
  notes: SectionAudioNote[];
}

export interface SectionAudioBinding {
  manifest: SectionAudioManifest;
  baseDir: string;
  byIndex: ReadonlyMap<number, string>;
}

/** Parse + validate raw JSON, or null when it isn't a section-audio doc. */
export function parseSectionAudio(raw: unknown, sectionCount: number): SectionAudioManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== SECTION_AUDIO_SCHEMA || !Array.isArray(o.notes)) return null;
  const byIndex = new Map<number, SectionAudioNote>();
  for (const entry of o.notes) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const idx = r.sectionIndex;
    if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= sectionCount) continue;
    if (typeof r.audio !== "string" || r.audio.length === 0) continue;
    byIndex.set(idx, { sectionIndex: idx, audio: r.audio });
  }
  const notes = [...byIndex.values()].sort((a, b) => a.sectionIndex - b.sectionIndex);
  const m: SectionAudioManifest = {
    schema: SECTION_AUDIO_SCHEMA,
    lang: typeof o.lang === "string" ? o.lang : "",
    voice: typeof o.voice === "string" ? o.voice : "",
    engine: typeof o.engine === "string" ? o.engine : "",
    notes,
  };
  if (typeof o.generatedAt === "string") m.generatedAt = o.generatedAt;
  return m;
}

export function bindSectionAudio(manifest: SectionAudioManifest, baseDir: string): SectionAudioBinding {
  return { manifest, baseDir, byIndex: new Map(manifest.notes.map((n) => [n.sectionIndex, n.audio])) };
}

/** Resolved vault path for a section's clip, or null if not rendered. Pure. */
export function selectSectionSrc(binding: SectionAudioBinding, sectionIndex: number): string | null {
  const rel = binding.byIndex.get(sectionIndex);
  return rel ? resolveAudioPath(binding.baseDir, rel) : null;
}

export interface SectionAudioPlayer {
  /** Play a section's summary clip; `fallbackText` is spoken if there's no clip. */
  playSection(sectionIndex: number, fallbackText: string): void;
  destroy(): void;
}

export function createSectionAudioPlayer(deps: {
  vault: VaultIO;
  binding: SectionAudioBinding;
  speak: (text: string) => void;
}): SectionAudioPlayer {
  const { vault, binding, speak } = deps;
  const audio = new Audio();
  const cache = new Map<string, string>(); // path → object URL (small LRU)
  const LRU = 8;
  let token = 0;
  let warned = false;

  function fallback(text: string): void {
    if (!warned) {
      console.warn("[section-audio] no clip — falling back to Web Speech");
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
    while (cache.size > LRU) {
      const oldest = cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      const u = cache.get(oldest);
      cache.delete(oldest);
      if (u) URL.revokeObjectURL(u);
    }
    return url;
  }

  return {
    playSection(sectionIndex, fallbackText) {
      token++;
      const tk = token;
      const src = selectSectionSrc(binding, sectionIndex);
      if (!src) {
        fallback(fallbackText);
        return;
      }
      void loadUrl(src).then((url) => {
        if (tk !== token) return;
        if (!url) {
          fallback(fallbackText);
          return;
        }
        audio.src = url;
        audio.playbackRate = 1;
        void audio.play().catch(() => {
          if (tk === token) fallback(fallbackText);
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
