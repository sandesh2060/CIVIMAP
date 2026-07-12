// ========================================================================
// FILE : server/src/seed/mockVehicleRegistry.seed.js
// Seeds MockVehicleRegistry records and auto-links ownerUserId to a
// matching User account (by phone, then email) when one exists. All data
// here is SYNTHETIC per the model's own documentation (isSynthetic is
// always true) - see README §15, §17.
//
// Run AFTER user.seed.js so ownerUserId links correctly:
//   node src/seed/user.seed.js
//   node src/seed/mockVehicleRegistry.seed.js
// ========================================================================

const mongoose = require("mongoose");
const MockVehicleRegistry = require("../models/MockVehicleRegistry");
const User = require("../models/User");
const { env } = require("../config/env");

async function connect() {
  await mongoose.connect(env.MONGO_URI);
}

const vehiclesToSeed = [
  {
    plateNumber: "बा ४४ प ६५४८",
    ownerName: "Biplov Rijal",
    phone: "+9779765852386",
    email: "rijalbiplov7@gmail.com",
    vehicleType: "bike",
    vehicleModel: "X Pulse",
    vehicleColor: "White and Black",
    address: { province: "Lumbini", district: "Banke" },
    isActive: true,
    registeredAt: new Date(),
    // Matches the "Biplov Rijal" User in user.seed.js exactly (same
    // phone + email) - ownerUserId will link cleanly.
  },
  {
    plateNumber: "बा ५६ प १४५",
    ownerName: "Sandesh Lamichhane",
    phone: "+9779745496290",
    email: "sharmsandes121@gmail.com",
    vehicleType: "bike",
    vehicleModel: "Bullet Classic 350",
    vehicleColor: "Black",
    address: { province: "Lumbini", district: "Bardiya" },
    isActive: true,
    registeredAt: new Date(),
    // Matches the "Sandesh Lamichhane" User in user.seed.js exactly
    // (same phone + email + name) - ownerUserId will link cleanly.
  },
  {
    // ASSUMPTION - PLACEHOLDER: no plate, model, or color was ever given
    // for Sandesh Sharma's vehicle. This plate is an invented, obviously
    // synthetic value so the seed can run without colliding with the
    // other two real plates above. REPLACE with the actual plate/model/
    // color before relying on this record for anything beyond a schema
    // smoke test.
    plateNumber: "बा ९९ च ०००१",
    ownerName: "Sandesh Sharma",
    phone: "+9779816562014",
    email: "sharmasandesh6600@gmail.com",
    vehicleType: "bike", // ASSUMPTION: not provided, guessed consistent with the others
    vehicleModel: null,
    vehicleColor: null,
    address: { province: "Lumbini", district: "Bardiya" },
    isActive: true,
    registeredAt: new Date(),
    // Matches the "Sandesh Sharma" User in user.seed.js exactly (same
    // phone + email + name) - ownerUserId will link cleanly.
  },
];

// Looks up a User by phone first (most reliable), falling back to email
// if no phone match. Returns null if neither matches.
async function findMatchingUser(vehicleData) {
  const byPhone = await User.findOne({ phone: vehicleData.phone, isDeleted: false });
  if (byPhone) return byPhone;

  const byEmail = await User.findOne({ email: vehicleData.email, isDeleted: false });
  if (byEmail) return byEmail;

  return null;
}

async function seedOne(vehicleData) {
  const matchedUser = await findMatchingUser(vehicleData);

  const dataToSave = {
    ...vehicleData,
    ownerUserId: matchedUser ? matchedUser._id : null,
  };

  if (matchedUser && matchedUser.fullName !== vehicleData.ownerName) {
    console.warn(
      `WARNING: "${vehicleData.plateNumber}" owner name "${vehicleData.ownerName}" ` +
        `does not match linked User's name "${matchedUser.fullName}" ` +
        `(matched by phone/email). Linked anyway - please verify this is correct.`
    );
  }

  const existing = await MockVehicleRegistry.findOne({
    plateNumber: vehicleData.plateNumber,
  });

  if (existing) {
    Object.assign(existing, dataToSave);
    await existing.save();
    console.log(
      `Updated existing vehicle record: ${existing.plateNumber} (${existing._id})` +
        (matchedUser ? ` - linked to User ${matchedUser._id} (${matchedUser.email})` : "")
    );
  } else {
    const vehicle = await MockVehicleRegistry.create(dataToSave);
    console.log(
      `Created vehicle record: ${vehicle.plateNumber} (${vehicle._id})` +
        (matchedUser ? ` - linked to User ${matchedUser._id} (${matchedUser.email})` : "")
    );
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