/**
 * Wiki + encoding-layer page builders (PRD §5.5). The CLI fills the
 * deterministic parts (frontmatter, section scaffold, examples from the user's
 * reading, related wikilinks); the agent fills the prose (meaning, etymology,
 * mnemonics) via prompts/{wiki-page,encoding-page}.md. One canonical page per
 * item — links, not copies.
 */
import {
  ENCODING_PAGE_SCHEMA,
  type DictEntry,
  type WordEntry,
  type BridgeInfo,
  type ExampleSentence,
  type EncodingPageDoc,
  type RelatedLink,
} from "@tsumugu/engine";
import { nfcTerm, encodingFilename } from "./io.js";

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
  examples?: string[] | ExampleSentence[];
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

function formatExampleLine(ex: string | ExampleSentence): string {
  if (typeof ex === "string") return `- ${ex}`;
  const tr = ex.translation?.trim();
  return tr ? `- ${ex.text} — ${tr}` : `- ${ex.text}`;
}

function examplesBlock(examples?: string[] | ExampleSentence[], encoding = false): string {
  const heading = encoding
    ? "## 例句 · Example sentences"
    : "## Examples (from your reading)";
  if (!examples?.length) return `${heading}\n${TODO}`;
  return heading + "\n" + examples.map(formatExampleLine).join("\n");
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
  // ARCHITECTURE.md §4 invariant #4: encoding twin carries `word:` audit key (word == term, NFC).
  const term = nfcTerm(input.term);
  const fm = frontmatter({
    term,
    word: term,
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
    `# ${term} — encoding-layer page`,
    "",
    "> Memory-encoding page (PRD §5.5): etymology, mnemonics, associations, *why it's tricky*.",
    "",
    "## Definitions",
    "### English",
    TODO,
    "",
    "### 簡明中文",
    TODO,
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
    examplesBlock(input.examples, true),
    input.bridge ? "\n" + bridgeBox(input.bridge) : "",
    "",
  ].join("\n");
  return fm + body;
}

function readingFromString(reading?: string): EncodingPageDoc["reading"] {
  if (!reading?.trim()) return undefined;
  return { pinyin: reading.trim() };
}

function relatedFromStrings(related?: string[]): RelatedLink[] | undefined {
  if (!related?.length) return undefined;
  return related.map((word) => ({ word }));
}

/** Skeleton `encoding-page@1` JSON for agent fill (Encoding PRD §6.2). */
export function buildEncodingPageJson(input: WikiInput & { flagNote?: string }): EncodingPageDoc {
  const term = nfcTerm(input.term);
  const doc: EncodingPageDoc = {
    schema: ENCODING_PAGE_SCHEMA,
    lang: input.lang,
    term,
    generatedAt: new Date().toISOString(),
  };
  const reading = readingFromString(input.reading);
  if (reading) doc.reading = reading;
  if (input.pos !== undefined) doc.pos = input.pos;
  if (input.level !== undefined) doc.level = input.level;
  if (input.flagNote !== undefined) doc.flagNote = input.flagNote;
  const related = relatedFromStrings(input.related);
  if (related) doc.related = related;
  if (input.bridge !== undefined) doc.bridge = input.bridge;
  return doc;
}

export interface EncodingArtifactPaths {
  mdPath: string;
  jsonPath: string;
  basename: string;
}

/** Resolve co-located Markdown twin + encoding-page@1 JSON paths. */
export function encodingArtifactPaths(
  outDir: string,
  lang: string,
  term: string,
  slug?: string,
): EncodingArtifactPaths {
  const basename = encodingFilename(term, slug);
  const dir = `${outDir}/${lang}/encoding`;
  return {
    basename,
    mdPath: `${dir}/${basename}.md`,
    jsonPath: `${dir}/${basename}.encoding.json`,
  };
}

/** Derive a WikiInput from a store entry + optional dictionary entry. */
export function wikiInputFromStore(
  entry: WordEntry,
  dict?: DictEntry,
  examples?: string[] | ExampleSentence[],
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