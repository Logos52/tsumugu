/**
 * Word-status coloring helpers (PRD §5.2, §5.8).
 *
 * Pure, DOM-free mapping from a {@link WordStatus} to highlight intensity,
 * a stable CSS class name, and keyboard hotkeys. The host (web app /
 * extension) owns the actual CSS and event wiring; the engine only provides
 * the language-agnostic mapping.
 */

import type { WordStatus } from "../types.js";

/**
 * Highlight strength in [0, 1]. Strongest for `new` (never graded), fading
 * through the learning levels `l1..l4`, and 0 for the terminal states
 * (`known`/`ignored`) which carry no highlight.
 *
 * Mirrors the fade implied by `STATUS_LEVEL` (level 0 → 1.0 … level 4 → 0.2)
 * but is expressed as an explicit table so terminal states map cleanly to 0.
 */
const STATUS_INTENSITY: Record<WordStatus, number> = {
  new: 1.0,
  l1: 0.8,
  l2: 0.6,
  l3: 0.4,
  l4: 0.2,
  known: 0,
  ignored: 0,
};

/**
 * Highlight strength for a status, in [0, 1].
 *
 * `new` is the strongest (1.0) and fades through `l1..l4`; `known` and
 * `ignored` are 0 (no highlight).
 */
export function statusIntensity(status: WordStatus): number {
  return STATUS_INTENSITY[status];
}

/**
 * Stable CSS class for a status, e.g. `"tsg-status-new"`, `"tsg-status-l1"`,
 * …, `"tsg-status-known"`, `"tsg-status-ignored"`.
 *
 * The class is derived from the status string, so it stays in lockstep with
 * the {@link WordStatus} union and is safe to use as a selector.
 */
export function statusColorClass(status: WordStatus): string {
  return `tsg-status-${status}`;
}

/**
 * Keyboard hotkeys → status. The numeric keys map to the learning levels,
 * `k`/`K` to `known`, and `x`/`X` to `ignored`. There is deliberately no
 * hotkey for `new` (the implicit default) — clearing/resetting is a host
 * concern, not a grade.
 */
export const STATUS_HOTKEYS: Record<string, WordStatus> = {
  "1": "l1",
  "2": "l2",
  "3": "l3",
  "4": "l4",
  k: "known",
  K: "known",
  x: "ignored",
  X: "ignored",
};

/**
 * Resolve a keyboard key to a status, or `undefined` if the key is not a
 * status hotkey. Case-sensitive (both cases are registered for letters).
 *
 * Uses an own-property check so that inherited `Object.prototype` keys
 * (`"toString"`, `"constructor"`, `"__proto__"`, …) — which a host may pass
 * as raw keyboard input — resolve to `undefined` rather than leaking the
 * inherited member. The declared `WordStatus | undefined` return type is
 * therefore honored at runtime for every possible string.
 */
export function hotkeyToStatus(key: string): WordStatus | undefined {
  return Object.hasOwn(STATUS_HOTKEYS, key) ? STATUS_HOTKEYS[key] : undefined;
}
