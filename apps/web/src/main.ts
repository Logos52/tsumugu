/**
 * Tsumugu reader — app bootstrap and glue. Wires the AppState to the header
 * nav, toolbar (sample picker, vault grant, Anki export, toggles), and mounts
 * the reader / review views. Client-side, offline, no backend.
 */
import { demoPack } from "@tsumugu/demo-pack";
import { primaryStoreLang, type AnkiDeck, type WordStatus, type VaultIO } from "@tsumugu/engine";
import { AppState, migrateAppSettings, type AppSettings, type ViewController } from "./state.js";
import { mountReader } from "./reader/reader.js";
import { mountReview } from "./review/review.js";
import { mountStyleguide } from "./styleguide/styleguide.js";
import {
  MemoryVault,
  pickVaultFolder,
  createHttpVault,
  devVaultAvailable,
  staticVaultAvailable,
  staticVaultBase,
  listVaultReadings,
  type VaultReading,
  createWebAudio,
  exportAndDownloadApkg,
} from "./host/index.js";
import { el, clear } from "./ui/dom.js";
import { SAMPLES } from "./samples.js";
import { packForLang } from "./packs/index.js";
import { readReadingFiles, classifyReadingDocs } from "./loadReading.js";
import { parseVoiceNotes, bindVoiceNotes, type VoiceNotesBinding } from "./voice/manifest.js";
import {
  defaultAssignment,
  mergeAssignmentPref,
  type VoiceTrack,
  type SpeakerAssignment,
} from "./voice/voices.js";
import { buildVoiceNotesDeck } from "./voice/ankiDeck.js";
import { parseWordAudio, bindWordAudio, type WordAudioBinding } from "./voice/wordAudio.js";
import { parseSectionAudio, bindSectionAudio, type SectionAudioBinding } from "./voice/sectionAudio.js";

const $ = <T extends HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);

const firstSample = SAMPLES[0]!;

// Reader toggles persist across reloads (reads off raw, but better than resetting
// zhuyin/tones/guess-first every page-load given how often dev reloads).
const SETTINGS_KEY = "tsg-settings";
// One-time migration: the hover default changed from "unknown" to "shift". A
// value persisted before that change would otherwise keep popping the card on
// every word, so drop the stored hoverMode once and let the new default apply.
const HOVER_SHIFT_MIGRATION_KEY = "tsg-hover-shift-default";
const persistedSettings: Partial<AppSettings> = (() => {
  try {
    const raw = migrateAppSettings(
      JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<AppSettings>,
    );
    if (!localStorage.getItem(HOVER_SHIFT_MIGRATION_KEY)) {
      delete raw.hoverMode; // fall back to the new "shift" default
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(raw)); // persist the cleaned value
      localStorage.setItem(HOVER_SHIFT_MIGRATION_KEY, "1");
    }
    return raw;
  } catch {
    return {};
  }
})();

const app = new AppState({
  pack: demoPack,
  audio: createWebAudio(),
  vault: new MemoryVault(), // in-session persistence until a real folder is granted
  content: firstSample.content,
  transcript: firstSample.transcript ?? null, // mount the synced transcript on load
  settings: persistedSettings,
});

const rootEl = $<HTMLElement>("#app-root")!;
const toolbarEl = $<HTMLElement>("#app-toolbar")!;
const statusEl = $<HTMLElement>("#app-status")!;

let view: ViewController | null = null;
let remountSeq = 0;
// True once the dev-server vault auto-loads; hides the manual grant button.
let devVault = false;
// Readings discovered in the dev vault (populated on init when devVault).
let vaultReadings: VaultReading[] = [];
const LAST_READING_KEY = "tsg-last-reading";
const VOICE_PREF_KEY = "tsg-voice-pref"; // global speaker→voice pref so a toggle sticks across readings
const READING_PICKER_ID = "tsg-reading-picker";
/** Default public homepage reading — Mandarin Corner split-pane YouTube reader. */
const DEFAULT_VAULT_READING = "inbox/zh-Hant/why-friendship-differs.prepared.json";

function readingKind(r: VaultReading): VaultReading["kind"] {
  if (r.kind) return r.kind;
  const slug = r.path.split("/").pop()?.replace(/\.prepared\.json$/, "") ?? "";
  if (/^gsm2-lesson-\d{2}-dialogue$/.test(slug)) return "gsm-dialogue";
  if (/^gsm2-lesson-\d{2}-rewrite$/.test(slug)) return "gsm-rewrite";
  return "other";
}

/** `?reading=why-friendship-differs` → vault path for deep links from the wiki. */
function readingPathFromQuery(): string | null {
  try {
    const slug = new URLSearchParams(location.search).get("reading")?.trim();
    if (!slug) return null;
    const clean = slug.replace(/\.prepared\.json$/i, "").replace(/^\/+/, "");
    if (!clean || clean.includes("/") || clean.includes("..")) return null;
    return `inbox/zh-Hant/${clean}.prepared.json`;
  } catch {
    return null;
  }
}
// Suffixed voice manifests probed beside a reading, in addition to the base
// `.voice-notes.json`. Each becomes a track whose id IS the suffix.
const KNOWN_VOICE_SUFFIXES = ["native"] as const;

/**
 * Point the app at the right language pack for the current content so the
 * reader gets real tone coloring, OpenCC normalization, and zh-TW / vi-VN TTS.
 * Falls back to the generic demo pack for languages with no browser pack. A
 * granted vault wires an optional vault-backed dictionary for live hover.
 */
/** Pack language for the surface being mounted (reader vs review/encoding). */
function activePackLang(): string {
  if (encodingRoute() || app.mode === "review") return app.studyLang;
  return app.content?.lang ?? "";
}

function syncPack(): void {
  app.pack = packForLang(activePackLang(), { vault: app.vault }) ?? demoPack;
}

/** Parse #/encoding/<word> → the word, else null. */
function encodingRoute(): string | null {
  const m = /^#\/encoding\/(.+)$/.exec(location.hash);
  return m ? decodeURIComponent(m[1]!) : null;
}

function remount(): void {
  void remountAsync();
}

async function remountAsync(): Promise<void> {
  const seq = ++remountSeq;
  syncPack();
  view?.unmount();
  clear(rootEl);
  if (seq !== remountSeq) return;
  if (location.hash === "#/styleguide") {
    view = mountStyleguide(rootEl, app);
    return;
  }
  const word = encodingRoute();
  if (word) {
    const { mountEncoding } = await import("./encoding/encoding.js");
    if (seq !== remountSeq) return;
    view = mountEncoding(rootEl, app, word);
    return;
  }
  view = app.mode === "review" ? mountReview(rootEl, app) : mountReader(rootEl, app);
}

// Clicking an SRS word (review view) sets the hash; route to its encoding page.
window.addEventListener("hashchange", remount);

function refreshStatus(): void {
  const m = app.metrics(app.vault ? app.studyLang : undefined);
  // Note: progressMetrics() does not populate dueCount (left undefined per the
  // engine spec), so no `· due N` suffix is shown here.
  statusEl.textContent =
    `${app.lang} · known ${m.knownCount}/${m.trackedCount}` +
    (m.flaggedCount ? ` · flagged ${m.flaggedCount}` : "");
}

/** Persist the user-facing reader toggles so they survive a reload. */
function persistSettings(): void {
  try {
    const {
      phonetics,
      phoneticsAllWords,
      toneColoring,
      guessFirst,
      hoverMode,
      transcriptLayout,
      showTranslation,
      voiceNotesEnabled,
      voiceSlow,
      dictDefault,
    } = app.settings;
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        phonetics,
        phoneticsAllWords,
        toneColoring,
        guessFirst,
        hoverMode,
        transcriptLayout,
        showTranslation,
        voiceNotesEnabled,
        voiceSlow,
        dictDefault,
      }),
    );
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
  if (location.hash !== "") location.hash = "";
  app.setMode(mode);
};
$<HTMLButtonElement>("#mode-reader")?.addEventListener("click", () => navTo("reader"));
$<HTMLButtonElement>("#mode-review")?.addEventListener("click", () => navTo("review"));
app.on("modechange", remount);
// A per-speaker voice change recomposes the binding → rebuild the player + UI,
// and remember the choice globally so it carries to the next reading.
app.on("voicechange", () => {
  saveVoicePref(app.voiceAssignment);
  remount();
});
app.on("change", refreshStatus);
// Persist settings on any change, so live toggles + the `t` hotkey survive reload.
app.on("change", persistSettings);
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

/** Vault-relative directory beside a prepared.json (where `examples[].audio` resolves). */
function preparedBaseDir(readingPath: string): string {
  const slugBase = readingPath.replace(/\.prepared\.json$/, "").replace(/\.json$/, "");
  const lastSlash = slugBase.lastIndexOf("/");
  return lastSlash >= 0 ? slugBase.slice(0, lastSlash) : "";
}

/**
 * Discover a `<slug>.voice-notes.json` sidecar beside a reading and bind it to
 * its directory (audio paths resolve against that dir). Null when absent/invalid
 * — the voice module then stays inert. Tolerant: any read/parse error → null.
 */
async function discoverVoiceNotes(
  vault: VaultIO,
  readingPath: string,
  cueCount: number,
): Promise<VoiceNotesBinding | null> {
  if (cueCount === 0) return null;
  const slugBase = readingPath.replace(/\.prepared\.json$/, "").replace(/\.json$/, "");
  const lastSlash = slugBase.lastIndexOf("/");
  const baseDir = lastSlash >= 0 ? slugBase.slice(0, lastSlash) : "";
  try {
    const raw = await vault.readText(`${slugBase}.voice-notes.json`);
    if (!raw) return null;
    const manifest = parseVoiceNotes(JSON.parse(raw), cueCount);
    return manifest ? bindVoiceNotes(manifest, baseDir) : null;
  } catch {
    return null;
  }
}

/** A stable track id from a base manifest's voice label ("Serena" → "serena"). */
function baseVoiceId(voice: string): string {
  return voice.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "primary";
}

/**
 * Discover ALL voice tracks beside a reading: the base `<slug>.voice-notes.json`
 * plus any `<slug>.voice-notes.<suffix>.json` for known suffixes (e.g. `native`).
 * Absent/invalid manifests are skipped. ≥2 tracks enables per-speaker assignment.
 */
async function discoverVoiceTracks(
  vault: VaultIO,
  readingPath: string,
  cueCount: number,
): Promise<VoiceTrack[]> {
  if (cueCount === 0) return [];
  const slugBase = readingPath.replace(/\.prepared\.json$/, "").replace(/\.json$/, "");
  const lastSlash = slugBase.lastIndexOf("/");
  const baseDir = lastSlash >= 0 ? slugBase.slice(0, lastSlash) : "";
  const read = async (file: string): Promise<VoiceNotesBinding | null> => {
    try {
      const raw = await vault.readText(file);
      if (!raw) return null;
      const m = parseVoiceNotes(JSON.parse(raw), cueCount);
      return m ? bindVoiceNotes(m, baseDir) : null;
    } catch {
      return null;
    }
  };
  const tracks: VoiceTrack[] = [];
  const base = await read(`${slugBase}.voice-notes.json`);
  if (base) tracks.push({ id: baseVoiceId(base.manifest.voice), label: base.manifest.voice || "Voice", binding: base });
  for (const suffix of KNOWN_VOICE_SUFFIXES) {
    const b = await read(`${slugBase}.voice-notes.${suffix}.json`);
    if (b && !tracks.some((t) => t.id === suffix)) {
      tracks.push({ id: suffix, label: b.manifest.voice || suffix, binding: b });
    }
  }
  return tracks;
}

/** Read the global speaker→voice preference (last toggle), tolerant of bad JSON. */
function loadVoicePref(): SpeakerAssignment | null {
  try {
    const raw = localStorage.getItem(VOICE_PREF_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? (o as SpeakerAssignment) : null;
  } catch {
    return null;
  }
}

/** Persist the current speaker→voice assignment so it sticks across readings. */
function saveVoicePref(assignment: SpeakerAssignment): void {
  try {
    localStorage.setItem(VOICE_PREF_KEY, JSON.stringify(assignment));
  } catch {
    /* private mode / storage disabled — non-fatal */
  }
}

/**
 * Discover a `<slug>.word-audio.json` sidecar beside a reading (per-word Serena
 * mp3s). Null when absent/invalid — the hover 🔊 then stays on Web Speech.
 */
async function discoverWordAudio(vault: VaultIO, readingPath: string): Promise<WordAudioBinding | null> {
  const slugBase = readingPath.replace(/\.prepared\.json$/, "").replace(/\.json$/, "");
  const lastSlash = slugBase.lastIndexOf("/");
  const baseDir = lastSlash >= 0 ? slugBase.slice(0, lastSlash) : "";
  try {
    const raw = await vault.readText(`${slugBase}.word-audio.json`);
    if (!raw) return null;
    const manifest = parseWordAudio(JSON.parse(raw));
    return manifest ? bindWordAudio(manifest, baseDir) : null;
  } catch {
    return null;
  }
}

/** Discover a `<slug>.section-audio.json` sidecar (per-section summary audio). */
async function discoverSectionAudio(
  vault: VaultIO,
  readingPath: string,
  sectionCount: number,
): Promise<SectionAudioBinding | null> {
  if (sectionCount === 0) return null;
  const slugBase = readingPath.replace(/\.prepared\.json$/, "").replace(/\.json$/, "");
  const lastSlash = slugBase.lastIndexOf("/");
  const baseDir = lastSlash >= 0 ? slugBase.slice(0, lastSlash) : "";
  try {
    const raw = await vault.readText(`${slugBase}.section-audio.json`);
    if (!raw) return null;
    const manifest = parseSectionAudio(JSON.parse(raw), sectionCount);
    return manifest ? bindSectionAudio(manifest, baseDir) : null;
  } catch {
    return null;
  }
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
  app.setContent(payload.content, { baseDir: preparedBaseDir(path) });
  syncPack();
  app.setTranscript(payload.transcript ?? null);
  // Voice notes: the base `<slug>.voice-notes.json` plus any native/other tracks
  // beside the reading. ≥2 tracks → per-speaker assignment (composed binding);
  // 1 track → that voice for every cue. Audio resolves against the reading's dir.
  const cueSpeakers = payload.transcript?.cues.map((c) => c.speaker) ?? [];
  const tracks = await discoverVoiceTracks(vault, path, payload.transcript?.cues.length ?? 0);
  if (tracks.length > 0) {
    const assignment = mergeAssignmentPref(defaultAssignment(tracks, cueSpeakers), loadVoicePref(), tracks);
    app.setVoiceTracks(tracks, assignment);
  } else {
    app.setVoiceNotes(null);
  }
  app.setWordAudio(await discoverWordAudio(vault, path));
  app.setSectionAudio(await discoverSectionAudio(vault, path, payload.transcript?.sections?.length ?? 0));
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
  const vaultOpt = (r: VaultReading) =>
    el("option", {
      attrs: { value: "vault:" + r.path },
      text:
        (r.title ||
          r.path.split("/").pop()?.replace(/\.prepared\.json$/, "") ||
          r.path) + (r.lang ? ` (${r.lang})` : ""),
    });
  const youtube = vaultReadings.filter((r) => readingKind(r) === "youtube");
  const gsmDialogue = vaultReadings.filter((r) => readingKind(r) === "gsm-dialogue");
  const otherVault = vaultReadings.filter(
    (r) => readingKind(r) !== "youtube" && readingKind(r) !== "gsm-dialogue",
  );
  const pickerChildren = vaultReadings.length
    ? [
        ...(youtube.length
          ? [el("optgroup", { attrs: { label: "YouTube — split pane" } }, ...youtube.map(vaultOpt))]
          : []),
        ...(gsmDialogue.length
          ? [
              el(
                "optgroup",
                { attrs: { label: "GSM — dialogues (dual waveforms)" } },
                ...gsmDialogue.map(vaultOpt),
              ),
            ]
          : []),
        ...(otherVault.length
          ? [el("optgroup", { attrs: { label: "Other readings" } }, ...otherVault.map(vaultOpt))]
          : []),
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

  const exportVoiceBtn = el("button", {
    class: "tsg-btn",
    text: "Export Anki 🔊",
    title: "Build an .apkg of this reading's sentences with embedded voice-note audio (when present).",
    type: "button",
    on: { click: () => void exportVoiceAnki() },
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
    { class: "tsg-btn", title: "Phonetic visual: zhuyin above unknown words + unknown underlines" },
    el("input", {
      attrs: app.settings.phonetics ? { type: "checkbox", checked: "" } : { type: "checkbox" },
      on: {
        change: (e) => setToggle({ phonetics: (e.target as HTMLInputElement).checked }),
      },
    }),
    " zhuyin",
  );

  // Scope toggle: by default zhuyin only sits over words you don't know yet
  // (new/l1/l2/l3); this shows it over every word. Only meaningful with zhuyin on.
  const phoneticsAll = el(
    "label",
    { class: "tsg-btn", title: "Zhuyin over ALL words (off = only words you don't know yet)" },
    el("input", {
      attrs: app.settings.phoneticsAllWords ? { type: "checkbox", checked: "" } : { type: "checkbox" },
      on: {
        change: (e) => setToggle({ phoneticsAllWords: (e.target as HTMLInputElement).checked }),
      },
    }),
    " all",
  );

  const layout = el(
    "select",
    {
      class: "tsg-btn",
      title: "Transcript layout: document (read) or subtitle (watch)",
      on: {
        change: (e) => {
          app.updateSettings({
            transcriptLayout: (e.target as HTMLSelectElement)
              .value as AppSettings["transcriptLayout"],
          });
          persistSettings();
          if (app.mode === "reader") remount();
        },
      },
    },
    el("option", { attrs: { value: "document" }, text: "layout: document" }),
    el("option", { attrs: { value: "subtitle" }, text: "layout: subtitle" }),
    el("option", { attrs: { value: "theater" }, text: "layout: theater" }),
  );
  layout.value = app.settings.transcriptLayout;

  const hover = el(
    "select",
    {
      class: "tsg-btn",
      title: "When the hover card appears (only unknown words)",
      on: {
        change: (e) => {
          app.updateSettings({
            hoverMode: (e.target as HTMLSelectElement).value as AppSettings["hoverMode"],
          });
          persistSettings();
        },
      },
    },
    el("option", { attrs: { value: "unknown" }, text: "hover: unknown" }),
    el("option", { attrs: { value: "all" }, text: "hover: all" }),
    el("option", { attrs: { value: "shift" }, text: "hover: ⇧shift" }),
  );
  hover.value = app.settings.hoverMode;

  const translate = el(
    "label",
    { class: "tsg-btn", title: "Show English under each sentence (hotkey: t)" },
    el("input", {
      attrs: app.settings.showTranslation ? { type: "checkbox", checked: "" } : { type: "checkbox" },
      on: {
        // Live (no remount, so the video doesn't reload); the reader's change
        // listener reflects it and persistSettings saves it.
        change: (e) => app.updateSettings({ showTranslation: (e.target as HTMLInputElement).checked }),
      },
    }),
    " 譯",
  );

  const voiceToggle = el(
    "label",
    { class: "tsg-btn", title: "Voice notes: per-cue audio playback + shadowing (when a manifest is present)" },
    el("input", {
      attrs: app.settings.voiceNotesEnabled ? { type: "checkbox", checked: "" } : { type: "checkbox" },
      on: {
        change: (e) => setToggle({ voiceNotesEnabled: (e.target as HTMLInputElement).checked }),
      },
    }),
    " 🔊",
  );

  const theme = el(
    "label",
    { class: "tsg-btn", title: "Dark theme (wnac)" },
    el("input", {
      attrs:
        document.documentElement.dataset.theme === "light"
          ? { type: "checkbox" } // light active → unchecked
          : { type: "checkbox", checked: "" }, // default/dark → checked
      on: {
        change: (e) => {
          const dark = (e.target as HTMLInputElement).checked;
          if (dark) document.documentElement.removeAttribute("data-theme");
          else document.documentElement.dataset.theme = "light";
          try {
            localStorage.setItem("tsg-theme", dark ? "dark" : "light");
          } catch {
            /* storage disabled — non-fatal */
          }
        },
      },
    }),
    " dark",
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

  const styleBtn = el("button", {
    class: "tsg-btn",
    text: "🎨",
    title: "Styleguide / testing page",
    type: "button",
    on: { click: () => { location.hash = "#/styleguide"; } },
  });

  // The manual "Grant vault folder" button is only needed when the dev-server
  // vault isn't auto-loading (e.g. the production build).
  const items: HTMLElement[] = [picker, openBtn, fileInput];
  if (!devVault) items.push(grant);
  items.push(exportBtn, exportVoiceBtn, layout, hover, translate, voiceToggle, tone, guess, phonetics, phoneticsAll, theme, styleBtn);
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

/**
 * Export a sentence deck for the current reading with each cue's voice note
 * embedded as audio (`[sound:cue-NNNN.mp3]`) — for SRS shadowing on due lines.
 */
async function exportVoiceAnki(): Promise<void> {
  const binding = app.voiceNotes;
  const cues = app.transcript?.cues;
  const readBytes = app.vault?.readBytes;
  if (!binding || !cues || !readBytes) {
    app.setStatusMessage("No voice notes to export for this reading.");
    return;
  }
  try {
    const deck = await buildVoiceNotesDeck({
      deckName: `Tsumugu ${app.lang} — ${binding.manifest.slug}`,
      tags: ["tsumugu", app.lang, "voice"],
      cues,
      binding,
      readBytes: (p) => readBytes.call(app.vault, p),
    });
    if (deck.notes.length === 0) {
      app.setStatusMessage("No readable voice-note audio found to export.");
      return;
    }
    await exportAndDownloadApkg(deck, `tsumugu-${binding.manifest.slug}-voice.apkg`);
    app.setStatusMessage(`Exported ${deck.notes.length} sentence cards with audio.`);
  } catch (err) {
    app.setStatusMessage(`Voice Anki export failed: ${String(err)}`);
  }
}

// ── start ────────────────────────────────────────────────────────────────────
async function init(): Promise<void> {
  // Auto-load vault: dev bridge (`pnpm dev`) or static publish (`public/vault/`).
  let vaultBase = "/@vault/";
  let autoVault = await devVaultAvailable();
  if (!autoVault) {
    vaultBase = staticVaultBase();
    autoVault = await staticVaultAvailable();
  }
  devVault = autoVault;
  if (autoVault) {
    app.updateSettings({ storePath: "vault/tsumugu/word-store.json" });
    app.setVault(createHttpVault(vaultBase));
    try {
      await app.loadStore();
      const primary = primaryStoreLang(app.store);
      if (primary) app.updateSettings({ studyLang: primary });
      syncPack();
      vaultReadings = await listVaultReadings(vaultBase);
    } catch (err) {
      app.setStatusMessage(`Vault auto-load failed: ${String(err)}`);
      devVault = false;
    }
  }
  syncPack();
  buildToolbar();

  let restored = false;
  if (devVault) {
    const fromQuery = readingPathFromQuery();
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_READING_KEY);
    } catch {
      last = null;
    }
    const pick = [fromQuery, last, DEFAULT_VAULT_READING, vaultReadings[0]?.path ?? null].find(
      (p) => p && vaultReadings.some((r) => r.path === p),
    );
    if (pick) {
      await loadVaultReading(pick);
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
function showBootError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  rootEl.innerHTML = `<p class="tsg-boot-error">Boot failed: ${msg}</p>`;
  statusEl.textContent = "Boot failed — see message above.";
}

void init().catch(showBootError);
