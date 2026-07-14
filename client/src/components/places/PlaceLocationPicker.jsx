// file: client/src/components/places/PlaceLocationPicker.jsx
import { Marker } from "react-leaflet";
import L from "leaflet";
import MapView from "../map/MapView";
import { useLang } from "../../i18n/LanguageContext";
import { getCategoryStyle } from "../../utils/placeCategoryStyle";

function isValidCoords(v) {
  return !!v && Number.isFinite(v.lat) && Number.isFinite(v.lng);
}

// Colored divIcon matching the category's badge color/icon, so the pin
// on the picker map is the same pin the admin will see in the table
// once saved — no surprises after Save.
function buildCategoryDivIcon(category) {
  const { color, path } = getCategoryStyle(category);
  const html = `
    <div style="
      width:30px;height:30px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);border:2px solid white;
    ">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        style="transform:rotate(45deg)">
        <path d="${path}" />
      </svg>
    </div>`;
  return L.divIcon({
    html,
    className: "", // clear Leaflet's default marker box styling
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}

/**
 * Lat/lng inputs + an embedded map, for the Places admin form.
 * - Typing valid lat/lng flies the map there and drops a preview pin —
 *   lets the admin visually confirm the point before saving.
 * - Clicking the map sets lat/lng directly (equivalent to picking a
 *   point instead of typing coordinates).
 * Both paths go through the same onChange, so there's one source of
 * truth for the coordinates regardless of how they were set.
 */
export default function PlaceLocationPicker({ latValue, lngValue, category, onLatChange, onLngChange, onPick }) {
  const { t } = useLang();

  const parsedLat = parseFloat(latValue);
  const parsedLng = parseFloat(lngValue);
  const coords = isValidCoords({ lat: parsedLat, lng: parsedLng })
    ? { lat: parsedLat, lng: parsedLng }
    : null;

  function handleMapClick(pt) {
    onPick(pt);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted block mb-1">{t("places.lat")}</label>
          <input
            value={latValue}
            onChange={(e) => onLatChange(e.target.value)}
            placeholder="27.7172"
            className="w-full h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">{t("places.lng")}</label>
          <input
            value={lngValue}
            onChange={(e) => onLngChange(e.target.value)}
            placeholder="85.3240"
            className="w-full h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm"
          />
        </div>
      </div>

      <div className="h-56 rounded-xl overflow-hidden border border-border relative">
        <MapView
          center={coords ? [coords.lat, coords.lng] : undefined}
          flyTo={coords ? [coords.lat, coords.lng] : undefined}
          onMapClick={handleMapClick}
        >
          {coords && (
            <Marker position={[coords.lat, coords.lng]} icon={buildCategoryDivIcon(category)} />
          )}
        </MapView>
        {!coords && (
          <div className="absolute inset-0 grid place-items-center bg-surface/70 pointer-events-none text-xs text-muted text-center px-4">
            {t("places.tapMapOrTypeCoords") || "Tap the map to drop a pin, or type coordinates above"}
          </div>
        )}
      </div>

      {coords && (
        <p className="text-xs text-faint">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}