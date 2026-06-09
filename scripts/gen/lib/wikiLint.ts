/**
 * Wiki encoding-twin linter (ARCHITECTURE.md §4 invariants #4 / #5).
 * CI-gate checks for encoding/{term}.md twins before Quartz promotion.
 */
import { nfcTerm } from "./io.js";

export interface LintEncodingTwinOpts {
  /** Basename without `.md` — checked against the `word:` audit field (NFC). */
  filename?: string;
}

export interface LintEncodingTwinResult {
  ok: boolean;
  errors: string[];
}

/** Split frontmatter YAML from the Markdown body. */
function splitFrontmatter(md: string): { fm: string; body: string } | null {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { fm: match[1]!, body: match[2]! };
}

/** Minimal frontmatter parser for the scalar fields the linter needs. */
function parseFrontmatterScalars(fm: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.+)$/);
    if (!m) continue;
    let value = m[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]!] = value;
  }
  return out;
}

/** Extract the headword from the H1 (`# 熱鬧 — encoding-layer page` → `熱鬧`). */
function h1Term(body: string): string | undefined {
  const m = body.match(/^#\s+(.+)$/m);
  if (!m) return undefined;
  return m[1]!.split(/\s+—/)[0]!.trim();
}

function hasSection(body: string, pattern: RegExp): boolean {
  return pattern.test(body);
}

/**
 * Lint an encoding twin Markdown page.
 *
 * Invariant #4: `type: encoding`, `word:` present and == `term` == H1 headword.
 * Invariant #5 (D2): etymology section present; no dictionary `## Meaning` section.
 * NFC: optional `filename` must match the `word:` audit field.
 */
export function lintEncodingTwin(md: string, opts?: LintEncodingTwinOpts): LintEncodingTwinResult {
  const errors: string[] = [];

  const split = splitFrontmatter(md);
  if (!split) {
    return { ok: false, errors: ["missing YAML frontmatter (expected --- … ---)"] };
  }

  const fields = parseFrontmatterScalars(split.fm);
  const body = split.body;

  if (fields.type !== "encoding") {
    errors.push(`invariant #4: frontmatter must have type: encoding (got ${fields.type ?? "(missing)"})`);
  }

  const word = fields.word ? nfcTerm(fields.word) : undefined;
  if (!word) {
    errors.push("invariant #4: frontmatter must include word: <term> audit field");
  }

  const term = fields.term ? nfcTerm(fields.term) : undefined;
  if (!term) {
    errors.push("invariant #4: frontmatter must include term: <term>");
  }

  if (word && term && word !== term) {
    errors.push(`invariant #4: word (${word}) must equal term (${term})`);
  }

  const headword = h1Term(body);
  if (!headword) {
    errors.push("invariant #4: missing H1 heading (# <term> …)");
  } else if (word && nfcTerm(headword) !== word) {
    errors.push(`invariant #4: H1 headword (${headword}) must match word: (${word})`);
  }

  if (!hasSection(body, /^##\s+Etymology\b/m)) {
    errors.push("invariant #5: encoding twin must include an etymology section (## Etymology …)");
  }

  if (hasSection(body, /^##\s+Meaning\b/m)) {
    errors.push(
      "invariant #5 (D2): encoding pages must not duplicate dictionary meaning (remove ## Meaning; use etymology instead)",
    );
  }

  if (opts?.filename !== undefined) {
    const fileNfc = nfcTerm(opts.filename);
    if (word && fileNfc !== word) {
      errors.push(`NFC filename (${fileNfc}) must match word: field (${word})`);
    }
  }

  return { ok: errors.length === 0, errors };
}