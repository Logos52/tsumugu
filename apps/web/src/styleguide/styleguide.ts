/**
 * Styleguide / testing page (#/styleguide). A non-functional gallery of the
 * reader's design system — word statuses (both visuals), the grade-button
 * gradient, tone colors, the wnac palette, and a popup preview — so the
 * look can be eyeballed in either theme without loading real content.
 */
import type { AppState, ViewController } from "../state.js";
import { el, clear } from "../ui/dom.js";
import { CLS, toneClass } from "../ui/classes.js";

const STATUSES = ["new", "l1", "l2", "l3", "l4", "known", "ignored"] as const;
const GRADES: { label: string; meaning: string }[] = [
  { label: "1", meaning: "just started" },
  { label: "2", meaning: "recognized" },
  { label: "3", meaning: "familiar" },
  { label: "4", meaning: "learned" },
  { label: "K", meaning: "known" },
  { label: "X", meaning: "ignore (proper noun / already known)" },
];
const PALETTE = [
  "base", "surface", "text", "subtext", "faint", "border",
  "blue", "red", "peach", "yellow", "green", "teal", "mauve", "overlay",
];

function section(title: string, ...nodes: (Node | string)[]): HTMLElement {
  const s = el("section", { style: { margin: "1.5rem 0" } });
  s.append(el("h3", { text: title, style: { margin: "0 0 0.6rem" } }));
  s.append(el("div", { style: { display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" } }, ...nodes));
  return s;
}

/** A reader word span with a given status, for the gallery. */
function statusWord(text: string, status: string): HTMLElement {
  return el("span", {
    class: `${CLS.token} ${CLS.word} tsg-status-${status}`,
    text,
    title: status,
  });
}

/** A zhuyin ruby word (tone-colored) for the phonetics demo. */
function rubyWord(chars: [string, string][], status: string): HTMLElement {
  const span = el("span", { class: `${CLS.token} ${CLS.word} tsg-status-${status}` });
  const ruby = el("ruby", { class: CLS.ruby });
  for (const [c, r] of chars) {
    const t = toneClass(3);
    ruby.append(el("span", { class: t, text: c }));
    ruby.append(el("rt", { class: t, text: r }));
  }
  span.append(ruby);
  return span;
}

export function mountStyleguide(root: HTMLElement, _app: AppState): ViewController {
  const container = el("div", { class: CLS.reader, style: { maxWidth: "52rem", margin: "0 auto" } });

  container.append(
    el("button", {
      class: CLS.btn,
      text: "← back",
      type: "button",
      on: { click: () => { location.hash = ""; } },
    }),
    el("h2", { text: "Tsumugu styleguide" }),
    el("p", {
      class: CLS.popupReading,
      text: "Toggle dark in the toolbar to compare the light / dark theme. Toggle zhuyin to see the phonetic visual.",
    }),
  );

  // ── word statuses, default fill model ──
  container.append(
    section(
      "Word status — default (fill)",
      ...STATUSES.map((s) => statusWord(`字 ${s}`, s)),
    ),
  );

  // ── word statuses, phonetic visual (underline ramp, no fill) ──
  const phonetic = el("div", {
    class: CLS.readerText,
    attrs: { "data-visual": "phonetic" },
    style: { margin: "0", maxWidth: "none", fontSize: "1.3rem", lineHeight: "2.4" },
  });
  phonetic.append(
    ...STATUSES.map((s) => statusWord(`字`, s)),
    el("span", { class: CLS.punct, text: "   " }),
    rubyWord([["你", "ㄋㄧˇ"], ["好", "ㄏㄠˇ"]], "new"),
    rubyWord([["世", "ㄕˋ"], ["界", "ㄐㄧㄝˋ"]], "l2"),
    rubyWord([["已", "ㄧˇ"], ["知", "ㄓ"]], "known"),
  );
  container.append(section("Word status — phonetic visual (ruby + underline)", phonetic));

  // ── grade buttons ──
  const grades = el("div", { class: CLS.popupGrades, style: { marginTop: "0" } });
  for (const g of GRADES) {
    grades.append(el("button", { class: CLS.btn, type: "button", text: g.label, dataset: { grade: g.label }, title: g.meaning }));
  }
  container.append(
    section("Grade buttons (1 red → 4 green; K green; X = ignore)", grades),
  );

  // ── tone colors ──
  container.append(
    section(
      "Tone colors (1–5)",
      ...[1, 2, 3, 4, 5].map((n) =>
        el("span", { class: toneClass(n), text: `聲調${n}`, style: { fontSize: "1.4rem", fontWeight: "700" } }),
      ),
    ),
  );

  // ── palette swatches ──
  container.append(
    section(
      "wnac palette (current theme)",
      ...PALETTE.map((name) =>
        el(
          "div",
          { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", width: "5rem" } },
          el("div", {
            style: {
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "var(--tsg-radius)",
              background: `var(--wnac-${name})`,
              border: "1px solid var(--tsg-border)",
            },
          }),
          el("small", { text: name, style: { color: "var(--tsg-ink-muted)" } }),
        ),
      ),
    ),
  );

  // ── popup preview (static) ──
  const popup = el("div", { class: CLS.popup, style: { position: "static", width: "20rem" } });
  const head = el("div", { class: CLS.popupTerm });
  head.append(el("span", { text: "夜市" }));
  head.append(el("button", { class: CLS.btn, type: "button", text: "🔊" }));
  head.append(el("button", { class: CLS.btn, type: "button", text: "↗" }));
  popup.append(head);
  popup.append(el("div", { class: CLS.popupReading, text: "ㄧㄝˋ ㄕˋ / yè shì" }));
  popup.append(el("div", { class: CLS.popupGloss, text: "night market" }));
  popup.append(el("div", { class: CLS.popupExplain, text: "晚上才開的市場，可以一邊走一邊吃東西。" }));
  const ex = el("ul", { class: CLS.popupExamples });
  ex.append(el("li", { text: "今晚我們去夜市吃小吃。" }));
  popup.append(ex);
  const pg = el("div", { class: CLS.popupGrades });
  for (const g of GRADES) {
    pg.append(el("button", { class: CLS.btn, type: "button", text: g.label, dataset: { grade: g.label } }));
  }
  popup.append(pg);
  container.append(section("Hover popup", popup));

  clear(root);
  root.append(container);
  return { unmount: () => clear(root) };
}
