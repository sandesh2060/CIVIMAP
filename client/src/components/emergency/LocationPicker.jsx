// file: client/src/components/emergency/LocationPicker.jsx
import { useState } from "react";
import { motion } from "framer-motion";
import MapView from "../map/MapView";
import { useLang } from "../../i18n/LanguageContext";
import { EASE } from "../../config/tokens";

export default function LocationPicker({ value, onChange }) {
  const { t } = useLang();
  const [locating, setLocating] = useState(false);
  const [mode, setMode] = useState("gps"); // "gps" | "manual"
  const [error, setError] = useState(null);

  function useCurrentLocation() {
    setError(null);
    setMode("gps");
    if (!navigator.geolocation) {
      setError(t("emergency.locationUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError(t("emergency.locationDenied"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleManualClick(coords) {
    setMode("manual");
    onChange(coords);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="flex-1 h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          style={{
            background: mode === "gps" ? "var(--crimson-soft)" : "var(--surface2)",
            color: mode === "gps" ? "var(--np-crimson)" : "var(--muted)",
          }}
        >
          {locating ? (
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          )}
          {t("emergency.useCurrentLocation")}
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className="flex-1 h-11 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: mode === "manual" ? "var(--crimson-soft)" : "var(--surface2)",
            color: mode === "manual" ? "var(--np-crimson)" : "var(--muted)",
          }}
        >
          {t("emergency.dropPinManually")}
        </button>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE.out }}
          className="text-xs font-medium"
          style={{ color: "var(--np-crimson)" }}
        >
          {error}
        </motion.p>
      )}

      <div className="h-56 rounded-xl overflow-hidden border border-border relative">
        <MapView center={value ? [value.lat, value.lng] : undefined} flyTo={value ? [value.lat, value.lng] : undefined} onMapClick={handleManualClick} />
        {!value && (
          <div className="absolute inset-0 grid place-items-center bg-surface/70 pointer-events-none text-xs text-muted">
            {t("emergency.tapMapToPin")}
          </div>
        )}
      </div>

      {value && (
        <p className="text-xs text-faint">
          {t("emergency.selectedLocation")}: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}