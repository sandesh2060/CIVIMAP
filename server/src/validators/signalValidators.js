// ========================================================================
// FILE : server/src/validators/signalValidators.js
// ========================================================================

const Joi = require("joi");

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

const cycleDurationsSchema = Joi.object({
  red: Joi.number().integer().min(1).max(600),
  yellow: Joi.number().integer().min(1).max(60),
  green: Joi.number().integer().min(1).max(600),
});

const createSignalSchema = Joi.object({
  signalId: Joi.string().trim().min(1).max(60).required(),
  name: Joi.string().trim().max(120).allow("", null).optional(),
  location: locationSchema.required(),
  cycleDurations: cycleDurationsSchema.optional(),
});

const updateSignalSchema = Joi.object({
  name: Joi.string().trim().max(120).allow("", null),
  location: locationSchema,
  cycleDurations: cycleDurationsSchema,
  isActive: Joi.boolean(),
}).min(1);

const listSignalsQuerySchema = Joi.object({
  bbox: Joi.string()
    .pattern(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
});

module.exports = {
  createSignalSchema,
  updateSignalSchema,
  listSignalsQuerySchema,
};