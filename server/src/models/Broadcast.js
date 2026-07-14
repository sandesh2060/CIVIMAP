// ========================================================================
// FILE : server/src/models/Broadcast.js
// ========================================================================
// One row per broadcast SEND (not per recipient) — a lightweight log so
// admins can see broadcast history. Deleting a row only clears the log
// entry; it does not unsend or touch the per-recipient Notification docs
// created by notificationService.broadcastNotification.

const mongoose = require("mongoose");
const { Schema } = mongoose;

const BroadcastSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    titleNe: { type: String, trim: true, default: null },
    messageNe: { type: String, trim: true, default: null },

    audience: { type: String, enum: ["all", "admins"], required: true },
    recipientCount: { type: Number, required: true, default: 0 },

    sentBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true }
);

BroadcastSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Broadcast", BroadcastSchema);