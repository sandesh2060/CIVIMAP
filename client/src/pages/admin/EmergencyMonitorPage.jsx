// file: client/src/pages/admin/EmergencyMonitorPage.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import socket, { connectSocket } from "../../services/socket";
import { useLang } from "../../i18n/LanguageContext";
import { EASE } from "../../config/tokens";
import AlertCard from "../../components/emergency/AlertCard";
import { useCachedFetch, invalidateCache } from "../../hooks/useCachedFetch";

const CATEGORIES = ["ambulance", "fire", "police", "rescue"];
const STATUSES = ["dispatched", "acknowledged", "resolved"];

export default function EmergencyMonitorPage() {
  const { t } = useLang();
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [flashIds, setFlashIds] = useState(() => new Set());

  const cacheKey = `admin:emergency:${statusFilter}:${categoryFilter}`;

  async function fetchAlerts() {
    // IMPORTANT: explicit limit. Without this, the request falls back to
    // the server's Joi default of limit: 20 — on a live dispatch queue
    // this silently hides every alert past the 20th.
    const params = { limit: 200 };
    if (statusFilter !== "all") params.status = statusFilter;
    if (categoryFilter !== "all") params.category = categoryFilter;
    const res = await api.get("/emergency/alerts", { params });
    return res.data.data.alerts || [];
  }

  const { data: alertsData, loading, setData } = useCachedFetch(cacheKey, fetchAlerts, {
    deps: [statusFilter, categoryFilter],
  });
  const alerts = alertsData || [];

  useEffect(() => {
    const s = connectSocket();
    s.emit("admin:subscribeQueue");

    const flash = (id) => {
      setFlashIds((prev) => new Set(prev).add(id));
      setTimeout(() => setFlashIds((prev) => { const n = new Set(prev); n.delete(id); return n; }), 2500);
    };

    // Live events only affect the currently-viewed filter's cache entry
    // directly; other filter combinations will just pick up the change
    // next time they're revalidated (visited), which is fine — they're
    // not on screen right now.
    const onNew = ({ alert }) => {
      setData((prev) => [alert, ...(prev || [])]);
      flash(alert._id);
      invalidateCache("admin:overview");
    };
    const onStatusChanged = ({ alertId, status }) => {
      setData((prev) => (prev || []).map((a) => (a._id === alertId ? { ...a, status } : a)));
      flash(alertId);
      invalidateCache("admin:overview");
    };

    socket.on("emergency:new", onNew);
    socket.on("emergency:statusChanged", onStatusChanged);
    return () => {
      socket.off("emergency:new", onNew);
      socket.off("emergency:statusChanged", onStatusChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  async function handleResolve(id) {
    await api.patch(`/emergency/alerts/${id}/resolve`);
    setData((prev) => (prev || []).map((a) => (a._id === id ? { ...a, status: "resolved" } : a)));
    invalidateCache("admin:overview");
  }

  const openCount = useMemo(
    () => alerts.filter((a) => a.status !== "resolved").length,
    [alerts]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-text">{t("emergency.monitorTitle")}</h2>
          <p className="text-muted text-sm mt-1">{t("emergency.monitorSubtitle", { n: openCount })}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm text-text"
        >
          <option value="all">{t("reports.allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`emergency.status.${s}`)}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm text-text"
        >
          <option value="all">{t("emergency.allCategories")}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`emergency.category.${c}`)}</option>
          ))}
        </select>
      </div>

      {loading && alerts.length === 0 ? (
        <div className="py-16 text-center text-muted text-sm">{t("common.loading")}…</div>
      ) : alerts.length === 0 ? (
        <div className="py-16 text-center text-muted text-sm">{t("emergency.noActiveAlerts")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {alerts.map((alert, i) => (
              <motion.div
                key={alert._id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  boxShadow: flashIds.has(alert._id) ? "0 0 0 2px var(--np-crimson)" : "none",
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE.out, delay: i * 0.02 }}
                className="rounded-xl"
              >
                <AlertCard alert={alert} showReporter onResolve={handleResolve} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}