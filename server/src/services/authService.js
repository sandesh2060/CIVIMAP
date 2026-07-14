// ========================================================================
// FILE : server/src/services/authService.js
// ========================================================================

const User = require("../models/User");
const Admin = require("../models/admin/Admin");
const ApiError = require("../utils/ApiError");
const tokenService = require("./tokenService");

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
  loginAdmin,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
};