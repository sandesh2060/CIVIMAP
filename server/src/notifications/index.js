// ========================================================================
// FILE : server/src/notifications/index.js  (FULL FILE — replace existing)
// ========================================================================

const Admin = require("../models/admin/Admin");
const emailService = require("./emailService");
const whatsappService = require("./whatsappService");
const logger = require("../utils/logger");

async function dispatchViolationNotifications(violation) {
  const { getIO } = require("../sockets");

  const admins = await Admin.find({ isActive: true, isDeleted: false }).select(
    "email phone"
  );

  const results = {
    ownerEmail: false,
    ownerWhatsapp: false,
    adminEmail: false,
    adminWhatsapp: false,
    adminPush: false,
  };

  const ownerEmailResult = await emailService
    .sendOwnerViolationEmail(violation)
    .catch((err) => ({ success: false, error: err.message }));
  results.ownerEmail = !!ownerEmailResult?.success;

  const ownerWhatsappResult = await whatsappService
    .sendOwnerViolationWhatsapp(violation)
    .catch((err) => ({ success: false, error: err.message }));
  results.ownerWhatsapp = !!ownerWhatsappResult?.success;

  const adminEmailResults = await Promise.allSettled(
    admins.filter((a) => a.email).map((a) => emailService.sendAdminViolationEmail(violation, a.email))
  );
  results.adminEmail = adminEmailResults.some(
    (r) => r.status === "fulfilled" && r.value?.success
  );

  const adminWhatsappResults = await Promise.allSettled(
    admins
      .filter((a) => a.phone)
      .map((a) => whatsappService.sendAdminViolationWhatsapp(violation, a.phone))
  );
  results.adminWhatsapp = adminWhatsappResults.some(
    (r) => r.status === "fulfilled" && r.value?.success
  );

  try {
    const io = getIO();
    io.to("admin-room").emit("violation:new", { violation });
    results.adminPush = true;
  } catch (err) {
    logger.notificationFailure("Socket push failed for violation:new", {
      violationId: violation._id,
      error: err.message,
    });
  }

  return results;
}

async function dispatchReportStatusNotification(report, user) {
  try {
    await emailService.sendReportStatusEmail(report, user);
  } catch (err) {
    logger.notificationFailure("Report status email failed", {
      reportId: report._id,
      error: err.message,
    });
  }

  try {
    const { getIO } = require("../sockets");
    const io = getIO();
    io.to(`user-${user._id}`).emit("report:statusChanged", {
      reportId: report._id,
      status: report.status,
    });
  } catch (err) {
    logger.notificationFailure("Socket push failed for report:statusChanged", {
      reportId: report._id,
      error: err.message,
    });
  }
}

/**
 * Emergency dispatch — README §10 channel selection logic:
 *   - email only on file  -> email only
 *   - phone only on file  -> whatsapp only
 *   - both on file        -> both, in parallel
 *   - neither             -> impossible (schema-enforced on EmergencyContact)
 */
async function dispatchEmergencyAlert(alert, contact, citizen) {
  const channelsUsed = [];
  const errors = [];

  if (contact.email) {
    const result = await emailService
      .sendDepartmentEmergencyEmail(alert, contact, citizen)
      .catch((err) => ({ success: false, error: err.message }));
    if (result?.success) {
      channelsUsed.push("email");
    } else {
      errors.push(`email: ${result?.error || "unknown error"}`);
    }
  }

  if (contact.phone) {
    const result = await whatsappService
      .sendDepartmentEmergencyWhatsapp(alert, contact, citizen)
      .catch((err) => ({ success: false, error: err.message }));
    if (result?.success) {
      channelsUsed.push("whatsapp");
    } else {
      errors.push(`whatsapp: ${result?.error || "unknown error"}`);
    }
  }

  if (!channelsUsed.length) {
    logger.notificationFailure("Emergency dispatch failed on all channels", {
      alertId: alert._id,
      category: alert.category,
      contactId: contact._id,
      errors,
    });
  }

  try {
    const { getIO } = require("../sockets");
    const io = getIO();
    io.to("admin-room").emit("emergency:new", { alert });
  } catch (err) {
    logger.notificationFailure("Socket push failed for emergency:new", {
      alertId: alert._id,
      error: err.message,
    });
  }

  return { channelsUsed, reason: errors.join("; ") || null };
}

module.exports = {
  dispatchViolationNotifications,
  dispatchReportStatusNotification,
  dispatchEmergencyAlert,
};