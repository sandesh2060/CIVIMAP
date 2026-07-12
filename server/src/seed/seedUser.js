// ========================================================================
// FILE : server/src/seed/user.seed.js
// Seeds citizen User accounts for local testing of the OTP login flow
// and to back mockVehicleRegistry.seed.js's ownerUserId auto-linking.
// Every field is set explicitly (rather than relying on schema defaults)
// so each one is visible and editable.
//
// Run BEFORE mockVehicleRegistry.seed.js:
//   node src/seed/user.seed.js
//   node src/seed/mockVehicleRegistry.seed.js
// ========================================================================

const mongoose = require("mongoose");
// This package ships as an ES module with a default export; depending on
// the installed build, plain require() can return { default: NepaliDate }
// instead of the class itself. Handle both shapes.
const NepaliDateModule = require("nepali-date-converter");
const NepaliDate = NepaliDateModule.default || NepaliDateModule;
const User = require("../models/User");
const { env } = require("../config/env");

async function connect() {
  await mongoose.connect(env.MONGO_URI);
}

// Small helper so a user block can pass a BS (Bikram Sambat) date as
// (year, month, day) with month 1-indexed (Baisakh = 1), converted to
// the 0-indexed format the library actually wants.
function bsToGregorian(year, month1Indexed, day) {
  return new NepaliDate(year, month1Indexed - 1, day).toJsDate();
}

const usersToSeed = [
  {
    fullName: "Biplov Rijal",
    email: "rijalbiplov7@gmail.com",
    // ASSUMPTION: "9765852386" given with no country code - prefixed
    // +977 to match schema validation.
    phone: "+9779765852386",
    // ASSUMPTION: not provided - left null. Fill in if known.
    dateOfBirth: null,
    // ASSUMPTION: not provided - inferred male from "Biplov" typically
    // being a male given name in Nepal. Change if incorrect.
    gender: "male",
    citizenshipNumber: null, // ASSUMPTION: not provided
    profileImage: { url: null, publicId: null },

    address: { province: "Lumbini", district: "Banke" },
    // ASSUMPTION: no coordinates given - left at schema default [0, 0].
    // Update with real coordinates if you have them, since this feeds
    // 2dsphere-indexed "nearby" queries.
    location: { type: "Point", coordinates: [0, 0] },

    role: "citizen",
    isActive: true,
    isBanned: false,
    banReason: null,
    bannedAt: null,

    isEmailVerified: true,
    isPhoneVerified: true,

    languagePref: "en",
    notificationPrefs: { email: true, whatsapp: true, sms: false, push: true },
    theme: "system",

    stats: {
      reportsSubmitted: 0,
      reportsApproved: 0,
      reportsRejected: 0,
      violationsSubmitted: 0,
      violationsConfirmed: 0,
      violationsRejected: 0,
    },
    trustScore: 50,

    isDeleted: false,
    deletedAt: null,
    // No passwordHash - this citizen logs in via OTP only.
  },
  {
    fullName: "Sandesh Lamichhane",
    email: "sharmsandes121@gmail.com",
    phone: "+9779745496290",
    dateOfBirth: null, // ASSUMPTION: not provided
    gender: "male", // ASSUMPTION: inferred from given name
    citizenshipNumber: null,
    profileImage: { url: null, publicId: null },

    address: { province: "Lumbini", district: "Bardiya" },
    location: { type: "Point", coordinates: [0, 0] }, // ASSUMPTION: not provided

    role: "citizen",
    isActive: true,
    isBanned: false,
    banReason: null,
    bannedAt: null,

    isEmailVerified: true,
    isPhoneVerified: true,

    languagePref: "en",
    notificationPrefs: { email: true, whatsapp: true, sms: false, push: true },
    theme: "system",

    stats: {
      reportsSubmitted: 0,
      reportsApproved: 0,
      reportsRejected: 0,
      violationsSubmitted: 0,
      violationsConfirmed: 0,
      violationsRejected: 0,
    },
    trustScore: 50,

    isDeleted: false,
    deletedAt: null,
    // No passwordHash - this citizen logs in via OTP only.
  },
  {
    fullName: "Sandesh Sharma",
    email: "sharmasandesh6600@gmail.com",
    // NOTE: using +9779816562014 here, NOT +9779745496290 - that number
    // belongs to "Sandesh Lamichhane" above, and phone is unique on User.
    phone: "+9779816562014",
    dateOfBirth: bsToGregorian(2060, 12, 24), // BS 2060-12-24 (Chaitra 24), as given
    gender: "male", // ASSUMPTION: inferred from given name
    citizenshipNumber: null, // ASSUMPTION: not provided
    profileImage: { url: null, publicId: null },

    // Parsed from "lumbini 05 province gulariya-2 bardiya hanuman tole"
    // as: province Lumbini, district Bardiya, municipality Gulariya with
    // ward 2, street Hanuman Tole. Flag if this parsing is wrong.
    address: {
      province: "Lumbini",
      district: "Bardiya",
      municipality: "Gulariya",
      wardNo: 2,
      street: "Hanuman Tole",
    },
    // ASSUMPTION: exact coordinates not provided - this is Gulariya
    // municipality's approximate center, not a precise address pin.
    location: { type: "Point", coordinates: [81.3418, 28.1998] }, // [lng, lat]

    role: "citizen",
    isActive: true,
    isBanned: false,
    banReason: null,
    bannedAt: null,

    isEmailVerified: true,
    isPhoneVerified: true,

    languagePref: "en",
    notificationPrefs: { email: true, whatsapp: true, sms: false, push: true },
    theme: "system",

    stats: {
      reportsSubmitted: 0,
      reportsApproved: 0,
      reportsRejected: 0,
      violationsSubmitted: 0,
      violationsConfirmed: 0,
      violationsRejected: 0,
    },
    trustScore: 50,

    isDeleted: false,
    deletedAt: null,
    // No passwordHash - this citizen logs in via OTP only.
  },
];

async function seedOne(userData) {
  const existing = await User.findOne({
    $or: [{ email: userData.email }, { phone: userData.phone }],
  });

  if (existing) {
    Object.assign(existing, userData);
    await existing.save({ validateBeforeSave: false });
    console.log(`Updated existing citizen record: ${existing.email} (${existing._id})`);
  } else {
    const user = await User.create(userData);
    console.log(`Created citizen record: ${user.email} (${user._id})`);
  }
}

async function seed() {
  await connect();

  for (const userData of usersToSeed) {
    await seedOne(userData);
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});