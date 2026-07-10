// ========================================================================
// FILE : server/src/models/MockVehicleRegistry.js
// ========================================================================

const mongoose = require("mongoose");
const { Schema } = mongoose;
const plateNormalizer = require("../utils/plateNormalizer");

/* ------------------------------------------------------------------ */
/*  MockVehicleRegistry — SYNTHETIC seed data only.                    */
/*  No real vehicle-owner data is stored or looked up here. This       */
/*  exists purely to demo the violation → owner-notification flow      */
/*  until a real government data-sharing integration exists            */
/*  (see README section 24, Roadmap).                                  */
/* ------------------------------------------------------------------ */

const MockVehicleRegistrySchema = new Schema(
  {
    // Normalized on save (uppercase, single-spaced) so lookups from OCR
    // output are consistent. Devanagari plate strings are supported —
    // "uppercase" is a no-op on Devanagari but harmless.
    plateNumber: {
      type: String,
      required: [true, "Plate number is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    ownerName: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, "Invalid phone number format"],
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    vehicleType: {
      type: String,
      enum: ["car", "bike", "truck", "bus", "auto", "other"],
      required: true,
    },
    vehicleModel: { type: String, trim: true, default: null },
    vehicleColor: { type: String, trim: true, default: null },

    address: {
      province: { type: String, default: null },
      district: { type: String, default: null },
    },

    isActive: { type: Boolean, default: true }, // false = "deregistered" in the mock dataset
    registeredAt: { type: Date, default: Date.now },

    // Explicit synthetic-data marker — always true, kept as a field
    // (rather than only a comment) so it can be asserted on in tests/seeds
    // and surfaced in the API response if ever needed for disclosure.
    isSynthetic: { type: Boolean, default: true, immutable: true },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------------ */
/*  Hooks — normalize plate format before validation/save              */
/* ------------------------------------------------------------------ */

MockVehicleRegistrySchema.pre("validate", function (next) {
  if (this.plateNumber) {
    this.plateNumber = this.plateNumber
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  }
  next();
});

/* ------------------------------------------------------------------ */
/*  Statics                                                             */
/* ------------------------------------------------------------------ */

// PREVIOUSLY: this file had its own `normalizePlate` static that kept
// Devanagari characters but never converted Devanagari DIGITS to Latin.
// That was a second, divergent normalizer living alongside
// plateNormalizer.js's normalizePlateKey — the two disagreed on how a
// Devanagari-digit plate should be represented, so even a byte-for-byte
// correct OCR read had no reliable path to matching a seed record.
//
// FIX: matching now happens purely on the trailing digit group (the
// actual unique identifier on a Nepali plate), extracted the same way
// on both sides via plateNormalizer.extractDigitTail(). Province/category
// text is intentionally excluded from matching — it varies too much in
// spacing/formatting between OCR reads and seed data entry to be a
// reliable key, and isn't needed to uniquely identify a vehicle here.
MockVehicleRegistrySchema.statics.findByPlate = async function (rawPlateOrDigits) {
  const targetTail = plateNormalizer.extractDigitTail(rawPlateOrDigits);
  if (!targetTail) return null;

  const candidates = await this.find({ isActive: true });
  return (
    candidates.find(
      (c) => plateNormalizer.extractDigitTail(c.plateNumber) === targetTail
    ) || null
  );
};

module.exports = mongoose.model("MockVehicleRegistry", MockVehicleRegistrySchema);