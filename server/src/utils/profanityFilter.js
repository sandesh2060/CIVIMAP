// ========================================================================
// FILE : server/src/utils/profanityFilter.js  (NEW)
// ========================================================================
// Lightweight blocklist filter for comment bodies (English + romanized/
// Devanagari Nepali). Extend WORDLIST as needed — swap for a proper
// library (e.g. `bad-words`) or a moderation API later if this proves
// too easy to bypass with leetspeak/spacing tricks.
const WORDLIST = [
  "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "whore",
  "randi", "madarchod", "behenchod", "chutiya", "gandu", "harami",
  "रन्डी", "मादरचोद", "बहनचोद", "चुतिया",
];

const PATTERN = new RegExp(
  `\\b(${WORDLIST.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "iu"
);

function containsProfanity(text) {
  return !!text && PATTERN.test(text);
}

module.exports = { containsProfanity };