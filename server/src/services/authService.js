// ========================================================================
// FILE : server/src/services/authService.js
// ========================================================================

const User = require("../models/User");
const Admin = require("../models/admin/Admin");
const ApiError = require("../utils/ApiError");
const tokenService = require("./tokenService");

async function registerCitizen({ fullName, email, phone, password, languagePref }) {
  const existing = await User.findOne({ $or: [{ email }, { phone }] });
  if (existing) throw ApiError.conflict("Email or phone already registered");

  const user = await User.create({
    fullName,
    email,
    phone,
    passwordHash: password, // hashed by the pre-save hook in models/User.js
    languagePref,
  });

  const verificationToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  return { user, verificationToken };
}

async function loginCitizen({ email, password, ip, userAgent, deviceId }) {
  const user = await User.findActiveByEmail(email);
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  if (user.isLocked) {
    throw ApiError.forbidden("Account temporarily locked due to too many failed attempts");
  }
  if (user.isBanned) throw ApiError.forbidden("Account is banned");

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await user.registerFailedLogin();
    throw ApiError.unauthorized("Invalid email or password");
  }

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

async function loginAdmin({ email, password, ip }) {
  const admin = await Admin.findActiveByEmail(email);
  if (!admin) throw ApiError.unauthorized("Invalid email or password");

  if (admin.isLocked) {
    throw ApiError.forbidden("Account temporarily locked due to too many failed attempts");
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    await admin.registerFailedLogin();
    throw ApiError.unauthorized("Invalid email or password");
  }

  await admin.registerSuccessfulLogin(ip);

  const tokens = await tokenService.issueTokenPair({
    id: admin._id,
    accountType: "admin",
    ip,
  });

  return { admin, ...tokens };
}

async function logout(rawRefreshToken, ip) {
  if (!rawRefreshToken) return;
  await tokenService.revokeRefreshToken(rawRefreshToken, ip);
}

async function forgotPassword(email) {
  const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
  if (!user) return null; // don't leak whether the email exists

  const rawToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  return { user, rawToken };
}

async function resetPassword(hashedToken, newPassword) {
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select("+passwordHash");

  if (!user) throw ApiError.badRequest("Token is invalid or has expired");

  user.passwordHash = newPassword; // re-hashed by pre-save hook
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return user;
}

async function verifyEmail(hashedToken) {
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) throw ApiError.badRequest("Verification link is invalid or has expired");

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  return user;
}

module.exports = {
  registerCitizen,
  loginCitizen,
  loginAdmin,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
};