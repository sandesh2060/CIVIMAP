// ========================================================================
// FILE : server/src/controllers/mapController.js
// ========================================================================

const axios = require("axios");
const { env } = require("../config/env");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

/**
 * Proxies routing requests to a self-hosted OSRM/GraphHopper instance
 * so the frontend never needs to know which routing engine is behind it,
 * and API keys/internal URLs stay server-side.
 */
async function getRoute(req, res, next) {
  try {
    const { from, to } = req.query;
    if (!from || !to) throw ApiError.badRequest("`from` and `to` query params are required");

    const [fromLat, fromLng] = from.split(",").map(Number);
    const [toLat, toLng] = to.split(",").map(Number);

    if ([fromLat, fromLng, toLat, toLng].some(Number.isNaN)) {
      throw ApiError.badRequest("Coordinates must be numeric `lat,lng` pairs");
    }

    // OSRM expects lng,lat order.
    const url = `${env.OSRM_SERVER_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`;
    const { data } = await axios.get(url, {
      // steps=true pulls per-maneuver turn instructions (used for the
      // turn-by-turn nav view) instead of just the overall geometry.
      params: { overview: "full", geometries: "geojson", steps: true },
      timeout: 15000,
    });

    if (!data.routes || !data.routes.length) {
      throw ApiError.notFound("No route found between the given points");
    }

    const route = data.routes[0];

    // Flatten every leg's steps into one ordered array. A single from/to
    // request is always one leg (no via-points yet), but this stays
    // correct if multi-waypoint routing is added later.
    const steps = (route.legs || []).flatMap((leg) =>
      (leg.steps || []).map((step) => ({
        distanceMeters: step.distance,
        durationSeconds: step.duration,
        instructionType: step.maneuver.type, // e.g. "turn", "roundabout", "arrive"
        modifier: step.maneuver.modifier || null, // e.g. "left", "slight right"
        streetName: step.name || null,
        exit: step.maneuver.exit ?? null,
        bearingBefore: step.maneuver.bearing_before ?? null,
        bearingAfter: step.maneuver.bearing_after ?? null,
        location: {
          lat: step.maneuver.location[1],
          lng: step.maneuver.location[0],
        },
      }))
    );

    return ApiResponse.ok(res, {
      polyline: route.geometry, // GeoJSON LineString
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      steps,
    });
  } catch (err) {
    if (err.isAxiosError) {
      logger.error("Routing engine request failed", { error: err.message });
      return next(ApiError.internal("Routing engine is unavailable"));
    }
    next(err);
  }
}

module.exports = { getRoute };