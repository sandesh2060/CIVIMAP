// ========================================================================
// FILE : server/src/models/RefreshToken.js
// ========================================================================



const mongoose = require("mongoose");
const crypto = require("crypto");

const { Schema } = mongoose;

/* ------------------------------------------------------------------ */
/*  RefreshToken                                                        */
/*  Stores hashed refresh tokens (never the raw token) for both         */
/*  citizens and admins, with rotation support: each refresh issues a   */
/*  new token and marks the old one as replaced, rather than reused.    */
/* ------------------------------------------------------------------ */

const RefreshTokenSchema = new Schema(
  {
    // Works for either account type — set ownerModel accordingly.
    owner: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "ownerModel",
      index: true,
    },
    ownerModel: {
      type: String,
      required: true,
      enum: ["User", "Admin"],
    },

    // SHA-256 hash of the raw token — the raw value is only ever sent to
    // the client as an httpOnly cookie, never stored in plaintext here.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index — Mongo auto-deletes once expiresAt passes
    },

    createdByIp: { type: String, default: null },
    userAgent: { type: String, default: null },
    deviceId: { type: String, default: null },

    revokedAt: { type: Date, default: null },
    revokedByIp: { type: String, default: null },
    replacedByTokenHash: { type: String, default: null }, // rotation chain
  },
  { timestamps: true }
);

/* ------------------------------------------------------------------ */
/*  Virtuals                                                            */
/* ------------------------------------------------------------------ */

RefreshTokenSchema.virtual("isExpired").get(function () {
  return Date.now() >= this.expiresAt.getTime();
});

RefreshTokenSchema.virtual("isActive").get(function () {
  return !this.revokedAt && !this.isExpired;
});

/* ------------------------------------------------------------------ */
/*  Statics                                                             */
/* ------------------------------------------------------------------ */

RefreshTokenSchema.statics.hashToken = function (rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};

// Issues a brand-new refresh token for a citizen or admin. Returns the
// RAW token (send to client) — only the hash is persisted.
RefreshTokenSchema.statics.issue = async function ({
  ownerId,
  ownerModel,
  ttlMs = 7 * 24 * 60 * 60 * 1000, // 7 days
  ip,
  userAgent,
  deviceId,
}) {
  const rawToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = this.hashToken(rawToken);

  await this.create({
    owner: ownerId,
    ownerModel,
    tokenHash,
    expiresAt: new Date(Date.now() + ttlMs),
    createdByIp: ip,
    userAgent,
    deviceId,
  });

  return rawToken;
};

// Verifies a raw token, rotates it (revokes old, issues new), and
// returns { owner, ownerModel, newRawToken } or null if invalid/expired.
RefreshTokenSchema.statics.rotate = async function (rawToken, { ip, userAgent, deviceId } = {}) {
  const tokenHash = this.hashToken(rawToken);
  const existing = await this.findOne({ tokenHash });

  if (!existing || !existing.isActive) return null;

  const newRawToken = crypto.randomBytes(40).toString("hex");
  const newTokenHash = this.hashToken(newRawToken);

  existing.revokedAt = new Date();
  existing.revokedByIp = ip || null;
  existing.replacedByTokenHash = newTokenHash;
  await existing.save();

  await this.create({
    owner: existing.owner,
    ownerModel: existing.ownerModel,
    tokenHash: newTokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdByIp: ip,
    userAgent,
    deviceId,
  });

  return { owner: existing.owner, ownerModel: existing.ownerModel, newRawToken };
};

// Revokes a single token (logout) — pass the raw token from the cookie.
RefreshTokenSchema.statics.revoke = async function (rawToken, ip) {
  const tokenHash = this.hashToken(rawToken);
  return this.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { revokedAt: new Date(), revokedByIp: ip || null }
  );
};

// Revokes every active token for an owner — "log out of all devices".
RefreshTokenSchema.statics.revokeAllForOwner = async function (ownerId, ownerModel) {
  return this.updateMany(
    { owner: ownerId, ownerModel, revokedAt: null },
    { revokedAt: new Date() }
  );
};

module.exports = mongoose.model("RefreshToken", RefreshTokenSchema);