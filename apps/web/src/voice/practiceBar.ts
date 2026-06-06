/**
 * Segment-loop practice bar (M2.1) — wavesurfer.js glue.
 *
 * Mounts an Audacity-style waveform for one cue's audio: drag to select a slice,
 * loop it (L), nudge its edges ([ / ]), and slow it (1× / 0.85× / 0.75×). The
 * pure math lives in `practiceBarLogic.ts`; this file owns the wavesurfer
 * instance + DOM. wavesurfer (BSD-3-Clause) is **dynamically imported** so it
 * only loads when the bar is first opened (kept out of the main bundle, and out
 * of every other module's import graph). Reader/host layer only — engine untouched.
 *
 * Loop uses the regions plugin's media-element seek (the documented ~30 ms seam);
 * a gapless AudioBufferSourceNode path is the future upgrade.
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
  /** Toggle looping of the selected region (or the whole cue if none selected). */
  toggleLoop(): void;
  /** Nudge the region edge nearest the playhead: -1 = earlier, +1 = later. */
  nudge(dir: -1 | 1): void;
  /** Advance to the next speed preset; returns the new rate. */
  cycleSpeed(): number;
  /** Play/pause the cue audio. */
  playPause(): void;
  isLooping(): boolean;
  /** Tear down the wavesurfer instance and free the audio URL. */
  destroy(): void;
}

export interface PracticeBarArgs {
  /** Element the waveform mounts into. */
  container: HTMLElement;
  vault: VaultIO;
  binding: VoiceNotesBinding;
  /** The cue to pin the bar to. */
  cueIndex: number;
}

export type PracticeBarFactory = (args: PracticeBarArgs) => Promise<PracticeBar | null>;

/** Read a CSS custom property off :root, with a fallback. */
function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle !== "function") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Build a practice bar for `cueIndex`. Returns null when the cue has no voice
 * note or its audio can't be read (nothing to drill — the caller stays inert).
 */
export const createPracticeBar: PracticeBarFactory = async ({ container, vault, binding, cueIndex }) => {
  const note = binding.byCue.get(cueIndex);
  if (!note || !vault.readBytes) return null;
  let bytes: Uint8Array | null;
  try {
    bytes = await vault.readBytes(resolveAudioPath(binding.baseDir, note.audio));
  } catch {
    bytes = null;
  }
  if (!bytes) return null;
  const part = new Uint8Array(bytes); // fresh ArrayBuffer-backed copy for Blob (see host/anki.ts)
  const url = URL.createObjectURL(new Blob([part.buffer]));

  // Lazy-load wavesurfer + its regions plugin only now (code-split chunk).
  const { default: WaveSurfer } = await import("wavesurfer.js");
  const { default: RegionsPlugin } = await import("wavesurfer.js/plugins/regions");

  const ws = WaveSurfer.create({
    container,
    url,
    height: 64,
    waveColor: cssVar("--ctp-overlay0", "#9ca0b0"),
    progressColor: cssVar("--ctp-blue", "#1e66f5"),
    cursorColor: cssVar("--ctp-text", "#4c4f69"),
  });
  const regions = ws.registerPlugin(RegionsPlugin.create());
  regions.enableDragSelection({ color: "rgba(30, 102, 245, 0.18)" });

  let looping = false;
  let region: Region | null = null;
  let rate = 1;

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

  return {
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
        region = regions.addRegion({ start: 0, end, color: "rgba(30, 102, 245, 0.12)" });
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
      ws.destroy();
      URL.revokeObjectURL(url);
    },
  };
};
