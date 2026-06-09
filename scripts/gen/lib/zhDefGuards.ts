/**
 * Mechanical zh-definition guards the band metric cannot catch (PRD §5.3 Stage 6).
 */

/** True when the headword appears as a substring in gloss or illustration. */
export function isCircularZhDef(
  headword: string,
  gloss: string,
  illustration?: string,
): boolean {
  if (headword === "") return false;
  if (gloss.includes(headword)) return true;
  if (illustration !== undefined && illustration.includes(headword)) return true;
  return false;
}

/**
 * True when gloss is blank, or nothing meaningful remains after removing
 * every headword occurrence (PRD §2 check 5).
 */
export function isEmptyZhDef(headword: string, gloss: string): boolean {
  const trimmed = gloss.trim();
  if (trimmed === "") return true;
  if (headword === "") return false;
  const stripped = trimmed.split(headword).join("").replace(/\s+/g, "").trim();
  return stripped.length === 0;
}