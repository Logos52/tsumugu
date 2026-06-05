/**
 * Sanctioned YouTube IFrame Player wrapper (M4, PRD §7).
 *
 * The ONLY YouTube integration in Tsumugu: an embedded player whose time we
 * read to drive the synced-reader highlight. No code runs on youtube.com — this
 * is the permitted embed path, ToS-clean. Returns `null` if the IFrame API
 * can't load (offline / headless), so the caller falls back to a local scrubber.
 */

export interface VideoPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number): void;
  play(): void;
  pause(): void;
  destroy(): void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Win = typeof window & {
  YT?: { Player: new (el: Element, cfg: unknown) => any };
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<boolean> | null = null;

/** Load the IFrame API once; resolve false if it never arrives (offline). */
function loadApi(): Promise<boolean> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<boolean>((resolve) => {
    const w = window as Win;
    if (w.YT?.Player) return resolve(true);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(true);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => resolve(false);
    document.head.appendChild(tag);
    setTimeout(() => resolve(!!(window as Win).YT?.Player), 4000);
  });
  return apiPromise;
}

/** Create a player in `host` for `videoId`, or null if the API is unavailable. */
export async function createYouTubePlayer(
  host: HTMLElement,
  videoId: string,
): Promise<VideoPlayer | null> {
  await loadApi();
  // Trust the live DOM check, not loadApi's cached boolean: if an earlier call
  // timed out and cached `false`, a later call still self-heals once the API
  // script has actually finished loading.
  const YT = (window as Win).YT;
  if (!YT?.Player) return null;

  return new Promise<VideoPlayer | null>((resolve) => {
    let settled = false;
    const done = (v: VideoPlayer | null): void => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const mount = document.createElement("div");
    host.appendChild(mount);
    const yt = new YT.Player(mount, {
      videoId,
      width: "100%",
      playerVars: { playsinline: 1, modestbranding: 1, rel: 0 },
      events: {
        onReady: () =>
          done({
            getCurrentTime: () => yt.getCurrentTime?.() ?? 0,
            getDuration: () => yt.getDuration?.() ?? 0,
            seekTo: (s: number) => yt.seekTo?.(s, true),
            play: () => yt.playVideo?.(),
            pause: () => yt.pauseVideo?.(),
            destroy: () => {
              try {
                yt.destroy?.();
              } catch {
                /* already gone */
              }
            },
          }),
      },
    });
    setTimeout(() => {
      if (settled) return; // a genuine onReady already won
      try {
        yt.destroy?.(); // tear down the orphaned player instead of leaking it
      } catch {
        /* not ready yet / already gone */
      }
      mount.remove();
      done(null);
    }, 6000); // never hang the UI
  });
}
