// ========================================================================
// FILE : server/src/controllers/authController.js
// ========================================================================

const User = require("../models/User");
const authService = require("../services/authService");
const tokenService = require("../services/tokenService");
const emailService = require("../notifications/emailService");
const otpService = require("../services/otpService");
const { uploadBuffer, deleteImage } = require("../config/cloudinary");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { sha256 } = require("../utils/crypto");
const { env } = require("../config/env");

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: env.REFRESH_TOKEN_TTL_MS,
  path: "/api/auth",
};

function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, REFRESH_COOKIE_OPTIONS);
}

async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const { admin, accessToken, refreshToken } = await authService.loginAdmin({
      email,
      password,
      ip: req.ip,
    });

    setRefreshCookie(res, refreshToken);
    return ApiResponse.ok(res, { admin: sanitizeAdmin(admin), accessToken });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) throw ApiError.unauthorized("No refresh token provided");

    const result = await tokenService.refreshTokenPair(rawToken, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    if (!result) {
      res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);
      throw ApiError.unauthorized("Refresh token invalid or expired, please log in again");
    }

    setRefreshCookie(res, result.refreshToken);
    return ApiResponse.ok(res, { accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken;
    await authService.logout(rawToken, req.ip);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);
    return ApiResponse.ok(res, null, "Logged out successfully");
  } catch (err) {
    next(err);
  }
}

async function logoutAll(req, res, next) {
  try {
    await tokenService.revokeAllSessions(req.account._id, req.accountType);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);
    return ApiResponse.ok(res, null, "Logged out of all devices");
  } catch (err) {
    next(err);
  }
}

// Reads the citizen's currently-selected UI language off the X-Lang
// header sent by client/src/services/api.js (falls back to "en" if
// missing/invalid). This is what tells otpService/emailService which
// language to render the OTP email in — NOT user.languagePref, since
// this request fires before the citizen is authenticated and their
// stored preference may be stale or unset.
function getRequestLang(req) {
  const header = req.headers["x-lang"];
  return header === "ne" ? "ne" : "en";
}

async function requestOtp(req, res, next) {
  try {
    const { identifier } = req.body;
    const lang = getRequestLang(req);
    const result = await otpService.requestLoginOtp(identifier, req.ip, lang);
    return ApiResponse.ok(res, result, "Verification code sent");
  } catch (err) {
    next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { identifier, code, deviceId } = req.body;
    const { user, accessToken, refreshToken } = await otpService.verifyLoginOtp({
      identifier,
      code,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      deviceId,
    });

    setRefreshCookie(res, refreshToken);
    return ApiResponse.ok(res, { user: sanitizeUser(user), accessToken });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const sanitized =
      req.accountType === "admin" ? sanitizeAdmin(req.account) : sanitizeUser(req.account);
    return ApiResponse.ok(res, { account: sanitized, accountType: req.accountType });
  } catch (err) {
    next(err);
  }
}

const PROFILE_UPDATABLE_FIELDS = [
  "fullName",
  "dateOfBirth",
  "gender",
  "address",
  "languagePref",
  "theme",
  "notificationPrefs",
];

async function updateProfile(req, res, next) {
  try {
    if (req.accountType !== "citizen") {
      throw ApiError.forbidden("Only citizen accounts can update this profile");
    }

    const updates = {};
    for (const field of PROFILE_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.account._id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) throw ApiError.notFound("Account not found");

    return ApiResponse.ok(res, { user: sanitizeUser(user) }, "Profile updated");
  } catch (err) {
    next(err);
  }
}

async function uploadAvatar(req, res, next) {
  try {
    if (req.accountType !== "citizen") {
      throw ApiError.forbidden("Only citizen accounts have a profile picture");
    }
    if (!req.file) throw ApiError.badRequest("An image is required");

    const user = await User.findById(req.account._id);
    if (!user) throw ApiError.notFound("Account not found");

    const oldPublicId = user.profileImage?.publicId || null;
    const { url, publicId } = await uploadBuffer(req.file.buffer, "civimap/avatars");

    user.profileImage = { url, publicId };
    await user.save({ validateBeforeSave: false });

    if (oldPublicId) {
      deleteImage(oldPublicId);
    }

    return ApiResponse.ok(res, { user: sanitizeUser(user) }, "Profile picture updated");
  } catch (err) {
    next(err);
  }
}

async function removeAvatar(req, res, next) {
  try {
    if (req.accountType !== "citizen") {
      throw ApiError.forbidden("Only citizen accounts have a profile picture");
    }

    const user = await User.findById(req.account._id);
    if (!user) throw ApiError.notFound("Account not found");

    const publicId = user.profileImage?.publicId || null;
    user.profileImage = { url: null, publicId: null };
    await user.save({ validateBeforeSave: false });

    if (publicId) {
      await deleteImage(publicId);
    }

    return ApiResponse.ok(res, { user: sanitizeUser(user) }, "Profile picture removed");
  } catch (err) {
    next(err);
  }
}

/* ---------- helpers ---------- */

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.passwordHash;
  delete obj.passwordResetToken;
  delete obj.emailVerificationToken;
  delete obj.phoneVerificationCode;
  return obj;
}

function sanitizeAdmin(admin) {
  const obj = admin.toObject ? admin.toObject() : admin;
  delete obj.passwordHash;
  delete obj.passwordResetToken;
  return obj;
}

module.exports = {
  requestOtp,
  verifyOtp,
  adminLogin,
  refresh,
  logout,
  logoutAll,
  getMe,
  updateProfile,
  uploadAvatar,
  removeAvatar,
};