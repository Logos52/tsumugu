/**
 * Tone parsing for the browser packs — pure, data-free, DOM-free.
 *
 * Maps a per-word phonetic reading to per-syllable tone classes (1..5/1..6)
 * for the reader's optional tone coloring (PRD §5.8). Status coloring is
 * separate; this is consumed only when `settings.toneColoring` is on.
 */

/**
 * Per-syllable Mandarin tone classes from a Zhuyin (Bopomofo) reading.
 *
 * Splits on spaces; each syllable's tone is read off its Zhuyin tone mark:
 *   - no mark → 1 (first/high)
 *   - "ˊ" U+02CA → 2 (rising)
 *   - "ˇ" U+02C7 → 3 (low/dipping)
 *   - "ˋ" U+02CB → 4 (falling)
 *   - leading "˙" U+02D9 → 5 (neutral)
 *
 * If the reading carries a "/ pinyin" variant (e.g. "ㄧㄝˋ ㄕˋ / yè shì"),
 * only the Zhuyin part (before the "/") is used. Returns undefined if the
 * Zhuyin part is empty/unparseable so callers can fall back gracefully.
 */
export function toneClassesFromZhuyin(reading: string): number[] | undefined {
  if (!reading) return undefined;
  // Keep only the Zhuyin part if a "/ pinyin" (or "/ variant") suffix is present.
  const zhuyinPart = reading.split("/")[0]?.trim() ?? "";
  if (!zhuyinPart) return undefined;

  const syllables = zhuyinPart.split(/\s+/).filter((s) => s.length > 0);
  if (syllables.length === 0) return undefined;

  const tones: number[] = [];
  for (const syl of syllables) {
    if (syl.startsWith("˙")) {
      tones.push(5); // leading neutral-tone mark
      continue;
    }
    if (syl.includes("ˊ")) tones.push(2);
    else if (syl.includes("ˇ")) tones.push(3);
    else if (syl.includes("ˋ")) tones.push(4);
    else tones.push(1); // no mark → first tone
  }
  return tones;
}

/** Vietnamese tone-bearing combining marks (NFD), mapped to tone 1..6. */
const VI_TONE_MARKS: ReadonlyMap<string, number> = new Map([
  ["̀", 2], // grave → huyền
  ["́", 3], // acute → sắc
  ["̉", 4], // hook above → hỏi
  ["̃", 5], // tilde → ngã
  ["̣", 6], // dot below → nặng
]);

/** Vowel-quality marks to ignore (they change the vowel, not the tone). */
const VI_QUALITY_MARKS: ReadonlySet<string> = new Set([
  "̂", // circumflex (â, ê, ô)
  "̆", // breve (ă)
  "̛", // horn (ơ, ư)
]);

/**
 * Per-syllable Vietnamese tone classes (1..6) from a written word.
 *
 * Splits on spaces; each syllable's tone is derived from its NFD combining
 * marks: no tone mark → 1 (ngang). Vowel-quality marks (circumflex, breve,
 * horn) are ignored. Returns undefined if the input is empty.
 */
export function toneClassesFromViWord(word: string): number[] | undefined {
  if (!word) return undefined;
  const syllables = word.split(/\s+/).filter((s) => s.length > 0);
  if (syllables.length === 0) return undefined;

  const tones: number[] = [];
  for (const syl of syllables) {
    let tone = 1; // ngang (no mark) by default
    for (const ch of syl.normalize("NFD")) {
      if (VI_QUALITY_MARKS.has(ch)) continue;
      const mapped = VI_TONE_MARKS.get(ch);
      if (mapped !== undefined) {
        tone = mapped;
        break;
      }
    }
    tones.push(tone);
  }
  return tones;
}
