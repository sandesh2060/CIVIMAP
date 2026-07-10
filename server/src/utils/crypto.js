// ========================================================================
// FILE : server/src/utils/crypto.js
// ========================================================================

const crypto = require("crypto");

/** Generates a URL-safe random token (hex) of the given byte length. */
function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

/** SHA-256 hash — used to store tokens (password reset, refresh, etc.) at rest. */
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Generates a short numeric code, e.g. for phone/SMS verification. */
function generateNumericCode(length = 6) {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += digits[crypto.randomInt(0, digits.length)];
  }
  return code;
}

/** Constant-time string comparison to avoid timing attacks on token checks. */
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { generateRandomToken, sha256, generateNumericCode, safeCompare };