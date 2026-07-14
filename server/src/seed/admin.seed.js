// file: server/src/seed/admin.seed.js
require("dotenv").config();
const mongoose = require("mongoose");
const { env } = require("../config/env");
const Admin = require("../models/admin/Admin");

async function seedAdmin() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  const existing = await Admin.findOne({ email: "admin@civimap.gov.np" });
  if (existing) {
    console.log("Admin already exists — skipping. _id:", existing._id.toString());
    return existing;
  }

  // Pass the PLAIN password here — Admin.js's pre-save hook hashes it
  // exactly once automatically (same pattern as authService.registerCitizen
  // for User.js). Pre-hashing it ourselves before Admin.create() was the
  // bug: create() triggers save(), the hook sees passwordHash as a
  // modified field on a new doc and hashes it again, producing a
  // double-hashed string that no single bcrypt.compare() can ever match.
  const admin = await Admin.create({
    fullName: "Sandesh Sharma",
    email: "admin@civimap.gov.np",
    passwordHash: "Admin@12345",
    role: "superadmin",
    permissions: {
      canManageSignals: true,
      canManagePlaces: true,
      canReviewReports: true,
      canReviewViolations: true,
      canManageEmergencyContacts: true,
    },
  });

  console.log("Admin created:", admin.email, "/ password: Admin@12345");
  return admin;
}

if (require.main === module) {
  seedAdmin()
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error("Admin seed failed:", err);
      process.exit(1);
    });
}

module.exports = seedAdmin;