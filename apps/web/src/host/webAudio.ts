/**
 * Web Speech audio adapter implementing the engine's `AudioPort`.
 *
 * Speaks text via the browser's `speechSynthesis`, honoring the pack's
 * `TtsVoiceSpec` (lang/rate/pitch + preferred voice). Degrades to a no-op
 * where `speechSynthesis` is absent (e.g. happy-dom, older browsers).
 */

import type { AudioPort, TtsVoiceSpec } from "@tsumugu/engine";

/** Pick the best-matching voice for a spec, by voiceURI then lang prefix. */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  spec?: TtsVoiceSpec,
): SpeechSynthesisVoice | undefined {
  if (!spec) return undefined;
  if (spec.voiceURI) {
    const byUri = voices.find((v) => v.voiceURI === spec.voiceURI);
    if (byUri) return byUri;
  }
  if (spec.lang) {
    const lang = spec.lang.toLowerCase();
    // Exact lang match first, then a primary-subtag (e.g. "zh") match.
    const exact = voices.find((v) => v.lang.toLowerCase() === lang);
    if (exact) return exact;
    const primary = lang.split("-")[0];
    if (primary) {
      const loose = voices.find((v) =>
        v.lang.toLowerCase().startsWith(primary),
      );
      if (loose) return loose;
    }
  }
  return undefined;
}

/**
 * Build an `AudioPort` over `speechSynthesis`. Returns a no-op port when the
 * Web Speech API is unavailable so callers never need to feature-detect.
 */
export function createWebAudio(): AudioPort {
  if (typeof speechSynthesis === "undefined") {
    return { speak: () => {}, stop: () => {} };
  }

  return {
    speak(text: string, voice?: TtsVoiceSpec): void {
      const utter = new SpeechSynthesisUtterance(text);
      if (voice?.lang) utter.lang = voice.lang;
      if (voice?.rate !== undefined) utter.rate = voice.rate;
      if (voice?.pitch !== undefined) utter.pitch = voice.pitch;
      const match = pickVoice(speechSynthesis.getVoices(), voice);
      if (match) utter.voice = match;
      speechSynthesis.speak(utter);
    },
    stop(): void {
      speechSynthesis.cancel();
    },
  };
}
