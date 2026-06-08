/**
 * Segment-loop practice bar (M2.1, auto-following per M3) — wavesurfer.js glue.
 *
 * An always-visible waveform that FOLLOWS the active sentence: drag to select a
 * slice, loop it (🔁), nudge edges ([ / ]), slow it (1× / 0.85× / 0.75×). One
 * wavesurfer instance is mounted and `setCue()` reloads its audio when the active
 * cue changes (cheap `ws.load`, per-cue object-URL cache) — no recreate. The pure
 * math lives in `practiceBarLogic.ts`. wavesurfer (BSD-3-Clause) is dynamically
 * imported so it only loads when a voiced reading opens. Reader/host layer only.
 *
 * Loop uses the regions plugin's media-element seek (~30 ms seam, per PRD).
 */

import type { VaultIO } from "@tsumugu/engine";
import type { Region } from "wavesurfer.js/plugins/regions";

import { resolveAudioPath, type VoiceNotesBinding } from "./manifest.js";
import {
  cycleSpeed as nextSpeedPreset,
  nearestEdge,
  nudgeEdge,
  NUDGE_SEC,
  type Bounds,
} from "./practiceBarLogic.js";

export interface PracticeBar {
  /** Reload the bar's waveform to a different cue (follow the active sentence). */
  setCue(cueIndex: number): void;
  /** Toggle looping of the selected region (or the whole cue if none selected). */
  toggleLoop(): void;
  /** Nudge the region edge nearest the playhead: -1 = earlier, +1 = later. */
  nudge(dir: -1 | 1): void;
  /** Advance to the next speed preset; returns the new rate. */
  cycleSpeed(): number;
  /** Play/pause the cue audio. */
  playPause(): void;
  isLooping(): boolean;
  /** Tear down the wavesurfer instance and free cached audio URLs. */
  destroy(): void;
}

export interface PracticeBarArgs {
  /** Element the waveform mounts into. */
  container: HTMLElement;
  vault: VaultIO;
  binding: VoiceNotesBinding;
  /** The cue to load first. */
  initialCue: number;
}

export type PracticeBarFactory = (args: PracticeBarArgs) => Promise<PracticeBar | null>;

/** How many decoded cue clips to keep alive. */
const URL_LRU = 12;

/** Read a CSS custom property off :root, with a fallback. */
function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle !== "function") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Build the practice bar. Returns null only when the host can't read bytes (so
 * nothing could ever play); an individual cue without audio just leaves the
 * current waveform in place.
 */
export const createPracticeBar: PracticeBarFactory = async ({ container, vault, binding, initialCue }) => {
  if (!vault.readBytes) return null;

  // Lazy-load wavesurfer + its regions plugin only now (code-split chunk).
  const { default: WaveSurfer } = await import("wavesurfer.js");
  const { default: RegionsPlugin } = await import("wavesurfer.js/plugins/regions");

  const ws = WaveSurfer.create({
    container,
    height: 64,
    waveColor: cssVar("--wnac-overlay0", "#2e466b"),
    progressColor: cssVar("--wnac-blue", "#5089d8"),
    cursorColor: cssVar("--wnac-blue-bright", "#66aaf7"),
  });
  const regions = ws.registerPlugin(RegionsPlugin.create());
  regions.enableDragSelection({ color: "rgba(80,137,216,0.20)" });

  let looping = false;
  let region: Region | null = null;
  let rate = 1;
  const urlCache = new Map<number, string>(); // cueIndex → object URL (insertion-ordered LRU)
  let loadToken = 0;

  // Single selection: a new drag replaces any prior region.
  regions.on("region-created", (r: Region) => {
    for (const other of regions.getRegions()) if (other !== r) other.remove();
    region = r;
  });
  regions.on("region-updated", (r: Region) => {
    region = r;
  });
  // Loop: when playback leaves the active region (~at its end), replay from start.
  regions.on("region-out", (r: Region) => {
    if (looping && r === region) r.play();
  });

  async function urlForCue(i: number): Promise<string | null> {
    const hit = urlCache.get(i);
    if (hit !== undefined) {
      urlCache.delete(i);
      urlCache.set(i, hit);
      return hit;
    }
    const note = binding.byCue.get(i);
    if (!note || !vault.readBytes) return null;
    let bytes: Uint8Array | null;
    try {
      bytes = await vault.readBytes(resolveAudioPath(binding.baseDir, note.audio));
    } catch {
      return null;
    }
    if (!bytes) return null;
    const part = new Uint8Array(bytes); // fresh ArrayBuffer-backed copy for Blob (see host/anki.ts)
    const url = URL.createObjectURL(new Blob([part.buffer]));
    urlCache.set(i, url);
    while (urlCache.size > URL_LRU) {
      const oldest = urlCache.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      const u = urlCache.get(oldest);
      urlCache.delete(oldest);
      if (u) URL.revokeObjectURL(u);
    }
    return url;
  }

  async function loadCue(i: number): Promise<void> {
    loadToken++;
    const tk = loadToken;
    const url = await urlForCue(i);
    if (tk !== loadToken) return; // superseded by a newer setCue
    if (!url) return; // this cue has no audio — keep the current waveform
    looping = false;
    region = null;
    try {
      regions.clearRegions();
    } catch {
      /* no-op */
    }
    try {
      await ws.load(url);
      if (tk !== loadToken) return;
      ws.setPlaybackRate(rate, true); // keep the chosen speed across cues
    } catch {
      /* load races / unsupported in tests — non-fatal */
    }
  }

  await loadCue(initialCue);

  return {
    setCue(i) {
      void loadCue(i);
    },
    toggleLoop() {
      looping = !looping;
      if (!looping) {
        ws.pause();
        return;
      }
      if (!region) {
        const end = ws.getDuration() || 0;
        if (end <= 0) {
          looping = false;
          return;
        }
        region = regions.addRegion({ start: 0, end, color: "rgba(80,137,216,0.20)" });
      }
      region.play();
    },
    nudge(dir) {
      if (!region) return;
      const b: Bounds = { start: region.start, end: region.end };
      const edge = nearestEdge(b, ws.getCurrentTime());
      const nb = nudgeEdge(b, edge, dir * NUDGE_SEC, ws.getDuration() || b.end);
      region.setOptions({ start: nb.start, end: nb.end });
    },
    cycleSpeed() {
      rate = nextSpeedPreset(rate);
      ws.setPlaybackRate(rate, true); // preserve pitch
      return rate;
    },
    playPause() {
      void ws.playPause();
    },
    isLooping() {
      return looping;
    },
    destroy() {
      loadToken++;
      ws.destroy();
      for (const u of urlCache.values()) URL.revokeObjectURL(u);
      urlCache.clear();
    },
  };
};
