// ========================================================================
// FILE : server/src/models/Place.js
// ========================================================================



const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ------------------------------------------------------------------ */
/*  Place — map pins: hospitals, schools, tourist spots, sensitive     */
/*  sites, and admin-defined custom categories.                        */
/* ------------------------------------------------------------------ */

// Default categories ship with the app; admins can add more via
// /api/places/categories, so `category` stays a free-text field rather
// than a hard enum — validate against PlaceCategory.findActive() at the
// controller/service layer instead of at the schema level.
const DEFAULT_CATEGORIES = ["hospital", "school", "tourist", "sensitive", "custom"];

const PlaceSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Place name is required"],
      trim: true,
      maxlength: 150,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    address: { type: String, default: null },

    description: { type: String, trim: true, maxlength: 1000, default: null },

    contact: {
      phone: { type: String, default: null },
      email: { type: String, default: null },
      website: { type: String, default: null },
    },

    // Lets the frontend render a distinct marker per category without
    // hardcoding a lookup table client-side.
    icon: { type: String, default: null }, // icon key, e.g. "hospital-cross"
    markerColor: { type: String, default: "#3B82F6" },

    addedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    isActive: { type: Boolean, default: true }, // soft hide without deleting

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------------ */
/*  Indexes                                                             */
/* ------------------------------------------------------------------ */

PlaceSchema.index({ location: "2dsphere" });
PlaceSchema.index({ category: 1, isActive: 1 });
PlaceSchema.index({ name: "text", description: "text" });

/* ------------------------------------------------------------------ */
/*  Statics                                                             */
/* ------------------------------------------------------------------ */

PlaceSchema.statics.findWithinBounds = function (bbox, category) {
  const query = {
    isDeleted: false,
    isActive: true,
    location: {
      $geoWithin: {
        $box: [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
      },
    },
  };
  if (category) query.category = category.toLowerCase();
  return this.find(query);
};

PlaceSchema.statics.defaultCategories = function () {
  return DEFAULT_CATEGORIES;
};

PlaceSchema.query.activeOnly = function () {
  return this.where({ isDeleted: false, isActive: true });
};

module.exports = mongoose.model("Place", PlaceSchema);