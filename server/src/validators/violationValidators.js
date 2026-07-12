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

  // Used by the crop -> AI detect -> citizen-confirm flow
  // (ViolationUpload.jsx + violationController.js createViolation): when
  // present, the server reuses the already-uploaded preview image and
  // the citizen-confirmed plate text instead of re-running AI detection
  // via the async job. All four are optional so the original
  // direct-upload path (no preview step) still validates with none of
  // them present. Without these, Joi's default unknown-key handling was
  // silently dropping every one of these fields, which meant a citizen's
  // manual correction never reached the server — the async job would
  // re-run AI on the same photo and overwrite the correction with the
  // same wrong read.
  previewImageUrl: Joi.string().uri().optional(),
  previewImagePublicId: Joi.string().trim().optional(),
  confirmedPlateNumber: Joi.string().trim().max(30).optional(),
  confirmedConfidence: Joi.alternatives()
    .try(Joi.number().min(0).max(1), Joi.string())
    .optional(),
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