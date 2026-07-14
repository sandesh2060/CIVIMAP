// file: client/src/utils/voice.js
//
// Plays turn-by-turn instructions using server-generated neural speech
// (Kokoro for English, Piper for Nepali — see ai-service/routes/tts.py)
// instead of the browser's SpeechSynthesis API. Browser TTS quality
// depends entirely on whatever voices happen to be installed on the
// user's device — this sidesteps that by generating consistent,
// near-human audio server-side for every user regardless of device.
//
// Kept as a module-level singleton (one shared <audio> element) rather
// than something instantiated per-component, for the same reasons as
// before: muting must work instantly mid-utterance, and nothing should
// double-speak if NavigationView re-renders.

// Point this at your ai-service, not the Node/Express backend — TTS is
// served directly by FastAPI. Override via client/.env:
//   VITE_AI_SERVICE_URL=https://your-ai-service.example.com
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8000";

let enabled = true;
let unlocked = false; // has a user gesture unlocked audio playback yet?
const player = typeof window !== "undefined" ? new Audio() : null;

// Every time we point `player` at a new source (priming clip OR a real
// instruction) we bump this token and stamp the pending operation with
// it. When an async callback (a play() promise resolving, an unlock
// finishing) fires later, it only acts if its token still matches the
// current one. This is what prevents primeVoice()'s unlock — which can
// still be in flight when the first real speak() call fires a moment
// later — from reaching into the audio element and pausing/muting the
// real instruction that has since started playing.
let playToken = 0;

// A ~0.1s silent WAV, inlined as a data URI. primeVoice() plays this
// instead of hitting the AI service with a throwaway request — unlocking
// autoplay only needs *a* successful play() call, not real audio, and
// keeping this local means priming can never fail because of a server
// hiccup (empty-text synthesis errors, cold-start latency, etc.).
const SILENCE_DATA_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function isVoiceSupported() {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

export function setVoiceEnabled(next) {
  enabled = next;
  if (!next) stopSpeaking();
}

export function isVoiceEnabled() {
  return enabled;
}

function ttsUrl(text, lang) {
  const params = new URLSearchParams({ text, lang });
  return `${AI_SERVICE_URL}/tts?${params.toString()}`;
}

/**
 * Must be called synchronously inside a real user-gesture handler (a
 * button's onClick — not from a timer, a geolocation callback, or any
 * other async code). Mobile Safari and some Android browsers refuse to
 * play any audio on a page until playback has first been triggered
 * directly inside a click. A near-silent play/pause is enough to
 * "unlock" it for the rest of the page's lifetime, after which async
 * speak() calls (like the ones fired from GPS updates during
 * navigation) work normally.
 *
 * Uses a local silent clip (not the AI service) so priming can't fail
 * due to a server-side synthesis error, and is token-guarded so it can
 * never pause/mute audio that a real speak() call has since started —
 * see the `playToken` comment above.
 */
export function primeVoice() {
  if (!isVoiceSupported() || unlocked) return;
  const myToken = ++playToken;
  try {
    player.muted = true;
    player.src = SILENCE_DATA_URI;
    const playPromise = player.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          if (playToken !== myToken) return; // a real speak() has since taken over
          player.pause();
          player.muted = false;
          unlocked = true;
        })
        .catch(() => {
          // best-effort — if this fails, the first real speak() call
          // will still attempt playback and may just be silently
          // blocked on very restrictive browsers
          if (playToken === myToken) player.muted = false;
        });
    } else {
      unlocked = true;
    }
  } catch {
    // best-effort, same as above
  }
}

/**
 * Speaks `text` in the given app language ("en" | "ne"), cancelling
 * anything currently playing first. Cancelling on every call is
 * intentional: nav instructions are time-sensitive ("turn right in
 * 50m"), so an instruction still playing when a newer one fires should
 * be interrupted, not queued behind it.
 *
 * Playback rate is always 1 — pacing (e.g. Nepali reading a touch
 * slower) is controlled server-side via Piper's `length_scale` at
 * synthesis time (see ai-service/routes/tts.py), not by stretching the
 * finished waveform with the <audio> element's playbackRate. Post-hoc
 * time-stretching a neural TTS clip can introduce a faint warble/graininess
 * that the model's own native pacing doesn't have — audible enough on
 * Nepali that it was worth moving upstream.
 */
export function speak(text, appLang = "en") {
  if (!enabled || !text || !isVoiceSupported()) return;

  const myToken = ++playToken; // supersedes primeVoice() and any prior speak()
  unlocked = true; // a real speak() call is itself proof audio is usable

  player.pause();
  player.currentTime = 0;
  player.muted = false;
  player.playbackRate = 1;
  player.src = ttsUrl(text.trim(), appLang);

  const playPromise = player.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch((err) => {
      if (playToken !== myToken) return; // superseded by a newer instruction — not a real failure
      // Autoplay can still be blocked if primeVoice() was never called
      // from a click, or the network request failed — fail silently
      // rather than throwing during navigation.
      console.warn("voice: playback failed", err);
    });
  }
}

export function stopSpeaking() {
  if (!isVoiceSupported()) return;
  playToken++; // invalidate any in-flight play()/prime callbacks
  player.pause();
  player.currentTime = 0;
}

export default { isVoiceSupported, setVoiceEnabled, isVoiceEnabled, primeVoice, speak, stopSpeaking };