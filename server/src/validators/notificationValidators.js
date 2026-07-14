// ========================================================================
// FILE : server/src/validators/notificationValidators.js
// ========================================================================
const Joi = require("joi");

const broadcastSchema = Joi.object({
  title: Joi.string().trim().min(2).max(120).required(),
  message: Joi.string().trim().min(2).max(500).required(),
  titleNe: Joi.string().trim().min(2).max(120).allow("", null).optional(),
  messageNe: Joi.string().trim().min(2).max(500).allow("", null).optional(),
  audience: Joi.string().valid("all", "admins").default("all"),
});

module.exports = { broadcastSchema };