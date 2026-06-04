/**
 * Encoding-layer page view (PRD §5.5, criterion 8). Opened when the user clicks
 * a word in SRS review (route #/encoding/<word>). Renders a memory-encoding
 * page from whatever is known offline: the word's custom/pre-baked gloss +
 * explanation, examples, the Hán-Việt bridge, and the user's flag note ("why
 * it's tricky"). Fully offline — no live call, no generated file required.
 */
import { lookupPrebaked, mergeHover } from "@tsumugu/engine";
import type { ResolvedHover } from "@tsumugu/engine";
import type { AppState, ViewController } from "../state.js";
import { el, clear } from "../ui/dom.js";
import { CLS } from "../ui/classes.js";

export function mountEncoding(root: HTMLElement, app: AppState, word: string): ViewController {
  const container = el("div", { class: CLS.review });
  const entry = app.getEntry(word);

  const back = el("button", {
    class: CLS.btn,
    text: "← back",
    type: "button",
    on: { click: () => { location.hash = ""; } },
  });

  const card = el("div", { class: CLS.card });
  card.append(el("div", { class: CLS.cardTerm, text: word }));
  if (entry) {
    card.append(el("div", { class: CLS.popupReading, text: `status: ${entry.status}` }));
  }
  const body = el("div", { class: CLS.cardBack });
  card.append(body);
  container.append(back, card);
  clear(root);
  root.append(container);

  // Resolve the offline hover data, then fill the encoding sections.
  const prebaked = app.content ? lookupPrebaked(app.content, word) : undefined;
  const custom = entry?.custom;
  void Promise.resolve(app.pack.dictionaryProvider(word)).then((dict) => {
    const hover: ResolvedHover = mergeHover({
      word,
      ...(prebaked ? { prebaked } : {}),
      ...(custom ? { custom } : {}),
      ...(dict ? { dict } : {}),
    });
    if (hover.reading) body.append(el("p", { class: CLS.popupReading, text: hover.reading }));
    if (hover.gloss) body.append(el("p", { class: CLS.popupGloss, text: hover.gloss }));

    body.append(el("h3", { text: "Etymology / why it sticks" }));
    body.append(el("p", { class: CLS.popupExplain, text: hover.explanation ?? "—" }));

    if (entry?.flagNote) {
      body.append(el("h3", { text: "Why it's tricky (your flag)" }));
      body.append(el("p", { text: entry.flagNote }));
    }

    if (hover.examples?.length) {
      body.append(el("h3", { text: "Examples" }));
      const ul = el("ul", { class: CLS.popupExamples });
      for (const ex of hover.examples) ul.append(el("li", { text: ex }));
      body.append(ul);
    }

    if (hover.bridge) {
      const b = hover.bridge;
      const box = el("div", { class: CLS.popupBridge });
      box.append(el("strong", { text: `Hán-Việt bridge: ${b.etymon ?? "?"}` }));
      if (b.bridgeReading) box.append(el("span", { text: ` (${b.bridgeReading})` }));
      for (const m of b.morphemes ?? []) {
        box.append(el("div", { text: `${m.surface} ← ${m.etymon}${m.gloss ? ` — ${m.gloss}` : ""}` }));
      }
      body.append(box);
    }

    if (entry?.related?.length) {
      body.append(el("h3", { text: "Related" }));
      for (const r of entry.related) {
        body.append(el("a", { class: CLS.btn, text: r.word, attrs: { href: `#/encoding/${encodeURIComponent(r.word)}` } }));
      }
    }
  });

  return { unmount: () => clear(root) };
}
