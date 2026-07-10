// ========================================================================
// FILE : server/src/middleware/errorHandler.js
// ========================================================================

const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { env } = require("../config/env");

/** Converts known non-ApiError exceptions (Mongoose, JWT) into ApiErrors. */
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  if (err.name === "ValidationError") {
    // Mongoose schema validation error
    const details = Object.values(err.errors).map((e) => e.message);
    return ApiError.badRequest("Validation failed", details);
  }

  if (err.code === 11000) {
    // Mongo duplicate key
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return ApiError.conflict(`${field} already exists`);
  }

  if (err.name === "CastError") {
    return ApiError.badRequest(`Invalid value for ${err.path}`);
  }

  if (err.name === "JsonWebTokenError") {
    return ApiError.unauthorized("Invalid token");
  }

  if (err.name === "TokenExpiredError") {
    return ApiError.unauthorized("Token expired");
  }

  return ApiError.internal(err.message || "Something went wrong");
}

// 404 handler — mounted after all routes.
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Final error handler — mounted last.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const apiError = normalizeError(err);

  if (!apiError.isOperational) {
    logger.error("Unexpected error", { error: err.stack || err.message });
  } else if (apiError.statusCode >= 500) {
    logger.error(apiError.message, { details: apiError.details });
  }

  res.status(apiError.statusCode).json({
    success: false,
    message: apiError.message,
    details: apiError.details || undefined,
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });
}

module.exports = { errorHandler, notFoundHandler };