/**
 * Public API for the word-status module (PRD §5.2, §5.8).
 *
 * Coloring (intensity / CSS class / hotkeys) and transitions (known policy,
 * cycling, promote/demote, level lookup). All pure and DOM-free.
 */

export {
  statusIntensity,
  statusColorClass,
  STATUS_HOTKEYS,
  hotkeyToStatus,
} from "./coloring.js";

export {
  DEFAULT_KNOWN_POLICY,
  isKnown,
  cycleStatus,
  promote,
  demote,
  nextStatusLevel,
} from "./transitions.js";
