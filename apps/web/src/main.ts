/**
 * Tsumugu reader — app bootstrap and glue. Wires the AppState to the header
 * nav, toolbar (sample picker, vault grant, Anki export, toggles), and mounts
 * the reader / review views. Client-side, offline, no backend.
 */
import { demoPack } from "@tsumugu/demo-pack";
import type { AnkiDeck, WordStatus } from "@tsumugu/engine";
import { AppState, type ViewController } from "./state.js";
import { mountReader } from "./reader/reader.js";
import { mountReview } from "./review/review.js";
import { mountEncoding } from "./encoding/encoding.js";
import {
  MemoryVault,
  pickVaultFolder,
  createWebAudio,
  exportAndDownloadApkg,
} from "./host/index.js";
import { el, clear } from "./ui/dom.js";
import { SAMPLES } from "./samples.js";
import { packForLang } from "./packs/index.js";

const $ = <T extends HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);

const firstSample = SAMPLES[0]!;

const app = new AppState({
  pack: demoPack,
  audio: createWebAudio(),
  vault: new MemoryVault(), // in-session persistence until a real folder is granted
  content: firstSample.content,
});

const rootEl = $<HTMLElement>("#app-root")!;
const toolbarEl = $<HTMLElement>("#app-toolbar")!;
const statusEl = $<HTMLElement>("#app-status")!;

let view: ViewController | null = null;

/**
 * Point the app at the right language pack for the current content so the
 * reader gets real tone coloring, OpenCC normalization, and zh-TW / vi-VN TTS.
 * Falls back to the generic demo pack for languages with no browser pack. A
 * granted vault wires an optional vault-backed dictionary for live hover.
 */
function syncPack(): void {
  app.pack =
    packForLang(app.content?.lang ?? "", { vault: app.vault }) ?? demoPack;
}

/** Parse #/encoding/<word> → the word, else null. */
function encodingRoute(): string | null {
  const m = /^#\/encoding\/(.+)$/.exec(location.hash);
  return m ? decodeURIComponent(m[1]!) : null;
}

function remount(): void {
  view?.unmount();
  clear(rootEl);
  const word = encodingRoute();
  if (word) {
    view = mountEncoding(rootEl, app, word);
  } else {
    view = app.mode === "review" ? mountReview(rootEl, app) : mountReader(rootEl, app);
  }
}

// Clicking an SRS word (review view) sets the hash; route to its encoding page.
window.addEventListener("hashchange", remount);

function refreshStatus(): void {
  const m = app.metrics();
  // Note: progressMetrics() does not populate dueCount (left undefined per the
  // engine spec), so no `· due N` suffix is shown here.
  statusEl.textContent =
    `${app.lang} · known ${m.knownCount}/${m.trackedCount}` +
    (m.flaggedCount ? ` · flagged ${m.flaggedCount}` : "");
}

// ── header nav ───────────────────────────────────────────────────────────────
// Switch mode and leave any encoding route (clearing the hash re-renders via
// the hashchange listener; the modechange listener handles the mode switch).
const navTo = (mode: "reader" | "review"): void => {
  const hadHash = location.hash !== "";
  app.setMode(mode);
  if (hadHash) location.hash = "";
};
$<HTMLButtonElement>("#mode-reader")?.addEventListener("click", () => navTo("reader"));
$<HTMLButtonElement>("#mode-review")?.addEventListener("click", () => navTo("review"));
app.on("modechange", remount);
app.on("change", refreshStatus);
app.on("status", (msg) => {
  if (typeof msg === "string") statusEl.textContent = msg;
});

// ── toolbar ──────────────────────────────────────────────────────────────────
function buildToolbar(): void {
  clear(toolbarEl);

  const picker = el(
    "select",
    {
      class: "tsg-btn",
      title: "Sample text",
      on: {
        change: (e) => {
          const id = (e.target as HTMLSelectElement).value;
          const s = SAMPLES.find((x) => x.id === id);
          if (s) {
            app.setContent(s.content);
            // Bind (or clear) the sample's timed transcript for the synced reader.
            app.setTranscript(s.transcript ?? null);
            // Pick the pack for the new content's language BEFORE remounting so
            // the reader uses zh-TW / vi-VN TTS + tone coloring + OpenCC.
            syncPack();
            // Remount unconditionally: the reader recolors via its own "change"
            // listener, but the review view builds its due queue once at mount
            // and has no such listener — so a new sample (new language) only
            // reaches Review through a full remount.
            remount();
          }
        },
      },
    },
    ...SAMPLES.map((s) =>
      el("option", { attrs: { value: s.id }, text: s.label }),
    ),
  );

  const grant = el("button", {
    class: "tsg-btn",
    text: "Grant vault folder",
    title: "Point Tsumugu at a local folder; the word store syncs there (writes on your action only).",
    type: "button",
    on: {
      click: async () => {
        const vault = await pickVaultFolder();
        if (!vault) {
          app.setStatusMessage(
            "File System Access not available (or cancelled) — staying in-memory.",
          );
          return;
        }
        app.setVault(vault);
        // Re-evaluate the pack now that a vault is granted, so a vault-backed
        // dictionary (if present) is wired for live hover lookups.
        syncPack();
        await app.loadStore();
        await app.saveStore();
        // A freshly loaded store may carry due cards / new statuses; remount so
        // the mounted view reflects them. (loadStore's "change" recolors the
        // reader but does not rebuild the review view's already-built queue.)
        remount();
        app.setStatusMessage("Vault folder granted; word store loaded.");
      },
    },
  });

  const exportBtn = el("button", {
    class: "tsg-btn",
    text: "Export Anki",
    title: "Build an .apkg of your learning words (client-side).",
    type: "button",
    on: { click: () => void exportAnki() },
  });

  const tone = el(
    "label",
    { class: "tsg-btn", title: "zh tone coloring" },
    el("input", {
      attrs: app.settings.toneColoring ? { type: "checkbox", checked: "" } : { type: "checkbox" },
      on: {
        change: (e) => {
          app.updateSettings({ toneColoring: (e.target as HTMLInputElement).checked });
          if (app.mode === "reader") remount();
        },
      },
    }),
    " tones",
  );

  const guess = el(
    "label",
    { class: "tsg-btn", title: "Guess-first: hide the gloss until you reveal" },
    el("input", {
      attrs: app.settings.guessFirst ? { type: "checkbox", checked: "" } : { type: "checkbox" },
      on: {
        change: (e) => {
          app.updateSettings({ guessFirst: (e.target as HTMLInputElement).checked });
          if (app.mode === "reader") remount();
        },
      },
    }),
    " guess-first",
  );

  const phonetics = el(
    "label",
    { class: "tsg-btn", title: "Migaku visual: zhuyin above each word + unknown underlines" },
    el("input", {
      attrs: app.settings.phonetics ? { type: "checkbox", checked: "" } : { type: "checkbox" },
      on: {
        change: (e) => {
          app.updateSettings({ phonetics: (e.target as HTMLInputElement).checked });
          if (app.mode === "reader") remount();
        },
      },
    }),
    " zhuyin",
  );

  toolbarEl.append(picker, grant, exportBtn, tone, guess, phonetics);
}

async function exportAnki(): Promise<void> {
  const learning: WordStatus[] = ["l1", "l2", "l3", "l4"];
  const entries = app.store
    .all(app.lang)
    .filter((e) => learning.includes(e.status));
  if (entries.length === 0) {
    app.setStatusMessage("No learning words yet — grade some words first (1–4).");
    return;
  }
  const glossary = app.content?.glossary ?? {};
  const deck: AnkiDeck = {
    name: `Tsumugu ${app.lang}`,
    notes: entries.map((e) => ({
      front: e.word,
      back:
        e.custom?.gloss ?? glossary[e.word]?.gloss ?? e.custom?.reading ?? "(no gloss)",
      tags: ["tsumugu", app.lang],
    })),
  };
  try {
    await exportAndDownloadApkg(deck, `tsumugu-${app.lang}.apkg`);
    app.setStatusMessage(`Exported ${entries.length} cards.`);
  } catch (err) {
    app.setStatusMessage(`Anki export failed: ${String(err)}`);
  }
}

// ── start ────────────────────────────────────────────────────────────────────
syncPack();
buildToolbar();
remount();
refreshStatus();
