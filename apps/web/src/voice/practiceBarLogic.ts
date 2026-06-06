/**
 * Pure logic for the segment-loop practice bar (M2.1) — no DOM, no wavesurfer,
 * so it unit-tests without a browser. The DOM/wavesurfer glue lives in
 * `practiceBar.ts` and calls these.
 */

/** Loop/region bounds in seconds. */
export interface Bounds {
  start: number;
  end: number;
}

/** Speed presets for the practice bar (pitch-corrected via playbackRate). */
export const SPEED_PRESETS = [1, 0.85, 0.75] as const;

/** How far `[` / `]` move a region edge, in seconds. */
export const NUDGE_SEC = 0.05;

/** Smallest allowed region length, so an edge can't cross the other. */
export const MIN_REGION_SEC = 0.05;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

/** The span to loop: the selected region, or the whole cue when none is selected. */
export function loopBounds(region: Bounds | null, cueDuration: number): Bounds {
  return region ?? { start: 0, end: cueDuration };
}

/** Which edge is nearer the playhead `t` (ties → start). */
export function nearestEdge(b: Bounds, t: number): "start" | "end" {
  return Math.abs(t - b.start) <= Math.abs(t - b.end) ? "start" : "end";
}

/**
 * Move one edge by `deltaSec`, clamped to `[0, duration]` and kept at least
 * {@link MIN_REGION_SEC} from the other edge. Returns fresh bounds.
 */
export function nudgeEdge(b: Bounds, edge: "start" | "end", deltaSec: number, duration: number): Bounds {
  if (edge === "start") {
    return { start: clamp(b.start + deltaSec, 0, b.end - MIN_REGION_SEC), end: b.end };
  }
  return { start: b.start, end: clamp(b.end + deltaSec, b.start + MIN_REGION_SEC, duration) };
}

/** Next speed in the preset cycle (wraps; unknown current → first preset). */
export function cycleSpeed(current: number, speeds: readonly number[] = SPEED_PRESETS): number {
  const i = speeds.indexOf(current);
  return speeds[(i + 1) % speeds.length] ?? speeds[0]!;
}
