/**
 * Per-example-sentence waveforms on the encoding page — compact wavesurfer
 * loopers beside each 例句 row. Drag to set an A/B region; ▶ / Space plays the
 * active row; 🔁 / L toggles loop. Loads audio via vault.readBytes when present;
 * falls back to Web Speech for the Chinese sentence text.
 */

import type { VaultIO } from "@tsumugu/engine";

export interface SentenceWaveforms {
  setActive(index: number): void;
  key(ev: KeyboardEvent): boolean;
  destroy(): void;
}

interface SentenceWaveformOpts {
  rows: readonly HTMLElement[];
  waveEls: readonly HTMLElement[];
  playBtns: readonly HTMLButtonElement[];
  loopBtns: readonly HTMLButtonElement[];
  audioPaths: readonly (string | undefined)[];
  texts: readonly string[];
  vault: VaultIO | null;
  speak: (text: string) => void;
}

const NOOP: SentenceWaveforms = { setActive() {}, key: () => false, destroy() {} };

export async function mountSentenceWaveforms(
  opts: SentenceWaveformOpts,
): Promise<SentenceWaveforms> {
  const { rows, waveEls, playBtns, loopBtns, audioPaths, texts, vault, speak } = opts;
  if (rows.length === 0) return NOOP;

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
    row: HTMLElement;
    ws: import("wavesurfer.js").default | null;
    region: Region | null;
    looping: boolean;
    lp: HTMLButtonElement;
    url: string | null;
    hasAudio: boolean;
    text: string;
  }

  const insts: Inst[] = [];
  let active = 0;

  function setActive(i: number): void {
    if (i < 0 || i >= insts.length) return;
    insts[active]?.row.classList.remove("tsg-sent-wave-active");
    active = i;
    insts[active]!.row.classList.add("tsg-sent-wave-active");
  }

  function activateFrom(inst: Inst): void {
    setActive(insts.indexOf(inst));
  }

  function playInst(inst: Inst, fromStart: boolean): void {
    if (!inst.ws) {
      speak(inst.text);
      return;
    }
    if (inst.looping && inst.region) {
      inst.region.play();
      return;
    }
    if (fromStart) inst.ws.setTime(0);
    void inst.ws.play();
  }

  function onFinish(inst: Inst): void {
    if (inst.looping && inst.ws && !inst.region) {
      void inst.ws.play();
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const waveEl = waveEls[i]!;
    const pp = playBtns[i]!;
    const lp = loopBtns[i]!;
    const audio = audioPaths[i];
    const text = texts[i] ?? "";
    const hasAudio = Boolean(audio && vault?.readBytes);

    let ws: import("wavesurfer.js").default | null = null;
    let url: string | null = null;

    if (hasAudio) {
      ws = WaveSurfer.create({
        container: waveEl,
        height: 30,
        waveColor: cssVar("--wnac-overlay0", "#2e466b"),
        progressColor: cssVar("--wnac-blue", "#5089d8"),
        cursorColor: cssVar("--wnac-blue-bright", "#66aaf7"),
        normalize: true,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
      });
      const regions = ws.registerPlugin(RegionsPlugin.create());
      regions.enableDragSelection({ color: "rgba(80,137,216,0.20)" });
      const inst: Inst = { row, ws, region: null, looping: false, lp, url: null, hasAudio: true, text };
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
          const bytes = await vault!.readBytes!(audio!);
          if (!bytes) return;
          inst.url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer]));
          url = inst.url;
          await ws!.load(inst.url);
        } catch {
          /* missing clip — Web Speech fallback on play */
        }
      })();

      pp.onclick = () => {
        activateFrom(inst);
        inst.ws!.isPlaying() ? inst.ws!.pause() : playInst(inst, false);
      };
      lp.onclick = () => {
        activateFrom(inst);
        inst.looping = !inst.looping;
        lp.classList.toggle("on", inst.looping);
        if (inst.looping) playInst(inst, true);
      };
      insts.push(inst);
    } else {
      const inst: Inst = { row, ws: null, region: null, looping: false, lp, url: null, hasAudio: false, text };
      pp.onclick = () => {
        activateFrom(inst);
        speak(inst.text);
      };
      lp.onclick = () => {
        activateFrom(inst);
        inst.looping = !inst.looping;
        lp.classList.toggle("on", inst.looping);
        if (inst.looping) speak(inst.text);
      };
      insts.push(inst);
    }
  }

  if (insts.length) setActive(0);

  function playActive(): void {
    const inst = insts[active];
    if (!inst) return;
    playInst(inst, false);
  }

  return {
    setActive,
    key(ev) {
      if (!insts.length) return false;
      if (ev.key === " " || ev.code === "Space") {
        ev.preventDefault();
        playActive();
        return true;
      }
      if (ev.key === "l" || ev.key === "L") {
        const inst = insts[active];
        if (inst) inst.lp.click();
        return true;
      }
      return false;
    },
    destroy() {
      for (const inst of insts) {
        if (inst.ws) {
          try {
            inst.ws.destroy();
          } catch {
            /* no-op */
          }
        }
        if (inst.url) URL.revokeObjectURL(inst.url);
      }
      insts.length = 0;
    },
  };
}