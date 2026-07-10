// ========================================================================
// FILE : server/src/models/admin/Admin.js
// ========================================================================


const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const { Schema } = mongoose;
const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

/* ------------------------------------------------------------------ */
/*  Admin schema — independent collection from citizen Users.          */
/*  Separated because admins need different fields (department,       */
/*  permissions, audit trail) and should never be reachable through     */
/*  citizen-facing auth flows (register/login/reset).                   */
/* ------------------------------------------------------------------ */

const AdminSchema = new Schema(
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
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, "Invalid phone number format"],
      default: null,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    profileImage: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    /* ---------- Role & permissions ---------- */
    role: {
      type: String,
      enum: ["admin", "superadmin"],
      default: "admin",
    },
    department: {
      type: String,
      enum: ["traffic", "public_works", "general", "it"],
      default: "general",
    },
    employeeId: { type: String, trim: true, default: null, unique: true, sparse: true },
    // Fine-grained permission flags so a "superadmin" can restrict what a
    // regular admin sees, without needing more role enum values later.
    permissions: {
      canReviewReports: { type: Boolean, default: true },
      canReviewViolations: { type: Boolean, default: true },
      canManagePlaces: { type: Boolean, default: true },
      canManageSignals: { type: Boolean, default: false },
      canManageAdmins: { type: Boolean, default: false },
    },

    /* ---------- Status ---------- */
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null }, // audit: which admin created this account

    /* ---------- Security (mirrors User.js pattern) ---------- */
    passwordChangedAt: { type: Date, default: null },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },

    /* ---------- Activity log (lightweight audit trail) ---------- */
    activityLog: {
      type: [
        {
          action: { type: String }, // e.g. "report_approved", "violation_confirmed"
          targetId: { type: Schema.Types.ObjectId },
          targetModel: { type: String, enum: ["Report", "Violation", "Place"] },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ------------------------------------------------------------------ */
/*  Indexes                                                             */
/* ------------------------------------------------------------------ */

AdminSchema.index({ isActive: 1, isDeleted: 1 });

/* ------------------------------------------------------------------ */
/*  Virtuals                                                            */
/* ------------------------------------------------------------------ */

AdminSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

AdminSchema.virtual("isSuperAdmin").get(function () {
  return this.role === "superadmin";
});

/* ------------------------------------------------------------------ */
/*  Hooks                                                               */
/* ------------------------------------------------------------------ */

AdminSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();
  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
    if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
    next();
  } catch (err) {
    next(err);
  }
});

// Superadmins implicitly get every permission — keeps permission checks
// in controllers simple ("if (!admin.permissions.canX) return 403").
AdminSchema.pre("save", function (next) {
  if (this.role === "superadmin") {
    Object.keys(this.permissions).forEach((key) => {
      this.permissions[key] = true;
    });
  }
  next();
});

/* ------------------------------------------------------------------ */
/*  Instance methods                                                    */
/* ------------------------------------------------------------------ */

AdminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

AdminSchema.methods.changedPasswordAfter = function (jwtIssuedAtSeconds) {
  if (!this.passwordChangedAt) return false;
  const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return jwtIssuedAtSeconds < changedTimestamp;
};

AdminSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  return rawToken;
};

AdminSchema.methods.registerFailedLogin = async function () {
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

AdminSchema.methods.registerSuccessfulLogin = async function (ip) {
  this.loginAttempts = 0;
  this.lockUntil = null;
  this.lastLoginAt = new Date();
  this.lastLoginIp = ip || null;
  await this.save({ validateBeforeSave: false });
};

AdminSchema.methods.logActivity = async function (action, targetId, targetModel) {
  this.activityLog.unshift({ action, targetId, targetModel, at: new Date() });
  // Keep the embedded log bounded — full history belongs in a proper audit
  // collection/log aggregator if you need it later, not an ever-growing array.
  if (this.activityLog.length > 200) this.activityLog = this.activityLog.slice(0, 200);
  await this.save({ validateBeforeSave: false });
};

AdminSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isActive = false;
  await this.save({ validateBeforeSave: false });
};

/* ------------------------------------------------------------------ */
/*  Statics                                                             */
/* ------------------------------------------------------------------ */

AdminSchema.statics.findActiveByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase(), isDeleted: false }).select(
    "+passwordHash"
  );
};

AdminSchema.query.activeOnly = function () {
  return this.where({ isDeleted: false, isActive: true });
};

module.exports = mongoose.model("Admin", AdminSchema);