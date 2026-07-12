// file: client/src/pages/user/dashboard/ReportsPage.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import api from "../../../services/api";
import { useLang } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../context/AuthContext"; // adjust if your hook is named differently
import { EASE } from "../../../config/tokens";
import ViolationUpload from "../../../components/violation/ViolationUpload";
import ReportForm from "../../../components/report/ReportForm";

const REPORT_STATUS_STYLE = {
  pending: { bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  approved: { bg: "#e6f4ea", color: "#1e7e34" },
  flagged: { bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" },
  rejected: { bg: "var(--surface2)", color: "var(--muted)" },
};

const VIOLATION_STATUS_STYLE = {
  detected: { bg: "var(--surface2)", color: "var(--muted)" },
  flagged: { bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" },
  notified: { bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  reviewed: { bg: "#e6f4ea", color: "#1e7e34" },
};

// Server URL for the socket connection lives alongside the REST base URL —
// Socket.io is mounted at the API server root (see README §5/§9), not under /api.
const SOCKET_URL = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confidencePct(c) {
  if (c === undefined || c === null || Number.isNaN(c)) return null;
  return Math.round(c * 100);
}

export default function ReportsPage({ onNavigate }) {
  const { t } = useLang();
  const { user } = useAuth();
  const [tab, setTab] = useState("reports"); // "reports" | "violations"
  const [reports, setReports] = useState([]);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewImage, setPreviewImage] = useState(null);
  const [detailItem, setDetailItem] = useState(null); // { tab, item }
  const [liveConnected, setLiveConnected] = useState(false);
  const [justUpdatedIds, setJustUpdatedIds] = useState(() => new Set());
  const [showViolationUpload, setShowViolationUpload] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const socketRef = useRef(null);

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

  // reset filters when switching tabs so a leftover filter doesn't hide everything
  useEffect(() => {
    setStatusFilter("all");
    setSearch("");
  }, [tab]);

  // --- Real-time updates (README §9) ---
  useEffect(() => {
    if (!user?._id || !SOCKET_URL) return;

    const socket = io(SOCKET_URL, { withCredentials: true, transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setLiveConnected(true));
    socket.on("disconnect", () => setLiveConnected(false));

    const flashUpdated = (id) => {
      setJustUpdatedIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setJustUpdatedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 2500);
    };

    socket.on("report:statusChanged", ({ reportId, status }) => {
      setReports((prev) => {
        if (!prev.some((r) => r._id === reportId)) return prev;
        flashUpdated(reportId);
        return prev.map((r) => (r._id === reportId ? { ...r, status } : r));
      });
    });

    socket.on("violation:notified", ({ violationId }) => {
      setViolations((prev) => {
        if (!prev.some((v) => v._id === violationId)) return prev;
        flashUpdated(violationId);
        return prev.map((v) =>
          v._id === violationId
            ? { ...v, status: "notified", notifiedAt: new Date().toISOString() }
            : v
        );
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?._id]);

  const activeData = tab === "reports" ? reports : violations;
  const statusStyles = tab === "reports" ? REPORT_STATUS_STYLE : VIOLATION_STATUS_STYLE;
  const statusOptions = Object.keys(statusStyles);

  const filtered = useMemo(() => {
    return activeData.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const haystack =
        tab === "reports"
          ? item.description || ""
          : item.extractedPlateNumber || "";
      return haystack.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [activeData, statusFilter, search, tab]);

  function handleViolationSubmitted() {
    setShowViolationUpload(false);
    load(); // refresh so the new violation shows up immediately in the table
  }

  function handleReportSubmitted() {
    setShowReportForm(false);
    load(); // refresh so the new report shows up immediately in the table
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted text-sm">{t("reports.errorLoading")}</p>
        <button
          onClick={load}
          className="px-4 h-10 rounded-lg text-white text-sm font-medium"
          style={{ background: "var(--np-crimson)" }}
        >
          {t("reports.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-semibold text-text">{t("nav.reports")}</h2>
          <p className="text-muted text-sm mt-1">{t("reports.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {tab === "reports" && (
            <button
              onClick={() => setShowReportForm(true)}
              className="px-4 h-9 rounded-lg text-white text-sm font-medium"
              style={{ background: "var(--np-crimson)" }}
            >
              {t("reports.reportIssue") || "Report an Issue"}
            </button>
          )}
          {tab === "violations" && (
            <button
              onClick={() => setShowViolationUpload(true)}
              className="px-4 h-9 rounded-lg text-white text-sm font-medium"
              style={{ background: "var(--np-crimson)" }}
            >
              {t("reports.reportViolation") || "Report a Violation"}
            </button>
          )}
          <span
            className="flex items-center gap-1.5 text-xs text-muted mt-1"
            title={liveConnected ? t("reports.live") : t("reports.offline")}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: liveConnected ? "#1e7e34" : "var(--muted)",
                boxShadow: liveConnected ? "0 0 0 3px rgba(30,126,52,0.15)" : "none",
              }}
            />
            {liveConnected ? t("reports.live") : t("reports.offline")}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface2 p-1 rounded-lg w-fit">
        {[
          { id: "reports", label: t("reports.tabReports"), count: reports.length },
          { id: "violations", label: t("reports.tabViolations"), count: violations.length },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className="relative px-4 h-9 rounded-md text-sm font-medium transition-colors"
            style={{
              color: tab === tabItem.id ? "var(--np-crimson)" : "var(--muted)",
            }}
          >
            {tab === tabItem.id && (
              <motion.span
                layoutId="reports-tab-pill"
                className="absolute inset-0 rounded-md bg-surface"
                style={{ boxShadow: "var(--shadow-sm)" }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">
              {tabItem.label} {!loading && <span className="text-xs opacity-70">({tabItem.count})</span>}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "reports" ? t("reports.searchReportsPlaceholder") : t("reports.searchPlaceholder")}
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface2 border border-transparent
                       focus:border-border focus:bg-surface outline-none transition text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border
                     outline-none transition text-sm text-text sm:w-48"
        >
          <option value="all">{t("reports.allStatuses")}</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-4 py-16 text-center text-muted text-sm">{t("common.loading")}…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 flex flex-col items-center gap-3 text-center">
            <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "var(--crimson-soft)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--np-crimson)" strokeWidth="1.6"
                   strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <p className="text-[13.5px] text-muted max-w-sm">
              {activeData.length === 0
                ? tab === "reports" ? t("reports.noReportsYet") : t("reports.noViolationsYet")
                : t("reports.noResults")}
            </p>
            {activeData.length === 0 && (
              <button
                onClick={() => (tab === "reports" ? setShowReportForm(true) : setShowViolationUpload(true))}
                className="mt-1 px-4 h-9 rounded-lg text-white text-[13px] font-medium"
                style={{ background: "var(--np-crimson)" }}
              >
                {tab === "reports" ? t("reports.reportNow") : (t("reports.reportViolation") || "Report a Violation")}
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-4 py-3 font-medium w-14">{t("reports.photo")}</th>
                <th className="px-4 py-3 font-medium">
                  {tab === "reports" ? t("th.title") : t("reports.plate")}
                </th>
                <th className="px-4 py-3 font-medium">{t("th.status")}</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">{t("th.date")}</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.map((item, i) => {
                  const s = statusStyles[item.status] || statusStyles[Object.keys(statusStyles)[0]];
                  const conf = confidencePct(item.aiConfidence);
                  const justUpdated = justUpdatedIds.has(item._id);
                  return (
                    <motion.tr
                      key={item._id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        backgroundColor: justUpdated ? "var(--crimson-soft)" : "rgba(0,0,0,0)",
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE.out, delay: i * 0.03 }}
                      onClick={() => setDetailItem({ tab, item })}
                      className="border-b border-border last:border-0 hover:bg-surface2 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        {item.imageUrl ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage(item.imageUrl);
                            }}
                            className="w-9 h-9 rounded-md overflow-hidden block"
                            title={t("reports.viewImage")}
                          >
                            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <span className="w-9 h-9 rounded-md grid place-items-center bg-surface2 text-[10px] text-faint">
                            {t("reports.noPhoto")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-text max-w-xs truncate">
                        {tab === "reports"
                          ? item.description || "—"
                          : item.extractedPlateNumber || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="inline-block px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ background: s.bg, color: s.color }}
                          >
                            {t(`status.${item.status}`)}
                          </span>
                          {conf !== null && (
                            <span className="text-[11px] text-faint">
                              {t("reports.confidence")}: {conf}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted hidden md:table-cell">
                        {formatDate(item.createdAt)}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Image preview modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
          >
            <motion.img
              src={previewImage}
              alt=""
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE.out }}
              className="max-w-full max-h-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail modal */}
      <AnimatePresence>
        {detailItem && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setDetailItem(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE.out }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-xl w-full max-w-md overflow-hidden"
            >
              {detailItem.item.imageUrl && (
                <img
                  src={detailItem.item.imageUrl}
                  alt=""
                  className="w-full h-44 object-cover"
                />
              )}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold text-text">
                    {detailItem.tab === "reports"
                      ? detailItem.item.description || t("th.title")
                      : detailItem.item.extractedPlateNumber || t("reports.plate")}
                  </h3>
                  <span
                    className="inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                    style={{
                      background: (detailItem.tab === "reports" ? REPORT_STATUS_STYLE : VIOLATION_STATUS_STYLE)[detailItem.item.status]?.bg,
                      color: (detailItem.tab === "reports" ? REPORT_STATUS_STYLE : VIOLATION_STATUS_STYLE)[detailItem.item.status]?.color,
                    }}
                  >
                    {t(`status.${detailItem.item.status}`)}
                  </span>
                </div>

                {confidencePct(detailItem.item.aiConfidence) !== null && (
                  <div>
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>{t("reports.confidence")}</span>
                      <span>{confidencePct(detailItem.item.aiConfidence)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${confidencePct(detailItem.item.aiConfidence)}%`,
                          background: "var(--np-crimson)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {detailItem.item.status === "flagged" && (
                  <p className="text-xs text-muted bg-surface2 rounded-lg px-3 py-2">
                    {t("reports.flaggedHint")}
                  </p>
                )}

                {detailItem.item.location?.lat && detailItem.item.location?.lng && (
                  <a
                  
                    href={`https://www.google.com/maps?q=${detailItem.item.location.lat},${detailItem.item.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: "var(--np-blue)" }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                      <path d="M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {t("reports.viewOnMap")}
                  </a>
                )}

                <div className="text-xs text-muted space-y-1 pt-1 border-t border-border">
                  <div className="flex justify-between">
                    <span>{t("reports.submittedOn")}</span>
                    <span>{formatDateTime(detailItem.item.createdAt)}</span>
                  </div>
                  {detailItem.tab === "violations" && detailItem.item.notifiedAt && (
                    <div className="flex justify-between">
                      <span>{t("reports.notifiedAt")}</span>
                      <span>{formatDateTime(detailItem.item.notifiedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Violation upload modal */}
      <AnimatePresence>
        {showViolationUpload && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowViolationUpload(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE.out }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-xl w-full max-w-md p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold text-text">
                  {t("reports.reportViolation") || "Report a Violation"}
                </h3>
                <button
                  onClick={() => setShowViolationUpload(false)}
                  className="w-8 h-8 grid place-items-center rounded-lg hover:bg-surface2 transition"
                  aria-label={t("reports.close")}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <ViolationUpload onSubmitted={handleViolationSubmitted} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report form modal */}
      <AnimatePresence>
        {showReportForm && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowReportForm(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE.out }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-xl w-full max-w-md p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold text-text">
                  {t("reports.reportIssue") || "Report an Issue"}
                </h3>
                <button
                  onClick={() => setShowReportForm(false)}
                  className="w-8 h-8 grid place-items-center rounded-lg hover:bg-surface2 transition"
                  aria-label={t("reports.close")}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <ReportForm onSubmitted={handleReportSubmitted} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}