// ========================================================================
// FILE : server/src/notifications/whatsappService.js
// Message copy rewritten to match the formal, letterhead tone used in
// emailService.js. Twilio's WhatsApp API only supports plain text with
// *bold*/_italic_ markup and line breaks — no color, logo, or layout —
// so this is the ceiling for how "designed" a WhatsApp notice can look.
// ========================================================================

const twilio = require("twilio");
const { env } = require("../config/env");
const logger = require("../utils/logger");

let client = null;
function getClient() {
  if (client) return client;
  client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return client;
}

async function sendWhatsapp(to, body) {
  try {
    // Twilio WhatsApp sandbox (dev) / Business API (prod) — see README section 23.
    const message = await getClient().messages.create({
      from: `whatsapp:${env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${to}`,
      body,
    });
    return { success: true, sid: message.sid };
  } catch (err) {
    logger.notificationFailure("WhatsApp send failed", { to, error: err.message });
    return { success: false, error: err.message };
  }
}

// ------------------------------------------------------------------
// Violation notices
// ------------------------------------------------------------------

async function sendOwnerViolationWhatsapp(violation) {
  if (!violation.matchedOwner?.phone) return { success: false, error: "No owner phone" };

  const mapsLink = `https://www.google.com/maps?q=${violation.location.coordinates[1]},${violation.location.coordinates[0]}`;

  return sendWhatsapp(
    violation.matchedOwner.phone,
    `*CIVIMAP — Traffic Violation Notice*\n\n` +
      `A traffic violation has been recorded for a vehicle registered to you, plate *${violation.extractedPlateNumber}*.\n\n` +
      `Date & Time: ${violation.createdAt.toLocaleString()}\n` +
      `Location: ${mapsLink}\n\n` +
      `Reference: ${violation._id}\n\n` +
      `If you believe this notice was issued in error, please contact your local traffic authority and quote the reference number above.\n\n` +
      `_This is an automated message. Please do not reply to this number._`
  );
}

async function sendAdminViolationWhatsapp(violation, adminPhone) {
  return sendWhatsapp(
    adminPhone,
    `*CIVIMAP — New Violation Report*\n\n` +
      `Plate: *${violation.extractedPlateNumber || "Not extracted"}*\n` +
      `AI Confidence: ${((violation.aiConfidence || 0) * 100).toFixed(1)}%\n` +
      `Location: (${violation.location.coordinates[1]}, ${violation.location.coordinates[0]})\n\n` +
      `Reference: ${violation._id}\n\n` +
      `View in dashboard: ${env.CLIENT_ORIGIN}/admin/violations/${violation._id}`
  );
}

// ------------------------------------------------------------------
// Auth / account
// ------------------------------------------------------------------

async function sendOtpWhatsapp(phone, code) {
  return sendWhatsapp(
    phone,
    `*CIVIMAP — Login Code*\n\n` +
      `Your one-time login code is: *${code}*\n\n` +
      `This code expires in 5 minutes. For your security, do not share this code with anyone — CIVIMAP staff will never ask for it.\n\n` +
      `_Didn't request this? You can safely ignore this message._`
  );
}

// ------------------------------------------------------------------
// Emergency
// ------------------------------------------------------------------

async function sendDepartmentEmergencyWhatsapp(alert, contact, citizen) {
  if (!contact.phone) return { success: false, error: "No department phone" };

  const mapsLink = `https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`;

  return sendWhatsapp(
    contact.phone,
    `*CIVIMAP — Emergency Alert*\n` +
      `*${alert.category.toUpperCase()}*\n\n` +
      `${citizen.fullName} (${citizen.phone}) has reported an emergency requiring immediate attention.\n\n` +
      `Location: ${mapsLink}\n` +
      `Note: ${alert.note || "No additional details provided"}\n\n` +
      `Reference: ${alert._id}\n` +
      `Reported at: ${alert.dispatchedAt.toLocaleString()}`
  );
}

module.exports = {
  sendOwnerViolationWhatsapp,
  sendAdminViolationWhatsapp,
  sendOtpWhatsapp,
  sendDepartmentEmergencyWhatsapp,
};