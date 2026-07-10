// ========================================================================
// FILE : server/src/models/EmergencyContact.js
// ========================================================================

const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ------------------------------------------------------------------ */
/*  EmergencyContact — department directory citizens dispatch to.      */
/*  Seed/demo data unless explicitly replaced with a verified real      */
/*  department list (README §23).                                      */
/* ------------------------------------------------------------------ */

const CoverageAreaSchema = new Schema(
  {
    province: { type: String, default: null },
    district: { type: String, default: null },
    municipality: { type: String, default: null },
  },
  { _id: false }
);

// Defined as its own sub-schema (not an inline shorthand) so Mongoose
// doesn't misread the nested `type` key as SchemaType shorthand — that
// ambiguity is what breaks if you try to write `location: { type: {...} }`
// directly on the parent schema.
const LocationSchema = new Schema(
  {
    type: { type: String, enum: ["Point"] },
    coordinates: { type: [Number] },
  },
  { _id: false }
);

const EmergencyContactSchema = new Schema(
  {
    department: { type: String, required: true, trim: true },

    category: {
      type: String,
      required: true,
      enum: ["ambulance", "fire", "police", "rescue"],
      index: true,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
      match: [/^\+?[0-9]{7,15}$/, "Invalid phone number format"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    coverageArea: { type: CoverageAreaSchema, default: () => ({}) },

    // Optional geolocation for future "nearest department" lookups
    // (README §24 roadmap). No default — if omitted entirely, the field
    // stays absent on the document instead of saving a malformed partial
    // Point, which is what broke the sparse 2dsphere index earlier.
    location: { type: LocationSchema },

    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false }, // fallback contact for its category
  },
  { timestamps: true }
);

/* ------------------------------------------------------------------ */
/*  Validation — at least one of phone/email is required               */
/* ------------------------------------------------------------------ */

EmergencyContactSchema.pre("validate", function (next) {
  if (!this.phone && !this.email) {
    return next(new Error("At least one of phone or email is required"));
  }
  next();
});

/* ------------------------------------------------------------------ */
/*  Indexes                                                             */
/* ------------------------------------------------------------------ */

EmergencyContactSchema.index({ location: "2dsphere" }, { sparse: true });
EmergencyContactSchema.index({ category: 1, isActive: 1 });

/* ------------------------------------------------------------------ */
/*  Statics                                                             */
/* ------------------------------------------------------------------ */

// Finds the best-matching active contact for a category, preferring one
// whose coverageArea matches the citizen's address, falling back to
// that category's isDefault contact.
EmergencyContactSchema.statics.findForDispatch = async function (category, citizenAddress = {}) {
  const base = { category, isActive: true };

  if (citizenAddress.district) {
    const districtMatch = await this.findOne({
      ...base,
      "coverageArea.district": citizenAddress.district,
    });
    if (districtMatch) return districtMatch;
  }

  if (citizenAddress.province) {
    const provinceMatch = await this.findOne({
      ...base,
      "coverageArea.province": citizenAddress.province,
      "coverageArea.district": { $in: [null, undefined] },
    });
    if (provinceMatch) return provinceMatch;
  }

  const defaultContact = await this.findOne({ ...base, isDefault: true });
  if (defaultContact) return defaultContact;

  // last resort — any active contact for the category
  return this.findOne(base);
};

module.exports = mongoose.model("EmergencyContact", EmergencyContactSchema);