// ========================================================================
// FILE : server/src/validators/placeValidators.js
// ========================================================================

const Joi = require("joi");

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

const createPlaceSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  category: Joi.string().trim().lowercase().min(2).max(40).required(),
  location: locationSchema.required(),
  description: Joi.string().trim().max(500).allow("", null).optional(),
  contact: Joi.string().trim().max(100).allow("", null).optional(),
  icon: Joi.string().trim().max(60).allow("", null).optional(),
  markerColor: Joi.string().trim().max(20).allow("", null).optional(),
});

const updatePlaceSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  category: Joi.string().trim().lowercase().min(2).max(40),
  location: locationSchema,
  description: Joi.string().trim().max(500).allow("", null),
  contact: Joi.string().trim().max(100).allow("", null),
  icon: Joi.string().trim().max(60).allow("", null),
  markerColor: Joi.string().trim().max(20).allow("", null),
  isActive: Joi.boolean(),
}).min(1);

const listPlacesQuerySchema = Joi.object({
  bbox: Joi.string()
    .pattern(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
  category: Joi.string().trim().max(40).optional(),
});

const addCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(40).required(),
});

module.exports = {
  createPlaceSchema,
  updatePlaceSchema,
  listPlacesQuerySchema,
  addCategorySchema,
};