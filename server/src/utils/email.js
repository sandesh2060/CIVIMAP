// ========================================================================
// FILE : server/src/utils/email.js
// ========================================================================

const nodemailer = require("nodemailer");
const { env } = require("../config/env");
const logger = require("./logger");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: false, // false for port 587 (STARTTLS), true for port 465
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Sends an email. Returns { success, error? } rather than throwing, so
 * callers (emailService.js) can .catch(() => {}) without crashing a
 * request if delivery fails.
 */
async function sendMail({ to, subject, html }) {
  try {
    const info = await getTransporter().sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.notificationFailure("Email send failed", { to, subject, error: err.message });
    return { success: false, error: err.message };
  }
}

module.exports = { sendMail };