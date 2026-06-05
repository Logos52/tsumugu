/**
 * Tsumugu reader — app bootstrap and glue. Wires the AppState to the header
 * nav, toolbar (sample picker, vault grant, Anki export, toggles), and mounts
 * the reader / review views. Client-side, offline, no backend.
 */
import { demoPack } from "@tsumugu/demo-pack";
import type { AnkiDeck, WordStatus } from "@tsumugu/engine";
import { AppState, type AppSettings, type ViewController } from "./state.js";
import { mountReader } from "./reader/reader.js";
import { mountReview } from "./review/review.js";
import { mountEncoding } from "./encoding/encoding.js";
import {
  MemoryVault,
  pickVaultFolder,
  createHttpVault,
  devVaultAvailable,
  listVaultReadings,
  type VaultReading,
  createWebAudio,
  exportAndDownloadApkg,
} from "./host/index.js";
import { el, clear } from "./ui/dom.js";
import { SAMPLES } from "./samples.js";
import { packForLang } from "./packs/index.js";
import { readReadingFiles, classifyReadingDocs } from "./loadReading.js";

const $ = <T extends HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);

const firstSample = SAMPLES[0]!;

// Reader toggles persist across reloads (reads off raw, but better than resetting
// zhuyin/tones/guess-first every page-load given how often dev reloads).
const SETTINGS_KEY = "tsg-settings";
const persistedSettings: Partial<AppSettings> = (() => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<AppSettings>;
  } catch {
    return {};
  }
})();

const app = new AppState({
  pack: demoPack,
  audio: createWebAudio(),
  vault: new MemoryVault(), // in-session persistence until a real folder is granted
  content: firstSample.content,
  settings: persistedSettings,
});

const rootEl = $<HTMLElement>("#app-root")!;
const toolbarEl = $<HTMLElement>("#app-toolbar")!;
const statusEl = $<HTMLElement>("#app-status")!;

let view: ViewController | null = null;
// True once the dev-server vault auto-loads; hides the manual grant button.
let devVault = false;
// Readings discovered in the dev vault (populated on init when devVault).
let vaultReadings: VaultReading[] = [];
const LAST_READING_KEY = "tsg-last-reading";
const READING_PICKER_ID = "tsg-reading-picker";

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

/** Persist the user-facing reader toggles so they survive a reload. */
function persistSettings(): void {
  try {
    const { phonetics, toneColoring, guessFirst } = app.settings;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ phonetics, toneColoring, guessFirst }));
  } catch {
    /* storage disabled — non-fatal */
  }
}

/** Apply a toggle change: update settings, persist, and re-render the reader. */
function setToggle(patch: Partial<AppSettings>): void {
  app.updateSettings(patch);
  persistSettings();
  if (app.mode === "reader") remount();
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

/**
 * Load an ingested reading from disk (a `gen transcript` `.prepared.json`, and
 * optionally its `.cues.json` sidecar) into a reader session — synced to the
 * sidecar's video when it carries a `videoId` (M4).
 */
async function openReadingFiles(files: File[]): Promise<void> {
  const payload = await readReadingFiles(files);
  if (!payload.content) {
    app.setStatusMessage("No reading found — pick a gen-transcript .prepared.json (and its .cues.json).");
    return;
  }
  app.setContent(payload.content);
  // Pick the pack for the loaded content's language before remounting.
  syncPack();
  app.setTranscript(payload.transcript ?? null);
  remount();
  const t = payload.transcript;
  app.setStatusMessage(
    t
      ? `Loaded reading + transcript (${t.cues.length} cues${t.videoId ? ", synced video" : ""}).`
      : "Loaded reading.",
  );
}

/**
 * Load a reading discovered in the dev vault (its `.prepared.json` + sibling
 * `.cues.json`) and remember it, so it auto-restores on the next page-load.
 */
async function loadVaultReading(path: string): Promise<void> {
  const vault = app.vault;
  if (!vault) return;
  const cuesPath = path.replace(/\.json$/, "") + ".cues.json";
  const docs: unknown[] = [];
  try {
    const prep = await vault.readText(path);
    if (prep) docs.push(JSON.parse(prep));
    const cues = await vault.readText(cuesPath);
    if (cues) docs.push(JSON.parse(cues));
  } catch (err) {
    app.setStatusMessage(`Couldn't load ${path}: ${String(err)}`);
    return;
  }
  const payload = classifyReadingDocs(docs);
  if (!payload.content) {
    app.setStatusMessage(`No reading content in ${path}.`);
    return;
  }
  app.setContent(payload.content);
  syncPack();
  app.setTranscript(payload.transcript ?? null);
  try {
    localStorage.setItem(LAST_READING_KEY, path);
  } catch {
    /* private mode / storage disabled — non-fatal */
  }
  remount();
  const sel = $<HTMLSelectElement>(`#${READING_PICKER_ID}`);
  if (sel) sel.value = "vault:" + path;
  const t = payload.transcript;
  app.setStatusMessage(
    `Loaded ${path.split("/").pop()}${t ? ` (${t.cues.length} cues${t.videoId ? ", synced video" : ""})` : ""}.`,
  );
}

// ── toolbar ──────────────────────────────────────────────────────────────────
function buildToolbar(): void {
  clear(toolbarEl);

  const sampleOpts = SAMPLES.map((s) =>
    el("option", { attrs: { value: s.id }, text: s.label }),
  );
  // Vault readings (discovered under personal/) appear above the bundled samples.
  const pickerChildren = vaultReadings.length
    ? [
        el(
          "optgroup",
          { attrs: { label: "Vault readings" } },
          ...vaultReadings.map((r) =>
            el("option", {
              attrs: { value: "vault:" + r.path },
              text:
                (r.title ||
                  r.path.split("/").pop()?.replace(/\.prepared\.json$/, "") ||
                  r.path) + (r.lang ? ` (${r.lang})` : ""),
            }),
          ),
        ),
        el("optgroup", { attrs: { label: "Samples" } }, ...sampleOpts),
      ]
    : sampleOpts;
  const picker = el(
    "select",
    {
      class: "tsg-btn",
      title: "Pick a reading",
      attrs: { id: READING_PICKER_ID },
      on: {
        change: (e) => {
          const v = (e.target as HTMLSelectElement).value;
          if (v.startsWith("vault:")) {
            void loadVaultReading(v.slice("vault:".length));
            return;
          }
          const s = SAMPLES.find((x) => x.id === v);
          if (s) {
            app.setContent(s.content);
            // Bind (or clear) the sample's timed transcript for the synced reader.
            app.setTranscript(s.transcript ?? null);
            // Pick the pack for the new content's language before remounting.
            syncPack();
            remount();
          }
        },
      },
    },
    ...pickerChildren,
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
        change: (e) => setToggle({ toneColoring: (e.target as HTMLInputElement).checked }),
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
        change: (e) => setToggle({ guessFirst: (e.target as HTMLInputElement).checked }),
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
        change: (e) => setToggle({ phonetics: (e.target as HTMLInputElement).checked }),
      },
    }),
    " zhuyin",
  );

  const fileInput = el("input", {
    attrs: { type: "file", accept: ".json,application/json", multiple: "" },
    style: { display: "none" },
    on: {
      change: (e) => {
        const input = e.target as HTMLInputElement;
        const files = input.files ? Array.from(input.files) : [];
        input.value = ""; // allow re-picking the same files
        if (files.length) void openReadingFiles(files);
      },
    },
  });
  const openBtn = el("button", {
    class: "tsg-btn",
    text: "Open reading…",
    title: "Load a gen-transcript .prepared.json (+ its .cues.json) to read, optionally synced to a video.",
    type: "button",
    on: { click: () => fileInput.click() },
  });

  // The manual "Grant vault folder" button is only needed when the dev-server
  // vault isn't auto-loading (e.g. the production build).
  const items = [picker, openBtn, fileInput];
  if (!devVault) items.push(grant);
  items.push(exportBtn, tone, guess, phonetics);
  toolbarEl.append(...items);
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
async function init(): Promise<void> {
  // Under `pnpm dev`, auto-load the real vault over the dev-server bridge — no
  // File System Access click. Falls back silently (manual grant) otherwise.
  devVault = await devVaultAvailable();
  if (devVault) {
    // Store lives at vault/tsumugu/word-store.json under the personal/ root.
    app.updateSettings({ storePath: "vault/tsumugu/word-store.json" });
    app.setVault(createHttpVault());
    try {
      await app.loadStore();
      vaultReadings = await listVaultReadings();
    } catch (err) {
      app.setStatusMessage(`Vault auto-load failed: ${String(err)}`);
      devVault = false;
    }
  }
  syncPack();
  buildToolbar();

  // Restore the last-opened vault reading so a reload doesn't reset the page.
  let restored = false;
  if (devVault) {
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_READING_KEY);
    } catch {
      last = null;
    }
    if (last && vaultReadings.some((r) => r.path === last)) {
      await loadVaultReading(last);
      restored = true;
    }
  }
  if (!restored) {
    remount();
    if (devVault) {
      const m = app.metrics();
      app.setStatusMessage(`Vault auto-loaded — ${m.knownCount}/${m.trackedCount} known words.`);
    }
  }
  refreshStatus();
}
void init();
