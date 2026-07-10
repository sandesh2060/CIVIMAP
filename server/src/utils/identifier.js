// ========================================================================
// FILE : server/src/utils/identifier.js
// ========================================================================

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

function detectIdentifierType(identifier) {
  if (EMAIL_REGEX.test(identifier)) return "email";
  if (PHONE_REGEX.test(identifier)) return "phone";
  return null;
}

// Normalizes a phone number to E.164 with Nepal's +977 country code.
// Bare 10-digit local numbers (98xxxxxxxx, 97xxxxxxxx) get +977 prefixed;
// numbers that already start with + are left as-is (in case a future
// citizen has a non-Nepal number in the registry).
function normalizePhone(rawPhone) {
  const trimmed = rawPhone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  if (/^[0-9]{10}$/.test(trimmed)) return `+977${trimmed}`;
  return trimmed; // leave anything unrecognized untouched — validator will reject it
}

// Normalizes whatever the login form submitted into the exact form
// stored in the User collection: lowercase-trimmed email, or E.164 phone.
// Returns { type: "email" | "phone" | null, value: string }.
function normalizeIdentifier(rawIdentifier) {
  const trimmed = rawIdentifier.trim();

  if (EMAIL_REGEX.test(trimmed)) {
    return { type: "email", value: trimmed.toLowerCase() };
  }

  const normalizedPhone = normalizePhone(trimmed);
  if (PHONE_REGEX.test(normalizedPhone)) {
    return { type: "phone", value: normalizedPhone };
  }

  return { type: null, value: trimmed };
}

module.exports = {
  detectIdentifierType,
  normalizePhone,
  normalizeIdentifier,
  EMAIL_REGEX,
  PHONE_REGEX,
};