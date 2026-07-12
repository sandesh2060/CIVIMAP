// ========================================================================
// FILE : server/src/utils/ApiResponse.js
// ========================================================================

/**
 * Standard success-response shape so every endpoint returns the same
 * envelope: { success, statusCode, message, data }.
 */
class ApiResponse {
  constructor(statusCode, data = null, message = "Success") {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }

  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
    });
  }

static ok(res, data, message) {
  return res.status(200).json({ success: true, data, message });
}

  static created(res, data, message = "Created") {
    return new ApiResponse(201, data, message).send(res);
  }

  static noContent(res, message = "No content") {
    return new ApiResponse(204, null, message).send(res);
  }
}

module.exports = ApiResponse;