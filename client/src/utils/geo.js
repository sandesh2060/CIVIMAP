// file: client/src/utils/geo.js
// Shared geo helpers: GeoJSON <-> [lat,lng], distance, bounding boxes,
// bearing, and route-deviation math used by the turn-by-turn nav view.
// Both Place and TrafficSignal store location as GeoJSON
// { type:"Point", coordinates:[lng,lat] } — this is the single place
// that translates that into what Leaflet/UI code actually wants.

import { fmtDigits } from "../i18n/numbers";

export function toLatLng(location) {
  if (!location) return null;
  if (typeof location.lat === "number" && typeof location.lng === "number") {
    return [location.lat, location.lng];
  }
  if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
    const [lng, lat] = location.coordinates;
    return [lat, lng];
  }
  return null;
}

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/route returns { polyline: GeoJSON LineString, ... } — see mapController.js
export function geojsonLineToLatLngs(geojson) {
  if (!geojson?.coordinates) return [];
  return geojson.coordinates.map(([lng, lat]) => [lat, lng]);
}

// Route responses can carry the polyline as either a GeoJSON LineString
// (current OSRM config: geometries=geojson) or an encoded string (if that
// ever changes) — this is the one place nav/route UI code should call to
// get plain [lat,lng] points regardless of which shape came back.
export function routePolylinePoints(route, decodePolyline) {
  if (!route?.polyline) return [];
  return typeof route.polyline === "string"
    ? decodePolyline(route.polyline)
    : geojsonLineToLatLngs(route.polyline);
}

export function boundsFromLatLngs(points, padDeg = 0.01) {
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  return [
    Math.min(...lngs) - padDeg, // west
    Math.min(...lats) - padDeg, // south
    Math.max(...lngs) + padDeg, // east
    Math.max(...lats) + padDeg, // north
  ];
}

// Compass bearing (0-360, 0 = north) from point a to point b.
// Used both as a GPS-heading fallback (when the device doesn't report
// coords.heading) and to compute turn angles for maneuver icons.
export function bearingDeg([lat1, lng1], [lat2, lng2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Signed difference between two bearings, normalized to -180..180.
// Positive = turning right, negative = turning left. Used to rotate the
// maneuver arrow icon to the actual turn angle instead of a generic glyph.
export function turnAngleDeg(bearingBefore, bearingAfter) {
  if (bearingBefore == null || bearingAfter == null) return null;
  const diff = bearingAfter - bearingBefore;
  return ((diff + 540) % 360) - 180;
}

// Perpendicular distance (km) from a point to a single segment [a,b],
// via a flat equirectangular projection — accurate enough at city scale
// and much cheaper than great-circle projection per segment.
function distanceToSegmentKm(p, a, b) {
  const lat0 = (a[0] + b[0]) / 2;
  const kx = Math.cos((lat0 * Math.PI) / 180) || 1e-9;
  const toXY = ([lat, lng]) => [lng * kx, lat];
  const [px, py] = toXY(p);
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const closest = [cy, cx / kx];
  return haversineKm(p, closest);
}

// Closest distance (km) from a point to an entire polyline — this is the
// "how far off the planned route is the driver right now" check that
// drives auto-reroute during navigation.
export function distanceToPolylineKm(point, points) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegmentKm(point, points[i], points[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

// Short abbreviated form for on-screen display: "90 m", "1.2 km".
// Always Latin digits/abbreviations regardless of app language — this is
// the compact visual form, not what gets spoken. See formatDistanceSpoken
// below for the TTS-friendly version.
export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return "";
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Full-word form for text-to-speech: "90 meters" / "1.2 kilometers" in
// English, "९० मीटर" / "१.२ किलोमिटर" in Nepali. Neural TTS (Kokoro/Piper)
// reads abbreviations like "m" or "km" awkwardly or as the literal letter
// name — spelling the unit out fully reads naturally and is what a human
// navigator would actually say out loud. Digits are converted to
// Devanagari for lang === "ne" via fmtDigits (no-op for "en").
export function formatDistanceSpoken(meters, lang = "en") {
  if (meters == null || Number.isNaN(meters)) return "";
  if (meters < 1000) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return lang === "ne"
      ? `${fmtDigits(String(rounded), "ne")} मीटर`
      : `${rounded} meters`;
  }
  const km = (meters / 1000).toFixed(1);
  return lang === "ne"
    ? `${fmtDigits(km, "ne")} किलोमिटर`
    : `${km} kilometers`;
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} hr ${m} min`;
}

export default {
  toLatLng,
  haversineKm,
  geojsonLineToLatLngs,
  routePolylinePoints,
  boundsFromLatLngs,
  bearingDeg,
  turnAngleDeg,
  distanceToPolylineKm,
  formatDistance,
  formatDistanceSpoken,
  formatDuration,
};