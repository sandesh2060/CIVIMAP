// file: client/src/utils/voice.js
// Minimal wrapper around the browser's SpeechSynthesis API for spoken
// turn-by-turn instructions, in English or Nepali. Kept as a tiny
// module-level singleton (rather than something instantiated per-component)
// so muting works instantly even mid-utterance, and so nothing double-speaks
// if NavigationView happens to re-render.

let enabled = true;
let cachedVoices = [];
let pendingSpeakTimer = null;

export function isVoiceSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function refreshVoices() {
  if (isVoiceSupported()) cachedVoices = window.speechSynthesis.getVoices();
}

if (isVoiceSupported()) {
  refreshVoices();
  // Chrome (and some others) load the voice list asynchronously — this
  // fires once it's actually populated, so the very first speak() call
  // after a page load doesn't miss an installed Nepali/Hindi voice just
  // because the list wasn't ready yet.
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

export function setVoiceEnabled(next) {
  enabled = next;
  if (!next && isVoiceSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function isVoiceEnabled() {
  return enabled;
}

// App language ("en" | "ne") -> BCP-47 tag to request, plus an ordered list
// of locale prefixes to search installed voices for. Most devices don't
// ship a dedicated Nepali voice, so "ne" falls back to Hindi (hi-IN) as the
// closest widely-available voice that actually reads Devanagari script
// correctly. Actual pronunciation quality is entirely dependent on what
// voices are installed on the user's OS/browser — this code can only pick
// the best match among what's already installed, not improve on it.
const LANG_PROFILES = {
  en: { tag: "en-US", search: ["en-US", "en-GB", "en-IN", "en"] },
  ne: { tag: "ne-NP", search: ["ne-NP", "ne", "hi-IN", "hi"] },
};

function pickVoice(appLang) {
  const profile = LANG_PROFILES[appLang] || LANG_PROFILES.en;
  for (const prefix of profile.search) {
    const match = cachedVoices.find((v) => v.lang?.toLowerCase().startsWith(prefix.toLowerCase()));
    if (match) return match;
  }
  return null;
}

/**
 * Must be called synchronously inside a real user-gesture handler (a
 * button's onClick — not from a timer, a geolocation callback, or any
 * other async code). Some browsers, especially mobile Safari, refuse to
 * ever start speaking on a page unless speechSynthesis was first invoked
 * directly inside a click. A near-silent utterance is enough to "unlock"
 * it for the rest of the page's lifetime, after which async speak() calls
 * (like the ones fired from GPS updates during navigation) work normally.
 */
export function primeVoice() {
  if (!isVoiceSupported()) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0.01;
    window.speechSynthesis.speak(u);
  } catch {
    // best-effort — if this throws, speak() will still be attempted later
  }
}

/**
 * Speaks `text` in the given app language ("en" | "ne"), cancelling
 * anything currently queued/speaking first. Cancelling on every call is
 * intentional: nav instructions are time-sensitive ("turn right in 50m"),
 * so an instruction that's still being read when a newer one fires should
 * be dropped, not queued behind it.
 *
 * The short setTimeout before the actual speak() call works around a
 * long-standing Chrome/Chromium bug: calling cancel() and speak() back to
 * back in the same synchronous tick silently drops the new utterance —
 * nothing gets spoken and no error is thrown. Deferring speak() by a beat
 * avoids it.
 */
export function speak(text, appLang = "en") {
  if (!enabled || !text || !isVoiceSupported()) return;

  if (pendingSpeakTimer) clearTimeout(pendingSpeakTimer);
  refreshVoices(); // pick up a voice list that may have finished loading since last call
  window.speechSynthesis.cancel();

  pendingSpeakTimer = setTimeout(() => {
    const profile = LANG_PROFILES[appLang] || LANG_PROFILES.en;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = profile.tag;
    const voice = pickVoice(appLang);
    if (voice) utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, 60);
}

export function stopSpeaking() {
  if (pendingSpeakTimer) clearTimeout(pendingSpeakTimer);
  if (isVoiceSupported()) window.speechSynthesis.cancel();
}

export default { isVoiceSupported, setVoiceEnabled, isVoiceEnabled, primeVoice, speak, stopSpeaking };