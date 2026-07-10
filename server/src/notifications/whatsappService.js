// ========================================================================
// FILE : server/src/notifications/whatsappService.js
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

// Add this function to your existing whatsappService.js:

async function sendDepartmentEmergencyWhatsapp(alert, contact, citizen) {
  if (!contact.phone) return { success: false, error: "No department phone" };

  const mapsLink = `https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`;

  return sendWhatsapp(
    contact.phone,
    `CIVIMAP EMERGENCY — ${alert.category.toUpperCase()}\n` +
      `${citizen.fullName} (${citizen.phone}) needs help.\n` +
      `Location: ${mapsLink}\n` +
      `Note: ${alert.note || "No additional details provided"}\n` +
      `Alert ID: ${alert._id}`
  );
}

// Add "sendDepartmentEmergencyWhatsapp," to your existing module.exports = { ... } block.

async function sendOwnerViolationWhatsapp(violation) {
  if (!violation.matchedOwner?.phone) return { success: false, error: "No owner phone" };
  return sendWhatsapp(
    violation.matchedOwner.phone,
    `Traffic Violation Notice: Your vehicle (plate ${violation.extractedPlateNumber}) was reported for a violation. Reference ID: ${violation._id}. Contact the traffic authority if this is in error.`
  );
}

async function sendAdminViolationWhatsapp(violation, adminPhone) {
  return sendWhatsapp(
    adminPhone,
    `New violation — Plate ${violation.extractedPlateNumber || "UNKNOWN"}, confidence ${(
      (violation.aiConfidence || 0) * 100
    ).toFixed(1)}%. Ref: ${violation._id}`
  );
}

async function sendOtpWhatsapp(phone, code) {
  return sendWhatsapp(
    phone,
    `Your CIVIMAP login code is ${code}. It expires in 5 minutes. Don't share this code with anyone.`
  );
}

module.exports = {
  sendOwnerViolationWhatsapp,
  sendAdminViolationWhatsapp,
  sendOtpWhatsapp,
  sendDepartmentEmergencyWhatsapp,
};