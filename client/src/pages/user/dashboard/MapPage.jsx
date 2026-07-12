// file: client/src/pages/user/dashboard/MapPage.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import MapView from "../../../components/map/MapView";
import PlacePin from "../../../components/map/PlacePin";
import RouteLayer from "../../../components/map/RouteLayer";
import SignalCountdown from "../../../components/map/SignalCountdown";
import NavigationView from "../../../components/map/NavigationView";
import api from "../../../services/api";
import socket, { connectSocket, disconnectSocket } from "../../../services/socket";
import { useAuth } from "../../../context/AuthContext";
import { useLang } from "../../../i18n/LanguageContext";
import { EASE } from "../../../config/tokens";
import { toLatLng, haversineKm, geojsonLineToLatLngs, boundsFromLatLngs } from "../../../utils/geo";
import { decodePolyline } from "../../../utils/polyline";
import { primeVoice } from "../../../utils/voice";

// Strings that don't exist yet in translations.js — kept local so this
// page doesn't depend on an i18n file edit to ship. Move these into
// translations.js under a "nav.*" prefix whenever convenient.
const T = {
  en: {
    title: "Navigate",
    subtitle: "Route, live signal countdowns, and nearby places — all in one place.",
    searchPlaceholder: "Search by name, or \"school\", \"hospital\"...",
    from: "From",
    to: "To",
    useLocation: "Use current location",
    tapMapOrPick: "Tap the map or pick a result",
    go: "Go",
    routing: "Routing…",
    distance: "Distance",
    duration: "Base ETA",
    smartEta: "Smart ETA",
    smartEtaHint: "Adjusted for live signal wait along your route",
    nearby: "Nearby",
    noResults: "No matching places nearby",
    all: "All",
    sos: "SOS",
    routeError: "Could not calculate a route.",
    locationDenied: "Couldn't get your location.",
    startNavigation: "Start Navigation",
  },
  ne: {
    title: "नेभिगेट",
    subtitle: "मार्ग, प्रत्यक्ष सिग्नल काउन्टडाउन, र नजिकैका स्थानहरू — एउटै ठाउँमा।",
    searchPlaceholder: "नाम, वा \"विद्यालय\", \"अस्पताल\" खोज्नुहोस्...",
    from: "बाट",
    to: "सम्म",
    useLocation: "हालको स्थान प्रयोग गर्नुहोस्",
    tapMapOrPick: "नक्सामा ट्याप गर्नुहोस् वा नतिजा छान्नुहोस्",
    go: "जानुहोस्",
    routing: "मार्ग गणना हुँदै…",
    distance: "दूरी",
    duration: "आधार ETA",
    smartEta: "स्मार्ट ETA",
    smartEtaHint: "मार्गमा रहेका सिग्नलको पर्खाइ समय समावेश गरी",
    nearby: "नजिकैका",
    noResults: "नजिकै कुनै मिल्दो स्थान भेटिएन",
    all: "सबै",
    sos: "आपतकालीन",
    routeError: "मार्ग गणना गर्न सकिएन।",
    locationDenied: "स्थान प्राप्त गर्न सकिएन।",
    startNavigation: "नेभिगेसन सुरु गर्नुहोस्",
  },
};

const CATEGORY_CHIPS = ["hospital", "school", "tourist", "sensitive"];

export default function MapPage() {
  const { user } = useAuth?.() ?? {};
  const isAdmin = user?.accountType === "admin";
  const { lang, t } = useLang();
  const nt = T[lang] ?? T.en;

  const [places, setPlaces] = useState([]);
  const [reports, setReports] = useState([]);
  const [violations, setViolations] = useState([]);

  const [from, setFrom] = useState(null); // {lat,lng,label}
  const [to, setTo] = useState(null);
  const [flyTo, setFlyTo] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(null); // null = all

  const [route, setRoute] = useState(null);
  const [routeError, setRouteError] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [corridorSignals, setCorridorSignals] = useState([]);
  const [navigating, setNavigating] = useState(false);

  const [connected, setConnected] = useState(socket.connected);

  // Passed to MapView's `flyTo` prop. Memoized by *value* (lat/lng), not
  // just by the `flyTo` state reference — MapView also guards against
  // reference churn internally, but doing it here too means a re-render
  // triggered by something unrelated (a socket tick, etc.) never even
  // constructs a new array, which is what caused the map "shaking".
  const flyToCenter = useMemo(() => (flyTo ? [flyTo.lat, flyTo.lng] : null), [flyTo?.lat, flyTo?.lng]);

  // ---- Initial REST load ----
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [placesRes, reportsRes] = await Promise.all([
          api.get("/places"),
          api.get("/reports", { params: { status: "approved" } }),
        ]);
        if (cancelled) return;
        // Every endpoint returns the { success, message, data } envelope
        // (see ApiResponse.ok on the server) — the payload is nested one
        // level under `data`, so it's `res.data.data.<field>`, not `res.data.<field>`.
        setPlaces(placesRes.data.data.places ?? []);
        setReports(reportsRes.data.data.reports ?? []);
      } catch (err) {
        console.error("Failed to load map data", err);
      }
      if (isAdmin) {
        try {
          const violationsRes = await api.get("/violations");
          if (!cancelled) setViolations(violationsRes.data.data.violations ?? []);
        } catch (err) {
          console.error("Failed to load violations", err);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isAdmin]);

  // ---- Socket lifecycle ----
  useEffect(() => {
    connectSocket();
    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onPlaceNew = ({ place }) => setPlaces((prev) => [place, ...prev]);
    const onPlaceUpdated = ({ place }) =>
      setPlaces((prev) => prev.map((p) => (p._id === place._id ? place : p)));
    const onPlaceDeleted = ({ place }) =>
      setPlaces((prev) => prev.filter((p) => p._id !== place._id));
    const onReportNew = ({ report }) => setReports((prev) => [report, ...prev]);
    const onReportStatusChanged = ({ reportId, status }) => {
      if (status !== "approved") setReports((prev) => prev.filter((r) => r._id !== reportId));
    };
    const onViolationNew = ({ violation }) => isAdmin && setViolations((prev) => [violation, ...prev]);

    // Keeps the smart-ETA calc live even though each SignalCountdown
    // marker also tracks its own state independently.
    const onSignalUpdate = (payload) => {
      setCorridorSignals((prev) => {
        if (!prev.some((s) => s.signalId === payload.signalId)) return prev;
        return prev.map((s) =>
          s.signalId === payload.signalId
            ? { ...s, state: payload.state, countdownSeconds: payload.countdownSeconds }
            : s
        );
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("place:new", onPlaceNew);
    socket.on("place:updated", onPlaceUpdated);
    socket.on("place:deleted", onPlaceDeleted);
    socket.on("report:new", onReportNew);
    socket.on("report:statusChanged", onReportStatusChanged);
    socket.on("violation:new", onViolationNew);
    socket.on("signal:update", onSignalUpdate);

    if (isAdmin) socket.emit("admin:subscribeQueue");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("place:new", onPlaceNew);
      socket.off("place:updated", onPlaceUpdated);
      socket.off("place:deleted", onPlaceDeleted);
      socket.off("report:new", onReportNew);
      socket.off("report:statusChanged", onReportStatusChanged);
      socket.off("violation:new", onViolationNew);
      socket.off("signal:update", onSignalUpdate);
      disconnectSocket();
    };
  }, [isAdmin]);

  // ---- Current location ----
  const useMyLocation = useCallback(() => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError(nt.locationDenied);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: nt.useLocation };
        setFrom(pt);
        setFlyTo(pt);
        setLocating(false);
      },
      () => {
        setLocError(nt.locationDenied);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [nt]);

  // ---- Ranked nearby search (README §3.3 + Nepal-context category search) ----
  const nearbyResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const originLatLng = from ? [from.lat, from.lng] : null;

    return places
      .filter((p) => {
        if (category && p.category !== category) return false;
        if (q && !p.name?.toLowerCase().includes(q) && !p.category?.toLowerCase().includes(q)) return false;
        return true;
      })
      .map((p) => {
        const pos = toLatLng(p.location);
        const distanceKm = originLatLng && pos ? haversineKm(originLatLng, pos) : null;
        return { ...p, __pos: pos, distanceKm };
      })
      .filter((p) => p.__pos)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      .slice(0, 15);
  }, [places, query, category, from]);

  // ---- Route computation ----
  const computeRoute = useCallback(async (fromPt, toPt) => {
    if (!fromPt || !toPt) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const res = await api.get("/route", {
        params: { from: `${fromPt.lat},${fromPt.lng}`, to: `${toPt.lat},${toPt.lng}` },
      });
      // mapController's getRoute returns { polyline, distanceMeters, durationSeconds, steps }
      // wrapped in the standard { success, message, data } envelope — unwrap it here.
      setRoute(res.data.data);
      setFlyTo(fromPt);
    } catch (err) {
      setRouteError(err.response?.data?.message || nt.routeError);
      setRoute(null);
    } finally {
      setRouteLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRouteSearch(e) {
    e.preventDefault();
    computeRoute(from, to);
  }

  function pickNearbyResult(place) {
    const pos = place.__pos;
    const dest = { lat: pos[0], lng: pos[1], label: place.name };
    setTo(dest);
    if (from) computeRoute(from, dest);
  }

  // ---- Corridor-scoped signals (README §3.2, live along the route only) ----
  useEffect(() => {
    if (!route?.polyline) {
      setCorridorSignals([]);
      return;
    }
    const points =
      typeof route.polyline === "string" ? decodePolyline(route.polyline) : geojsonLineToLatLngs(route.polyline);
    if (points.length < 2) return;
    const bbox = boundsFromLatLngs(points, 0.01); // ~1km corridor padding
    api
      .get("/signals", { params: { bbox: bbox.join(",") } })
      .then((res) => setCorridorSignals(res.data.data.signals ?? []))
      .catch((err) => console.error("Failed to load corridor signals", err));
  }, [route]);

  // ---- Smart ETA — base OSRM duration + estimated signal wait ----
  const smartEtaMin = useMemo(() => {
    if (!route) return null;
    const baseMin = route.durationSeconds / 60;
    const waitMin = corridorSignals.reduce((sum, s) => {
      const state = s.state ?? s.currentState;
      const yellowCycle = s.cycleDurations?.yellow ?? 4;
      const redCycle = s.cycleDurations?.red ?? 30;
      if (state === "red") return sum + (s.countdownSeconds ?? redCycle / 2) / 60;
      if (state === "yellow") return sum + yellowCycle / 60;
      return sum + 5 / 60; // small buffer even on green, in case it flips on approach
    }, 0);
    return Math.round(baseMin + waitMin);
  }, [route, corridorSignals]);

  const visiblePlaces = useMemo(
    () => (category ? places.filter((p) => p.category === category) : places),
    [places, category]
  );

  // ---- Map click: always sets/updates the destination. No second-tap
  // "report an issue" behavior here anymore — reporting has its own
  // explicit entry point on the Reports page, so an accidental extra tap
  // on the map while picking a destination can no longer pop up an
  // unrelated form. ----
  const handleMapClick = useCallback(
    (latlng) => {
      const dest = { ...latlng, label: `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}` };
      setTo(dest);
      if (from) computeRoute(from, dest);
    },
    [from, computeRoute]
  );

  // ---- Enter navigation mode. primeVoice() MUST be called synchronously
  // inside this click handler (not inside an effect, timer, or the
  // geolocation callback that follows) — that's what unlocks
  // speechSynthesis on browsers (notably mobile Safari) that otherwise
  // silently refuse to speak anything not triggered by a direct user
  // gesture. See utils/voice.js for the full explanation. ----
  const handleStartNavigation = useCallback(() => {
    primeVoice();
    setNavigating(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>{nt.title}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{nt.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: connected ? "#1E5631" : "#DC143C" }} />
            {connected ? t("reports.live") : t("reports.offline")}
          </div>
          {/* SOS — client-side route change only, no reload */}
          <Link
            to="../emergency"
            relative="path"
            className="text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1.5"
            style={{ background: "var(--np-crimson)", color: "var(--text-on-brand)", boxShadow: "var(--shadow-btn)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            {nt.sos}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* ---- Left panel: search + nearby + route summary ---- */}
        <div className="surface-card rounded-lg p-4 space-y-4" style={{ background: "var(--surface)" }}>
          {/* From / To */}
          <div className="space-y-2">
            <div>
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>{nt.from}</label>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="lux-input w-full text-left text-sm rounded-lg px-3 py-2 flex items-center gap-2 disabled:opacity-60"
              >
                {locating ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--np-blue)" strokeWidth="1.8" className="w-3.5 h-3.5 shrink-0">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  </svg>
                )}
                <span style={{ color: from ? "var(--text)" : "var(--text-placeholder)" }}>
                  {from?.label ?? nt.useLocation}
                </span>
              </button>
            </div>
            <div>
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>{nt.to}</label>
              <div className="lux-input w-full text-sm rounded-lg px-3 py-2" style={{ color: to ? "var(--text)" : "var(--text-placeholder)" }}>
                {to?.label ?? nt.tapMapOrPick}
              </div>
            </div>
            <form onSubmit={handleRouteSearch}>
              <button
                type="submit"
                disabled={!from || !to || routeLoading}
                className="lux-btn-primary w-full py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {routeLoading ? nt.routing : nt.go}
              </button>
            </form>
            {locError && <p className="text-xs font-medium" style={{ color: "var(--np-crimson)" }}>{locError}</p>}
            {routeError && <p className="text-xs font-medium" style={{ color: "var(--np-crimson)" }}>{routeError}</p>}
          </div>

          {/* Route summary + smart ETA */}
          <AnimatePresence>
            {route && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE.out }}
                className="rounded-lg p-3 space-y-1.5 overflow-hidden"
                style={{ background: "var(--blue-soft)" }}
              >
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--text-muted)" }}>{nt.distance}</span>
                  <span style={{ color: "var(--text)" }} className="font-medium">
                    {(route.distanceMeters / 1000).toFixed(1)} km
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--text-muted)" }}>{nt.duration}</span>
                  <span style={{ color: "var(--text)" }} className="font-medium">
                    {Math.round(route.durationSeconds / 60)} min
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--np-blue)" }} className="font-semibold">{nt.smartEta}</span>
                  <span style={{ color: "var(--np-blue)" }} className="font-semibold">{smartEtaMin} min</span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>{nt.smartEtaHint}</p>

                {route.steps?.length > 0 && (
                  <button
                    type="button"
                    onClick={handleStartNavigation}
                    className="w-full mt-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ background: "var(--np-blue)", color: "#fff" }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11l19-9-9 19-2-8-8-2z" />
                    </svg>
                    {nt.startNavigation}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategory(null)}
              className="text-xs rounded-full px-3 py-1 border transition-colors"
              style={{
                borderColor: "var(--border)",
                background: !category ? "var(--np-blue)" : "transparent",
                color: !category ? "var(--text-on-brand)" : "var(--text-muted)",
              }}
            >
              {nt.all}
            </button>
            {CATEGORY_CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setCategory((prev) => (prev === c ? null : c))}
                className="text-xs rounded-full px-3 py-1 border transition-colors"
                style={{
                  borderColor: "var(--border)",
                  background: category === c ? "var(--np-blue)" : "transparent",
                  color: category === c ? "var(--text-on-brand)" : "var(--text-muted)",
                }}
              >
                {t(`places.category.${c}`)}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            className="lux-input w-full text-sm rounded-lg px-3 py-2"
            placeholder={nt.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {/* Nearby ranked results */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{nt.nearby}</p>
            {nearbyResults.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>{nt.noResults}</p>
            )}
            {nearbyResults.map((place) => (
              <button
                key={place._id}
                onClick={() => pickNearbyResult(place)}
                className="w-full text-left rounded-lg px-3 py-2 flex items-center justify-between gap-2 transition-colors"
                style={{ background: to?.label === place.name ? "var(--crimson-soft)" : "var(--surface-2)" }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{place.name}</div>
                  <div className="text-[11px] capitalize" style={{ color: "var(--text-muted)" }}>
                    {t(`places.category.${place.category}`) || place.category}
                  </div>
                </div>
                {place.distanceKm != null && (
                  <span className="text-xs shrink-0" style={{ color: "var(--np-blue)" }}>
                    {place.distanceKm.toFixed(1)} km
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Map ---- */}
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)", height: "72vh", minHeight: 460 }}>
          <MapView flyTo={flyToCenter} onMapClick={handleMapClick}>
            <RouteLayer route={route} />

            {visiblePlaces.map((place) => (
              <PlacePin key={place._id} kind="place" data={place} />
            ))}

            {reports.map((report) => (
              <PlacePin key={report._id} kind="report" data={report} />
            ))}

            {isAdmin && violations.map((violation) => (
              <PlacePin key={violation._id} kind="violation" data={violation} />
            ))}

            {/* Corridor-scoped only — not every signal in the city */}
            {corridorSignals.map((signal) => (
              <SignalCountdown key={signal.signalId} initial={signal} />
            ))}
          </MapView>
        </div>
      </div>

      {/* Full-screen turn-by-turn navigation */}
      <AnimatePresence>
        {navigating && route && to && (
          <NavigationView
            route={route}
            destination={to}
            lang={lang}
            onRouteUpdate={setRoute}
            onExit={() => setNavigating(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}