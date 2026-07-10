// file: client/src/pages/user/dashboard/EmergencyPage.jsx
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import api from "../../../services/api";
import socket, { connectSocket } from "../../../services/socket";
import { useLang } from "../../../i18n/LanguageContext";
import { EASE } from "../../../config/tokens";
import CategoryButton from "../../../components/emergency/CategoryButton";
import LocationPicker from "../../../components/emergency/LocationPicker";
import EmergencyConfirmation from "../../../components/emergency/EmergencyConfirmation";
import AlertCard from "../../../components/emergency/AlertCard";

const CATEGORIES = ["ambulance", "fire", "police", "rescue"];

export default function EmergencyPage() {
  const { t } = useLang();

  const [category, setCategory] = useState(null);
  const [location, setLocation] = useState(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [dispatched, setDispatched] = useState(null);
  const [resolving, setResolving] = useState(false);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await api.get("/emergency/alerts/mine");
      setHistory(res.data.data.alerts || []);
    } catch {
      // non-fatal — history is a courtesy view, not the core flow
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
    connectSocket();

    const onStatusChanged = ({ alertId, status }) => {
      setHistory((prev) => prev.map((a) => (a._id === alertId ? { ...a, status } : a)));
      setDispatched((prev) =>
        prev && prev.alert._id === alertId ? { ...prev, alert: { ...prev.alert, status } } : prev
      );
    };
    socket.on("emergency:statusChanged", onStatusChanged);
    return () => socket.off("emergency:statusChanged", onStatusChanged);
  }, []);

  const canSubmit = category && location && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/emergency/alerts", { category, location, note: note.trim() || undefined });
      setDispatched(res.data.data);
      setHistory((prev) => [res.data.data.alert, ...prev]);
    } catch (err) {
      setError(err.response?.data?.message || t("emergency.dispatchError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(idOverride) {
    const id = idOverride || dispatched?.alert?._id;
    if (!id) return;
    setResolving(true);
    try {
      await api.patch(`/emergency/alerts/${id}/resolve`);
      setHistory((prev) => prev.map((a) => (a._id === id ? { ...a, status: "resolved" } : a)));
      if (dispatched?.alert?._id === id) {
        setDispatched((prev) => ({ ...prev, alert: { ...prev.alert, status: "resolved" } }));
      }
    } finally {
      setResolving(false);
    }
  }

  function resetForm() {
    setDispatched(null);
    setCategory(null);
    setLocation(null);
    setNote("");
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="font-display text-2xl font-semibold text-text">{t("nav.emergency")}</h2>
        <p className="text-muted text-sm mt-1">{t("emergency.subtitle")}</p>
      </div>

      <AnimatePresence mode="wait">
        {dispatched ? (
          <motion.div key="confirmation" exit={{ opacity: 0 }}>
            <EmergencyConfirmation
              department={dispatched.department}
              channelsUsed={dispatched.channelsUsed}
              resolved={dispatched.alert.status === "resolved" || resolving}
              onResolve={() => handleResolve()}
              onSendAnother={resetForm}
            />
          </motion.div>
        ) : (
          <motion.div key="form" exit={{ opacity: 0 }} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((c) => (
                <CategoryButton key={c} category={c} selected={category === c} onClick={setCategory} />
              ))}
            </div>

            <LocationPicker value={location} onChange={setLocation} />

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("emergency.notePlaceholder")}
              maxLength={500}
              rows={3}
              className="w-full p-3 rounded-lg bg-surface2 border border-transparent focus:border-border focus:bg-surface outline-none transition text-sm resize-none"
            />

            {error && (
              <p className="text-xs font-medium" style={{ color: "var(--np-crimson)" }}>{error}</p>
            )}

            <motion.button
              onClick={handleSubmit}
              disabled={!canSubmit}
              whileTap={{ scale: canSubmit ? 0.98 : 1 }}
              transition={{ duration: 0.15, ease: EASE.out }}
              className="w-full h-12 rounded-xl text-white font-semibold disabled:opacity-50"
              style={{ background: "var(--np-crimson)" }}
            >
              {submitting ? t("emergency.dispatching") : t("emergency.sendAlert")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-4 border-t border-border space-y-3">
        <h3 className="font-display text-base font-semibold text-text">{t("emergency.myAlerts")}</h3>
        {loadingHistory ? (
          <p className="text-sm text-muted">{t("common.loading")}…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted">{t("emergency.noAlertsYet")}</p>
        ) : (
          <div className="space-y-3">
            {history.map((alert, i) => (
              <AlertCard key={alert._id} alert={alert} onResolve={handleResolve} delay={i * 0.03} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}