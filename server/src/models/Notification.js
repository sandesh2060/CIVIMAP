// ========================================================================
// FILE : server/src/models/Notification.js
// ========================================================================

const mongoose = require("mongoose");
const { Schema } = mongoose;

// One document per recipient, even for broadcasts — this keeps
// read/unread state per-citizen trivial to query (no readBy array to
// maintain) at the cost of a few extra rows on broadcast, which matches
// how the rest of this codebase favors simple per-recipient documents
// (see EmergencyAlert) over shared/aggregate ones.
const NotificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "report_status",
        "violation_status",
        "admin_broadcast",
        "violation_matched",
          "new_feed_post",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    relatedPost: { type: Schema.Types.ObjectId, ref: "Post", default: null },


    

    // Optional Nepali versions — only populated for admin_broadcast today.
    // The client picks title/titleNe (and message/messageNe) at render
    // time based on the viewer's languagePref; everything else keeps
    // using the English fields since only English is authored for them.
    titleNe: { type: String, trim: true, default: null },
    messageNe: { type: String, trim: true, default: null },

    // Optional back-references so the client can deep-link ("View report")
    relatedReport: { type: Schema.Types.ObjectId, ref: "Report", default: null },
    relatedViolation: { type: Schema.Types.ObjectId, ref: "Violation", default: null },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

NotificationSchema.methods.markRead = async function () {
  if (this.isRead) return this;
  this.isRead = true;
  this.readAt = new Date();
  await this.save();
  return this;
};

NotificationSchema.statics.unreadCountForUser = function (userId) {
  return this.countDocuments({ recipient: userId, isRead: false });
};

NotificationSchema.statics.markAllReadForUser = function (userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

module.exports = mongoose.model("Notification", NotificationSchema);