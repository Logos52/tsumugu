/**
 * Per-sentence waveforms — the transcript laid out as one ROW per cue: the
 * sentence's (already-rendered) word spans on the left, a compact wavesurfer
 * looper on the right. Drag across a waveform to highlight a slice, 🔁 / L to
 * A/B-loop it, ▶ / Space to play the SELECTED line, ↑/↓ to move the selection,
 * and a play-through that auto-advances line by line.
 *
 * The reader's flowing-paragraph layout can't place a waveform beside each line,
 * so this reparents the existing token spans into rows (keeping their coloring /
 * hover / cue-highlight bindings). Audio reads through the vault (object-URL
 * pattern from practiceBar.ts); wavesurfer is dynamically imported (bundled, no
 * CDN). Reader/host layer only.
 */

import type { VaultIO } from "@tsumugu/engine";
import { resolveAudioPath, type VoiceNotesBinding } from "./manifest.js";

export interface CueWaveforms {
  /** Select the row for a cue (outline) — follows reader cue navigation. */
  setActive(cueIndex: number): void;
  /** Handle Space / ↑ / ↓ / L for the per-sentence waveforms; true if handled. */
  key(ev: KeyboardEvent): boolean;
  /** Play every line in turn from the active one, auto-advancing. */
  playThrough(): void;
  /** Stop playback + any play-through. */
  stop(): void;
  isPlaying(): boolean;
  destroy(): void;
}

interface CueWaveformOpts {
  ranges: readonly { startToken: number; endToken: number }[];
  tokenEls: readonly (HTMLElement | null)[];
  vault: VaultIO;
  binding: VoiceNotesBinding;
  onActivate?: (cueIndex: number) => void;
}

const NOOP: CueWaveforms = { setActive() {}, key: () => false, playThrough() {}, stop() {}, isPlaying: () => false, destroy() {} };

export async function mountCueWaveforms(opts: CueWaveformOpts): Promise<CueWaveforms> {
  const { ranges, tokenEls, vault, binding, onActivate } = opts;
  if (!vault.readBytes) return NOOP;
  const container = tokenEls.find((e) => e)?.parentElement;
  if (!container) return NOOP;

  const { default: WaveSurfer } = await import("wavesurfer.js");
  const { default: RegionsPlugin } = await import("wavesurfer.js/plugins/regions");
  const cssVar = (n: string, f: string) =>
    (typeof getComputedStyle === "function" && getComputedStyle(document.documentElement).getPropertyValue(n).trim()) || f;

  interface Region {
    play: () => void;
  }
  interface Inst {
    cue: number;
    row: HTMLElement;
    ws: import("wavesurfer.js").default;
    region: Region | null;
    looping: boolean;
    lp: HTMLButtonElement;
    url: string | null;
  }

  // 1) Reparent each cue's spans into a row, waveform on the right.
  container.classList.add("tsg-cue-rows");
  const frag = document.createDocumentFragment();
  const pendings: { cue: number; row: HTMLElement; waveEl: HTMLElement; pp: HTMLButtonElement; lp: HTMLButtonElement; audio: string }[] = [];
  for (let c = 0; c < ranges.length; c++) {
    const range = ranges[c]!;
    const row = document.createElement("div");
    row.className = "tsg-cue-row";
    const textEl = document.createElement("div");
    textEl.className = "tsg-cue-text";
    for (let i = range.startToken; i < range.endToken; i++) {
      const node = tokenEls[i];
      if (node) textEl.append(node);
    }
    row.append(textEl);
    const note = binding.byCue.get(c);
    if (note) {
      const wrap = document.createElement("div");
      wrap.className = "tsg-cue-wavewrap";
      const pp = document.createElement("button");
      pp.className = "tsg-cw-btn";
      pp.textContent = "▶";
      pp.title = "Play / pause this line (Space)";
      const waveEl = document.createElement("div");
      waveEl.className = "tsg-cw-wave";
      const lp = document.createElement("button");
      lp.className = "tsg-cw-btn";
      lp.textContent = "🔁";
      lp.title = "Loop highlighted region (L)";
      wrap.append(pp, waveEl, lp);
      row.append(wrap);
      pendings.push({ cue: c, row, waveEl, pp, lp, audio: note.audio });
    }
    frag.append(row);
  }
  container.replaceChildren(frag);

  // 2) Mount a wavesurfer per cue.
  const insts: Inst[] = [];
  const idxByCue = new Map<number, number>();
  let active = 0;
  let chaining = false;

  function setActive(i: number): void {
    if (i < 0 || i >= insts.length) return;
    insts[active]?.row.classList.remove("tsg-cw-active");
    active = i;
    insts[active]!.row.classList.add("tsg-cw-active");
  }
  function activateFrom(inst: Inst): void {
    setActive(idxByCue.get(inst.cue)!);
    onActivate?.(inst.cue);
  }
  function playInst(inst: Inst, fromStart: boolean): void {
    if (inst.looping && inst.region) {
      inst.region.play();
      return;
    }
    if (fromStart) inst.ws.setTime(0);
    void inst.ws.play();
  }
  function onFinish(inst: Inst): void {
    if (inst.looping && !inst.region) {
      void inst.ws.play();
      return;
    }
    if (chaining) {
      const next = insts[idxByCue.get(inst.cue)! + 1];
      if (next) {
        setActive(idxByCue.get(next.cue)!);
        onActivate?.(next.cue);
        next.row.scrollIntoView({ block: "nearest", behavior: "smooth" });
        playInst(next, true);
      } else {
        chaining = false;
      }
    }
  }

  for (const p of pendings) {
    const ws = WaveSurfer.create({
      container: p.waveEl,
      height: 30,
      waveColor: cssVar("--ctp-overlay0", "#565f89"),
      progressColor: cssVar("--ctp-blue", "#7aa2f7"),
      cursorColor: cssVar("--ctp-mauve", "#bb9af7"),
      normalize: true,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
    });
    const regions = ws.registerPlugin(RegionsPlugin.create());
    regions.enableDragSelection({ color: "rgba(122,162,247,0.22)" });
    const inst: Inst = { cue: p.cue, row: p.row, ws, region: null, looping: false, lp: p.lp, url: null };
    regions.on("region-created", (r) => {
      for (const o of regions.getRegions()) if (o !== r) o.remove();
      inst.region = r as unknown as Region;
      activateFrom(inst);
    });
    regions.on("region-updated", (r) => {
      inst.region = r as unknown as Region;
    });
    regions.on("region-out", (r) => {
      if (inst.looping && (r as unknown as Region) === inst.region) (r as unknown as Region).play();
    });
    ws.on("finish", () => onFinish(inst));
    ws.on("interaction", () => activateFrom(inst));

    void (async () => {
      try {
        const bytes = await vault.readBytes!(resolveAudioPath(binding.baseDir, p.audio));
        if (!bytes) return;
        inst.url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer]));
        await ws.load(inst.url);
      } catch {
        /* missing/unreadable clip — leave an empty waveform */
      }
    })();

    p.pp.onclick = () => {
      activateFrom(inst);
      chaining = false;
      inst.ws.isPlaying() ? inst.ws.pause() : playInst(inst, false);
    };
    p.lp.onclick = () => {
      activateFrom(inst);
      inst.looping = !inst.looping;
      p.lp.classList.toggle("on", inst.looping);
      if (inst.looping) playInst(inst, true);
    };
    idxByCue.set(p.cue, insts.length);
    insts.push(inst);
  }
  if (insts.length) setActive(0);

  function playActive(): void {
    const inst = insts[active];
    if (!inst) return;
    chaining = false;
    inst.ws.isPlaying() ? inst.ws.pause() : playInst(inst, false);
  }

  return {
    setActive(cueIndex) {
      const i = idxByCue.get(cueIndex);
      if (i !== undefined) setActive(i);
    },
    key(ev) {
      if (!insts.length) return false;
      if (ev.key === " " || ev.code === "Space") {
        ev.preventDefault();
        playActive();
        return true;
      }
      if (ev.key === "ArrowDown" || ev.key === ".") {
        ev.preventDefault();
        setActive(active + 1);
        insts[active]!.row.scrollIntoView({ block: "nearest", behavior: "smooth" });
        onActivate?.(insts[active]!.cue);
        return true;
      }
      if (ev.key === "ArrowUp" || ev.key === ",") {
        ev.preventDefault();
        setActive(active - 1);
        insts[active]!.row.scrollIntoView({ block: "nearest", behavior: "smooth" });
        onActivate?.(insts[active]!.cue);
        return true;
      }
      if (ev.key === "L") {
        // Shift+L loops the active line; lowercase `l` stays the reader's next-word.
        const inst = insts[active];
        if (inst) inst.lp.click();
        return true;
      }
      return false;
    },
    playThrough() {
      const inst = insts[active];
      if (!inst) return;
      chaining = true;
      playInst(inst, true);
    },
    stop() {
      chaining = false;
      for (const i of insts) {
        try {
          i.ws.pause();
        } catch {
          /* no-op */
        }
      }
    },
    isPlaying() {
      return insts.some((i) => {
        try {
          return i.ws.isPlaying();
        } catch {
          return false;
        }
      });
    },
    destroy() {
      for (const i of insts) {
        try {
          i.ws.destroy();
        } catch {
          /* no-op */
        }
        if (i.url) URL.revokeObjectURL(i.url);
      }
      insts.length = 0;
      idxByCue.clear();
    },
  };
}
