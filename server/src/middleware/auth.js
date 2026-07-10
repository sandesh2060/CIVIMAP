// ========================================================================
// FILE : server/src/middleware/auth.js
// ========================================================================

const { verifyAccessToken } = require("../utils/tokens");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const Admin = require("../models/admin/Admin");

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.split(" ")[1];
  return null;
}

/**
 * Verifies the access token and loads the corresponding account
 * (citizen from User, staff from Admin) based on the token's
 * accountType claim, attaching it to req.account / req.accountType.
 */
async function protect(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized("Authentication required");

    const payload = verifyAccessToken(token); // throws if invalid/expired

    let account;
    if (payload.accountType === "admin") {
      account = await Admin.findById(payload.sub);
    } else {
      account = await User.findById(payload.sub);
    }

    if (!account || account.isDeleted || !account.isActive) {
      throw ApiError.unauthorized("Account no longer active");
    }
    if (account.isBanned) {
      throw ApiError.forbidden("Account is banned");
    }
    if (account.changedPasswordAfter && account.changedPasswordAfter(payload.iat)) {
      throw ApiError.unauthorized("Password changed recently, please log in again");
    }

    req.account = account;
    req.accountType = payload.accountType === "admin" ? "admin" : "citizen";
    // Back-compat aliases used throughout controllers
    req.user = account;
    next();
  } catch (err) {
    next(err instanceof ApiError ? err : ApiError.unauthorized("Invalid or expired token"));
  }
}

/** Restricts a route to citizens only. */
function citizenOnly(req, res, next) {
  if (req.accountType !== "citizen") {
    return next(ApiError.forbidden("Citizen account required"));
  }
  next();
}

/** Restricts a route to admin accounts, optionally checking a permission flag. */
function adminOnly(permission = null) {
  return (req, res, next) => {
    if (req.accountType !== "admin") {
      return next(ApiError.forbidden("Admin account required"));
    }
    if (permission && !req.account.permissions?.[permission]) {
      return next(ApiError.forbidden(`Missing permission: ${permission}`));
    }
    next();
  };
}

module.exports = { protect, citizenOnly, adminOnly };