// ========================================================================
// FILE : server/src/services/notificationService.js
// ========================================================================
// Centralizes Notification.create() + the matching socket emit so
// controllers stay thin, mirroring emergencyService.js / otpService.js.

const Notification = require("../models/Notification");
const User = require("../models/User");
const Admin = require("../models/admin/Admin");
const { getIO } = require("../sockets");
const {
  emitNotificationNew,
  emitNotificationBroadcast,
} = require("../sockets/notificationSocket");
const logger = require("../utils/logger");
const emailService = require("../notifications/emailService");

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

// Single entry point the controller calls — routes to the citizen or
// admin broadcast path based on audience.
async function broadcastNotification({ title, message, titleNe, messageNe, audience = "all" }) {
  return audience === "admins"
    ? broadcastToAdmins({ title, message })
    : broadcastToAllCitizens({ title, message, titleNe, messageNe });
}

// Broadcasts to every active citizen. Uses insertMany for the DB write
// (one round trip regardless of citizen count) but a single socket emit
// to the shared "citizen-room" rather than one emit per user — the
// per-user Notification rows still exist for accurate unread counts,
// the emit is just a "go refetch / here's a toast" signal.
//
// titleNe/messageNe are optional — the client (in-app popup + unread
// list) picks title/titleNe based on the viewer's languagePref. Email
// stays English-only for now regardless of what's passed here.
async function broadcastToAllCitizens({ title, message, titleNe, messageNe }) {
  const citizens = await User.find({
    isActive: true,
    isBanned: false,
    isDeleted: false,
  }).select("_id email fullName");

  if (citizens.length === 0) return { recipientCount: 0, audience: "all" };

  const docs = citizens.map((c) => ({
    recipient: c._id,
    type: "admin_broadcast",
    title,
    message,
    titleNe: titleNe || null,
    messageNe: messageNe || null,
  }));

  await Notification.insertMany(docs);

  try {
    emitNotificationBroadcast(getIO(), {
      type: "admin_broadcast",
      title,
      message,
      titleNe: titleNe || null,
      messageNe: messageNe || null,
    });
  } catch (err) {
    logger.jobFailure("Socket emit failed for notification:broadcast", {
      error: err.message,
    });
  }

  // Fire-and-forget: email is a nice-to-have alongside the in-app
  // notification, so a mail failure shouldn't fail the broadcast itself.
  // English-only for now, regardless of the citizen's languagePref.
  Promise.allSettled(
    citizens
      .filter((c) => c.email)
      .map((c) => emailService.sendBroadcastEmail(c, { title, message }, "en"))
  ).then((results) => {
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) {
      logger.jobFailure(`Broadcast email failed for ${failed} citizen(s)`, {});
    }
  });

  return { recipientCount: citizens.length, audience: "all" };
}

// Admin-only broadcast: email only. Admins aren't `User` documents, so
// there's no in-app Notification/bell for them here — adjust if you add one.
async function broadcastToAdmins({ title, message }) {
  const admins = await Admin.find({ isActive: true, isDeleted: false }).select("email fullName");

  if (admins.length === 0) return { recipientCount: 0, audience: "admins" };

  const results = await Promise.allSettled(
    admins.filter((a) => a.email).map((a) => emailService.sendBroadcastEmail(a, { title, message }, "en"))
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) {
    logger.jobFailure(`Broadcast email failed for ${failed} admin(s)`, {});
  }

  return { recipientCount: admins.length, audience: "admins" };
}

module.exports = {
  notifyReportStatus,
  notifyViolationStatus,
  broadcastNotification,
  notifyOwnerMatchedViolation,
};