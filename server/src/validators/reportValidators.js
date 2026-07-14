// ========================================================================
// FILE : server/src/validators/reportValidators.js
// ========================================================================

const Joi = require("joi");

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

// multipart/form-data: image comes through multer, not this schema.
const createReportSchema = Joi.object({
  description: Joi.string().trim().min(5).max(1000).required(),
  category: Joi.string()
    .valid("pothole", "crack", "debris", "flooding", "streetlight", "signage", "other")
    .default("other"),
  location: Joi.alternatives()
    .try(
      locationSchema,
      Joi.string().custom((value, helpers) => {
        // allow location sent as a JSON string in multipart forms
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

const reviewReportSchema = Joi.object({
  decision: Joi.string().valid("approved", "rejected").required(),
  rejectionReason: Joi.string().trim().max(500).when("decision", {
    is: "rejected",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

const listReportsQuerySchema = Joi.object({
  status: Joi.string().valid("pending", "approved", "flagged", "rejected").optional(),
  bbox: Joi.string()
    .pattern(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
  page: Joi.number().integer().min(1).default(1),
  // was max(100) — ReportsPage.jsx requests limit: 500, which Joi was
  // rejecting with a 400. Raised to 1000; revisit with real server-side
  // pagination if report volume ever gets into the thousands.
  limit: Joi.number().integer().min(1).max(1000).default(20),
});

module.exports = {
  createReportSchema,
  reviewReportSchema,
  listReportsQuerySchema,
};