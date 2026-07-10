// ========================================================================
// FILE : server/src/models/Report.js
// ========================================================================



const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ------------------------------------------------------------------ */
/*  Report — citizen-submitted road issues, AI-verified                */
/* ------------------------------------------------------------------ */

const ReportSchema = new Schema(
  {
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    imageUrl: { type: String, required: [true, "Photo is required"] },
    imagePublicId: { type: String, default: null }, // Cloudinary public_id, for deletion

    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: 1000,
    },

    category: {
      type: String,
      enum: ["pothole", "crack", "debris", "flooding", "streetlight", "signage", "other"],
      default: "other",
    },

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    address: { type: String, default: null }, // human-readable, reverse-geocoded

    /* ---------- AI verification ---------- */
    status: {
      type: String,
      enum: ["pending", "approved", "flagged", "rejected"],
      default: "pending",
      index: true,
    },
    aiConfidence: { type: Number, min: 0, max: 1, default: null },
    aiLabel: { type: String, default: null }, // model's raw label, e.g. "pothole" | "irrelevant"
    aiProcessedAt: { type: Date, default: null },
    aiError: { type: String, default: null }, // populated if the AI service call failed/timed out

    /* ---------- Admin review (only relevant when flagged) ---------- */
    adminReviewedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    /* ---------- Lifecycle ---------- */
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------------ */
/*  Indexes                                                             */
/* ------------------------------------------------------------------ */

ReportSchema.index({ location: "2dsphere" });
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ reportedBy: 1, createdAt: -1 });

/* ------------------------------------------------------------------ */
/*  Instance methods — keep status-transition logic in one place       */
/*  rather than scattered across controllers.                          */
/* ------------------------------------------------------------------ */

ReportSchema.methods.markApproved = async function ({ confidence, label } = {}) {
  this.status = "approved";
  if (confidence !== undefined) this.aiConfidence = confidence;
  if (label !== undefined) this.aiLabel = label;
  this.aiProcessedAt = new Date();
  await this.save();
};

ReportSchema.methods.markFlagged = async function ({ confidence, label, error } = {}) {
  this.status = "flagged";
  if (confidence !== undefined) this.aiConfidence = confidence;
  if (label !== undefined) this.aiLabel = label;
  if (error !== undefined) this.aiError = error;
  this.aiProcessedAt = new Date();
  await this.save();
};

ReportSchema.methods.adminApprove = async function (adminId) {
  this.status = "approved";
  this.adminReviewedBy = adminId;
  this.reviewedAt = new Date();
  await this.save();
};

ReportSchema.methods.adminReject = async function (adminId, reason) {
  this.status = "rejected";
  this.adminReviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason || null;
  await this.save();
};

/* ------------------------------------------------------------------ */
/*  Statics                                                             */
/* ------------------------------------------------------------------ */

ReportSchema.statics.findWithinBounds = function (bbox, filters = {}) {
  // bbox: [swLng, swLat, neLng, neLat]
  return this.find({
    ...filters,
    isDeleted: false,
    location: {
      $geoWithin: {
        $box: [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
      },
    },
  });
};

ReportSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

module.exports = mongoose.model("Report", ReportSchema);