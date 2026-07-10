// ========================================================================
// FILE : server/src/validators/emergencyValidators.js
// ========================================================================

const Joi = require("joi");

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

const createAlertSchema = Joi.object({
  category: Joi.string().valid("ambulance", "fire", "police", "rescue").required(),
  location: locationSchema.required(),
  note: Joi.string().trim().max(500).allow("", null).optional(),
});

const listAlertsQuerySchema = Joi.object({
  status: Joi.string().valid("dispatched", "acknowledged", "resolved").optional(),
  category: Joi.string().valid("ambulance", "fire", "police", "rescue").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const listContactsQuerySchema = Joi.object({
  category: Joi.string().valid("ambulance", "fire", "police", "rescue").optional(),
});

const coverageAreaSchema = Joi.object({
  province: Joi.string().trim().allow(null, ""),
  district: Joi.string().trim().allow(null, ""),
  municipality: Joi.string().trim().allow(null, ""),
}).optional();

const createContactSchema = Joi.object({
  department: Joi.string().trim().required(),
  category: Joi.string().valid("ambulance", "fire", "police", "rescue").required(),
  phone: Joi.string()
    .trim()
    .pattern(/^\+?[0-9]{7,15}$/)
    .allow(null, ""),
  email: Joi.string().trim().lowercase().email().allow(null, ""),
  coverageArea: coverageAreaSchema,
  location: Joi.object({
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180),
  }).optional(),
  isDefault: Joi.boolean().default(false),
})
  .or("phone", "email")
  .messages({ "object.missing": "At least one of phone or email is required" });

const updateContactSchema = Joi.object({
  department: Joi.string().trim(),
  phone: Joi.string()
    .trim()
    .pattern(/^\+?[0-9]{7,15}$/)
    .allow(null, ""),
  email: Joi.string().trim().lowercase().email().allow(null, ""),
  coverageArea: coverageAreaSchema,
  location: Joi.object({
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180),
  }).optional(),
  isActive: Joi.boolean(),
  isDefault: Joi.boolean(),
}).min(1);

module.exports = {
  createAlertSchema,
  listAlertsQuerySchema,
  listContactsQuerySchema,
  createContactSchema,
  updateContactSchema,
};