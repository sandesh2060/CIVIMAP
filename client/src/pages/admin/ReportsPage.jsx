// file: client/src/pages/admin/ReportsPage.jsx
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import { useLang } from "../../i18n/LanguageContext";
import { fmtNum } from "../../i18n/numbers";
import { EASE } from "../../config/tokens";
import { useCachedFetch, invalidateCache } from "../../hooks/useCachedFetch";

const STATUS_STYLE = {
  pending: { bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  approved: { bg: "#e6f4ea", color: "#1e7e34" },
  flagged: { bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" },
  rejected: { bg: "var(--surface2)", color: "var(--muted)" },
};

const STATUS_TABS = ["all", "pending", "flagged", "approved", "rejected"];
const CATEGORIES = ["all", "pothole", "streetlight", "garbage", "water_leak", "civic_other"];
const PAGE_SIZE = 8;

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

function buildMapsLink(location) {
  if (!location || !location.coordinates) return null;
  const lng = location.coordinates[0];
  const lat = location.coordinates[1];
  return "https://www.google.com/maps?q=" + lat + "," + lng;
}

const linkStyle = { color: "var(--np-blue)" };

function Badge(props) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: props.style.bg, color: props.style.color }}>
      {props.label}
    </span>
  );
}

function Row(props) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted">{props.label}</span>
      {props.node ? props.node : <span className="font-medium text-text">{props.value}</span>}
    </div>
  );
}

function MapLink(props) {
  return <a href={props.href} target="_blank" rel="noreferrer" className="text-xs font-medium" style={linkStyle}>{props.children}</a>;
}

const CACHE_KEY = "admin:reports";

async function loadReports() {
  const res = await api.get("/reports", { params: { page: 1, limit: 500 } });
  return res.data.data.reports || [];
}

export default function ReportsPage() {
  const { t, lang } = useLang();

  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [reviewing, setReviewing] = useState(false);

  const { data: reportsData, loading, error, refresh, setData } = useCachedFetch(CACHE_KEY, loadReports);
  const reports = reportsData || [];

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (category !== "all" && r.category !== category) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const desc = (r.description || "").toLowerCase();
        if (!desc.includes(q) && !String(r._id).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [reports, status, category, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  function resetPage(fn) {
    return function (v) {
      fn(v);
      setPage(1);
    };
  }

  function countFor(s) {
    if (s === "all") return reports.length;
    return reports.filter((r) => r.status === s).length;
  }

  async function handleReview(id, decision) {
    setReviewing(true);
    try {
      const res = await api.patch("/reports/" + id + "/review", { decision: decision });
      const updated = res.data.data.report;
      const next = reports.map((r) => (r._id === id ? updated : r));
      setData(next);
      setSelected(updated);
      // Overview's pending/total counts derive from this same data —
      // drop it so the next visit there re-fetches instead of showing
      // a stale pending count.
      invalidateCache("admin:overview");
    } catch (err) {
      console.error("Review failed", err);
    } finally {
      setReviewing(false);
    }
  }

  if (error && reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted text-sm">{t("reports.errorLoading")}</p>
        <button onClick={refresh} className="px-4 h-10 rounded-lg text-white text-sm font-medium" style={{ background: "var(--np-crimson)" }}>
          {t("reports.retry")}
        </button>
      </div>
    );
  }

  const selectedMapsLink = selected ? buildMapsLink(selected.location) : null;
  const selectedConfidence = selected ? confidencePct(selected.aiConfidence) : null;
  const canReview = selected && (selected.status === "pending" || selected.status === "flagged");

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-display font-bold text-text">{t("reports.heading")}</h2>
        <p className="text-muted mt-1">{t("reports.subtitle")}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {STATUS_TABS.map((s) => {
          const active = s === status;
          const label = s === "all" ? t("reports.allStatuses") : t("status." + s);
          return (
            <button key={s} onClick={() => resetPage(setStatus)(s)} className="relative px-4 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors" style={{ color: active ? "var(--np-crimson)" : "var(--muted)" }}>
              {active && (
                <motion.span layoutId="rep-tab" className="absolute inset-0 rounded-lg" style={{ background: "var(--crimson-soft)" }} transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <span className="relative z-10">{label} ({fmtNum(countFor(s), lang)})</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" strokeLinecap="round" />
            </svg>
          </span>
          <input value={query} onChange={(e) => resetPage(setQuery)(e.target.value)} placeholder={t("reports.searchPlaceholder")} className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface border border-border focus:border-crimson outline-none transition text-sm" />
        </div>
        <select value={category} onChange={(e) => resetPage(setCategory)(e.target.value)} className="h-10 px-3 rounded-lg bg-surface border border-border outline-none focus:border-crimson transition text-sm cursor-pointer">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c === "all" ? t("reports.allCategories") : t("cat." + c)}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {loading && reports.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm">{t("common.loading")}…</div>
        ) : pageRows.length === 0 ? (
          <div className="p-12 text-center text-muted">{t("reports.noResults")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left border-b border-border">
                  <th className="font-medium px-5 py-3">{t("th.id")}</th>
                  <th className="font-medium px-3 py-3">{t("th.title")}</th>
                  <th className="font-medium px-3 py-3 hidden md:table-cell">{t("th.category")}</th>
                  <th className="font-medium px-3 py-3 hidden lg:table-cell">{t("reports.confidence")}</th>
                  <th className="font-medium px-3 py-3">{t("th.status")}</th>
                  <th className="font-medium px-5 py-3 hidden md:table-cell">{t("th.date")}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
                  const conf = confidencePct(r.aiConfidence);
                  return (
                    <tr key={r._id} onClick={() => setSelected(r)} className="border-b border-border last:border-0 hover:bg-surface2 transition-colors cursor-pointer">
                      <td className="px-5 py-3 text-muted">#{r._id.slice(-6)}</td>
                      <td className="px-3 py-3 font-medium text-text max-w-xs truncate">{r.description || "—"}</td>
                      <td className="px-3 py-3 hidden md:table-cell text-muted">{t("cat." + r.category)}</td>
                      <td className="px-3 py-3 hidden lg:table-cell text-muted">{conf !== null ? conf + "%" : "—"}</td>
                      <td className="px-3 py-3"><Badge style={st} label={t("status." + r.status)} /></td>
                      <td className="px-5 py-3 hidden md:table-cell text-muted">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted">{t("reports.showing", { a: from, b: to, n: filtered.length })}</span>
          <div className="flex items-center gap-2">
            <button disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 h-9 rounded-lg border border-border disabled:opacity-40 hover:bg-surface2 transition">
              {t("reports.prev")}
            </button>
            <span className="px-2 text-muted">{fmtNum(safePage, lang)} / {fmtNum(totalPages, lang)}</span>
            <button disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 h-9 rounded-lg border border-border disabled:opacity-40 hover:bg-surface2 transition">
              {t("reports.next")}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={() => setSelected(null)} />
            <motion.aside className="fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-surface border-l border-border shadow-lg overflow-y-auto" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.34, ease: EASE.smooth }}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-muted text-sm">#{selected._id.slice(-6)}</span>
                  <button onClick={() => setSelected(null)} className="w-9 h-9 grid place-items-center rounded-lg hover:bg-surface2 transition" aria-label={t("reports.close")}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <h3 className="text-xl font-display font-bold mb-1 text-text">{selected.description || t("th.title")}</h3>
                <p className="text-muted text-sm mb-4">{formatDateTime(selected.createdAt)}</p>

                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt="" className="rounded-lg w-full h-44 object-cover border border-border mb-4" />
                ) : (
                  <div className="rounded-lg bg-surface2 border border-border h-44 grid place-items-center mb-4 text-muted text-sm">{t("reports.noPhoto")}</div>
                )}

                <div className="space-y-3 text-sm">
                  <Row label={t("th.category")} value={t("cat." + selected.category)} />
                  <Row label={t("th.status")} node={<Badge style={STATUS_STYLE[selected.status] || STATUS_STYLE.pending} label={t("status." + selected.status)} />} />
                  {selectedConfidence !== null && <Row label={t("reports.confidence")} value={selectedConfidence + "%"} />}
                  {selectedMapsLink && <Row label={t("reports.viewOnMap")} node={<MapLink href={selectedMapsLink}>{t("reports.viewOnMap")}</MapLink>} />}
                </div>

                {canReview && (
                  <div className="flex gap-2 mt-6 pt-4 border-t border-border">
                    <button disabled={reviewing} onClick={() => handleReview(selected._id, "rejected")} className="flex-1 h-11 rounded-lg text-sm font-medium border border-border text-text disabled:opacity-50">
                      {t("reports.reject")}
                    </button>
                    <button disabled={reviewing} onClick={() => handleReview(selected._id, "approved")} className="flex-1 h-11 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--np-crimson)" }}>
                      {t("reports.approve")}
                    </button>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}