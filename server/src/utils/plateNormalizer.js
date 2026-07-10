// ========================================================================
// FILE : server/src/utils/plateNormalizer.js
// ========================================================================
//
// The plate OCR pipeline (ai-service) returns Devanagari script/digits,
// since that's what's actually printed on Nepali plates. Registry lookups
// need a script-independent key to compare against, otherwise a perfectly
// correct OCR read will never match a Latin-script seed record (or vice
// versa). This module is the single place that conversion happens — don't
// duplicate the mapping elsewhere (MockVehicleRegistry.js previously had
// its own separate normalizer that didn't convert digits at all — removed,
// see MockVehicleRegistry.js for the fix).

const DEVANAGARI_TO_LATIN_DIGITS = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

/**
 * Converts any Devanagari digits in a string to Latin digits. Leaves
 * everything else (letters, spaces, punctuation) untouched.
 */
function devanagariDigitsToLatin(text) {
  if (!text) return text;
  return text
    .split("")
    .map((ch) => DEVANAGARI_TO_LATIN_DIGITS[ch] || ch)
    .join("");
}

/**
 * Produces a canonical matching key from a FULL plate string, regardless
 * of source script: strips whitespace/punctuation, converts digits to
 * Latin, uppercases any Latin letters already present. Devanagari LETTERS
 * (province/category, e.g. "बा", "च") are intentionally left as-is.
 *
 * NOTE: this is for matching two FULL plate strings against each other.
 * It is NOT sufficient on its own for matching an isolated digit tail
 * against a full stored plate string — for that, use extractDigitTail()
 * on both sides instead (see below). This was the second half of the
 * registry-matching bug: plateNumberDigits ("7453") was never going to
 * equal normalizePlateKey("बा ७० प ७४५३") ("बा70प7453") even after digit
 * conversion, because one is a bare key and the other still has the
 * province/category text attached.
 */
function normalizePlateKey(text) {
  if (!text) return "";
  return devanagariDigitsToLatin(text)
    .replace(/[\s.\-]/g, "")
    .toUpperCase();
}

/**
 * Extracts just the trailing digit group (3-4 digits) from a plate string
 * and returns it as Latin digits. This is the actual stable identifier
 * for a Nepali plate — province/category text varies too much in
 * formatting to be a reliable match key, but the digit tail doesn't.
 *
 * Use this on BOTH sides of a registry lookup:
 *   - AI service's plateNumberDigits (already isolated, but still may be
 *     in Devanagari — this converts it to Latin)
 *   - MockVehicleRegistry.plateNumber (full string — this pulls out just
 *     the tail before comparing)
 *
 * Returns null if no 3-4 digit trailing group is found.
 */
function extractDigitTail(text) {
  if (!text) return null;
  const latinDigitsOnly = devanagariDigitsToLatin(text).replace(/[^0-9]/g, "");
  const match = latinDigitsOnly.match(/\d{3,4}$/);
  return match ? match[0] : null;
}

module.exports = { devanagariDigitsToLatin, normalizePlateKey, extractDigitTail };