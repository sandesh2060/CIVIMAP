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
const DEFAULT_ZOOM = 14;

function isValidLatLng(pair) {
  return Array.isArray(pair) && Number.isFinite(pair[0]) && Number.isFinite(pair[1]);
}

// zoom must be a finite number — `??` alone doesn't catch NaN, since NaN
// isn't nullish. A NaN zoom doesn't fail immediately; it poisons Leaflet's
// flyTo() animation math mid-flight (see FlyToController below), which is
// why this crash showed up inside frame()/unproject rather than at the
// call site itself.
function safeZoomOr(zoom, fallback) {
  return Number.isFinite(zoom) ? zoom : fallback;
}

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

/**
 * Lets the parent imperatively recenter the map (route search, "use my
 * location"). Parents that build the `center` array inline on every
 * render (e.g. `flyTo && [flyTo.lat, flyTo.lng]`) pass a *new array
 * reference* even when the coordinates haven't actually moved — and this
 * component used to re-run map.flyTo() on every one of those renders,
 * fighting the map's own animation and producing a visible "shake" every
 * time something unrelated (a socket tick, a re-render higher up) fired.
 *
 * Fix: compare the actual lat/lng values against the last point we flew
 * to, and only call flyTo() when they genuinely changed. Also guards
 * against NaN/undefined coordinates AND a NaN zoom — either one reaching
 * Leaflet's flyTo() corrupts the animation and throws "Invalid LatLng".
 */
function FlyToController({ center, zoom }) {
  const map = useMap();
  const lastFlownRef = useRef(null);

  useEffect(() => {
    if (!isValidLatLng(center)) return;
    const [lat, lng] = center;
    const last = lastFlownRef.current;
    const unchanged = last && Math.abs(last[0] - lat) < 1e-6 && Math.abs(last[1] - lng) < 1e-6;
    if (unchanged) return;

    let cancelled = false;

   
    function flyWhenSized() {
      if (cancelled) return;
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) {
        map.invalidateSize();
        requestAnimationFrame(flyWhenSized);
        return;
      }

      lastFlownRef.current = [lat, lng];
      const safeZoom = safeZoomOr(zoom, map.getZoom());
      const current = map.getCenter();
      const distMeters = current.distanceTo(L.latLng(lat, lng));
      if (distMeters < 30) {
        map.setView([lat, lng], safeZoom);
      } else {
        map.flyTo([lat, lng], safeZoom, { duration: 0.8 });
      }
    }

    flyWhenSized();
    return () => {
      cancelled = true;
    };
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
  const initialCenter = useMemo(
    () => (isValidLatLng(center) ? center : DEFAULT_CENTER),
    [center]
  );
  const safeInitialZoom = safeZoomOr(zoom, DEFAULT_ZOOM);
  const safeFlyTo = isValidLatLng(flyTo) ? flyTo : null;

  return (
    <MapContainer center={initialCenter} zoom={safeInitialZoom} scrollWheelZoom style={{ width: "100%", height: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <SizeFix />
      <ViewportSync />
      <ClickCapture onMapClick={onMapClick} />
      {safeFlyTo && <FlyToController center={safeFlyTo} zoom={safeInitialZoom} />}
      {children}
    </MapContainer>
  );
}