// ========================================================================
// FILE : server/src/models/EmergencyAlert.js
// ========================================================================

const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ------------------------------------------------------------------ */
/*  EmergencyAlert — a single citizen-initiated dispatch. No AI, no     */
/*  review queue, no confidence threshold (README §3.6/§6.4). Created   */
/*  and dispatched synchronously in the same request.                   */
/* ------------------------------------------------------------------ */

const EmergencyAlertSchema = new Schema(
  {
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    category: {
      type: String,
      required: true,
      enum: ["ambulance", "fire", "police", "rescue"],
    },

    location: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
    },

    note: { type: String, trim: true, maxlength: 500, default: null },

    contactedDepartment: {
      type: Schema.Types.ObjectId,
      ref: "EmergencyContact",
      required: true,
    },

    channelsUsed: [{ type: String, enum: ["email", "whatsapp"] }],

    status: {
      type: String,
      enum: ["dispatched", "acknowledged", "resolved"],
      default: "dispatched",
      index: true,
    },

    dispatchedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, refPath: "resolvedByModel", default: null },
    resolvedByModel: { type: String, enum: ["User", "Admin"], default: null },

    dispatchFailed: { type: Boolean, default: false },
    dispatchFailureReason: { type: String, default: null },
  },
  { timestamps: true }
);

EmergencyAlertSchema.index({ location: "2dsphere" });
EmergencyAlertSchema.index({ category: 1, status: 1, createdAt: -1 });

EmergencyAlertSchema.methods.markResolved = function (resolverId, resolverType) {
  this.status = "resolved";
  this.resolvedAt = new Date();
  this.resolvedBy = resolverId;
  this.resolvedByModel = resolverType === "admin" ? "Admin" : "User";
  return this.save();
};

EmergencyAlertSchema.methods.markDispatchFailed = function (reason) {
  this.dispatchFailed = true;
  this.dispatchFailureReason = reason;
  return this.save();
};

module.exports = mongoose.model("EmergencyAlert", EmergencyAlertSchema);