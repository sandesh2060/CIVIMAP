// ========================================================================
// FILE : server/src/controllers/signalController.js
// ========================================================================

const TrafficSignal = require("../models/TrafficSignal");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

// Returns initial state only — live updates arrive via the "signal:update"
// socket event (see sockets/signalSocket.js). This endpoint exists so the
// client has something to render before the first tick arrives.
async function listSignals(req, res, next) {
  try {
    const { bbox } = req.query;
    const signals = bbox
      ? await TrafficSignal.findWithinBounds(bbox.split(",").map(Number))
      : await TrafficSignal.find({ isActive: true });

    return ApiResponse.ok(res, { signals });
  } catch (err) {
    next(err);
  }
}


async function createSignal(req, res, next) {
  try {
    const { signalId, name, location, cycleDurations } = req.body;
    const signal = await TrafficSignal.create({
      signalId,
      name,
      location: { type: "Point", coordinates: [location.lng, location.lat] },
      cycleDurations,
    });
    return ApiResponse.created(res, { signal });
  } catch (err) {
    next(err);
  }
}

async function updateSignal(req, res, next) {
  try {
    const signal = await TrafficSignal.findOne({ signalId: req.params.signalId });
    if (!signal) throw ApiError.notFound("Signal not found");

    ["name", "cycleDurations", "isActive"].forEach((field) => {
      if (req.body[field] !== undefined) signal[field] = req.body[field];
    });
    if (req.body.location) {
      signal.location = {
        type: "Point",
        coordinates: [req.body.location.lng, req.body.location.lat],
      };
    }

    await signal.save();
    return ApiResponse.ok(res, { signal });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSignals, createSignal, updateSignal };