/**
 * Encoding-layer page view (PRD §5.5). Opened when the user clicks a word in SRS
 * review (route #/encoding/<word>). Two-column layout: 300px pull-SRS rail left,
 * encoding page right. Reads `encoding-page@1` from the vault when present;
 * falls back to mergeHover for un-generated words. Fully offline.
 */

import {
  getDue,
  lookupPrebaked,
  mergeHover,
  parseEncodingPage,
  reviewSrs,
  STATUS_LABELS,
  STATUS_LEVEL,
  type EncodingPageDoc,
  type Etymology,
  type RelatedLink,
  type SrsRating,
  type SrsState,
  type WordEntry,
  type WordStatus,
} from "@tsumugu/engine";
import type { AppState, ViewController } from "../state.js";
import { resolveDictDefault } from "../state.js";
import { el, clear } from "../ui/dom.js";
import { CLS } from "../ui/classes.js";
import {
  computeEncodingCoverageStats,
  formatEncodingCoverageLine,
} from "./coverage.js";
import { mountSentenceWaveforms, type SentenceWaveforms } from "../voice/sentenceWaveform.js";
import {
  discoverEncodingAudio,
  resolveSentenceAudioPath,
  resolveTermAudioPath,
  type EncodingAudioBinding,
} from "../voice/encodingAudio.js";
import { exportEncodingAnki } from "./ankiExport.js";
import { acceptEncodingContent } from "./accept.js";

const CIRCLED = ["⓪", "①", "②", "③", "④"] as const;

/** Vault-relative path for a per-word encoding artifact. */
export function encodingArtifactPath(lang: string, term: string): string {
  return `${lang}/encoding/${term}.encoding.json`;
}

async function loadEncodingPage(
  app: AppState,
  term: string,
): Promise<EncodingPageDoc | null> {
  const path = encodingArtifactPath(app.lang, term);
  const raw = await app.vault?.readText(path);
  if (!raw) return null;
  return parseEncodingPage(raw);
}

function formatInterval(ms: number, rating: SrsRating): string {
  if (ms <= 0) return "now";
  if (rating === "again" && ms < 600_000) return "<10m";
  const days = ms / 86_400_000;
  if (days < 1) {
    const hours = Math.max(1, Math.round(ms / 3_600_000));
    return `${hours}h`;
  }
  return `${Math.round(days)}d`;
}

function previewInterval(state: SrsState, rating: SrsRating, clock: AppState["clock"]): string {
  const next = reviewSrs(state, rating, clock);
  return formatInterval(Date.parse(next.due) - clock.now().getTime(), rating);
}

function statusPillLabel(status: WordStatus, reps?: number): string {
  const level = STATUS_LEVEL[status];
  if (level != null) {
    const n = CIRCLED[level] ?? String(level);
    return `Learning ${n}`;
  }
  if (reps != null && reps > 0) return `${STATUS_LABELS[status]} · ${reps}×`;
  return STATUS_LABELS[status];
}

function formatReading(doc: EncodingPageDoc | null, hoverReading?: string): string {
  if (doc?.reading) {
    const parts: string[] = [];
    if (doc.reading.zhuyin) parts.push(doc.reading.zhuyin);
    if (doc.reading.pinyin) parts.push(doc.reading.pinyin);
    if (parts.length) return parts.join(" · ");
  }
  return hoverReading ?? "";
}

function formatPosLevel(pos?: string, level?: string): string {
  const bits = [pos, level].filter(Boolean);
  return bits.join(" · ");
}

function highlightTerm(text: string, term: string, extra?: string[]): string {
  const targets = new Set([term, ...(extra ?? [])]);
  let out = text;
  for (const t of [...targets].sort((a, b) => b.length - a.length)) {
    out = out.split(t).join(`<em>${t}</em>`);
  }
  return out;
}

function groundingLabel(grounding: Etymology["grounding"]): string {
  switch (grounding) {
    case "sourced":
      return "sourced";
    case "mnemonic-device":
      return "memory device";
    case "speculative":
      return "speculative";
  }
}

function renderEtymologyBody(etymology: Etymology): HTMLElement {
  const body = el("div", { class: "tsg-encoding-body" });
  const parts: ChildPart[] = [];
  for (let i = 0; i < etymology.parts.length; i++) {
    const p = etymology.parts[i]!;
    if (i > 0) parts.push(" + ");
    const bit = el("span");
    bit.append(el("b", { class: "tsg-encoding-han", text: p.char }));
    const tail: string[] = [];
    if (p.reading) tail.push(p.reading);
    if (p.gloss) tail.push(`"${p.gloss}"`);
    if (p.note) tail.push(`(${p.note})`);
    if (tail.length) bit.append(document.createTextNode(` ${tail.join(" ")}`));
    parts.push(bit);
  }
  parts.push(" → ");
  parts.push(el("b", { text: etymology.payoff }));
  for (const p of parts) {
    if (typeof p === "string") body.append(document.createTextNode(p));
    else body.append(p);
  }
  return body;
}

type ChildPart = string | HTMLElement;

function relatedSuffix(link: RelatedLink): string {
  if (link.relation === "antonym") return " ↔";
  if (link.relation === "confusable") return " ⚠";
  return "";
}

export function mountEncoding(root: HTMLElement, app: AppState, word: string): ViewController {
  const work = el("div", { class: CLS.encodingWork });
  const railHost = el("div", { class: CLS.encodingRail });
  const pageHost = el("div", { class: CLS.encodingPage });
  work.append(railHost, pageHost);
  clear(root);
  root.append(work);

  let waveforms: SentenceWaveforms | null = null;
  let keyHandler: ((ev: KeyboardEvent) => void) | null = null;
  let disposed = false;
  let termAudioEl: HTMLAudioElement | null = null;
  let termAudioUrl: string | null = null;

  const onKey = (ev: KeyboardEvent): void => {
    if (disposed) return;
    waveforms?.key(ev);
  };
  keyHandler = onKey;
  document.addEventListener("keydown", onKey);

  function navigateTo(word: string): void {
    location.hash = `#/encoding/${encodeURIComponent(word)}`;
  }

  async function gradeActive(rating: SrsRating): Promise<void> {
    const entry = app.getEntry(word);
    if (!entry?.srs) return;
    app.store.setSrs(app.lang, word, reviewSrs(entry.srs, rating, app.clock));
    await app.saveStore();
    app.emit("change");
    void renderRail();
  }

  async function renderRail(): Promise<void> {
    clear(railHost);
    const due = getDue(app.store.all(app.lang), app.clock);
    const entry = app.getEntry(word);
    const srs = entry?.srs;

    railHost.append(
      el("div", { class: CLS.encodingRailHead },
        el("span", { class: "tsg-encoding-rail-title", text: "Review" }),
        el("span", { class: "tsg-encoding-rail-count", text: `${due.length} due` }),
      ),
      el("p", { class: "tsg-encoding-rail-sub", text: "pull-based · no schedule, no nags" }),
    );

    const queue = el("div", { class: CLS.encodingRailQueue });
    const show = due.slice(0, 8);
    if (show.length === 0) {
      queue.append(el("p", { class: "tsg-encoding-rail-empty", text: "Nothing due right now." }));
    }
    for (const item of show) {
      const isActive = item.word === word;
      const qi = el("div", {
        class: `${CLS.encodingRailItem}${isActive ? ` ${CLS.encodingRailItemActive}` : ""}`,
        on: { click: () => navigateTo(item.word) },
      });
      qi.append(el("span", { class: "tsg-encoding-rail-word", text: item.word }));
      qi.append(el("span", { class: "tsg-encoding-rail-due", text: isActive ? "now" : "·" }));
      queue.append(qi);
    }
    railHost.append(queue);

    if (srs) {
      const grades = el("div", { class: CLS.encodingRailGrades });
      const ratings: { label: string; rating: SrsRating; cls?: string }[] = [
        { label: "Again", rating: "again", cls: CLS.encodingGradeAgain },
        { label: "Hard", rating: "hard" },
        { label: "Good", rating: "good", cls: CLS.encodingGradeGood },
        { label: "Easy", rating: "easy" },
      ];
      for (const g of ratings) {
        const btn = el("button", {
          class: ["tsg-encoding-grade", g.cls].filter(Boolean).join(" "),
          type: "button",
          on: { click: () => void gradeActive(g.rating) },
        });
        btn.append(el("span", { text: g.label }));
        btn.append(el("small", { text: previewInterval(srs, g.rating, app.clock) }));
        grades.append(btn);
      }
      railHost.append(grades);

      const stab =
        srs.stability >= 1 ? `${srs.stability.toFixed(1)}d` : `${Math.round(srs.stability * 24)}h`;
      railHost.append(
        el("p", {
          class: "tsg-encoding-rail-fsrs",
          html: `<b>FSRS</b> · ts-fsrs · client-side<br>stability ${stab} · clicking a due word opens <b>this</b> encoding page`,
        }),
      );
    }

    const coverage = formatEncodingCoverageLine(await computeEncodingCoverageStats(app));
    railHost.append(
      el("p", { class: CLS.encodingCoverage, text: coverage }),
    );

    railHost.append(
      el("button", {
        class: "tsg-btn tsg-encoding-rail-export",
        text: "Export encoding Anki",
        type: "button",
        title: "Export learning words as sentence-mining cards (term-keyed guids)",
        on: {
          click: () => {
            void exportEncodingAnki(app)
              .then((msg) => {
                if (msg) app.setStatusMessage(msg);
                else {
                  app.setStatusMessage(
                    "No encoding cards to export — generate encoding artifacts first.",
                  );
                }
              })
              .catch((err) => {
                app.setStatusMessage(`Encoding Anki export failed: ${String(err)}`);
              });
          },
        },
      }),
    );
  }

  async function renderPage(): Promise<void> {
    waveforms?.destroy();
    waveforms = null;
    clear(pageHost);

    const entry = app.getEntry(word);
    const doc = await loadEncodingPage(app, word);
    const audioBinding: EncodingAudioBinding | null = await discoverEncodingAudio(
      app.vault,
      app.lang,
      word,
    );
    const prebaked = app.content ? lookupPrebaked(app.content, word) : undefined;
    const custom = entry?.custom;
    const dict = await app.pack.dictionaryProvider(word);
    const hover = mergeHover({
      word,
      ...(prebaked ? { prebaked } : {}),
      ...(custom ? { custom } : {}),
      ...(dict ? { dict } : {}),
    });

    const { definitions, examples, etymology } = acceptEncodingContent(doc, hover);
    const dictDefault = resolveDictDefault(app.settings);
    const guessFirst = app.settings.guessFirst;
    let defsRevealed = !guessFirst;

    const pos = doc?.pos ?? hover.pos;
    const level = doc?.level ?? hover.level;
    const flagNote = entry?.flagNote ?? doc?.flagNote;
    const related = doc?.related ?? entry?.related?.map((r) => ({ word: r.word }));

    pageHost.append(
      el("div", {
        class: CLS.encodingBrow,
        html: `Review → <b>${word}</b> · encoding-layer page <span class="tsg-encoding-brow-note">— definitions · example sentences · etymology · memory</span>`,
      }),
    );

    const header = el("div", { class: "tsg-encoding-hdr" });
    header.append(el("div", { class: CLS.encodingTerm, text: word }));

    const meta = el("div");
    const reading = formatReading(doc, hover.reading);
    if (reading) meta.append(el("div", { class: CLS.encodingReading, text: reading }));
    const posLevel = formatPosLevel(pos, level);
    if (posLevel) meta.append(el("div", { class: CLS.encodingPosLevel, text: posLevel }));
    header.append(meta);

    const termAudioPath = resolveTermAudioPath(audioBinding, doc);
    const termAudio = el("button", {
      class: "tsg-encoding-audio",
      text: "🔊",
      type: "button",
      title: "Play term audio",
      on: {
        click: () => {
          void playTermAudio(termAudioPath, word);
        },
      },
    });
    header.append(termAudio);

    const tags = el("div", { class: "tsg-encoding-tags" });
    if (entry) {
      tags.append(
        el("span", {
          class: `${CLS.encodingTag} ${CLS.encodingTagLearn}`,
          text: statusPillLabel(entry.status, entry.srs?.reps),
        }),
      );
    }
    if (flagNote) {
      tags.append(el("span", { class: CLS.encodingFlag, text: `⚑ ${flagNote}` }));
    }
    header.append(tags);
    pageHost.append(header);

    const defSection = el("div", { class: "tsg-encoding-sec" });
    const defHead = el("div", { class: "tsg-encoding-sec-head" });
    defHead.append(el("span", { class: "tsg-encoding-sec-label", text: "Definition" }));
    defHead.append(
      el("span", {
        class: "tsg-encoding-sec-cap",
        text: "two dictionaries — switch your default anytime",
      }),
    );

    const toggle = el("div", { class: CLS.defToggle });
    const segEn = el("button", {
      class: `${CLS.defSeg}${dictDefault === "en" ? ` ${CLS.defSegOn}` : ""}`,
      text: "English",
      type: "button",
      on: {
        click: () => {
          app.updateSettings({ dictDefault: "en" });
          renderDefPins();
          updateToggle();
        },
      },
    });
    const segZh = el("button", {
      class: `${CLS.defSeg}${dictDefault === "zh" ? ` ${CLS.defSegOn}` : ""}`,
      text: "簡明中文",
      type: "button",
      on: {
        click: () => {
          app.updateSettings({ dictDefault: "zh" });
          renderDefPins();
          updateToggle();
        },
      },
    });
    toggle.append(segEn, segZh);
    defHead.append(toggle);
    defSection.append(defHead);

    const defGrid = el("div", { class: CLS.defGrid });
    if (guessFirst && !defsRevealed) {
      defGrid.classList.add(CLS.encodingHidden);
    }

    const enCard = el("div", { class: `${CLS.defCard} tsg-defcard-en` });
    const zhCard = el("div", { class: `${CLS.defCard} ${CLS.defCardZh}` });

    function renderDefPins(): void {
      const d = resolveDictDefault(app.settings);
      for (const pin of defGrid.querySelectorAll(".tsg-def-pin")) pin.remove();
      const enLabel = enCard.querySelector(".tsg-def-label");
      const zhLabel = zhCard.querySelector(".tsg-def-label");
      if (d === "en" && enLabel) {
        enLabel.append(el("span", { class: "tsg-def-pin", text: "default" }));
      }
      if (d === "zh" && zhLabel) {
        zhLabel.append(el("span", { class: "tsg-def-pin", text: "default" }));
      }
    }

    function updateToggle(): void {
      const d = resolveDictDefault(app.settings);
      segEn.classList.toggle(CLS.defSegOn, d === "en");
      segZh.classList.toggle(CLS.defSegOn, d === "zh");
    }

    if (definitions.en) {
      enCard.append(
        el("div", { class: "tsg-def-label", text: "English dictionary " }),
        el("div", { class: "tsg-def-gloss", text: definitions.en.gloss }),
      );
      if (definitions.en.explanation) {
        enCard.append(el("div", { class: "tsg-def-explain", text: definitions.en.explanation }));
      }
    }
    if (definitions.zh) {
      const cap =
        ("monolingual" in definitions.zh && definitions.zh.monolingual
          ? definitions.zh.level
          : undefined) ?? level ?? "B1";
      const zhBlurb =
        "monolingual" in definitions.zh && definitions.zh.monolingual
          ? definitions.zh.illustration
          : definitions.zh.explanation;
      zhCard.append(
        el("div", {
          class: "tsg-def-label",
          text: `簡明中文 · leveled, monolingual (uses only ${cap} words) `,
        }),
        el("div", { class: "tsg-def-gloss tsg-def-gloss-zh", text: definitions.zh.gloss }),
      );
      if (zhBlurb) {
        zhCard.append(
          el("div", { class: "tsg-def-explain tsg-def-explain-zh", text: zhBlurb }),
        );
      }
    }
    defGrid.append(enCard, zhCard);
    defSection.append(defGrid);

    if (guessFirst) {
      const revealBtn = el("button", {
        class: CLS.btn,
        text: "Reveal definitions",
        type: "button",
        on: {
          click: () => {
            if (defsRevealed) return;
            defsRevealed = true;
            defGrid.classList.remove(CLS.encodingHidden);
            revealBtn.remove();
          },
        },
      });
      defSection.append(revealBtn);
    }

    renderDefPins();
    pageHost.append(defSection);

    if (examples.length) {
      const sentSection = el("div", { class: `tsg-encoding-sec ${CLS.sents}` });
      sentSection.append(
        el("div", { class: "tsg-encoding-sec-head" },
          el("span", { class: "tsg-encoding-sec-label", text: "例句 · Example sentences" }),
          el("span", {
            class: "tsg-encoding-sec-cap",
            text: "AI-generated · simple, common, usable · 🔊 each · recycles your known words",
          }),
        ),
      );

      const rows: HTMLElement[] = [];
      const waveEls: HTMLElement[] = [];
      const playBtns: HTMLButtonElement[] = [];
      const loopBtns: HTMLButtonElement[] = [];
      const audioPaths: (string | undefined)[] = [];
      const texts: string[] = [];

      examples.forEach((ex, i) => {
        const row = el("div", { class: CLS.sentRow });
        row.append(el("span", { class: CLS.sentNum, text: String(i + 1) }));
        row.append(
          el("span", {
            class: CLS.sentCn,
            html: highlightTerm(ex.text, word, i === 0 ? ["夜市"] : undefined),
          }),
        );
        if (ex.translation) row.append(el("span", { class: CLS.sentEn, text: ex.translation }));

        const wrap = el("div", { class: CLS.sentWavewrap });
        const pp = el("button", {
          class: CLS.sentWaveBtn,
          text: "▶",
          type: "button",
          title: "Play / pause (Space)",
        });
        const waveEl = el("div", { class: CLS.sentWave });
        const lp = el("button", {
          class: CLS.sentWaveBtn,
          text: "🔁",
          type: "button",
          title: "Loop region (L)",
        });
        wrap.append(pp, waveEl, lp);
        row.append(wrap);
        sentSection.append(row);

        rows.push(row);
        waveEls.push(waveEl);
        playBtns.push(pp);
        loopBtns.push(lp);
        audioPaths.push(resolveSentenceAudioPath(audioBinding, doc, i) ?? ex.audio);
        texts.push(ex.text);
      });

      pageHost.append(sentSection);

      void mountSentenceWaveforms({
        rows,
        waveEls,
        playBtns,
        loopBtns,
        audioPaths,
        texts,
        vault: app.vault,
        speak: (t) => app.speak(t),
      })
        .then((w) => {
          if (!disposed) waveforms = w;
        })
        .catch(() => {
          /* wavesurfer unavailable — Web Speech buttons still work */
        });
    }

    const bottom = el("div", { class: CLS.encodingBrow });
    if (etymology) {
      const cell = el("div", { class: CLS.encodingCell });
      const head = el("div", { class: "tsg-encoding-cell-head" });
      head.append(el("span", { text: "Character story" }));
      head.append(
        el("span", {
          class: CLS.groundingMarker,
          text: groundingLabel(etymology.grounding),
        }),
      );
      cell.append(head, renderEtymologyBody(etymology));
      bottom.append(cell);
    } else if (hover.explanation) {
      bottom.append(
        el("div", { class: CLS.encodingCell },
          el("div", { class: "tsg-encoding-cell-head", text: "Character story" }),
          el("p", { class: "tsg-encoding-body", text: hover.explanation }),
        ),
      );
    }

    const trickyCell = el("div", { class: `${CLS.encodingCell} ${CLS.encodingCellTricky}` });
    trickyCell.append(el("div", { class: "tsg-encoding-cell-head", text: "Why it's tricky · related" }));
    const trickyText = doc?.tricky?.text ?? flagNote;
    if (trickyText) trickyCell.append(el("p", { class: "tsg-encoding-body", text: trickyText }));

    if (related?.length) {
      const rel = el("div", { class: "tsg-encoding-related" });
      for (const link of related) {
        rel.append(
          el("a", {
            class: CLS.relatedLink,
            text: link.word + relatedSuffix(link),
            attrs: { href: `#/encoding/${encodeURIComponent(link.word)}` },
          }),
        );
      }
      trickyCell.append(rel);
    }
    if (trickyText || related?.length) bottom.append(trickyCell);

    if (bottom.childElementCount) pageHost.append(bottom);

    pageHost.append(
      el("p", {
        class: "tsg-encoding-foot",
        text: "encoding layer · definitions · example sentences · etymology · memory",
      }),
    );
  }

  async function playTermAudio(path: string | null, fallbackText: string): Promise<void> {
    if (!path || !app.vault?.readBytes) {
      app.speak(fallbackText);
      return;
    }
    let bytes: Uint8Array | null;
    try {
      bytes = await app.vault.readBytes(path);
    } catch {
      bytes = null;
    }
    if (!bytes) {
      app.speak(fallbackText);
      return;
    }
    if (termAudioUrl) {
      URL.revokeObjectURL(termAudioUrl);
      termAudioUrl = null;
    }
    if (!termAudioEl) termAudioEl = new Audio();
    const part = new Uint8Array(bytes);
    termAudioUrl = URL.createObjectURL(new Blob([part.buffer]));
    termAudioEl.src = termAudioUrl;
    termAudioEl.playbackRate = 1;
    void termAudioEl.play().catch(() => app.speak(fallbackText));
  }

  void renderRail();
  void renderPage();

  return {
    unmount(): void {
      disposed = true;
      if (keyHandler) document.removeEventListener("keydown", keyHandler);
      waveforms?.destroy();
      if (termAudioEl) {
        termAudioEl.pause();
        termAudioEl = null;
      }
      if (termAudioUrl) {
        URL.revokeObjectURL(termAudioUrl);
        termAudioUrl = null;
      }
      clear(root);
    },
  };
}