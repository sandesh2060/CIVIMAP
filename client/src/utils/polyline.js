// file: client/src/utils/polyline.js
// Decodes an OSRM/Google-style encoded polyline string into [lat, lng] pairs.
// OSRM's default geometry encoding uses precision 5, same as Google's algorithm.
// If your /api/route response actually returns GeoJSON coordinates instead of
// an encoded string, skip this file and map coordinates directly ([lng,lat] -> [lat,lng]).
export function decodePolyline(encoded, precision = 5) {
  if (!encoded) return [];
  const factor = Math.pow(10, precision);
  let index = 0,
    lat = 0,
    lng = 0;
  const points = [];

  while (index < encoded.length) {
    let result = 0,
      shift = 0,
      byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / factor, lng / factor]);
  }

  return points;
}