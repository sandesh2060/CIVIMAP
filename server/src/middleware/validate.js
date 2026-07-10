// ========================================================================
// FILE : server/src/middleware/validate.js
// ========================================================================

const ApiError = require("../utils/ApiError");

/**
 * Wraps a Joi schema into an Express middleware.
 * Usage: router.post("/", validate(reportValidators.createReport), controller.create)
 *
 * @param {import('joi').ObjectSchema} schema
 * @param {"body"|"query"|"params"} source
 */
function validate(schema, source = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message);
      return next(ApiError.badRequest("Validation failed", details));
    }

    req[source] = value;
    next();
  };
}

module.exports = validate;