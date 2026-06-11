/**
 * Per-sentence waveforms — one ROW per cue: sentence text left, one or more
 * compact wavesurfer loopers on the right (e.g. Native TW + Serena stacked).
 * Drag to A/B-loop; ▶ / Space plays the selected line's primary clip.
 */

import type { VaultIO } from "@tsumugu/engine";
import { resolveAudioPath, type VoiceNotesBinding } from "./manifest.js";

export interface CueWaveTrack {
  label: string;
  binding: VoiceNotesBinding;
}

export interface CueWaveforms {
  setActive(cueIndex: number): void;
  key(ev: KeyboardEvent): boolean;
  playThrough(): void;
  stop(): void;
  isPlaying(): boolean;
  destroy(): void;
}

interface CueWaveformOpts {
  ranges: readonly { startToken: number; endToken: number }[];
  tokenEls: readonly (HTMLElement | null)[];
  vault: VaultIO;
  /** One or more voice tracks — GSM dialogues show both stacked (no toggle). */
  tracks: readonly CueWaveTrack[];
  onActivate?: (cueIndex: number) => void;
}

const NOOP: CueWaveforms = {
  setActive() {},
  key: () => false,
  playThrough() {},
  stop() {},
  isPlaying: () => false,
  destroy() {},
};

export async function mountCueWaveforms(opts: CueWaveformOpts): Promise<CueWaveforms> {
  const { ranges, tokenEls, vault, tracks, onActivate } = opts;
  if (!vault.readBytes || tracks.length === 0) return NOOP;
  const container = tokenEls.find((e) => e)?.parentElement;
  if (!container) return NOOP;

  const { default: WaveSurfer } = await import("wavesurfer.js");
  const { default: RegionsPlugin } = await import("wavesurfer.js/plugins/regions");
  const cssVar = (n: string, f: string) =>
    (typeof getComputedStyle === "function" &&
      getComputedStyle(document.documentElement).getPropertyValue(n).trim()) ||
    f;

  interface Region {
    play: () => void;
  }
  interface Inst {
    cue: number;
    trackIdx: number;
    row: HTMLElement;
    ws: import("wavesurfer.js").default;
    region: Region | null;
    looping: boolean;
    lp: HTMLButtonElement;
    url: string | null;
  }

  container.classList.add("tsg-cue-rows");
  const frag = document.createDocumentFragment();
  const pendings: {
    cue: number;
    row: HTMLElement;
    waveEl: HTMLElement;
    pp: HTMLButtonElement;
    lp: HTMLButtonElement;
    audio: string;
    binding: VoiceNotesBinding;
    trackIdx: number;
  }[] = [];

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

    const stack = document.createElement("div");
    stack.className = "tsg-cue-wavestack";
    let anyAudio = false;

    for (let t = 0; t < tracks.length; t++) {
      const track = tracks[t]!;
      const note = track.binding.byCue.get(c);
      if (!note) continue;
      anyAudio = true;
      const wrap = document.createElement("div");
      wrap.className = "tsg-cue-wavewrap";
      const label = document.createElement("span");
      label.className = "tsg-cw-label";
      label.textContent = track.label;
      const pp = document.createElement("button");
      pp.className = "tsg-cw-btn";
      pp.textContent = "▶";
      pp.title = `Play ${track.label} (Space on row)`;
      const waveEl = document.createElement("div");
      waveEl.className = "tsg-cw-wave";
      const lp = document.createElement("button");
      lp.className = "tsg-cw-btn";
      lp.textContent = "🔁";
      lp.title = "Loop highlighted region (L)";
      wrap.append(label, pp, waveEl, lp);
      stack.append(wrap);
      pendings.push({
        cue: c,
        row,
        waveEl,
        pp,
        lp,
        audio: note.audio,
        binding: track.binding,
        trackIdx: t,
      });
    }

    if (anyAudio) row.append(stack);
    frag.append(row);
  }
  container.replaceChildren(frag);

  const insts: Inst[] = [];
  const idxByCue = new Map<number, number>();
  let active = 0;
  let chaining = false;

  function setActive(i: number): void {
    if (i < 0 || i >= insts.length) return;
    const cue = insts[i]!.cue;
    document.querySelectorAll(".tsg-cue-row.tsg-cw-active").forEach((n) => n.classList.remove("tsg-cw-active"));
    insts[i]!.row.classList.add("tsg-cw-active");
    active = i;
    void cue;
  }
  function activateFrom(inst: Inst): void {
    const first = insts.findIndex((x) => x.cue === inst.cue);
    if (first >= 0) setActive(first);
    onActivate?.(inst.cue);
  }
  function playInst(inst: Inst, fromStart: boolean): void {
    for (const o of insts) {
      if (o.cue === inst.cue && o !== inst) {
        try {
          o.ws.pause();
        } catch {
          /* no-op */
        }
      }
    }
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
      const curIdx = idxByCue.get(inst.cue)!;
      const nextCue = insts[curIdx + 1]?.cue;
      const next = nextCue !== undefined ? insts.find((x) => x.cue === nextCue && x.trackIdx === 0) : undefined;
      if (next) {
        activateFrom(next);
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
      height: 28,
      waveColor: cssVar("--wnac-overlay0", "#2e466b"),
      progressColor:
        p.trackIdx === 0
          ? cssVar("--wnac-blue", "#5089d8")
          : cssVar("--wnac-mauve", "#b36ef5"),
      cursorColor: cssVar("--wnac-blue-bright", "#66aaf7"),
      normalize: true,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
    });
    const regions = ws.registerPlugin(RegionsPlugin.create());
    regions.enableDragSelection({ color: "rgba(80,137,216,0.20)" });
    const inst: Inst = {
      cue: p.cue,
      trackIdx: p.trackIdx,
      row: p.row,
      ws,
      region: null,
      looping: false,
      lp: p.lp,
      url: null,
    };
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
        const bytes = await vault.readBytes!(resolveAudioPath(p.binding.baseDir, p.audio));
        if (!bytes) return;
        inst.url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer]));
        await ws.load(inst.url);
      } catch {
        /* missing clip */
      }
    })();

    p.pp.onclick = () => {
      const i = insts.findIndex((x) => x.cue === p.cue && x.trackIdx === p.trackIdx);
      if (i >= 0) active = i;
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
    if (!idxByCue.has(p.cue)) idxByCue.set(p.cue, insts.length);
    insts.push(inst);
  }
  if (insts.length) setActive(0);

  function primaryOnRow(cue: number): Inst | undefined {
    return insts.find((x) => x.cue === cue && x.trackIdx === 0) ?? insts.find((x) => x.cue === cue);
  }

  function playActive(): void {
    const inst = insts[active] ?? primaryOnRow(insts[active]?.cue ?? 0);
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
        const curCue = insts[active]?.cue ?? 0;
        const next = insts.find((x) => x.cue > curCue && x.trackIdx === 0);
        if (next) {
          setActive(insts.indexOf(next));
          next.row.scrollIntoView({ block: "nearest", behavior: "smooth" });
          onActivate?.(next.cue);
        }
        return true;
      }
      if (ev.key === "ArrowUp" || ev.key === ",") {
        ev.preventDefault();
        const curCue = insts[active]?.cue ?? 0;
        const prev = [...insts].reverse().find((x) => x.cue < curCue && x.trackIdx === 0);
        if (prev) {
          setActive(insts.indexOf(prev));
          prev.row.scrollIntoView({ block: "nearest", behavior: "smooth" });
          onActivate?.(prev.cue);
        }
        return true;
      }
      if (ev.key === "L") {
        const inst = insts[active];
        if (inst) inst.lp.click();
        return true;
      }
      return false;
    },
    playThrough() {
      const inst = primaryOnRow(insts[active]?.cue ?? insts[0]!.cue);
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