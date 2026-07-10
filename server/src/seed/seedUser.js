// ========================================================================
// FILE : server/src/seed/seedUser.js
// One-off script to seed real citizen records for local testing of the
// OTP login flow. Every field in the User schema is set explicitly below
// (rather than relying on schema defaults) so you can see and edit each
// one. Run with: node src/seed/seedUser.js
// ========================================================================

const mongoose = require("mongoose");
// This package ships as an ES module with a default export; depending on
// the installed build, plain require() can return { default: NepaliDate }
// instead of the class itself. Handle both shapes.
const NepaliDateModule = require("nepali-date-converter");
const NepaliDate = NepaliDateModule.default || NepaliDateModule;
const User = require("../models/User");
const { env } = require("../config/env");

// NOTE: assumes config/env.js exposes MONGO_URI. If your db connection
// lives in config/db.js as a connectDB() export instead, swap the two
// lines below for: const connectDB = require("../config/db"); await connectDB();
async function connect() {
  await mongoose.connect(env.MONGO_URI);
}

// Small helper so each user block below can pass a BS (Bikram Sambat)
// date as (year, month, day) with month 1-indexed (Baisakh = 1), and we
// convert to the 0-indexed format the library actually wants.
function bsToGregorian(year, month1Indexed, day) {
  return new NepaliDate(year, month1Indexed - 1, day).toJsDate();
}

const usersToSeed = [
  {
    /* ---------- Identity — from you ---------- */
    fullName: "Sandesh Sharma",
    email: "sharmasandesh6600@gmail.com",
    // ASSUMPTION: you gave "9745496290" with no country code — prefixed
    // +977 to match the schema's E.164-style expectation. Remove the
    // prefix here if you store numbers without it.
    phone: "+9779745496290",
    dateOfBirth: bsToGregorian(2060, 12, 24), // BS 2060-12-24 (Chaitra 24), as given
    // ASSUMPTION: not provided — inferred from "Sandesh" typically being a
    // male given name in Nepal. Change if incorrect.
    gender: "male",
    citizenshipNumber: null, // ASSUMPTION: not provided

    /* ---------- Identity — schema fields you didn't provide, defaulted ---------- */
    profileImage: {
      url: null, // ASSUMPTION: no photo yet — upload later via Cloudinary
      publicId: null,
    },

    /* ---------- Location — parsed from "lumbini 05 province gulariya-2
       bardiya hanuman tole" as: province Lumbini (the province formerly
       numbered "Province No. 5"), district Bardiya, municipality
       Gulariya with ward 2, street Hanuman Tole. Flag if this parsing
       is wrong — e.g. if "05" was meant to be the ward number instead
       of a province reference. ---------- */
    address: {
      province: "Lumbini",
      district: "Bardiya",
      municipality: "Gulariya",
      wardNo: 2,
      street: "Hanuman Tole",
    },
    // ASSUMPTION: exact coordinates not provided — this is Gulariya
    // municipality's approximate center, not a precise address pin.
    // Update with the real coordinates if you have them (e.g. from a
    // map picker), since this feeds 2dsphere-indexed "nearby" queries.
    location: {
      type: "Point",
      coordinates: [81.3418, 28.1998], // [lng, lat] — Gulariya, Bardiya (approximate)
    },

    /* ---------- Account type & status — ASSUMPTIONS, review these ---------- */
    role: "citizen",
    isActive: true,
    isBanned: false,
    banReason: null,
    bannedAt: null,

    /* ---------- Verification — ASSUMPTIONS ---------- */
    isEmailVerified: true,
    isPhoneVerified: true,

    /* ---------- Preferences — ASSUMPTIONS ---------- */
    languagePref: "en",
    notificationPrefs: {
      email: true,
      whatsapp: true,
      sms: false,
      push: true,
    },
    theme: "system",

    /* ---------- Civic engagement stats — fresh account, all zero ---------- */
    stats: {
      reportsSubmitted: 0,
      reportsApproved: 0,
      reportsRejected: 0,
      violationsSubmitted: 0,
      violationsConfirmed: 0,
      violationsRejected: 0,
    },
    trustScore: 50,

    /* ---------- Soft delete — fresh account ---------- */
    isDeleted: false,
    deletedAt: null,

    // No passwordHash — this citizen logs in via OTP only.
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