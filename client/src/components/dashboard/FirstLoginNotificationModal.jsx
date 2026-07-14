// file: client/src/components/dashboard/FirstLoginNotificationModal.jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "../../hooks/useNotifications";
import { useAuth } from "../../context/AuthContext";
import { EASE } from "../../config/tokens";

// Keep in sync with Notification.type values (server/src/models/Notification.js).
const TYPE_META = {
  admin_broadcast: { icon: "📢", bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" },
  report_status: { icon: "📋", bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" },
  violation_status: { icon: "⚠️", bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  violation_matched: { icon: "🚓", bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
};
const DEFAULT_META = { icon: "🔔", bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" };

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Shows once per browser session (not once-ever) — a natural "here's
// what happened while you were away" popup right after landing on the
// dashboard, if there's anything unread waiting.
export default function FirstLoginNotificationModal() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAllRead, loading } = useNotifications();
  const [dismissed, setDismissed] = useState(false);

  const sessionKey = user ? `civimap_notif_shown_${user._id || user.id}` : null;
  const alreadyShownThisSession = sessionKey ? sessionStorage.getItem(sessionKey) : true;

  useEffect(() => {
    if (!loading && !alreadyShownThisSession && unreadCount > 0 && sessionKey) {
      sessionStorage.setItem(sessionKey, "1");
    }
  }, [loading, alreadyShownThisSession, unreadCount, sessionKey]);

  const shouldShow =
    !loading && !dismissed && !alreadyShownThisSession && unreadCount > 0;

  // Escape key dismisses, same as clicking the backdrop or the X.
  useEffect(() => {
    if (!shouldShow) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setDismissed(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shouldShow]);

  const unread = notifications.filter((n) => !n.isRead).slice(0, 5);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setDismissed(true)}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE.out }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
              <h2 className="font-display font-semibold text-lg">
                You have {unreadCount} new update{unreadCount > 1 ? "s" : ""}
              </h2>
              <button
                onClick={() => setDismissed(true)}
                aria-label="Close"
                className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-muted hover:bg-surface2 transition"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <ul className="max-h-80 overflow-y-auto">
              {unread.map((n) => {
                const meta = TYPE_META[n.type] || DEFAULT_META;
                return (
                  <li key={n._id} className="px-6 py-3 border-b border-border last:border-b-0 flex gap-3">
                    <span
                      className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-base"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-faint mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => setDismissed(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface2 transition"
              >
                Dismiss
              </button>
              <button
                onClick={async () => {
                  await markAllRead();
                  setDismissed(true);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition"
                style={{ background: "var(--np-blue)" }}
              >
                Mark all read
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}