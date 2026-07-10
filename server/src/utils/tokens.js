// ========================================================================
// FILE : server/src/utils/tokens.js
// ========================================================================

const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

/**
 * Access tokens are short-lived JWTs carrying { sub, accountType }.
 * accountType is "citizen" | "admin" so middleware/auth.js knows which
 * Mongoose model to load the account from.
 */
function generateAccessToken({ id, accountType }) {
  return jwt.sign({ sub: id, accountType }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL || "15m",
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET); // throws on invalid/expired
}

module.exports = { generateAccessToken, verifyAccessToken };