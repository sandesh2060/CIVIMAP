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
      params: { overview: "full", geometries: "geojson" },
      timeout: 10000,
    });

    if (!data.routes || !data.routes.length) {
      throw ApiError.notFound("No route found between the given points");
    }

    const route = data.routes[0];
    return ApiResponse.ok(res, {
      polyline: route.geometry, // GeoJSON LineString
      distanceMeters: route.distance,
      durationSeconds: route.duration,
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