// file: client/src/components/map/RouteLayer.jsx
import { Polyline, Marker } from "react-leaflet";
import L from "leaflet";
import { decodePolyline } from "../../utils/polyline";

const endIcon = (color) =>
  L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

/**
 * Renders the route returned by GET /api/route (README §3.1, §8).
 * Expected shape: { polyline, distanceMeters, durationSeconds }.
 */
export default function RouteLayer({ route }) {
  if (!route?.polyline) return null;

  const points = decodePolyline(route.polyline);
  if (points.length < 2) return null;

  return (
    <>
      <Polyline positions={points} pathOptions={{ color: "#003893", weight: 5, opacity: 0.85 }} />
      <Marker position={points[0]} icon={endIcon("#16A34A")} />
      <Marker position={points[points.length - 1]} icon={endIcon("#DC143C")} />
    </>
  );
}