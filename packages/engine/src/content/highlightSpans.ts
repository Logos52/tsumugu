/**
 * Headword highlight spans for example sentences (Dictionary PRD §5.4).
 * DOM-free — used by verify tooling and the encoding-page renderer.
 */

export interface TextSpan {
  start: number;
  end: number;
}

/** Find every non-overlapping occurrence of `headword` in `text`. */
export function computeHighlightSpans(text: string, headword: string): TextSpan[] {
  if (!text || !headword) return [];
  const spans: TextSpan[] = [];
  let idx = 0;
  while (idx <= text.length - headword.length) {
    const pos = text.indexOf(headword, idx);
    if (pos === -1) break;
    spans.push({ start: pos, end: pos + headword.length });
    idx = pos + headword.length;
  }
  return spans;
}

export interface HighlightSpanValidation {
  ok: boolean;
  errors: string[];
  expected: TextSpan[];
}

function spanCoversExpected(span: TextSpan, expected: TextSpan): boolean {
  return span.start <= expected.start && span.end >= expected.end;
}

/** Validate that `highlightSpans` mark every headword occurrence in `text`. */
export function validateHighlightSpans(
  text: string,
  headword: string,
  spans?: TextSpan[],
): HighlightSpanValidation {
  const expected = computeHighlightSpans(text, headword);
  const errors: string[] = [];

  if (expected.length === 0) {
    errors.push("headword not found in sentence text");
    return { ok: false, errors, expected };
  }
  if (!spans?.length) {
    errors.push("highlightSpans missing");
    return { ok: false, errors, expected };
  }

  for (const span of spans) {
    if (span.start < 0 || span.end > text.length || span.start >= span.end) {
      errors.push(`invalid span bounds ${span.start}..${span.end}`);
      continue;
    }
    const slice = text.slice(span.start, span.end);
    if (slice !== headword) {
      errors.push(`span ${span.start}..${span.end} is "${slice}", expected "${headword}"`);
    }
  }

  for (const exp of expected) {
    const covered = spans.some((s) => spanCoversExpected(s, exp));
    if (!covered) {
      errors.push(`headword occurrence at ${exp.start}..${exp.end} not marked`);
    }
  }

  return { ok: errors.length === 0, errors, expected };
}

/** Wrap highlighted regions with `open`/`close` markers (default: `<em>`). */
export function renderHighlightSpans(
  text: string,
  spans: TextSpan[],
  open = "<em>",
  close = "</em>",
): string {
  if (!text || !spans.length) return text;
  const sorted = [...spans].sort((a, b) => b.start - a.start);
  let out = text;
  for (const span of sorted) {
    if (span.start < 0 || span.end > out.length || span.start >= span.end) continue;
    out =
      out.slice(0, span.start) + open + out.slice(span.start, span.end) + close + out.slice(span.end);
  }
  return out;
}