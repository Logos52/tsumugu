/**
 * Collocation helpers (Dictionary PRD extension).
 */
import type { Collocation } from "@tsumugu/engine";

export const COLLOCATION_COUNT_MIN = 3;
export const COLLOCATION_COUNT_MAX = 5;
export const COLLOCATION_COUNT_DEFAULT = 4;

/** Deterministic 3–5 slot count per headword. */
export function collocationTargetCount(term: string): number {
  let hash = 0;
  for (let i = 0; i < term.length; i++) {
    hash = (hash * 37 + term.charCodeAt(i)) >>> 0;
  }
  const span = COLLOCATION_COUNT_MAX - COLLOCATION_COUNT_MIN + 1;
  return COLLOCATION_COUNT_MIN + (hash % span);
}

/** Seed empty shared-base collocation slots for agent fill. */
export function seedCollocationSlots(term: string): Collocation[] {
  const count = collocationTargetCount(term);
  return Array.from({ length: count }, () => ({
    phrase: "",
    translation: "",
    shared: true,
    source: "generated" as const,
  }));
}

export function isFilledCollocation(c: Collocation): boolean {
  return c.phrase.trim() !== "" && c.translation.trim() !== "";
}

export function isSharedCollocation(c: Collocation): boolean {
  return c.shared !== false;
}