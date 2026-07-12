// ========================================================================
// FILE : server/src/validators/notificationValidators.js
// ========================================================================
const Joi = require("joi");

const broadcastSchema = Joi.object({
  title: Joi.string().trim().min(2).max(120).required(),
  message: Joi.string().trim().min(2).max(500).required(),
});

module.exports = { broadcastSchema };