/**
 * Wiki + encoding-layer page builders (PRD §5.5). The CLI fills the
 * deterministic parts (frontmatter, section scaffold, examples from the user's
 * reading, related wikilinks); the agent fills the prose (meaning, etymology,
 * mnemonics) via prompts/{wiki-page,encoding-page}.md. One canonical page per
 * item — links, not copies.
 */
import type { DictEntry, WordEntry, BridgeInfo } from "@tsumugu/engine";

export interface WikiInput {
  term: string;
  lang: string;
  status?: string;
  reading?: string;
  pos?: string;
  level?: string;
  tags?: string[];
  firstSeen?: string;
  source?: string;
  related?: string[];
  meaning?: string;
  examples?: string[];
  bridge?: BridgeInfo;
}

const TODO = "<!-- TODO (agent): fill via prompts/{wiki-page,encoding-page}.md -->";

function yamlValue(v: string): string {
  return /[:#\[\]{}&*!|>'"%@`,]/.test(v) || v.trim() !== v ? JSON.stringify(v) : v;
}

function frontmatter(fields: Record<string, string | string[] | undefined>): string {
  const lines: string[] = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      lines.push(`${k}: [${v.map(yamlValue).join(", ")}]`);
    } else {
      lines.push(`${k}: ${yamlValue(v)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

function bridgeBox(b: BridgeInfo): string {
  const morphemes = (b.morphemes ?? [])
    .map((m) => `- **${m.surface}** ← ${m.etymon}${m.reading ? ` (${m.reading})` : ""}${m.gloss ? ` — ${m.gloss}` : ""}`)
    .join("\n");
  return [
    "## Hán-Việt bridge",
    `- etymon: **${b.etymon ?? "?"}**${b.bridgeReading ? ` (${b.bridgeReading})` : ""}`,
    b.meaning ? `- meaning: ${b.meaning}` : "",
    morphemes,
    typeof b.confidence === "number" ? `- confidence: ${b.confidence}${b.corrected ? " (corrected)" : ""}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function examplesBlock(examples?: string[]): string {
  if (!examples?.length) return `## Examples (from your reading)\n${TODO}`;
  return "## Examples (from your reading)\n" + examples.map((e) => `- ${e}`).join("\n");
}

export function buildWikiPage(input: WikiInput): string {
  const fm = frontmatter({
    term: input.term,
    reading: input.reading,
    pos: input.pos,
    status: input.status,
    tocfl: input.level,
    tags: input.tags,
    first_seen: input.firstSeen,
    source: input.source,
    related: input.related,
    lang: input.lang,
  });
  const body = [
    `# ${input.term}`,
    "",
    "## Meaning",
    input.meaning ?? TODO,
    "",
    "## Character / etymology breakdown",
    TODO,
    "",
    "## Similar / related",
    (input.related ?? []).length
      ? (input.related ?? []).map((r) => `- [[${r}]]`).join("\n")
      : TODO,
    "",
    examplesBlock(input.examples),
    "",
    "## Usage / register",
    TODO,
    input.bridge ? "\n" + bridgeBox(input.bridge) : "",
    "",
  ].join("\n");
  return fm + body;
}

export function buildEncodingPage(input: WikiInput & { flagNote?: string }): string {
  const fm = frontmatter({
    term: input.term,
    reading: input.reading,
    pos: input.pos,
    status: input.status,
    tocfl: input.level,
    tags: [...(input.tags ?? []), "encoding"],
    first_seen: input.firstSeen,
    source: input.source,
    related: input.related,
    type: "encoding",
    lang: input.lang,
  });
  const body = [
    `# ${input.term} — encoding-layer page`,
    "",
    "> Memory-encoding page (PRD §5.5): etymology, mnemonics, associations, *why it's tricky*.",
    "",
    "## Etymology / character story",
    TODO,
    "",
    "## Mnemonic",
    TODO,
    "",
    "## Semantic associations",
    (input.related ?? []).length
      ? (input.related ?? []).map((r) => `- [[${r}]]`).join("\n")
      : TODO,
    "",
    "## Why it's tricky",
    input.flagNote ? `Your flag: *${input.flagNote}*\n\n${TODO}` : TODO,
    "",
    examplesBlock(input.examples),
    input.bridge ? "\n" + bridgeBox(input.bridge) : "",
    "",
  ].join("\n");
  return fm + body;
}

/** Derive a WikiInput from a store entry + optional dictionary entry. */
export function wikiInputFromStore(
  entry: WordEntry,
  dict?: DictEntry,
  examples?: string[],
): WikiInput {
  const input: WikiInput = { term: entry.word, lang: entry.lang, status: entry.status };
  const reading = entry.custom?.reading ?? dict?.reading;
  const pos = entry.custom?.pos ?? dict?.pos;
  const level = entry.custom?.level ?? dict?.level;
  const meaning = entry.custom?.gloss ?? dict?.gloss;
  if (reading !== undefined) input.reading = reading;
  if (pos !== undefined) input.pos = pos;
  if (level !== undefined) input.level = level;
  if (meaning !== undefined) input.meaning = meaning;
  if (entry.firstSeen !== undefined) input.firstSeen = entry.firstSeen.slice(0, 10);
  if (entry.tags !== undefined) input.tags = entry.tags;
  if (entry.related?.length) input.related = entry.related.map((r) => r.word);
  if (examples?.length) input.examples = examples;
  return input;
}
