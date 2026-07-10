// ========================================================================
// FILE : server/src/services/tokenService.js
// ========================================================================

const { generateAccessToken, verifyAccessToken } = require("../utils/tokens");
const RefreshToken = require("../models/RefreshToken");
const { env } = require("../config/env");

/**
 * Issues a fresh access + refresh token pair for a citizen or admin.
 * The raw refresh token is meant to be set as an httpOnly cookie by the
 * caller (authController) — never returned in a JSON body.
 */
async function issueTokenPair({ id, accountType, ip, userAgent, deviceId }) {
  const accessToken = generateAccessToken({ id, accountType });
  const refreshToken = await RefreshToken.issue({
    ownerId: id,
    ownerModel: accountType === "admin" ? "Admin" : "User",
    ttlMs: env.REFRESH_TOKEN_TTL_MS,
    ip,
    userAgent,
    deviceId,
  });
  return { accessToken, refreshToken };
}

/**
 * Rotates a refresh token: validates it, revokes it, issues a new
 * refresh token + a new access token. Returns null if the token was
 * invalid, expired, or already revoked (possible replay attack).
 */
async function refreshTokenPair(rawRefreshToken, { ip, userAgent, deviceId } = {}) {
  const rotated = await RefreshToken.rotate(rawRefreshToken, { ip, userAgent, deviceId });
  if (!rotated) return null;

  const accountType = rotated.ownerModel === "Admin" ? "admin" : "citizen";
  const accessToken = generateAccessToken({ id: rotated.owner, accountType });

  return { accessToken, refreshToken: rotated.newRawToken, accountType, ownerId: rotated.owner };
}

async function revokeRefreshToken(rawRefreshToken, ip) {
  return RefreshToken.revoke(rawRefreshToken, ip);
}

async function revokeAllSessions(ownerId, accountType) {
  return RefreshToken.revokeAllForOwner(ownerId, accountType === "admin" ? "Admin" : "User");
}

module.exports = {
  issueTokenPair,
  refreshTokenPair,
  revokeRefreshToken,
  revokeAllSessions,
  verifyAccessToken,
};