// ========================================================================
// FILE : server/src/utils/ApiError.js
// ========================================================================

/**
 * Standard operational error class. Throw this anywhere in
 * controllers/services/middleware and errorHandler.js will turn it into a
 * consistent JSON response.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null, isOperational = true) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details; // e.g. Joi validation error array
    this.isOperational = isOperational; // false = programmer error / unexpected bug
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", details = null) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }

  static tooManyRequests(message = "Too many requests") {
    return new ApiError(429, message);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message, null, false);
  }
}

module.exports = ApiError;