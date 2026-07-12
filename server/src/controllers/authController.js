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

// NEW: revokes every refresh token belonging to this account (all
// devices/sessions), then clears the cookie on the current device too —
// so the caller ends up logged out here exactly like everywhere else.
async function logoutAll(req, res, next) {
  try {
    await tokenService.revokeAllSessions(req.account._id, req.accountType);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);
    return ApiResponse.ok(res, null, "Logged out of all devices");
  } catch (err) {
    next(err);
  }
}

async function requestOtp(req, res, next) {
  try {
    const { identifier } = req.body;
    const result = await otpService.requestLoginOtp(identifier, req.ip);
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

// NEW: profile self-service update. Only ever touches the citizen-facing
// allow-list enforced by validators/authValidators.js's
// updateProfileSchema (fullName, dateOfBirth, gender, address,
// languagePref, theme, notificationPrefs) — Joi's schema (no
// .unknown(true)) already strips anything else, this is a second,
// explicit belt-and-braces guard against sending untouched fields
// (email, phone, role, trustScore, stats, verification flags, etc.)
// straight into User.findByIdAndUpdate from req.body.
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

// NEW: replaces the citizen's avatar. Uploads the new image first, saves
// it, THEN deletes the old Cloudinary asset — in that order, so a failed
// upload never leaves the account with no photo at all. The old-image
// delete itself doesn't need to block the response (deleteImage() logs
// its own failures — see cloudinary.js), but we still fire it before
// responding rather than losing track of it entirely.
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
      deleteImage(oldPublicId); // best-effort cleanup of the replaced asset
    }

    return ApiResponse.ok(res, { user: sanitizeUser(user) }, "Profile picture updated");
  } catch (err) {
    next(err);
  }
}

// NEW: removes the citizen's avatar and deletes the underlying
// Cloudinary asset. Unlike the "replace" path above, deletion here IS
// the point of the action, so it's awaited — the client only sees
// "removed" after Cloudinary has actually confirmed the delete.
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