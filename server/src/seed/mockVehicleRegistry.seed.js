// ========================================================================
// FILE : server/src/seed/mockVehicleRegistry.seed.js
// One-off script to seed a MockVehicleRegistry record for local testing
// of the violation → owner-notification flow. All data here is SYNTHETIC
// per the model's own documentation (isSynthetic is always true) — see
// README §15, §17. Run with: node src/seed/mockVehicleRegistry.seed.js
// ========================================================================

const mongoose = require("mongoose");
const MockVehicleRegistry = require("../models/MockVehicleRegistry");
const { env } = require("../config/env");

async function connect() {
  await mongoose.connect(env.MONGO_URI);
}

const vehiclesToSeed = [
  {
    // Plate as you read it directly off the physical plate: "BA 72 PA
    // 641". Stored in Devanagari to match how it's actually printed and
    // how your OCR pipeline reads real Nepali plates — the schema's
    // pre-validate hook + normalizePlate() both support this Unicode
    // range, so lookups from OCR output will match correctly.
    plateNumber: "बा ४४ प ६५४८",

    // ASSUMPTION: not given for this entry — reused from your earlier
    // seeded citizen record since the phone number matches. Correct if
    // this should be a different owner.
    ownerName: "Sandesh Sharma",
    // ASSUMPTION: "9816562014" given with no country code — prefixed
    // +977 to match the schema's phone format validation, consistent
    // with your other seeded records.
    phone: "+9779816562014",
    email: "sharmsandes121@gmail.com",

    vehicleType: "bike", // motorcycle — closest enum value available
    vehicleModel: null, // ASSUMPTION: not provided — update if known
    vehicleColor: "Black", // from the photo

    // ASSUMPTION: not given for this vehicle — reused from your Bardiya
    // address on the citizen record as a placeholder.
    address: {
      province: "Lumbini",
      district: "Bardiya",
    },

    isActive: true,
    registeredAt: new Date(),
    // isSynthetic defaults to true and is immutable — not set explicitly.
  },
];

async function seedOne(vehicleData) {
  const existing = await MockVehicleRegistry.findOne({
    plateNumber: vehicleData.plateNumber,
  });

  if (existing) {
    Object.assign(existing, vehicleData);
    await existing.save();
    console.log(`Updated existing vehicle record: ${existing.plateNumber} (${existing._id})`);
  } else {
    const vehicle = await MockVehicleRegistry.create(vehicleData);
    console.log(`Created vehicle record: ${vehicle.plateNumber} (${vehicle._id})`);
  }
}

async function seed() {
  await connect();

  for (const vehicleData of vehiclesToSeed) {
    await seedOne(vehicleData);
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});