// file: client/src/pages/admin/OverviewPage.jsx
import api from "../../services/api";
import { useLang } from "../../i18n/LanguageContext";
import { fmtNum } from "../../i18n/numbers";
import StatCard from "../../components/dashboard/StatCard";
import { useCachedFetch } from "../../hooks/useCachedFetch";

const ICONS = {
  reports: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  pending: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  violations: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  flagged: "M3 21V5a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H9l-2 2H3z",
  emergency: "M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zM12 7v5M12 15h.01",
  places: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13 6-3m-6 3V7m6 10 4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
};

// IMPORTANT: keep `limit` at 1 (or well under whatever max each Joi
// listXQuerySchema enforces). We only ever need the `total` field from
// these responses, never the actual rows.
async function fetchTotal(url, params) {
  const res = await api.get(url, { params: { page: 1, limit: 1, ...params } });
  return res.data?.data?.total ?? 0;
}

async function loadOverviewStats() {
  const [
    totalReports,
    pendingReports,
    totalViolations,
    flaggedViolations,
    totalAlerts,
    resolvedAlerts,
    placesRes,
  ] = await Promise.all([
    fetchTotal("/reports"),
    fetchTotal("/reports", { status: "pending" }),
    fetchTotal("/violations"),
    fetchTotal("/violations", { status: "flagged" }),
    fetchTotal("/emergency/alerts"),
    fetchTotal("/emergency/alerts", { status: "resolved" }),
    api.get("/places"),
  ]);

  return {
    totalReports,
    pendingReports,
    totalViolations,
    flaggedViolations,
    openAlerts: Math.max(0, totalAlerts - resolvedAlerts),
    totalPlaces: (placesRes.data?.data?.places || []).length,
  };
}

export default function OverviewPage() {
  const { t, lang } = useLang();
  const { data: stats, loading, error, refresh } = useCachedFetch(
    "admin:overview",
    loadOverviewStats
  );

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted text-sm">{t("reports.errorLoading")}</p>
        <button onClick={refresh} className="px-4 h-10 rounded-lg text-white text-sm font-medium" style={{ background: "var(--np-crimson)" }}>
          {t("reports.retry")}
        </button>
      </div>
    );
  }

  if (loading && !stats) {
    return <div className="py-16 text-center text-muted text-sm">{t("common.loading")}…</div>;
  }

  const cards = [
    {
      label: lang === "ne" ? "कुल प्रतिवेदन" : "Total Reports",
      value: fmtNum(stats.totalReports, lang),
      hint: lang === "ne" ? `${fmtNum(stats.pendingReports, lang)} समीक्षामा` : `${stats.pendingReports} pending review`,
      accent: "blue",
      icon: ICONS.reports,
    },
    {
      label: lang === "ne" ? "विचाराधीन प्रतिवेदन" : "Pending Reports",
      value: fmtNum(stats.pendingReports, lang),
      accent: "crimson",
      icon: ICONS.pending,
    },
    {
      label: lang === "ne" ? "कुल उल्लङ्घन" : "Total Violations",
      value: fmtNum(stats.totalViolations, lang),
      hint: lang === "ne" ? `${fmtNum(stats.flaggedViolations, lang)} समीक्षामा` : `${stats.flaggedViolations} flagged`,
      accent: "blue",
      icon: ICONS.violations,
    },
    {
      label: lang === "ne" ? "समीक्षामा उल्लङ्घन" : "Flagged Violations",
      value: fmtNum(stats.flaggedViolations, lang),
      accent: "crimson",
      icon: ICONS.flagged,
    },
    {
      label: lang === "ne" ? "खुला आपतकालीन अलर्ट" : "Open Emergency Alerts",
      value: fmtNum(stats.openAlerts, lang),
      accent: "crimson",
      icon: ICONS.emergency,
    },
    {
      label: lang === "ne" ? "स्थान पिनहरू" : "Place Pins",
      value: fmtNum(stats.totalPlaces, lang),
      accent: "neutral",
      icon: ICONS.places,
    },
  ];

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-display font-bold text-text">{t("nav.overview")}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 0.04} />
        ))}
      </div>
    </div>
  );
}