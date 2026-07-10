// ========================================================================
// FILE : server/src/notifications/emailService.js
// ========================================================================

const { sendMail } = require("../utils/email");
const { env } = require("../config/env");

async function sendOwnerViolationEmail(violation) {
  if (!violation.matchedOwner?.email) return { success: false, error: "No owner email" };

  return sendMail({
    to: violation.matchedOwner.email,
    subject: `Traffic Violation Notice — Plate ${violation.extractedPlateNumber}`,
    html: `
      <p>Your vehicle was reported for a traffic violation at
      (${violation.location.coordinates[1]}, ${violation.location.coordinates[0]})
      on ${violation.createdAt.toLocaleString()}.</p>
      <p>Reference ID: ${violation._id}</p>
      <p>Please contact the traffic authority if you believe this is an error.</p>
    `,
  });
}
async function sendOtpEmail(user, code) {
  return sendMail({
    to: user.email,
    subject: `Your CIVIMAP login code: ${code}`,
    html: `
      <p>Hi ${user.fullName},</p>
      <p>Your CIVIMAP login code is:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>This code expires in 5 minutes. Didn't request this? You can ignore this email.</p>
    `,
  });
}

async function sendAdminViolationEmail(violation, adminEmail) {
  return sendMail({
    to: adminEmail,
    subject: `New violation detected — Plate ${violation.extractedPlateNumber || "UNKNOWN"}`,
    html: `
      <p>Plate: ${violation.extractedPlateNumber || "Not extracted"}</p>
      <p>Confidence: ${((violation.aiConfidence || 0) * 100).toFixed(1)}%</p>
      <p>Location: (${violation.location.coordinates[1]}, ${violation.location.coordinates[0]})</p>
      <p><a href="${env.CLIENT_ORIGIN}/admin/violations/${violation._id}">View in dashboard</a></p>
    `,
  });
}

async function sendReportStatusEmail(report, user) {
  const statusLabel = report.status === "approved" ? "approved" : "rejected";
  return sendMail({
    to: user.email,
    subject: `Your road issue report was ${statusLabel}`,
    html: `
      <p>Hi ${user.fullName},</p>
      <p>Your report submitted on ${report.createdAt.toLocaleDateString()} has been
      <strong>${statusLabel}</strong>.</p>
      ${report.rejectionReason ? `<p>Reason: ${report.rejectionReason}</p>` : ""}
    `,
  });
}

async function sendVerificationEmail(user, rawToken) {
  const link = `${env.CLIENT_ORIGIN}/verify-email?token=${rawToken}`;
  return sendMail({
    to: user.email,
    subject: "Verify your CIVIMAP account",
    html: `<p>Hi ${user.fullName}, please verify your email:</p><p><a href="${link}">${link}</a></p>`,
  });
}

// Add this function to your existing emailService.js:

async function sendDepartmentEmergencyEmail(alert, contact, citizen) {
  if (!contact.email) return { success: false, error: "No department email" };

  const mapsLink = `https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`;

  return sendMail({
    to: contact.email,
    subject: `CIVIMAP Emergency Alert — ${alert.category}`,
    html: `
      <p><strong>${citizen.fullName}</strong> (${citizen.phone}) reported a
      <strong>${alert.category}</strong> emergency.</p>
      <p>Location: <a href="${mapsLink}">${mapsLink}</a></p>
      <p>Note: ${alert.note || "No additional details provided"}</p>
      <p>Reported at: ${alert.dispatchedAt.toLocaleString()} · Alert ID: ${alert._id}</p>
    `,
  });
}

// Add "sendDepartmentEmergencyEmail," to your existing module.exports = { ... } block.

async function sendPasswordResetEmail(user, rawToken) {
  const link = `${env.CLIENT_ORIGIN}/reset-password?token=${rawToken}`;
  return sendMail({
    to: user.email,
    subject: "Reset your CIVIMAP password",
    html: `<p>Reset your password using the link below (valid for 1 hour):</p><p><a href="${link}">${link}</a></p>`,
  });
}

module.exports = {
  sendOwnerViolationEmail,
  sendAdminViolationEmail,
  sendReportStatusEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOtpEmail,
  sendDepartmentEmergencyEmail,
};