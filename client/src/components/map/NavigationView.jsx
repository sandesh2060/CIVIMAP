// file: client/src/components/map/NavigationView.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import RouteLayer from "./RouteLayer";
import { getInstruction } from "../../utils/maneuvers";
import { speak, stopSpeaking, setVoiceEnabled, isVoiceSupported } from "../../utils/voice";
import {
  routePolylinePoints,
  distanceToPolylineKm,
  bearingDeg,
  haversineKm,
  formatDistance,
  formatDuration,
} from "../../utils/geo";
import { decodePolyline } from "../../utils/polyline";

// Thresholds tuned for city driving/riding speeds — not exposed as props
// since "like Google Maps" behavior is the whole point here.
const ANNOUNCE_FAR_M = 250; // "In 250m, turn right..."
const ANNOUNCE_NEAR_M = 60; // "Turn right onto..."
const ADVANCE_STEP_M = 25; // close enough to a maneuver to move to the next step
const ARRIVE_THRESHOLD_M = 15;
const DEVIATION_THRESHOLD_M = 50;
const DEVIATION_CONFIRM_COUNT = 3; // consecutive off-route reads before rerouting

// UI strings that are spoken (or shown right next to something spoken) need
// to match the app language, same pattern as MapPage's local T dict.
const NT = {
  en: {
    then: "Then",
    recalculating: "Recalculating route…",
    recalculatingSpeech: "Recalculating route",
    locError: "Couldn't get your location. Check location permissions and try again.",
    arrivedTitle: "You've arrived",
    done: "Done",
    inPrefix: (dist, text) => `In ${dist}, ${text}`,
  },
  ne: {
    then: "त्यसपछि",
    recalculating: "मार्ग पुनः गणना गर्दै…",
    recalculatingSpeech: "मार्ग पुनः गणना गर्दै",
    locError: "स्थान प्राप्त गर्न सकिएन। कृपया लोकेसन अनुमति जाँच गरी फेरि प्रयास गर्नुहोस्।",
    arrivedTitle: "तपाईं आइपुग्नुभयो",
    done: "पूरा भयो",
    inPrefix: (dist, text) => `${dist} पछि, ${text}`,
  },
};

const puckIcon = L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;border-radius:9999px;background:#1a73e8;border:3px solid #fff;box-shadow:0 0 0 2px rgba(26,115,232,0.35),0 2px 8px rgba(0,0,0,0.45)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/** Straight up-arrow, rotated to the real turn angle when we have one. */
function ManeuverIcon({ kind, turnAngle }) {
  if (kind === "arrive") {
    return (
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }
  if (kind === "roundabout") {
    return (
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="7" />
        <path d="M12 5v4M19 12l-3-1.5" />
      </svg>
    );
  }
  const rotate = kind === "uturn" ? 180 : turnAngle ?? 0;
  return (
    <svg
      viewBox="0 0 24 24"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${rotate}deg)`, transition: "transform 0.25s ease" }}
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

/** Locks the camera on the driver's current position, following each GPS fix. */
function FollowCamera({ position, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    map.setView([position.lat, position.lng], zoom, { animate: true, duration: 0.4 });
  }, [position, zoom, map]);

  useEffect(() => {
    // The map sits in an oversized, off-screen-padded, rotated wrapper
    // (see the rotation note in the parent component) — Leaflet needs a
    // nudge after that layout settles to pick up its real pixel size.
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);

  return null;
}

export default function NavigationView({ route, destination, lang = "en", onExit, onRouteUpdate }) {
  const nt = NT[lang] ?? NT.en;

  const [navRoute, setNavRoute] = useState(route);
  const [position, setPosition] = useState(null);
  const [heading, setHeading] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [locError, setLocError] = useState(null);
  const [voiceOn, setVoiceOn] = useState(isVoiceSupported());
  const [stageSize, setStageSize] = useState({ w: 800, h: 800 });

  const routeRef = useRef(route);
  const stepIndexRef = useRef(0);
  const announcedRef = useRef({});
  const deviationCountRef = useRef(0);
  const reroutingRef = useRef(false);
  const lastPositionRef = useRef(null);
  const watchIdRef = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    routeRef.current = navRoute;
  }, [navRoute]);

  const setStep = useCallback((i) => {
    stepIndexRef.current = i;
    setStepIndex(i);
  }, []);

  // ---- Voice on/off ----
  useEffect(() => {
    setVoiceEnabled(voiceOn);
  }, [voiceOn]);
  useEffect(() => () => stopSpeaking(), []);

  // ---- Size the rotated map wrapper to the viewport's diagonal so no
  // corner goes blank when it's rotated to any heading. ----
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const diag = Math.ceil(Math.sqrt(w * w + h * h)) + 40;
      setStageSize({ w: diag, h: diag });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Reroute from the current position to the original destination ----
  const triggerReroute = useCallback(
    async (pos) => {
      if (reroutingRef.current) return;
      reroutingRef.current = true;
      setRerouting(true);
      speak(nt.recalculatingSpeech, lang);
      try {
        const res = await api.get("/route", {
          params: { from: `${pos.lat},${pos.lng}`, to: `${destination.lat},${destination.lng}` },
        });
        const updated = res.data.data;
        setNavRoute(updated);
        setStep(0);
        announcedRef.current = {};
        deviationCountRef.current = 0;
        onRouteUpdate?.(updated);
      } catch (err) {
        console.error("Reroute failed", err);
      } finally {
        reroutingRef.current = false;
        setRerouting(false);
      }
    },
    [destination, onRouteUpdate, setStep, lang, nt.recalculatingSpeech]
  );

  // ---- Core progress logic, run on every GPS fix ----
  const processFix = useCallback(
    (pos) => {
      const current = routeRef.current;
      const steps = current?.steps || [];
      const idx = stepIndexRef.current;
      const step = steps[idx];
      if (!step) return;

      const isLast = idx === steps.length - 1;
      const distToManeuverM =
        haversineKm([pos.lat, pos.lng], [step.location.lat, step.location.lng]) * 1000;

      const { text } = getInstruction(step, isLast, lang);
      const a = (announcedRef.current[idx] = announcedRef.current[idx] || {});

      if (!a.far && distToManeuverM <= ANNOUNCE_FAR_M && distToManeuverM > ANNOUNCE_NEAR_M) {
        a.far = true;
        speak(nt.inPrefix(formatDistance(distToManeuverM), text), lang);
      }
      if (!a.near && distToManeuverM <= ANNOUNCE_NEAR_M) {
        a.near = true;
        speak(text, lang);
      }

      const advanceThreshold = isLast ? ARRIVE_THRESHOLD_M : ADVANCE_STEP_M;
      if (distToManeuverM <= advanceThreshold) {
        if (isLast) {
          if (!arrived) {
            setArrived(true);
            speak(text, lang); // "arrive" text from getInstruction is already localized
          }
        } else {
          setStep(idx + 1);
        }
      }

      // Deviation check against the whole route polyline.
      if (current) {
        const points = routePolylinePoints(current, decodePolyline);
        if (points.length >= 2) {
          const offRouteM = distanceToPolylineKm([pos.lat, pos.lng], points) * 1000;
          if (offRouteM > DEVIATION_THRESHOLD_M) {
            deviationCountRef.current += 1;
            if (deviationCountRef.current >= DEVIATION_CONFIRM_COUNT) {
              triggerReroute(pos);
            }
          } else {
            deviationCountRef.current = 0;
          }
        }
      }
    },
    [arrived, setStep, triggerReroute, lang, nt]
  );

  // ---- GPS watch ----
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError(nt.locError);
      return;
    }

    const handleFix = (geoPos) => {
      const { latitude, longitude, heading: gpsHeading, speed } = geoPos.coords;
      const next = { lat: latitude, lng: longitude };
      setLocError(null);

      setHeading((prevHeading) => {
        // Prefer the device's own compass/GPS heading when it's moving
        // fast enough for it to be reliable; otherwise fall back to the
        // bearing between the last two fixes, and hold the last known
        // heading rather than jitter when basically stationary.
        if (gpsHeading != null && !Number.isNaN(gpsHeading) && (speed == null || speed > 0.5)) {
          return gpsHeading;
        }
        const last = lastPositionRef.current;
        if (last) {
          const movedM = haversineKm([last.lat, last.lng], [next.lat, next.lng]) * 1000;
          if (movedM > 3) return bearingDeg([last.lat, last.lng], [next.lat, next.lng]);
        }
        return prevHeading;
      });

      lastPositionRef.current = next;
      setPosition(next);
      processFix(next);
    };

    const handleError = () => {
      setLocError(nt.locError);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(handleFix, handleError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15000,
    });

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processFix, nt.locError]);

  const steps = navRoute?.steps || [];
  const currentStep = steps[stepIndex];
  const nextStep = steps[stepIndex + 1];
  const isLastStep = stepIndex === steps.length - 1;

  const current = useMemo(() => getInstruction(currentStep, isLastStep, lang), [currentStep, isLastStep, lang]);
  const upNext = useMemo(
    () => (nextStep ? getInstruction(nextStep, stepIndex + 1 === steps.length - 1, lang) : null),
    [nextStep, stepIndex, steps.length, lang]
  );

  const distToManeuverM = useMemo(() => {
    if (!position || !currentStep) return null;
    return haversineKm([position.lat, position.lng], [currentStep.location.lat, currentStep.location.lng]) * 1000;
  }, [position, currentStep]);

  const remaining = useMemo(() => {
    return steps.slice(stepIndex).reduce(
      (acc, s) => ({ distance: acc.distance + s.distanceMeters, duration: acc.duration + s.durationSeconds }),
      { distance: 0, duration: 0 }
    );
  }, [steps, stepIndex]);

  const etaClock = useMemo(() => {
    const d = new Date(Date.now() + (remaining.duration || 0) * 1000);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }, [remaining.duration]);

  const initialCenter = position
    ? [position.lat, position.lng]
    : (routePolylinePoints(navRoute, decodePolyline)[0] ?? [27.7172, 85.324]);

  return (
    <div className="fixed inset-0 z-[999]" style={{ background: "#0b1220" }}>
      {/* Rotated, oversized map stage — vanilla Leaflet doesn't support
          whole-map rotation, so heading-up is approximated by rotating
          this wrapper opposite the current heading with CSS. Trade-off:
          street name labels baked into the OSM tiles will appear rotated
          too. Map interaction (drag/click/zoom) is intentionally disabled
          in this view since click coordinates aren't rotation-aware. */}
      <div ref={stageRef} className="absolute inset-0 overflow-hidden">
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: stageSize.w,
            height: stageSize.h,
            transform: `translate(-50%, -50%) rotate(${-heading}deg)`,
            transition: "transform 0.3s linear",
          }}
        >
          <MapContainer
            center={initialCenter}
            zoom={17}
            zoomControl={false}
            attributionControl={true}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
            keyboard={false}
            style={{ width: "100%", height: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <RouteLayer route={navRoute} />
            {position && <Marker position={[position.lat, position.lng]} icon={puckIcon} />}
            <FollowCamera position={position} zoom={17} />
          </MapContainer>
        </div>
      </div>

      {/* Top instruction card */}
      <div className="absolute top-0 left-0 right-0 p-3">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl px-4 py-3.5 flex items-center gap-3.5"
          style={{ background: "#111827", color: "#fff", boxShadow: "0 6px 24px rgba(0,0,0,0.35)" }}
        >
          <span className="w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ background: "#1a73e8" }}>
            <ManeuverIcon kind={current.kind} turnAngle={current.turnAngle} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-semibold leading-tight truncate">
              {distToManeuverM != null ? formatDistance(distToManeuverM) : ""}
            </p>
            <p className="text-[13.5px] opacity-85 truncate">{current.text}</p>
          </div>
        </motion.div>

        {upNext && (
          <div
            className="mt-1.5 rounded-xl px-3.5 py-2 text-[12px] flex items-center gap-2"
            style={{ background: "rgba(17,24,39,0.75)", color: "#cbd5e1" }}
          >
            <span className="opacity-70">{nt.then}</span>
            <span className="truncate">{upNext.text}</span>
          </div>
        )}

        <AnimatePresence>
          {rerouting && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1.5 rounded-xl px-3.5 py-2 text-[12.5px] text-center font-medium"
              style={{ background: "#1a73e8", color: "#fff" }}
            >
              {nt.recalculating}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {locError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1.5 rounded-xl px-3.5 py-2 text-[12.5px] text-center font-medium"
              style={{ background: "var(--np-crimson, #DC143C)", color: "#fff" }}
            >
              {locError}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
          style={{ background: "#111827", color: "#fff", boxShadow: "0 -4px 20px rgba(0,0,0,0.3)" }}
        >
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{etaClock}</p>
            <p className="text-[11.5px] opacity-70 truncate">
              {formatDuration(remaining.duration)} · {formatDistance(remaining.distance)}
              {destination?.label ? ` · ${destination.label}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isVoiceSupported() && (
              <button
                onClick={() => setVoiceOn((v) => !v)}
                aria-label={voiceOn ? "Mute voice guidance" : "Unmute voice guidance"}
                className="w-10 h-10 rounded-full grid place-items-center"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                {voiceOn ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </button>
            )}
            <button
              onClick={onExit}
              aria-label="Exit navigation"
              className="w-10 h-10 rounded-full grid place-items-center"
              style={{ background: "var(--np-crimson, #DC143C)" }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Arrived overlay */}
      <AnimatePresence>
        {arrived && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center p-6"
            style={{ background: "rgba(11,18,32,0.85)" }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-2xl p-6 max-w-xs w-full text-center"
              style={{ background: "#fff" }}
            >
              <span className="inline-grid place-items-center w-14 h-14 rounded-full mb-3" style={{ background: "var(--green-soft, #e6f4ea)" }}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#1e7e34" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <p className="text-lg font-semibold mb-1" style={{ color: "#111827" }}>{nt.arrivedTitle}</p>
              <p className="text-sm mb-4" style={{ color: "#6b7280" }}>{destination?.label || ""}</p>
              <button
                onClick={onExit}
                className="w-full py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: "var(--np-crimson, #DC143C)", color: "#fff" }}
              >
                {nt.done}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}