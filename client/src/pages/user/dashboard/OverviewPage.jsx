// file: client/src/pages/user/dashboard/OverviewPage.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { useLang } from "../../../i18n/LanguageContext";
import BarChart from "../../../components/dashboard/BarChart";
import { EASE } from "../../../config/tokens";

const MONTH_KEYS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ICONS = {
  submitted: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  approved: "M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z",
  pending: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  violation: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13 6-3m-6 3V7m6 10 4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  trust: "M12 15a3 3 0 100-6 3 3 0 000 6zm0 0v3m-7-3a7 7 0 1114 0 7 7 0 01-14 0z",
  camera: "M4 8a2 2 0 012-2h1.5l1-1.5h7l1 1.5H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z M12 16a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
  plate: "M3 8a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z M7 12h4m4 0h2",
  siren: "M12 2a5 5 0 015 5v3H7V7a5 5 0 015-5zM5 12h14l1 8H4l1-8z M12 2v0",
};

/* ---------------------------------------------------------------------- */
/*  Local, premium-styled pieces — kept in this file so the Overview page */
/*  has one consistent look without depending on other components'        */
/*  internals (StatCard, etc.) being restyled separately.                 */
/* ---------------------------------------------------------------------- */

// Soft elevated surface — no hard border, just a hairline + a gentle
// shadow that deepens slightly on hover. This is the one "card" pattern
// the whole page reuses.
function Surface({ as: Tag = "div", className = "", style = {}, children, ...props }) {
  return (
    <Tag className={`surface-card rounded-2xl ${className}`} style={style} {...props}>
      {children}
    </Tag>
  );
}

function QuickAction({ icon, tint, title, hint, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: EASE.out }}
      className="text-left"
    >
      <Surface className="flex items-center gap-4 px-5 py-5 h-full">
        <span
          className="w-11 h-11 rounded-full grid place-items-center shrink-0"
          style={{ background: tint.soft, color: tint.solid }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
               strokeLinecap="round" strokeLinejoin="round" className="w-[19px] h-[19px]"><path d={icon} /></svg>
        </span>
        <span>
          <span className="block text-[14.5px] font-medium text-text">{title}</span>
          <span className="block text-[12.5px] text-muted mt-0.5">{hint}</span>
        </span>
      </Surface>
    </motion.button>
  );
}

function StatTile({ label, value, icon, tint, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE.out, delay }}
    >
      <Surface className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-faint">{label}</span>
          <span className="w-7 h-7 rounded-full grid place-items-center shrink-0" style={{ background: tint.soft, color: tint.solid }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d={icon} /></svg>
          </span>
        </div>
        <p className="text-[26px] font-display font-semibold text-text leading-none">{value}</p>
      </Surface>
    </motion.div>
  );
}

const TINT = {
  neutral: { soft: "var(--surface-2)", solid: "var(--text-muted)" },
  blue: { soft: "var(--blue-soft)", solid: "var(--np-blue)" },
  crimson: { soft: "var(--crimson-soft)", solid: "var(--np-crimson)" },
  green: { soft: "var(--green-soft)", solid: "var(--np-green)" },
};

function lastSixMonthBuckets() {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTH_KEYS[d.getMonth()], value: 0 });
  }
  return buckets;
}

function timeAgo(dateStr, t) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t("time.now");
  if (mins < 60) return t("time.minAgo").replace("{n}", mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("time.hrAgo").replace("{n}", hrs);
  return t("time.dayAgo").replace("{n}", Math.floor(hrs / 24));
}

export default function OverviewPage({ onNavigate }) {
  const { user } = useAuth();
  const { t } = useLang();

  const [reports, setReports] = useState([]);
  const [violations, setViolations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsUnavailable, setAlertsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    setAlertsUnavailable(false);

    const [reportsRes, violationsRes, alertsRes] = await Promise.allSettled([
      api.get("/reports/mine"),
      api.get("/violations/mine"),
      api.get("/emergency/alerts/mine"),
    ]);

    if (reportsRes.status === "fulfilled" && violationsRes.status === "fulfilled") {
      setReports(reportsRes.value.data.data.reports || []);
      setViolations(violationsRes.value.data.data.violations || []);
    } else {
      setError(reportsRes.reason || violationsRes.reason);
    }

    if (alertsRes.status === "fulfilled") {
      setAlerts(alertsRes.value.data.data.alerts || []);
    } else {
      setAlerts([]);
      setAlertsUnavailable(true);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const reportsApproved = reports.filter((r) => r.status === "approved").length;
    const reportsPending = reports.filter((r) => r.status === "pending" || r.status === "flagged").length;
    return {
      reportsSubmitted: reports.length,
      reportsApproved,
      reportsPending,
      violationsSubmitted: violations.length,
      emergencyAlertsSent: alerts.length,
    };
  }, [reports, violations, alerts]);

  const openAlerts = useMemo(
    () => alerts.filter((a) => a.status !== "resolved").sort((a, b) => new Date(b.dispatchedAt || b.createdAt) - new Date(a.dispatchedAt || a.createdAt)),
    [alerts]
  );

  const monthlyData = useMemo(() => {
    const buckets = lastSixMonthBuckets();
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    [...reports, ...violations, ...alerts].forEach((item) => {
      const d = new Date(item.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (byKey[key]) byKey[key].value += 1;
    });
    return buckets;
  }, [reports, violations, alerts]);

  const recentActivity = useMemo(() => {
    const combined = [
      ...reports.map((r) => ({ id: r._id, type: "report", title: r.description, status: r.status, createdAt: r.createdAt, imageUrl: r.imageUrl })),
      ...violations.map((v) => ({ id: v._id, type: "violation", title: v.extractedPlateNumber || t("ov.violationType"), status: v.status, createdAt: v.createdAt, imageUrl: v.imageUrl })),
      ...alerts.map((a) => ({ id: a._id, type: "emergency", title: t(`emergency.category.${a.category}`), status: a.status, createdAt: a.dispatchedAt || a.createdAt })),
    ];
    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  }, [reports, violations, alerts, t]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted text-sm">{t("ov.errorLoading")}</p>
        <button
          onClick={load}
          className="lux-btn-primary px-5 h-10 rounded-full text-sm font-medium"
        >
          {t("ov.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-[1180px]">
      {/* Greeting — small gold divider underneath gives it a quiet,
          ceremonial civic feel rather than a SaaS-dashboard feel. */}
      <div>
        <h2 className="font-display text-[27px] sm:text-[29px] font-semibold tracking-tight text-text">
          {t("dash.greeting")}, {user?.fullName?.split(" ")[0] || ""}
        </h2>
        <p className="text-muted text-[14px] mt-1.5 mb-4">{t("dash.subtitle")}</p>
        <div className="lux-divider w-24 h-px" />
      </div>

      {/* Open emergency alerts — a quiet left-accent-bar banner instead of
          a hard-outlined alert box, but still unmistakably urgent. */}
      {!loading && openAlerts.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onNavigate?.("emergency")}
          className="w-full text-left rounded-2xl overflow-hidden flex"
          style={{ background: "var(--crimson-soft)", boxShadow: "var(--shadow-card-sm)" }}
        >
          <span className="w-1 shrink-0" style={{ background: "var(--np-crimson)" }} />
          <span className="flex-1 flex items-center gap-4 px-5 py-4">
            <motion.span
              className="w-9 h-9 rounded-full grid place-items-center shrink-0"
              style={{ background: "var(--np-crimson)", color: "#fff" }}
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                   strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d={ICONS.siren} /></svg>
            </motion.span>
            <span className="flex-1">
              <span className="block text-[13.5px] font-medium" style={{ color: "var(--np-crimson)" }}>
                {t("ov.openAlertsBanner", { n: openAlerts.length })}
              </span>
              <span className="block text-[12px] text-muted mt-0.5">{t("ov.openAlertsBannerHint")}</span>
            </span>
          </span>
        </motion.button>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickAction
          icon={ICONS.camera}
          tint={TINT.crimson}
          title={t("ov.reportIssue")}
          hint={t("ov.reportIssueHint")}
          onClick={() => onNavigate?.("map")}
        />
        <QuickAction
          icon={ICONS.plate}
          tint={TINT.blue}
          title={t("ov.reportViolationCta")}
          hint={t("ov.reportViolationHint")}
          onClick={() => onNavigate?.("map")}
        />
        <QuickAction
          icon={ICONS.siren}
          tint={TINT.green}
          title={t("ov.sendEmergencyCta")}
          hint={t("ov.sendEmergencyHint")}
          onClick={() => onNavigate?.("emergency")}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label={t("ov.reportsSubmitted")} value={loading ? "—" : stats.reportsSubmitted} icon={ICONS.submitted} tint={TINT.neutral} delay={0} />
        <StatTile label={t("ov.reportsApproved")} value={loading ? "—" : stats.reportsApproved} icon={ICONS.approved} tint={TINT.blue} delay={0.04} />
        <StatTile label={t("ov.reportsPending")} value={loading ? "—" : stats.reportsPending} icon={ICONS.pending} tint={TINT.crimson} delay={0.08} />
        <StatTile label={t("ov.violationsSubmitted")} value={loading ? "—" : stats.violationsSubmitted} icon={ICONS.violation} tint={TINT.neutral} delay={0.12} />
        <StatTile label={t("ov.trustScore")} value={loading ? "—" : (user?.trustScore ?? 50)} icon={ICONS.trust} tint={TINT.blue} delay={0.16} />
      </div>

      {/* Monthly activity */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE.out, delay: 0.2 }}
      >
        <Surface className="p-6">
          <h3 className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-faint mb-4">
            {t("ov.monthlyActivity")}
          </h3>
          {!loading && <BarChart data={monthlyData} labelFor={(m) => m} emptyMessage={t("ov.noActivityChart")} />}
        </Surface>
      </motion.div>

      {/* Recent activity */}
      <div>
        <h3 className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-faint mb-3">
          {t("ov.recentActivity")}
        </h3>
        <Surface className="overflow-hidden">
          {loading ? (
            <div className="px-6 py-12 text-center text-muted text-sm">{t("common.loading")}…</div>
          ) : recentActivity.length === 0 ? (
            <div className="px-6 py-14 flex flex-col items-center gap-3 text-center">
              <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "var(--crimson-soft)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--np-crimson)" strokeWidth="1.5"
                     strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d={ICONS.submitted} /></svg>
              </span>
              <p className="text-[13.5px] text-muted max-w-sm">{t("ov.noActivity")}</p>
              <button
                onClick={() => onNavigate?.("map")}
                className="lux-btn-primary mt-1 px-5 h-9 rounded-full text-[13px] font-medium"
              >
                {t("ov.viewMap")}
              </button>
            </div>
          ) : (
            recentActivity.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface2"
                style={{ borderBottom: i !== recentActivity.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 grid place-items-center" style={{ background: "var(--surface-2)" }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[11px] font-medium text-muted">
                      {item.type === "report" ? "R" : item.type === "violation" ? "V" : "E"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] text-text font-medium truncate">
                    {item.type === "report" ? t("ov.reportType") : item.type === "violation" ? t("ov.violationType") : t("ov.alertType")}
                    {item.title ? ` — ${item.title}` : ""}
                  </p>
                  <p className="text-[12px] text-muted mt-0.5">{timeAgo(item.createdAt, t)}</p>
                </div>
                <span
                  className="text-[10.5px] font-medium px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                >
                  {item.type === "emergency" ? t(`emergency.status.${item.status}`) : t(`status.${item.status}`)}
                </span>
              </div>
            ))
          )}
        </Surface>
      </div>

      {/* Emergency alert history */}
      {!loading && !alertsUnavailable && (
        <div>
          <h3 className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-faint mb-3">
            {t("emergency.myAlerts")}
          </h3>
          <Surface className="overflow-hidden">
            {alerts.length === 0 ? (
              <div className="px-6 py-10 text-center text-muted text-sm">{t("emergency.noAlertsYet")}</div>
            ) : (
              alerts
                .slice()
                .sort((a, b) => new Date(b.dispatchedAt || b.createdAt) - new Date(a.dispatchedAt || a.createdAt))
                .slice(0, 5)
                .map((a, i, arr) => (
                  <div
                    key={a._id}
                    className="flex items-center gap-4 px-6 py-4"
                    style={{ borderBottom: i !== arr.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <span className="w-8 h-8 rounded-full grid place-items-center shrink-0" style={{ background: "var(--green-soft)", color: "var(--np-green)" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                           strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d={ICONS.siren} /></svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] text-text font-medium truncate">{t(`emergency.category.${a.category}`)}</p>
                      <p className="text-[12px] text-muted mt-0.5">{timeAgo(a.dispatchedAt || a.createdAt, t)}</p>
                    </div>
                    <span
                      className="text-[10.5px] font-medium px-2.5 py-1 rounded-full shrink-0"
                      style={{
                        background: a.status === "resolved" ? "var(--green-soft)" : "var(--crimson-soft)",
                        color: a.status === "resolved" ? "var(--np-green)" : "var(--np-crimson)",
                      }}
                    >
                      {t(`emergency.status.${a.status}`)}
                    </span>
                  </div>
                ))
            )}
          </Surface>
        </div>
      )}
    </div>
  );
}