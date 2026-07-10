// ========================================================================
// FILE : server/src/models/TrafficSignal.js
// ========================================================================




const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ------------------------------------------------------------------ */
/*  TrafficSignal — currently backed by an in-memory mock simulator    */
/*  (see server/src/sockets/signalSocket.js). Designed so a real IoT   */
/*  feed can later write to the same shape without touching the        */
/*  frontend or the socket event contract.                             */
/* ------------------------------------------------------------------ */

const CycleDurationSchema = new Schema(
  {
    red: { type: Number, default: 30, min: 1 },     // seconds
    yellow: { type: Number, default: 4, min: 1 },
    green: { type: Number, default: 25, min: 1 },
  },
  { _id: false }
);

const TrafficSignalSchema = new Schema(
  {
    signalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    name: { type: String, trim: true, default: null }, // e.g. "Maitighar Signal"

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },

    currentState: {
      type: String,
      enum: ["red", "yellow", "green"],
      default: "red",
    },
    countdownSeconds: { type: Number, default: 30, min: 0 },
    cycleDurations: { type: CycleDurationSchema, default: () => ({}) },

    // true until real hardware is wired in per the roadmap (section 24 of README)
    isMock: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },

    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------------ */
/*  Indexes                                                             */
/* ------------------------------------------------------------------ */

TrafficSignalSchema.index({ location: "2dsphere" });

/* ------------------------------------------------------------------ */
/*  Instance methods                                                    */
/* ------------------------------------------------------------------ */

// Advances the mock cycle by one second. Called every second by the
// in-memory simulator in sockets/signalSocket.js — kept here so the
// state-transition rules live with the model, not the socket layer.
TrafficSignalSchema.methods.tick = function () {
  if (this.countdownSeconds > 1) {
    this.countdownSeconds -= 1;
    this.lastUpdated = new Date();
    return this;
  }

  // countdown hit zero — advance to the next state in the cycle
  const order = ["red", "green", "yellow"];
  const nextIndex = (order.indexOf(this.currentState) + 1) % order.length;
  this.currentState = order[nextIndex];
  this.countdownSeconds = this.cycleDurations[this.currentState];
  this.lastUpdated = new Date();
  return this;
};

/* ------------------------------------------------------------------ */
/*  Statics                                                             */
/* ------------------------------------------------------------------ */

TrafficSignalSchema.statics.findWithinBounds = function (bbox) {
  return this.find({
    isActive: true,
    location: {
      $geoWithin: {
        $box: [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
      },
    },
  });
};

module.exports = mongoose.model("TrafficSignal", TrafficSignalSchema);