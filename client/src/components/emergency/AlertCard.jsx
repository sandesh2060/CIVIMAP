// file: client/src/components/emergency/AlertCard.jsx
import { motion } from "framer-motion";
import { useLang } from "../../i18n/LanguageContext";
import { EASE } from "../../config/tokens";

const STATUS_STYLE = {
  dispatched: { bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  acknowledged: { bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" },
  resolved: { bg: "#e6f4ea", color: "#1e7e34" },
};

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AlertCard({ alert, showReporter = false, onResolve, delay = 0 }) {
  const { t } = useLang();
  const s = STATUS_STYLE[alert.status] || STATUS_STYLE.dispatched;
  const mapsLink = `https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE.out, delay }}
      className="bg-surface border border-border rounded-xl p-4 space-y-2.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-semibold text-sm text-text capitalize">
            {t(`emergency.category.${alert.category}`)}
          </span>
          {alert.contactedDepartment?.department && (
            <p className="text-xs text-muted mt-0.5">{alert.contactedDepartment.department}</p>
          )}
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
          style={{ background: s.bg, color: s.color }}
        >
          {t(`emergency.status.${alert.status}`)}
        </span>
      </div>

      {showReporter && alert.reportedBy && (
        <div className="text-xs text-muted flex items-center gap-3 flex-wrap">
          <span>{alert.reportedBy.fullName}</span>
          {alert.reportedBy.phone && <span>· {alert.reportedBy.phone}</span>}
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