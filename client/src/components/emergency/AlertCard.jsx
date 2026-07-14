// file: client/src/components/emergency/AlertCard.jsx
import { motion } from "framer-motion";
import { useLang } from "../../i18n/LanguageContext";
import { EASE } from "../../config/tokens";

const STATUS_STYLE = {
  dispatched: { bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  acknowledged: { bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" },
  resolved: { bg: "#e6f4ea", color: "#1e7e34" },
};

// Distinct color + icon per emergency category, so cards are
// distinguishable at a glance instead of all looking identical. The
// left border + icon badge carry the category; the status pill (top
// right, unchanged) still carries dispatched/acknowledged/resolved.
const CATEGORY_STYLE = {
  ambulance: {
    color: "#dc2626",
    bg: "#fef2f2",
    path: "M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-4M14 3h6v6M9 15h4M11 13v4M14 3l-6.5 6.5",
  },
  fire: {
    color: "#ea580c",
    bg: "#fff7ed",
    path: "M12 2c1 3-3 4-3 7a3 3 0 006 0c0-1-.5-2-1-2 1 3 3 3 3 6a5 5 0 01-10 0c0-4 3-5 5-11z",
  },
  police: {
    color: "#1e3a8a",
    bg: "#eff6ff",
    path: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z",
  },
  rescue: {
    color: "#0f766e",
    bg: "#f0fdfa",
    path: "M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3M12 8a4 4 0 100 8 4 4 0 000-8z",
  },
};

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AlertCard({ alert, showReporter = false, onResolve, delay = 0 }) {
  const { t } = useLang();
  const s = STATUS_STYLE[alert.status] || STATUS_STYLE.dispatched;
  const cat = CATEGORY_STYLE[alert.category] || CATEGORY_STYLE.rescue;
  const mapsLink = `https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE.out, delay }}
      className="bg-surface border border-border rounded-xl p-4 space-y-2.5"
      style={{ borderLeft: `4px solid ${cat.color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className="w-9 h-9 rounded-full grid place-items-center shrink-0"
            style={{ background: cat.bg }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke={cat.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d={cat.path} />
            </svg>
          </span>
          <div>
            <span className="font-semibold text-sm text-text capitalize">
              {t(`emergency.category.${alert.category}`)}
            </span>
            {alert.contactedDepartment?.department && (
              <p className="text-xs text-muted mt-0.5">{alert.contactedDepartment.department}</p>
            )}
          </div>
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
          style={{ background: s.bg, color: s.color }}
        >
          {t(`emergency.status.${alert.status}`)}
        </span>
      </div>

      {showReporter && alert.reportedBy && (
        <div className="text-xs text-muted flex items-center gap-3 flex-wrap bg-surface2 rounded-lg px-3 py-2">
          <span className="font-medium text-text">{alert.reportedBy.fullName}</span>
          {alert.reportedBy.phone && <span>· {alert.reportedBy.phone}</span>}
          {alert.reportedBy.email && <span>· {alert.reportedBy.email}</span>}
        </div>
      )}

      {alert.note && <p className="text-xs text-text bg-surface2 rounded-lg px-3 py-2">{alert.note}</p>}

      <div className="flex items-center justify-between text-xs text-faint pt-1">
        <a href={mapsLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium" style={{ color: "var(--np-blue)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
            <path d="M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          {t("reports.viewOnMap")}
        </a>
        <span>{formatDateTime(alert.dispatchedAt || alert.createdAt)}</span>
      </div>

      {alert.dispatchFailed && (
        <p className="text-xs font-medium bg-red-50 rounded-lg px-3 py-2" style={{ color: "var(--np-crimson)" }}>
          {t("emergency.dispatchFailedWarning")}
        </p>
      )}

      {onResolve && alert.status !== "resolved" && (
        <button
          onClick={() => onResolve(alert._id)}
          className="w-full h-9 rounded-lg text-xs font-medium border border-border text-text mt-1"
        >
          {t("emergency.markResolved")}
        </button>
      )}
    </motion.div>
  );
}