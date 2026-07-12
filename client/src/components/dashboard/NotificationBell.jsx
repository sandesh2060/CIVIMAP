// file: client/src/components/dashboard/NotificationBell.jsx
import { useState, useRef, useEffect } from "react";
import { useNotifications } from "../../hooks/useNotifications";
import { useLang } from "../../i18n/LanguageContext";

const BellIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
       strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" {...props}>
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { t } = useLang();

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative w-10 h-10 grid place-items-center rounded-lg hover:bg-surface2 transition text-muted hover:text-text"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500
                           text-white text-[10px] font-semibold grid place-items-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-border
                        bg-surface shadow-xl z-40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-500 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">No notifications yet.</div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n._id}
                  onClick={() => !n.isRead && markRead(n._id)}
                  className={`px-4 py-3 border-b border-border last:border-b-0 cursor-pointer transition
                             hover:bg-surface2 ${!n.isRead ? "bg-blue-500/5" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}