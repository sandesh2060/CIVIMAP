// ========================================================================
// FILE : server/src/seed/trafficSignals.seed.js
// Seeds signal-controlled junctions across Kathmandu Valley (Kathmandu,
// Lalitpur, Bhaktapur). Coordinates are best-effort approximations of
// real junctions — accurate enough for map/demo purposes.
//
// Cycle durations vary by junction type: major ring-road/highway
// junctions get longer red phases (heavier cross-traffic), smaller
// inner-city junctions get shorter cycles.
//
// Run: node src/seed/trafficSignals.seed.js
// ========================================================================

const mongoose = require("mongoose");
const { env } = require("../config/env");
const TrafficSignal = require("../models/TrafficSignal");
const logger = require("../utils/logger");

const MAJOR = { red: 45, yellow: 5, green: 35 }; // ring road / highway junctions
const STANDARD = { red: 30, yellow: 4, green: 25 }; // typical city junctions
const MINOR = { red: 20, yellow: 3, green: 18 }; // smaller inner-city junctions

const SIGNALS = [
  // ---------------- RING ROAD / MAJOR JUNCTIONS ----------------
  { signalId: "KTM-001", name: "Maitighar Mandala Signal", coordinates: [85.3222, 27.6939], cycle: MAJOR },
  { signalId: "KTM-002", name: "Tinkune Junction", coordinates: [85.3489, 27.6889], cycle: MAJOR },
  { signalId: "KTM-003", name: "Koteshwor Signal", coordinates: [85.3486, 27.6776], cycle: MAJOR },
  { signalId: "KTM-004", name: "Kalanki Signal", coordinates: [85.2812, 27.6934], cycle: MAJOR },
  { signalId: "KTM-005", name: "Chabahil Signal", coordinates: [85.3453, 27.7186], cycle: MAJOR },
  { signalId: "KTM-006", name: "Gongabu Bus Park Junction", coordinates: [85.3126, 27.7373], cycle: MAJOR },
  { signalId: "KTM-007", name: "New Baneshwor Signal", coordinates: [85.3357, 27.6913], cycle: MAJOR },
  { signalId: "KTM-008", name: "Balkhu Signal", coordinates: [85.2960, 27.6885], cycle: MAJOR },
  { signalId: "KTM-009", name: "Satdobato Junction", coordinates: [85.3255, 27.6598], cycle: MAJOR },
  { signalId: "KTM-010", name: "Gwarko Junction", coordinates: [85.3350, 27.6690], cycle: MAJOR },
  { signalId: "KTM-011", name: "Jadibuti Signal", coordinates: [85.3495, 27.6835], cycle: MAJOR },
  { signalId: "KTM-012", name: "Sinamangal Signal", coordinates: [85.3505, 27.7015], cycle: MAJOR },
  { signalId: "KTM-013", name: "Thapathali Signal", coordinates: [85.3170, 27.6940], cycle: MAJOR },
  { signalId: "KTM-014", name: "Ekantakuna Junction", coordinates: [85.3190, 27.6630], cycle: MAJOR },
  { signalId: "KTM-015", name: "Balaju Chowk Signal", coordinates: [85.3010, 27.7280], cycle: MAJOR },

  // ---------------- STANDARD CITY JUNCTIONS — KATHMANDU ----------------
  { signalId: "KTM-016", name: "Sundhara Signal", coordinates: [85.3115, 27.7017], cycle: STANDARD },
  { signalId: "KTM-017", name: "Putalisadak Signal", coordinates: [85.3230, 27.7040], cycle: STANDARD },
  { signalId: "KTM-018", name: "Ratna Park Signal", coordinates: [85.3140, 27.7050], cycle: STANDARD },
  { signalId: "KTM-019", name: "Dillibazar Signal", coordinates: [85.3280, 27.7108], cycle: STANDARD },
  { signalId: "KTM-020", name: "Bagbazar Signal", coordinates: [85.3140, 27.7060], cycle: STANDARD },
  { signalId: "KTM-021", name: "Naxal Signal", coordinates: [85.3260, 27.7135], cycle: STANDARD },
  { signalId: "KTM-022", name: "Lazimpat Signal", coordinates: [85.3200, 27.7185], cycle: STANDARD },
  { signalId: "KTM-023", name: "Baluwatar Signal", coordinates: [85.3300, 27.7195], cycle: STANDARD },
  { signalId: "KTM-024", name: "Maharajgunj Signal", coordinates: [85.3325, 27.7370], cycle: STANDARD },
  { signalId: "KTM-025", name: "Dhumbarahi Signal", coordinates: [85.3380, 27.7300], cycle: STANDARD },
  { signalId: "KTM-026", name: "Chuchepati Signal", coordinates: [85.3480, 27.7310], cycle: STANDARD },
  { signalId: "KTM-027", name: "Kalimati Signal", coordinates: [85.3010, 27.6970], cycle: STANDARD },
  { signalId: "KTM-028", name: "Sitapaila Signal", coordinates: [85.2790, 27.7130], cycle: STANDARD },
  { signalId: "KTM-029", name: "Nayabazar Signal", coordinates: [85.3120, 27.7280], cycle: STANDARD },
  { signalId: "KTM-030", name: "Samakhusi Signal", coordinates: [85.3150, 27.7325], cycle: STANDARD },
  { signalId: "KTM-031", name: "Teku Signal", coordinates: [85.3060, 27.6960], cycle: STANDARD },
  { signalId: "KTM-032", name: "Tripureshwor Signal", coordinates: [85.3160, 27.6935], cycle: STANDARD },
  { signalId: "KTM-033", name: "Babarmahal Signal", coordinates: [85.3270, 27.6935], cycle: STANDARD },
  { signalId: "KTM-034", name: "Minbhawan Signal", coordinates: [85.3395, 27.6975], cycle: STANDARD },
  { signalId: "KTM-035", name: "Old Baneshwor Signal", coordinates: [85.3430, 27.6935], cycle: STANDARD },

  // ---------------- STANDARD CITY JUNCTIONS — LALITPUR ----------------
  { signalId: "LTP-001", name: "Pulchowk Junction", coordinates: [85.3175, 27.6760], cycle: STANDARD },
  { signalId: "LTP-002", name: "Jawalakhel Signal", coordinates: [85.3130, 27.6715], cycle: STANDARD },
  { signalId: "LTP-003", name: "Lagankhel Signal", coordinates: [85.3245, 27.6660], cycle: STANDARD },
  { signalId: "LTP-004", name: "Kupondole Signal", coordinates: [85.3155, 27.6825], cycle: STANDARD },
  { signalId: "LTP-005", name: "Sanepa Signal", coordinates: [85.3075, 27.6805], cycle: MINOR },
  { signalId: "LTP-006", name: "Patan Dhoka Signal", coordinates: [85.3195, 27.6790], cycle: MINOR },
  { signalId: "LTP-007", name: "Mangal Bazar Signal", coordinates: [85.3255, 27.6730], cycle: MINOR },
  { signalId: "LTP-008", name: "Jhamsikhel Junction", coordinates: [85.3110, 27.6750], cycle: MINOR },

  // ---------------- STANDARD CITY JUNCTIONS — BHAKTAPUR ----------------
  { signalId: "BKT-001", name: "Bhaktapur Durbar Square Approach Signal", coordinates: [85.4280, 27.6720], cycle: STANDARD },
  { signalId: "BKT-002", name: "Suryabinayak Signal", coordinates: [85.4415, 27.6635], cycle: STANDARD },
  { signalId: "BKT-003", name: "Kamalbinayak Signal", coordinates: [85.4310, 27.6755], cycle: MINOR },
  { signalId: "BKT-004", name: "Thimi Signal", coordinates: [85.3960, 27.6775], cycle: STANDARD },
  { signalId: "BKT-005", name: "Lokanthali Signal", coordinates: [85.3890, 27.6790], cycle: STANDARD },

  // ---------------- MINOR INNER-CITY JUNCTIONS ----------------
  { signalId: "KTM-036", name: "Kamaladi Signal", coordinates: [85.3195, 27.7075], cycle: MINOR },
  { signalId: "KTM-037", name: "Hattisar Signal", coordinates: [85.3260, 27.7095], cycle: MINOR },
  { signalId: "KTM-038", name: "Kamalpokhari Signal", coordinates: [85.3270, 27.7130], cycle: MINOR },
  { signalId: "KTM-039", name: "Bishnumati Signal", coordinates: [85.3070, 27.7060], cycle: MINOR },
  { signalId: "KTM-040", name: "Sorhakhutte Signal", coordinates: [85.3080, 27.7145], cycle: MINOR },
  { signalId: "KTM-041", name: "Chhetrapati Signal", coordinates: [85.3095, 27.7115], cycle: MINOR },
  { signalId: "KTM-042", name: "Ason Signal", coordinates: [85.3105, 27.7075], cycle: MINOR },
  { signalId: "LTP-009", name: "Gairidhara-Lalitpur Border Signal", coordinates: [85.3230, 27.7160], cycle: MINOR },
  { signalId: "LTP-010", name: "Bakhundole Signal", coordinates: [85.3145, 27.6790], cycle: MINOR },
  { signalId: "KTM-043", name: "Anamnagar Signal", coordinates: [85.3280, 27.6975], cycle: MINOR },
];

async function seed() {
  await mongoose.connect(env.MONGO_URI);
  logger.info("Connected to MongoDB for traffic signal seeding");

  let created = 0;
  let skipped = 0;

  for (const s of SIGNALS) {
    const existing = await TrafficSignal.findOne({ signalId: s.signalId });
    if (existing) {
      skipped += 1;
      continue;
    }
    await TrafficSignal.create({
      signalId: s.signalId,
      name: s.name,
      location: { type: "Point", coordinates: s.coordinates },
      currentState: "red",
      countdownSeconds: s.cycle.red,
      cycleDurations: s.cycle,
      isMock: true,
      isActive: true,
    });
    created += 1;
  }

  logger.info(`Traffic signal seed complete — created: ${created}, skipped (already existed): ${skipped}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error("Traffic signal seed failed", { error: err.message });
  process.exit(1);
});