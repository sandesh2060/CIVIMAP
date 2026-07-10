// ========================================================================
// FILE : server/src/validators/violationValidators.js
// ========================================================================

const Joi = require("joi");

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

const createViolationSchema = Joi.object({
  violationType: Joi.string()
    .valid("red_light", "no_parking", "wrong_lane", "no_helmet", "over_speeding", "other")
    .default("other"),
  location: Joi.alternatives()
    .try(
      locationSchema,
      Joi.string().custom((value, helpers) => {
        try {
          const parsed = JSON.parse(value);
          const { error } = locationSchema.validate(parsed);
          if (error) return helpers.error("any.invalid");
          return parsed;
        } catch {
          return helpers.error("any.invalid");
        }
      })
    )
    .required(),
});

const reviewViolationSchema = Joi.object({
  decision: Joi.string().valid("confirmed", "rejected").required(),
  rejectionReason: Joi.string().trim().max(500).when("decision", {
    is: "rejected",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

const listViolationsQuerySchema = Joi.object({
  status: Joi.string()
    .valid("detected", "notified", "flagged", "reviewed", "rejected")
    .optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createViolationSchema,
  reviewViolationSchema,
  listViolationsQuerySchema,
};