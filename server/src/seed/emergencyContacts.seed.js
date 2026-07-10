// ========================================================================
// FILE : server/src/seed/emergencyContacts.seed.js
// ========================================================================
//
// Run once after install:
//   cd server && node src/seed/emergencyContacts.seed.js

const mongoose = require("mongoose");
const { env } = require("../config/env");
const EmergencyContact = require("../models/EmergencyContact");
const logger = require("../utils/logger");

const CONTACTS = [
  {
    department: "Kathmandu Metropolitan Ambulance Service",
    category: "ambulance",
    phone: "+9779745706065",
    email: "pangeninischal@gmail.com",
    coverageArea: { province: "Bagmati", district: "Kathmandu", municipality: "Kathmandu" },
    isDefault: true,
  },
  {
    department: "Lalitpur Ambulance Service",
    category: "ambulance",
    phone: "+9779841000102",
    email: "ambulance.lalitpur@civimap.example",
    coverageArea: { province: "Bagmati", district: "Lalitpur", municipality: "Lalitpur" },
  },
  {
    department: "Nepal Police — Fire Brigade Kathmandu",
    category: "fire",
    phone: "+9779841000201",
    email: "fire.ktm@civimap.example",
    coverageArea: { province: "Bagmati", district: "Kathmandu", municipality: "Kathmandu" },
    isDefault: true,
  },
  {
    department: "Lalitpur Fire Brigade",
    category: "fire",
    phone: "+9779841000202",
    email: "fire.lalitpur@civimap.example",
    coverageArea: { province: "Bagmati", district: "Lalitpur", municipality: "Lalitpur" },
  },
  {
    department: "Nepal Traffic Police — Kathmandu Valley",
    category: "police",
    phone: "+9779841000301",
    email: "police.ktm@civimap.example",
    coverageArea: { province: "Bagmati", district: "Kathmandu", municipality: "Kathmandu" },
    isDefault: true,
  },
  {
    department: "Lalitpur District Police Office",
    category: "police",
    phone: "+9779841000302",
    email: "police.lalitpur@civimap.example",
    coverageArea: { province: "Bagmati", district: "Lalitpur", municipality: "Lalitpur" },
  },
  {
    department: "National Disaster Risk Reduction & Management Authority (NDRRMA) — Central",
    category: "rescue",
    phone: "+9779841000401",
    email: "rescue.central@civimap.example",
    coverageArea: { province: "Bagmati" },
    isDefault: true,
  },
  {
    department: "Nepal Red Cross Society — Kathmandu Chapter",
    category: "rescue",
    phone: "+9779841000402",
    email: "rescue.redcross.ktm@civimap.example",
    coverageArea: { province: "Bagmati", district: "Kathmandu", municipality: "Kathmandu" },
  },
];

async function seed() {
  await mongoose.connect(env.MONGO_URI);
  logger.info("Connected to MongoDB for emergency contact seeding");

  let created = 0;
  let skipped = 0;

  for (const contactData of CONTACTS) {
    const exists = await EmergencyContact.findOne({
      department: contactData.department,
      category: contactData.category,
    });
    if (exists) {
      skipped += 1;
      continue;
    }
    await EmergencyContact.create(contactData);
    created += 1;
  }

  logger.info(`Emergency contacts seed complete — created: ${created}, skipped (already existed): ${skipped}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error("Emergency contacts seed failed", { error: err.message });
  process.exit(1);
});