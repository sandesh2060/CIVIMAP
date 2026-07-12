// file: client/src/components/dashboard/FirstLoginNotificationModal.jsx
import { useEffect, useState } from "react";
import { useNotifications } from "../../hooks/useNotifications";
import { useAuth } from "../../context/AuthContext";

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

  if (!shouldShow) return null;

  const unread = notifications.filter((n) => !n.isRead).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg">
            You have {unreadCount} new update{unreadCount > 1 ? "s" : ""}
          </h2>
        </div>

        <ul className="max-h-80 overflow-y-auto">
          {unread.map((n) => (
            <li key={n._id} className="px-6 py-3 border-b border-border last:border-b-0">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted mt-0.5">{n.message}</p>
            </li>
          ))}
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
      </div>
    </div>
  );
}