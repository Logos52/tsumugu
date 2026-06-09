/**
 * Emit the agent-facing prompt for a run: the shipped prompt template plus a
 * context block (the deterministic facts the agent needs to fill the skeleton).
 * The model does the language work; this just briefs it.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readText } from "./io.js";

const PROMPT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "prompts");

export async function loadPrompt(name: string): Promise<string> {
  return readText(resolve(PROMPT_DIR, name));
}

export interface PromptContext {
  lang: string;
  mode: "directed" | "autonomous";
  ciTarget: number;
  skeletonPath: string;
  unknownWords: string[];
  targetWords?: string[];
  agent?: string;
}

export function contextBlock(c: PromptContext): string {
  const lines = [
    "",
    "---",
    "## Run context (filled by `pnpm gen`)",
    `- agent: ${c.agent ?? "(unspecified)"}`,
    `- lang: ${c.lang}`,
    `- mode: ${c.mode}`,
    `- ciTarget: ${c.ciTarget}`,
    `- skeleton file (edit in place; fill empty \`gloss\`/\`explanation\`): \`${c.skeletonPath}\``,
  ];
  if (c.targetWords?.length) {
    lines.push(`- target words (recycle each ≥3×): ${c.targetWords.join("、")}`);
  }
  lines.push(
    `- words needing resolution (${c.unknownWords.length}): ${c.unknownWords.join("、") || "(none)"}`,
    "",
    "After filling the skeleton, run `pnpm gen verify --in " + c.skeletonPath + "` (OpenCC + CI re-score).",
    "",
  );
  return lines.join("\n");
}
