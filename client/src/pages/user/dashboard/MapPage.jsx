// file: client/src/pages/user/dashboard/MapPage.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MapView from "../../../components/map/MapView";
import PlacePin from "../../../components/map/PlacePin";
import RouteLayer from "../../../components/map/RouteLayer";
import SignalCountdown from "../../../components/map/SignalCountdown";
import api from "../../../services/api";
import socket, { connectSocket, disconnectSocket } from "../../../services/socket";
import { useAuth } from "../../../context/AuthContext"; // adjust if your hook name differs
import { EASE } from "../../../config/tokens";

const CATEGORY_FILTERS = [
  { key: "hospital", label: "Hospitals" },
  { key: "school", label: "Schools" },
  { key: "tourist", label: "Tourist spots" },
  { key: "sensitive", label: "Sensitive sites" },
  { key: "report", label: "Road issues" },
];

export default function MapPage() {
  const { user } = useAuth?.() ?? {};
  const isAdmin = user?.accountType === "admin";

  const [places, setPlaces] = useState([]);
  const [reports, setReports] = useState([]);
  const [violations, setViolations] = useState([]);
  const [signals, setSignals] = useState([]);
  const [activeCategories, setActiveCategories] = useState(
    () => new Set(CATEGORY_FILTERS.map((c) => c.key))
  );

  const [route, setRoute] = useState(null);
  const [routeError, setRouteError] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [from, setFrom] = useState(null); // {lat,lng,label}
  const [to, setTo] = useState(null);
  const [flyTo, setFlyTo] = useState(null);

  const [reportDraft, setReportDraft] = useState(null); // {lat,lng,description,image}
  const [connected, setConnected] = useState(socket.connected);

  // ---- Initial REST load (README §8) ----
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [placesRes, reportsRes, signalsRes] = await Promise.all([
          api.get("/places"),
          api.get("/reports", { params: { status: "approved" } }),
          api.get("/signals"),
        ]);
        if (cancelled) return;
        setPlaces(placesRes.data.places ?? []);
        setReports(reportsRes.data.reports ?? []);
        setSignals(signalsRes.data.signals ?? []);
      } catch (err) {
        console.error("Failed to load map data", err);
      }

      // Violations are admin-only per README §8 — citizens never see other
      // people's violation reports, only admins get them on the map.
      if (isAdmin) {
        try {
          const violationsRes = await api.get("/violations");
          if (!cancelled) setViolations(violationsRes.data.violations ?? []);
        } catch (err) {
          console.error("Failed to load violations", err);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // ---- Socket lifecycle + live sync (README §9) ----
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
      // A report that flips to "approved" arrives separately via report:new
      // (that's the event that puts the pin on everyone's map). This handler
      // just needs to drop it if it moves to a non-visible status.
      if (status !== "approved") {
        setReports((prev) => prev.filter((r) => r._id !== reportId));
      }
    };

    const onViolationNew = ({ violation }) =>
      isAdmin && setViolations((prev) => [violation, ...prev]);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("place:new", onPlaceNew);
    socket.on("place:updated", onPlaceUpdated);
    socket.on("place:deleted", onPlaceDeleted);
    socket.on("report:new", onReportNew);
    socket.on("report:statusChanged", onReportStatusChanged);
    socket.on("violation:new", onViolationNew);

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
      disconnectSocket();
    };
  }, [isAdmin]);

  // ---- Filtering (README §3.3) ----
  const visiblePlaces = useMemo(
    () => places.filter((p) => activeCategories.has(p.category)),
    [places, activeCategories]
  );
  const visibleReports = useMemo(
    () => (activeCategories.has("report") ? reports : []),
    [reports, activeCategories]
  );

  function toggleCategory(key) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ---- Route search (README §3.1, §8) ----
  async function handleRouteSearch(e) {
    e.preventDefault();
    if (!from || !to) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const res = await api.get("/route", {
        params: { from: `${from.lat},${from.lng}`, to: `${to.lat},${to.lng}` },
      });
      setRoute(res.data);
      setFlyTo(from);
    } catch (err) {
      setRouteError(err.response?.data?.message || "Could not calculate a route.");
    } finally {
      setRouteLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setFrom({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Current location" });
    });
  }

  // ---- Click-to-report (README §3.4, ties into AI pipeline §6) ----
  // Map click behavior: first click (no destination set) picks the route
  // destination; once a destination exists, further clicks open the report
  // modal. This keeps one gesture (tap the map) doing double duty without a
  // separate mode toggle — swap in a real geocoded search box later if you
  // add self-hosted Nominatim.
  const handleMapClick = useCallback(
    (latlng) => {
      if (!to) {
        setTo({ ...latlng, label: `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}` });
      } else {
        setReportDraft({ ...latlng, description: "", image: null });
      }
    },
    [to]
  );

  async function submitReport() {
    if (!reportDraft?.image) return;
    const body = new FormData();
    body.append("image", reportDraft.image);
    body.append("description", reportDraft.description);
    body.append("location", JSON.stringify({ lat: reportDraft.lat, lng: reportDraft.lng }));

    try {
      // Status starts "pending" (README §6, §7). The eventual AI decision
      // arrives via report:new (approved, live pin) or report:statusChanged
      // (flagged/rejected) — no polling required after this call resolves.
      await api.post("/reports", body, { headers: { "Content-Type": "multipart/form-data" } });
      setReportDraft(null);
    } catch (err) {
      console.error("Failed to submit report", err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-2xl font-semibold">Live Map</h2>
          <p className="text-muted text-sm mt-1">
            Route, live signals, and pinned places — tap the map to set a destination, tap again to
            report an issue.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-2 h-2 rounded-full" style={{ background: connected ? "#16A34A" : "#DC143C" }} />
          {connected ? "Live" : "Reconnecting…"}
        </div>
      </div>

      {/* Route search */}
      <form
        onSubmit={handleRouteSearch}
        className="bg-surface border border-border rounded-lg p-3 flex flex-wrap gap-2 items-end"
      >
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-muted">From</label>
          <button
            type="button"
            onClick={useMyLocation}
            className="w-full text-left text-sm border border-border rounded px-2 py-1.5 bg-surface2"
          >
            {from?.label ?? "Use current location"}
          </button>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-muted">To</label>
          <input
            className="w-full text-sm border border-border rounded px-2 py-1.5 bg-surface2"
            placeholder="Tap the map to set destination"
            value={to?.label ?? ""}
            readOnly
          />
        </div>
        <button
          type="submit"
          disabled={!from || !to || routeLoading}
          className="text-sm font-medium rounded px-3 py-1.5 text-white disabled:opacity-50"
          style={{ background: "var(--np-crimson)" }}
        >
          {routeLoading ? "Routing…" : "Go"}
        </button>
        {route && (
          <div className="text-xs text-muted">
            {(route.distanceMeters / 1000).toFixed(1)} km · {Math.round(route.durationSeconds / 60)} min
          </div>
        )}
        {routeError && (
          <div className="text-xs" style={{ color: "var(--np-crimson)" }}>
            {routeError}
          </div>
        )}
      </form>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c.key}
            onClick={() => toggleCategory(c.key)}
            className="text-xs rounded-full px-3 py-1 border transition-colors"
            style={{
              borderColor: "var(--border)",
              background: activeCategories.has(c.key) ? "var(--np-blue)" : "transparent",
              color: activeCategories.has(c.key) ? "white" : "var(--muted)",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div
        className="bg-surface border border-border rounded-lg overflow-hidden"
        style={{ height: "65vh", minHeight: 420 }}
      >
        <MapView flyTo={flyTo && [flyTo.lat, flyTo.lng]} onMapClick={handleMapClick}>
          <RouteLayer route={route} />

          {visiblePlaces.map((place) => (
            <PlacePin key={place._id} kind="place" data={place} />
          ))}

          {visibleReports.map((report) => (
            <PlacePin key={report._id} kind="report" data={report} />
          ))}

          {isAdmin &&
            violations.map((violation) => (
              <PlacePin key={violation._id} kind="violation" data={violation} />
            ))}

          {signals.map((signal) => (
            <SignalCountdown key={signal.signalId} initial={signal} />
          ))}
        </MapView>
      </div>

      {/* Click-to-report modal */}
      <AnimatePresence>
        {reportDraft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setReportDraft(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: EASE.out }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-lg p-4 w-full max-w-sm space-y-3"
            >
              <h3 className="font-semibold">Report an issue here</h3>
              <p className="text-xs text-muted">
                {reportDraft.lat.toFixed(5)}, {reportDraft.lng.toFixed(5)}
              </p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setReportDraft((d) => ({ ...d, image: e.target.files?.[0] ?? null }))}
                className="w-full text-sm"
              />
              <textarea
                className="w-full text-sm border border-border rounded px-2 py-1.5 bg-surface2"
                rows={3}
                placeholder="Describe the issue (pothole, streetlight, garbage...)"
                value={reportDraft.description}
                onChange={(e) => setReportDraft((d) => ({ ...d, description: e.target.value }))}
              />
              <p className="text-[11px] text-muted">
                Submitted reports are checked automatically by our AI system — clear photos get
                approved fastest. You'll be notified either way.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setReportDraft(null)}
                  className="text-sm px-3 py-1.5 rounded border border-border"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReport}
                  disabled={!reportDraft.image}
                  className="text-sm px-3 py-1.5 rounded text-white disabled:opacity-50"
                  style={{ background: "var(--np-crimson)" }}
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}