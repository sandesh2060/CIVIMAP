// ========================================================================
// FILE : server/src/validators/authValidators.js
// ========================================================================
const Joi = require("joi");
const { EMAIL_REGEX, PHONE_REGEX } = require("../utils/identifier");

const identifierSchema = Joi.string()
  .trim()
  .required()
  .custom((value, helpers) => {
    if (!EMAIL_REGEX.test(value) && !PHONE_REGEX.test(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  }, "email-or-phone")
  .messages({ "any.invalid": "Enter a valid email or phone number" });

const otpRequestSchema = Joi.object({
  identifier: identifierSchema,
});

const otpVerifySchema = Joi.object({
  identifier: identifierSchema,
  code: Joi.string().trim().pattern(/^[0-9]{6}$/).required(),
  deviceId: Joi.string().optional(),
});

const adminLoginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

module.exports = { otpRequestSchema, otpVerifySchema, adminLoginSchema };