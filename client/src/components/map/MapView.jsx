// file: client/src/components/map/MapView.jsx
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import socket from "../../services/socket";

// Leaflet's default marker icon paths break under Vite's asset bundling —
// point them at CDN-hosted images instead of shipping local copies.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Kathmandu — sensible default center until the user's location resolves.
const DEFAULT_CENTER = [27.7172, 85.324];

/**
 * Watches the map's current bounds and tells the server which viewport
 * room to join (debounced 400ms on pan/zoom), so place:new/updated/deleted
 * broadcasts stay scoped to what's actually on screen.
 * See server/src/sockets/mapSocket.js — map:subscribeViewport / bbox.
 */
function ViewportSync() {
  const map = useMap();
  const timeoutRef = useRef(null);

  const emitBbox = () => {
    const b = map.getBounds();
    socket.emit("map:subscribeViewport", {
      bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    });
  };

  useEffect(() => {
    emitBbox();
    return () => socket.emit("map:unsubscribeViewport");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useMapEvents({
    moveend: () => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(emitBbox, 400);
    },
  });

  return null;
}

/**
 * Leaflet measures its container's size once on mount. If that mount
 * happens while a parent flex/grid box is still settling (common right
 * after a route change), Leaflet can lock in a 0x0 size and render nothing
 * even though the wrapper div looks fine. Forcing one invalidateSize()
 * after mount (and on window resize) fixes that blank-map symptom.
 */
function SizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t = setTimeout(fix, 100);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

/** Lets the parent imperatively recenter the map (route search, "use my location"). */
function FlyToController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

/** Reports map clicks back to the parent — powers the click-to-report flow. */
function ClickCapture({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function MapView({ center, zoom = 14, flyTo, onMapClick, children }) {
  const initialCenter = useMemo(() => center ?? DEFAULT_CENTER, [center]);

  return (
    <MapContainer center={initialCenter} zoom={zoom} scrollWheelZoom style={{ width: "100%", height: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <SizeFix />
      <ViewportSync />
      <ClickCapture onMapClick={onMapClick} />
      {flyTo && <FlyToController center={flyTo} zoom={zoom} />}
      {children}
    </MapContainer>
  );
}