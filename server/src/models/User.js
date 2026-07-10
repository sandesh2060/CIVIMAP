// ========================================================================
// FILE : server/src/models/User.js
// ========================================================================

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { normalizeIdentifier } = require("../utils/identifier");

const { Schema } = mongoose;
const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

/* ------------------------------------------------------------------ */
/*  Sub-schemas                                                        */
/* ------------------------------------------------------------------ */

const AddressSchema = new Schema(
  {
    province: { type: String, trim: true },
    district: { type: String, trim: true },
    municipality: { type: String, trim: true },
    wardNo: { type: Number, min: 1 },
    street: { type: String, trim: true },
  },
  { _id: false }
);

const NotificationPrefsSchema = new Schema(
  {
    email: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
  },
  { _id: false }
);

// Tracks devices/sessions a citizen has logged in from — useful for
// "log out of all devices" and suspicious-login detection later.
const DeviceSessionSchema = new Schema(
  {
    deviceId: { type: String },
    userAgent: { type: String },
    ip: { type: String },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* ------------------------------------------------------------------ */
/*  Main Citizen (User) schema                                         */
/*  NOTE: this collection is citizen-only. Admins live in               */
/*  models/admin/Admin.js as a separate collection with their own       */
/*  auth/security fields — do not add role:"admin" here.                */
/*                                                                       */
/*  Citizen records are sourced from the national registry (not         */
/*  self-registration), and login is OTP-only — see loginOtp* fields    */
/*  below. passwordHash is kept but optional, in case it's needed for   */
/*  a legacy/admin-assisted path later; it is never required for        */
/*  citizen login.                                                      */
/* ------------------------------------------------------------------ */

const UserSchema = new Schema(
  {
    /* ---------- Identity ---------- */
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
      index: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, "Invalid phone number format"],
    },
    passwordHash: {
      type: String,
      required: false, // citizens log in via OTP; no password is set for them
      select: false, // never returned by default queries
    },
    profileImage: {
      url: { type: String, default: null }, // Cloudinary URL
      publicId: { type: String, default: null },
    },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },
    citizenshipNumber: { type: String, trim: true, default: null }, // optional, sensitive — confirm you need this before storing

    /* ---------- Location ---------- */
    address: { type: AddressSchema, default: () => ({}) },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },

    /* ---------- Account type & status ---------- */
    // Fixed to "citizen" — this collection never holds admins.
    role: { type: String, default: "citizen", immutable: true },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    bannedAt: { type: Date, default: null },

    /* ---------- Verification ---------- */
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    phoneVerificationCode: { type: String, select: false },
    phoneVerificationExpires: { type: Date, select: false },

    /* ---------- Security ---------- */
    passwordChangedAt: { type: Date, default: null },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
    sessions: { type: [DeviceSessionSchema], default: [] },

    /* ---------- Login OTP (primary auth path for citizens) ---------- */
    // Hash only — the raw 6-digit code is never persisted, only sent via
    // email or WhatsApp. loginAttempts/lockUntil above are reused for OTP
    // brute-force lockout rather than adding a parallel counter.
    loginOtpHash: { type: String, select: false, default: null },
    loginOtpExpires: { type: Date, select: false, default: null },
    loginOtpLastSentAt: { type: Date, select: false, default: null },

    /* ---------- Preferences ---------- */
    languagePref: { type: String, enum: ["en", "ne"], default: "en" },
    notificationPrefs: {
      type: NotificationPrefsSchema,
      default: () => ({}),
    },
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },

    /* ---------- Civic engagement stats ---------- */
    stats: {
      reportsSubmitted: { type: Number, default: 0 },
      reportsApproved: { type: Number, default: 0 },
      reportsRejected: { type: Number, default: 0 },
      violationsSubmitted: { type: Number, default: 0 },
      violationsConfirmed: { type: Number, default: 0 },
      violationsRejected: { type: Number, default: 0 },
    },
    // Rises with approved reports/confirmed violations, falls with
    // rejected/spammy ones. Foundation for auto-trusting reliable
    // reporters later (skip AI review sooner) or flagging serial abusers.
    trustScore: { type: Number, default: 50, min: 0, max: 100 },

    /* ---------- Soft delete ---------- */
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ------------------------------------------------------------------ */
/*  Indexes                                                             */
/* ------------------------------------------------------------------ */

UserSchema.index({ location: "2dsphere" });
UserSchema.index({ fullName: "text", email: "text" });
UserSchema.index({ isActive: 1, isBanned: 1 });

/* ------------------------------------------------------------------ */
/*  Virtuals (relations — populate on demand, not embedded)            */
/* ------------------------------------------------------------------ */

UserSchema.virtual("reports", {
  ref: "Report",
  localField: "_id",
  foreignField: "reportedBy",
});

UserSchema.virtual("violations", {
  ref: "Violation",
  localField: "_id",
  foreignField: "reportedBy",
});

UserSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

/* ------------------------------------------------------------------ */
/*  Hooks                                                               */
/* ------------------------------------------------------------------ */

UserSchema.pre("save", async function (next) {
  // Guard against hashing undefined — passwordHash is optional now that
  // citizens authenticate via OTP instead of a password.
  if (!this.isModified("passwordHash") || !this.passwordHash) return next();

  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
    // Skip on brand-new docs so login isn't rejected for "changed after token issued"
    if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
    next();
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/*  Instance methods                                                    */
/* ------------------------------------------------------------------ */

UserSchema.methods.comparePassword = async function (candidatePassword) {
  // Requires passwordHash to have been explicitly selected in the query:
  // User.findOne({ email }).select("+passwordHash")
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

UserSchema.methods.changedPasswordAfter = function (jwtIssuedAtSeconds) {
  if (!this.passwordChangedAt) return false;
  const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return jwtIssuedAtSeconds < changedTimestamp;
};

UserSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return rawToken; // send this unhashed version to the user via email
};

UserSchema.methods.createEmailVerificationToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h
  return rawToken;
};

// Generates a new 6-digit login OTP, hashes it for storage, and returns
// the raw code so the caller can send it via email or WhatsApp. Never
// call this without immediately dispatching the returned code — it is
// not retrievable once this method returns.
UserSchema.methods.createLoginOtp = function () {
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  this.loginOtpHash = crypto.createHash("sha256").update(code).digest("hex");
  this.loginOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 min
  this.loginOtpLastSentAt = new Date();
  return code;
};

// Constant-time comparison against the stored OTP hash. Returns false
// if there's no active OTP or it has expired.
UserSchema.methods.compareLoginOtp = function (candidateCode) {
  if (!this.loginOtpHash || !this.loginOtpExpires) return false;
  if (this.loginOtpExpires.getTime() < Date.now()) return false;

  const candidateHash = crypto.createHash("sha256").update(candidateCode).digest("hex");
  const a = Buffer.from(candidateHash);
  const b = Buffer.from(this.loginOtpHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Call after a successful verify (or when issuing a fresh OTP) so a
// used or superseded code can never be replayed.
UserSchema.methods.clearLoginOtp = async function () {
  this.loginOtpHash = null;
  this.loginOtpExpires = null;
  await this.save({ validateBeforeSave: false });
};

UserSchema.methods.registerFailedLogin = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil = null;
  } else {
    this.loginAttempts += 1;
    if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      this.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
    }
  }
  await this.save({ validateBeforeSave: false });
};

UserSchema.methods.registerSuccessfulLogin = async function (ip, deviceId, userAgent) {
  this.loginAttempts = 0;
  this.lockUntil = null;
  this.lastLoginAt = new Date();
  this.lastLoginIp = ip || null;

  if (deviceId) {
    const existing = this.sessions.find((s) => s.deviceId === deviceId);
    if (existing) {
      existing.lastUsedAt = new Date();
      existing.ip = ip;
      existing.userAgent = userAgent;
    } else {
      this.sessions.push({ deviceId, ip, userAgent, lastUsedAt: new Date() });
    }
  }
  await this.save({ validateBeforeSave: false });
};

// Call after a report/violation is resolved to keep trust score current.
UserSchema.methods.adjustTrustScore = async function (delta) {
  this.trustScore = Math.min(100, Math.max(0, this.trustScore + delta));
  await this.save({ validateBeforeSave: false });
};

UserSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isActive = false;
  await this.save({ validateBeforeSave: false });
};

/* ------------------------------------------------------------------ */
/*  Static / query helpers                                             */
/* ------------------------------------------------------------------ */

UserSchema.statics.findActiveByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase(), isDeleted: false }).select(
    "+passwordHash"
  );
};

// Looks a citizen up by either email or phone, auto-detecting which one
// was given, and pre-selects the OTP + lockout fields needed by the
// login flow (all `select: false` by default).
UserSchema.statics.findActiveByIdentifier = function (identifier) {
  const { type, value } = normalizeIdentifier(identifier);
  const query =
    type === "email"
      ? { email: value, isDeleted: false }
      : { phone: value, isDeleted: false };

  return this.findOne(query).select(
    "+loginOtpHash +loginOtpExpires +loginOtpLastSentAt +loginAttempts +lockUntil"
  );
};

UserSchema.statics.findNearby = function (lng, lat, maxDistanceMeters = 5000) {
  return this.find({
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: maxDistanceMeters,
      },
    },
    isDeleted: false,
  });
};

// Excludes soft-deleted, banned, or inactive citizens from default listings.
UserSchema.query.activeOnly = function () {
  return this.where({ isDeleted: false, isBanned: false, isActive: true });
};

module.exports = mongoose.model("User", UserSchema);