// file: client/src/pages/user/dashboard/OverviewPage.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { useLang } from "../../../i18n/LanguageContext";
import StatCard from "../../../components/dashboard/StatCard";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reportsRes, violationsRes] = await Promise.all([
        api.get("/reports/mine"),
        api.get("/violations/mine"),
      ]);
      setReports(reportsRes.data.data.reports || []);
      setViolations(violationsRes.data.data.violations || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const reportsApproved = reports.filter((r) => r.status === "approved").length;
    const reportsPending = reports.filter((r) => r.status === "pending" || r.status === "flagged").length;
    const violationsConfirmed = violations.filter((v) => v.status === "reviewed" || v.status === "notified").length;
    return {
      reportsSubmitted: reports.length,
      reportsApproved,
      reportsPending,
      violationsSubmitted: violations.length,
      violationsConfirmed,
    };
  }, [reports, violations]);

  const monthlyData = useMemo(() => {
    const buckets = lastSixMonthBuckets();
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    [...reports, ...violations].forEach((item) => {
      const d = new Date(item.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (byKey[key]) byKey[key].value += 1;
    });
    return buckets;
  }, [reports, violations]);

  const recentActivity = useMemo(() => {
    const combined = [
      ...reports.map((r) => ({ id: r._id, type: "report", title: r.description, status: r.status, createdAt: r.createdAt, imageUrl: r.imageUrl })),
      ...violations.map((v) => ({ id: v._id, type: "violation", title: v.extractedPlateNumber || t("ov.violationType"), status: v.status, createdAt: v.createdAt, imageUrl: v.imageUrl })),
    ];
    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  }, [reports, violations, t]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted text-sm">{t("ov.errorLoading")}</p>
        <button
          onClick={load}
          className="px-4 h-10 rounded-lg text-white text-sm font-medium"
          style={{ background: "var(--np-crimson)" }}
        >
          {t("ov.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-[26px] sm:text-[28px] font-semibold tracking-tight text-text">
          {t("dash.greeting")}, {user?.fullName?.split(" ")[0] || ""}
        </h2>
        <p className="text-muted text-[14px] mt-1.5">{t("dash.subtitle")}</p>
      </div>

      {/* Quick actions — the two things a citizen actually comes here to do */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate?.("map")}
          className="group flex items-center gap-4 rounded-xl p-5 text-left bg-surface border border-border/60 hover:border-transparent transition"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <span className="w-11 h-11 rounded-lg grid place-items-center shrink-0 text-white"
                style={{ background: "var(--np-crimson)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d={ICONS.camera} /></svg>
          </span>
          <span>
            <span className="block text-[14px] font-semibold text-text">{t("ov.reportIssue")}</span>
            <span className="block text-[12.5px] text-muted mt-0.5">{t("ov.reportIssueHint")}</span>
          </span>
        </button>

        <button
          onClick={() => onNavigate?.("map")}
          className="group flex items-center gap-4 rounded-xl p-5 text-left bg-surface border border-border/60 hover:border-transparent transition"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <span className="w-11 h-11 rounded-lg grid place-items-center shrink-0 text-white"
                style={{ background: "var(--np-blue)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d={ICONS.plate} /></svg>
          </span>
          <span>
            <span className="block text-[14px] font-semibold text-text">{t("ov.reportViolationCta")}</span>
            <span className="block text-[12.5px] text-muted mt-0.5">{t("ov.reportViolationHint")}</span>
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label={t("ov.reportsSubmitted")} value={loading ? "—" : stats.reportsSubmitted} icon={ICONS.submitted} accent="neutral" delay={0} />
        <StatCard label={t("ov.reportsApproved")} value={loading ? "—" : stats.reportsApproved} icon={ICONS.approved} accent="blue" delay={0.05} />
        <StatCard label={t("ov.reportsPending")} value={loading ? "—" : stats.reportsPending} icon={ICONS.pending} accent="crimson" delay={0.1} />
        <StatCard label={t("ov.violationsSubmitted")} value={loading ? "—" : stats.violationsSubmitted} icon={ICONS.violation} accent="neutral" delay={0.15} />
        <StatCard label={t("ov.trustScore")} value={loading ? "—" : (user?.trustScore ?? 50)} icon={ICONS.trust} accent="blue" delay={0.2} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE.out, delay: 0.22 }}
        className="rounded-xl bg-surface p-6 border border-border/60"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint mb-2">
          {t("ov.monthlyActivity")}
        </h3>
        {!loading && <BarChart data={monthlyData} labelFor={(m) => m} emptyMessage={t("ov.noActivityChart")} />}
      </motion.div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint mb-3">
          {t("ov.recentActivity")}
        </h3>
        <div className="rounded-xl bg-surface border border-border/60 overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          {loading ? (
            <div className="px-6 py-10 text-center text-muted text-sm">{t("common.loading")}…</div>
          ) : recentActivity.length === 0 ? (
            <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
              <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "var(--crimson-soft)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--np-crimson)" strokeWidth="1.6"
                     strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d={ICONS.submitted} /></svg>
              </span>
              <p className="text-[13.5px] text-muted max-w-sm">{t("ov.noActivity")}</p>
              <button
                onClick={() => onNavigate?.("map")}
                className="mt-1 px-4 h-9 rounded-lg text-white text-[13px] font-medium"
                style={{ background: "var(--np-crimson)" }}
              >
                {t("ov.viewMap")}
              </button>
            </div>
          ) : (
            recentActivity.map((item, i) => (
              <div key={item.id} className={`flex items-center gap-4 px-6 py-4 hover:bg-surface2 transition-colors ${i !== recentActivity.length - 1 ? "border-b border-border" : ""}`}>
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 grid place-items-center" style={{ background: "var(--crimson-soft)" }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-crimson">{item.type === "report" ? "R" : "V"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-text font-medium truncate">
                    {item.type === "report" ? t("ov.reportType") : t("ov.violationType")}
                    {item.title ? ` — ${item.title}` : ""}
                  </p>
                  <p className="text-[12px] text-muted">{timeAgo(item.createdAt, t)}</p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ background: "var(--crimson-soft)", color: "var(--np-crimson)" }}>
                  {t(`status.${item.status}`)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}