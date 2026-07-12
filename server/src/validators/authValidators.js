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

/* ---------- profile update ---------- */
// Deliberately a strict allow-list mirroring the fields on User.js that
// are meant to be citizen-editable. Anything not listed here (email,
// phone, role, trustScore, stats, verification flags, etc.) is
// registry-sourced / server-managed and must never be settable through
// this endpoint, regardless of what a client sends.

const addressSchema = Joi.object({
  province: Joi.string().trim().allow("", null),
  district: Joi.string().trim().allow("", null),
  municipality: Joi.string().trim().allow("", null),
  wardNo: Joi.number().integer().min(1).allow(null),
  street: Joi.string().trim().allow("", null),
});

const notificationPrefsSchema = Joi.object({
  email: Joi.boolean(),
  whatsapp: Joi.boolean(),
  sms: Joi.boolean(),
  push: Joi.boolean(),
});

const updateProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100),
  dateOfBirth: Joi.date().max("now").allow(null),
  gender: Joi.string().valid("male", "female", "other", "prefer_not_to_say"),
  address: addressSchema,
  languagePref: Joi.string().valid("en", "ne"),
  theme: Joi.string().valid("light", "dark", "system"),
  notificationPrefs: notificationPrefsSchema,
})
  .min(1)
  .messages({ "object.min": "Provide at least one field to update" });

module.exports = {
  otpRequestSchema,
  otpVerifySchema,
  adminLoginSchema,
  updateProfileSchema,
};