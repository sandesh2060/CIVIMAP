// ========================================================================
// FILE : server/src/models/Violation.js
// ========================================================================

const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ------------------------------------------------------------------ */
/*  Violation — citizen-submitted traffic violations, AI plate         */
/*  detection + mock registry lookup + owner/admin notification         */
/* ------------------------------------------------------------------ */

const MatchedOwnerSchema = new Schema(
  {
    name: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    vehicleType: { type: String, default: null },
  },
  { _id: false }
);

const ViolationSchema = new Schema(
  {
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    imageUrl: { type: String, required: [true, "Photo is required"] },
    imagePublicId: { type: String, default: null },
    croppedPlateImageUrl: { type: String, default: null }, // AI-cropped plate region

    violationType: {
      type: String,
      enum: [
        "red_light",
        "no_parking",
        "wrong_lane",
        "no_helmet",
        "over_speeding",
        "other",
      ],
      default: "other",
    },

    /* ---------- AI plate detection ---------- */
    extractedPlateNumber: { type: String, default: null, trim: true, uppercase: true },
    aiConfidence: { type: Number, min: 0, max: 1, default: null },
    aiProcessedAt: { type: Date, default: null },
    aiError: { type: String, default: null },

    /* ---------- Registry match ---------- */
    matchedOwner: { type: MatchedOwnerSchema, default: null },
    matchedRegistryId: {
      type: Schema.Types.ObjectId,
      ref: "MockVehicleRegistry",
      default: null,
    },

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    address: { type: String, default: null },

    /* ---------- Status & notification ---------- */
    status: {
      type: String,
      enum: ["detected", "notified", "flagged", "reviewed", "rejected"],
      default: "detected",
      index: true,
    },
    notifiedAt: { type: Date, default: null },
    notificationChannels: {
      ownerEmail: { type: Boolean, default: false },
      ownerWhatsapp: { type: Boolean, default: false },
      adminEmail: { type: Boolean, default: false },
      adminWhatsapp: { type: Boolean, default: false },
      adminPush: { type: Boolean, default: false },
    },

    /* ---------- Admin review (required whenever low confidence / no match) ---------- */
    adminReviewedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------------ */
/*  Indexes                                                             */
/* ------------------------------------------------------------------ */

ViolationSchema.index({ location: "2dsphere" });
ViolationSchema.index({ status: 1, createdAt: -1 });
ViolationSchema.index({ reportedBy: 1, createdAt: -1 });
ViolationSchema.index({ extractedPlateNumber: 1 });

/* ------------------------------------------------------------------ */
/*  Instance methods                                                    */
/* ------------------------------------------------------------------ */

// Called after the AI service + registry lookup succeed with high confidence.
ViolationSchema.methods.markNotified = async function () {
  this.status = "notified";
  this.notifiedAt = new Date();
  this.notificationChannels = {
    ownerEmail: true,
    ownerWhatsapp: true,
    adminEmail: true,
    adminWhatsapp: true,
    adminPush: true,
  };
  await this.save();
};

// Called when confidence is low or there's no registry match — requires
// a human before any owner is ever contacted.
ViolationSchema.methods.markFlagged = async function ({ confidence, error } = {}) {
  this.status = "flagged";
  if (confidence !== undefined) this.aiConfidence = confidence;
  if (error !== undefined) this.aiError = error;
  this.aiProcessedAt = new Date();
  await this.save();
};

ViolationSchema.methods.adminConfirm = async function (adminId) {
  this.status = "notified";
  this.adminReviewedBy = adminId;
  this.reviewedAt = new Date();
  this.notifiedAt = new Date();
  await this.save();
};

ViolationSchema.methods.adminReject = async function (adminId, reason) {
  this.status = "rejected";
  this.adminReviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason || null;
  await this.save();
};

/* ------------------------------------------------------------------ */
/*  Statics                                                             */
/* ------------------------------------------------------------------ */

ViolationSchema.statics.findByPlate = function (plateNumber) {
  return this.find({
    extractedPlateNumber: plateNumber.trim().toUpperCase(),
    isDeleted: false,
  }).sort({ createdAt: -1 });
};

ViolationSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

module.exports = mongoose.model("Violation", ViolationSchema);