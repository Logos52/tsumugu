/**
 * Shadowing / chorusing mode — pure state machine (PRD §8, brief B3).
 *
 * The loop: play the current cue's voice note → highlight stays → the user
 * repeats it aloud → Space advances to the next cue and plays it. No auto-advance.
 * Esc exits. This module is the transitions only; the transcript controller maps
 * each state to effects (play a cue, move the highlight) and feeds back events.
 */

export type ShadowState =
  | { phase: "idle" }
  | { phase: "playing"; cue: number }
  | { phase: "waiting"; cue: number }
  | { phase: "done" };

export type ShadowEvent =
  | { type: "start"; cue: number }
  | { type: "audioEnded" }
  | { type: "advance" }
  | { type: "exit" };

export const SHADOW_IDLE: ShadowState = { phase: "idle" };

/** The cue currently in focus (playing or waiting), else null. */
export function shadowCue(state: ShadowState): number | null {
  return state.phase === "playing" || state.phase === "waiting" ? state.cue : null;
}

/** Whether shadowing is engaged (anything but idle). */
export function shadowActive(state: ShadowState): boolean {
  return state.phase !== "idle";
}

/**
 * Next state for an event. Pure.
 *
 * - `exit` always → idle.
 * - `start(cue)` → playing(cue) from any phase (re-arm), if the cue is in range.
 * - `audioEnded` while playing → waiting (highlight stays; user's turn).
 * - `advance` (Space) while playing or waiting → next cue playing, or done at the end.
 * - everything else is a no-op (returns the same state).
 */
export function shadowReducer(state: ShadowState, event: ShadowEvent, cueCount: number): ShadowState {
  switch (event.type) {
    case "exit":
      return SHADOW_IDLE;
    case "start":
      if (event.cue < 0 || event.cue >= cueCount) return SHADOW_IDLE;
      return { phase: "playing", cue: event.cue };
    case "audioEnded":
      return state.phase === "playing" ? { phase: "waiting", cue: state.cue } : state;
    case "advance": {
      if (state.phase !== "playing" && state.phase !== "waiting") return state;
      const next = state.cue + 1;
      return next < cueCount ? { phase: "playing", cue: next } : { phase: "done" };
    }
    default:
      return state;
  }
}
