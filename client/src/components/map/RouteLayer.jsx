// file: client/src/components/map/RouteLayer.jsx
import { Polyline, Marker } from "react-leaflet";
import L from "leaflet";
import { decodePolyline } from "../../utils/polyline";
import { geojsonLineToLatLngs } from "../../utils/geo";

const endIcon = (color) =>
  L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

/**
 * mapController.js returns { polyline: <GeoJSON LineString> } via OSRM's
 * geometries=geojson param — NOT an encoded polyline string. We still
 * fall back to decodePolyline() for a string, in case OSRM config ever
 * changes to geometries=polyline.
 */
export default function RouteLayer({ route }) {
  if (!route?.polyline) return null;

  const points =
    typeof route.polyline === "string"
      ? decodePolyline(route.polyline)
      : geojsonLineToLatLngs(route.polyline);

  if (points.length < 2) return null;

  return (
    <>
      <Polyline positions={points} pathOptions={{ color: "#003893", weight: 5, opacity: 0.85 }} />
      <Marker position={points[0]} icon={endIcon("#1E5631")} />
      <Marker position={points[points.length - 1]} icon={endIcon("#DC143C")} />
    </>
  );
}