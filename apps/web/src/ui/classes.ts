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
  cueTr: "tsg-cue-tr", // per-row English under a cue (譯 / `t`)
  section: "tsg-section", // the "now talking about…" section summary
  sectionTr: "tsg-section-tr", // the section summary's translation (譯 toggle)
  practiceBar: "tsg-practice", // segment-loop practice bar container (M2.1)
  practiceWave: "tsg-practice-wave", // wavesurfer waveform host
  loopStrip: "tsg-loop-strip", // A/B video loop strip container (🆎)
  loopTrack: "tsg-loop-track", // the strip's timeline track
  loopTick: "tsg-loop-tick", // a sentence-boundary mark on the track
  loopFill: "tsg-loop-fill", // the selected A→B region
  loopHandle: "tsg-loop-handle", // a draggable A or B edge
  loopPlayhead: "tsg-loop-playhead", // current playback position on the track

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

  // encoding layer page
  encodingWork: "tsg-encoding-work",
  encodingRail: "tsg-encoding-rail",
  encodingPage: "tsg-encoding-page",
  encodingBrow: "tsg-encoding-brow",
  encodingCell: "tsg-encoding-cell",
  encodingCellTricky: "tsg-encoding-cell-tricky",
  defGrid: "tsg-defgrid",
  defCard: "tsg-defcard",
  defCardZh: "tsg-defcard-zh",
  defToggle: "tsg-def-toggle",
  defSeg: "tsg-def-seg",
  defSegOn: "tsg-def-seg-on",
  sents: "tsg-sents",
  sentRow: "tsg-sent-row",
  sentNum: "tsg-sent-num",
  sentCn: "tsg-sent-cn",
  sentEn: "tsg-sent-en",
  sentWavewrap: "tsg-sent-wavewrap",
  sentWave: "tsg-sent-wave",
  sentWaveBtn: "tsg-sent-wave-btn",
  sentWaveActive: "tsg-sent-wave-active",
  groundingMarker: "tsg-grounding-marker",
  relatedLink: "tsg-related-link",
  encodingTerm: "tsg-encoding-term",
  encodingReading: "tsg-encoding-reading",
  encodingPosLevel: "tsg-encoding-pos-level",
  encodingTag: "tsg-encoding-tag",
  encodingTagLearn: "tsg-encoding-tag-learn",
  encodingFlag: "tsg-encoding-flag",
  encodingRailHead: "tsg-encoding-rail-head",
  encodingRailQueue: "tsg-encoding-rail-queue",
  encodingRailItem: "tsg-encoding-rail-item",
  encodingRailItemActive: "tsg-encoding-rail-item-active",
  encodingRailGrades: "tsg-encoding-rail-grades",
  encodingGradeAgain: "tsg-encoding-grade-again",
  encodingGradeGood: "tsg-encoding-grade-good",
  encodingHidden: "tsg-encoding-hidden",

  // shared controls
  btn: "tsg-btn",
  btnActive: "tsg-btn-active",
  toolbar: "tsg-toolbar",
  metrics: "tsg-metrics",
  encodingCoverage: "tsg-encoding-coverage",
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
