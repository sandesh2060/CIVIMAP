// ========================================================================
// FILE : server/src/controllers/authController.js
// ========================================================================

const authService = require("../services/authService");
const tokenService = require("../services/tokenService");
const emailService = require("../notifications/emailService");
const otpService = require("../services/otpService");
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
  getMe,
};