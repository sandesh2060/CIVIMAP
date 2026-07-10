// ========================================================================
// FILE : server/src/services/otpService.js
// ========================================================================

const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const tokenService = require("./tokenService");
const emailService = require("../notifications/emailService");
const whatsappService = require("../notifications/whatsappService");
const { normalizeIdentifier } = require("../utils/identifier");

const RESEND_COOLDOWN_MS = 45 * 1000;

async function requestLoginOtp(rawIdentifier, ip) {
  const { type: channel, value: identifier } = normalizeIdentifier(rawIdentifier);
  if (!channel) throw ApiError.badRequest("Enter a valid email or phone number");

  const user = await User.findActiveByIdentifier(identifier);
  if (!user) {
    // Citizen records come from the national registry, not self-registration.
    throw ApiError.badRequest("No citizen record found for this email or phone");
  }
  if (user.isBanned) throw ApiError.forbidden("Account is banned");
  if (user.isLocked) throw ApiError.forbidden("Too many attempts. Try again in a few minutes.");

  if (
    user.loginOtpLastSentAt &&
    Date.now() - user.loginOtpLastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    const waitSec = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - user.loginOtpLastSentAt.getTime())) / 1000
    );
    throw ApiError.badRequest(`Please wait ${waitSec}s before requesting another code`);
  }

  const code = user.createLoginOtp();
  await user.save({ validateBeforeSave: false });

 if (channel === "email") {
    await emailService.sendOtpEmail(user, code);
  } else {
    const result = await whatsappService.sendOtpWhatsapp(user.phone, code);
    if (!result.success) {
      throw ApiError.internal(`Failed to send WhatsApp code: ${result.error}`);
    }
  }

  return { channel, maskedIdentifier: maskIdentifier(identifier, channel) };
}

async function verifyLoginOtp({ identifier: rawIdentifier, code, ip, userAgent, deviceId }) {
  const { value: identifier } = normalizeIdentifier(rawIdentifier);
  const user = await User.findActiveByIdentifier(identifier);
  if (!user) throw ApiError.unauthorized("Invalid or expired code");

  if (user.isLocked) throw ApiError.forbidden("Too many attempts. Try again in a few minutes.");
  if (user.isBanned) throw ApiError.forbidden("Account is banned");

  const isValid = user.compareLoginOtp(code);
  if (!isValid) {
    await user.registerFailedLogin(); // reuses the existing loginAttempts/lockUntil lockout
    throw ApiError.unauthorized("Invalid or expired code");
  }

  await user.clearLoginOtp();
  await user.registerSuccessfulLogin(ip, deviceId, userAgent);

  const tokens = await tokenService.issueTokenPair({
    id: user._id,
    accountType: "citizen",
    ip,
    userAgent,
    deviceId,
  });

  return { user, ...tokens };
}

function maskIdentifier(identifier, channel) {
  if (channel === "email") {
    const [name, domain] = identifier.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return `${"*".repeat(Math.max(identifier.length - 4, 0))}${identifier.slice(-4)}`;
}

module.exports = { requestLoginOtp, verifyLoginOtp };