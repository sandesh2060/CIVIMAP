// ========================================================================
// FILE : server/src/services/notificationService.js
// ========================================================================
// Centralizes Notification.create() + the matching socket emit so
// controllers stay thin, mirroring emergencyService.js / otpService.js.

const Notification = require("../models/Notification");
const User = require("../models/User");
const { getIO } = require("../sockets");
const {
  emitNotificationNew,
  emitNotificationBroadcast,
} = require("../sockets/notificationSocket");
const logger = require("../utils/logger");

async function notifyReportStatus(report, user, decision) {
  const isApproved = decision === "approved";
  const notification = await Notification.create({
    recipient: user._id,
    type: "report_status",
    title: isApproved ? "Report approved" : "Report rejected",
    message: isApproved
      ? `Your ${report.category} report was approved and is now live on the map.`
      : `Your ${report.category} report was not approved.${
          report.rejectionReason ? ` Reason: ${report.rejectionReason}` : ""
        }`,
    relatedReport: report._id,
  });

  try {
    emitNotificationNew(getIO(), user._id, notification);
  } catch (err) {
    logger.jobFailure("Socket emit failed for notification:new (report)", {
      notificationId: notification._id,
      error: err.message,
    });
  }

  return notification;
}

async function notifyViolationStatus(violation, user, decision) {
  const isConfirmed = decision === "confirmed";
  const notification = await Notification.create({
    recipient: user._id,
    type: "violation_status",
    title: isConfirmed ? "Violation confirmed" : "Violation rejected",
    message: isConfirmed
      ? `Your violation report (plate ${violation.extractedPlateNumber || "unknown"}) was confirmed.`
      : `Your violation report was not confirmed.${
          violation.rejectionReason ? ` Reason: ${violation.rejectionReason}` : ""
        }`,
    relatedViolation: violation._id,
  });

  try {
    emitNotificationNew(getIO(), user._id, notification);
  } catch (err) {
    logger.jobFailure("Socket emit failed for notification:new (violation)", {
      notificationId: notification._id,
      error: err.message,
    });
  }

  return notification;
}


async function notifyOwnerMatchedViolation(violation) {
  const notification = await Notification.create({
    recipient: violation.matchedOwnerUserId,
    type: "violation_matched",
    title: "Your vehicle was reported",
    message: `A ${violation.violationType.replace(/_/g, " ")} violation was reported for your vehicle${
      violation.extractedPlateNumber ? ` (plate ${violation.extractedPlateNumber})` : ""
    }. Check your email for details.`,
    relatedViolation: violation._id,
  });

  try {
    emitNotificationNew(getIO(), violation.matchedOwnerUserId, notification);
  } catch (err) {
    logger.jobFailure("Socket emit failed for notification:new (matched owner)", {
      notificationId: notification._id,
      error: err.message,
    });
  }

  return notification;
}
// Broadcasts to every active citizen. Uses insertMany for the DB write
// (one round trip regardless of citizen count) but a single socket emit
// to the shared "citizen-room" rather than one emit per user — the
// per-user Notification rows still exist for accurate unread counts,
// the emit is just a "go refetch / here's a toast" signal.
async function broadcastToAllCitizens({ title, message }) {
  const citizens = await User.find({
    isActive: true,
    isBanned: false,
    isDeleted: false,
  }).select("_id");

  if (citizens.length === 0) return { recipientCount: 0 };

  const docs = citizens.map((c) => ({
    recipient: c._id,
    type: "admin_broadcast",
    title,
    message,
  }));

  await Notification.insertMany(docs);

  try {
    emitNotificationBroadcast(getIO(), { type: "admin_broadcast", title, message });
  } catch (err) {
    logger.jobFailure("Socket emit failed for notification:broadcast", {
      error: err.message,
    });
  }

  return { recipientCount: citizens.length };
}

module.exports = { notifyReportStatus, notifyViolationStatus, broadcastToAllCitizens,notifyOwnerMatchedViolation };