/**
 * Example-sentence helpers for the Dictionary PRD §5.4 generation pipeline.
 */
import type { ExampleSentence } from "@tsumugu/engine";

export const EXAMPLE_COUNT_MIN = 3;
export const EXAMPLE_COUNT_MAX = 6;
export const EXAMPLE_COUNT_DEFAULT = 4;

/** Deterministic 3–6 slot count per headword (mockup uses 4 as the prove-out). */
export function exampleTargetCount(term: string): number {
  let hash = 0;
  for (let i = 0; i < term.length; i++) {
    hash = (hash * 31 + term.charCodeAt(i)) >>> 0;
  }
  const span = EXAMPLE_COUNT_MAX - EXAMPLE_COUNT_MIN + 1;
  return EXAMPLE_COUNT_MIN + (hash % span);
}

/** Seed empty shared-base example slots for agent fill. */
export function seedSharedExampleSlots(term: string): ExampleSentence[] {
  const count = exampleTargetCount(term);
  return Array.from({ length: count }, () => ({
    text: "",
    translation: "",
    shared: true,
    source: "generated" as const,
  }));
}

/** True when the example row has agent-filled content. */
export function isFilledExample(ex: ExampleSentence): boolean {
  return ex.text.trim() !== "" || ex.translation.trim() !== "";
}

/** Shared-base rows: `shared` is true or absent on legacy rows; overlay is `shared:false`. */
export function isSharedExample(ex: ExampleSentence): boolean {
  return ex.shared !== false;
}

export function isOverlayExample(ex: ExampleSentence): boolean {
  return ex.shared === false;
}