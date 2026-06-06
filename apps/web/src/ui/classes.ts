/**
 * Shared CSS class names so view markup and styles.css stay in sync.
 *
 * STATUS coloring classes are NOT here — they come from the engine's
 * `statusColorClass(status)` → "tsg-status-new" | "tsg-status-l1" … "l4" |
 * "tsg-status-known" | "tsg-status-ignored". styles.css must define all seven.
 * TONE classes come from `toneClass(n)` below → "tsg-tone-1".."tsg-tone-5".
 */

export const CLS = {
  // reader
  reader: "tsg-reader",
  readerText: "tsg-reader-text",
  token: "tsg-token",
  word: "tsg-word",
  punct: "tsg-punct",
  flagged: "tsg-flagged",
  active: "tsg-active",
  ruby: "tsg-ruby", // <ruby> wrapper for zhuyin-above rendering (phonetics on)
  cueActive: "tsg-cue-active", // tokens of the transcript cue currently playing

  // transcript synced-reader (M4)
  transcript: "tsg-transcript",
  player: "tsg-player",
  transport: "tsg-transport",
  scrubber: "tsg-scrubber",
  translation: "tsg-translation", // the current line's sentence translation

  // hover popup
  popup: "tsg-popup",
  popupTerm: "tsg-popup-term",
  popupReading: "tsg-popup-reading",
  popupGloss: "tsg-popup-gloss",
  popupExplain: "tsg-popup-explain",
  popupExamples: "tsg-popup-examples",
  popupBridge: "tsg-popup-bridge",
  popupGrades: "tsg-popup-grades",
  popupHidden: "tsg-popup-hidden", // guess-first: gloss concealed until reveal

  // review
  review: "tsg-review",
  card: "tsg-card",
  cardTerm: "tsg-card-term",
  cardBack: "tsg-card-back",
  cardControls: "tsg-card-controls",

  // shared controls
  btn: "tsg-btn",
  btnActive: "tsg-btn-active",
  toolbar: "tsg-toolbar",
  metrics: "tsg-metrics",
} as const;

/** zh tone-coloring class for syllable tone n (1..5; 5 = neutral). */
export function toneClass(n: number): string {
  return `tsg-tone-${n}`;
}

/** All seven status color classes, for styles.css authors and tests. */
export const STATUS_COLOR_CLASSES = [
  "tsg-status-new",
  "tsg-status-l1",
  "tsg-status-l2",
  "tsg-status-l3",
  "tsg-status-l4",
  "tsg-status-known",
  "tsg-status-ignored",
] as const;
