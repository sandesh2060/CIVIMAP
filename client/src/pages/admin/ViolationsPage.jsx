// file: client/src/pages/admin/ViolationsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import { useLang } from "../../i18n/LanguageContext";
import { fmtNum } from "../../i18n/numbers";
import { EASE } from "../../config/tokens";

const STATUS_STYLE = {
  detected: { bg: "var(--surface2)", color: "var(--muted)" },
  flagged: { bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" },
  notified: { bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  reviewed: { bg: "#e6f4ea", color: "#1e7e34" },
};

const STATUS_TABS = ["all", "detected", "flagged", "notified", "reviewed"];
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
  if (!location) return null;
  if (Array.isArray(location.coordinates)) {
    return "https://www.google.com/maps?q=" + location.coordinates[1] + "," + location.coordinates[0];
  }
  if (location.lat !== undefined && location.lng !== undefined) {
    return "https://www.google.com/maps?q=" + location.lat + "," + location.lng;
  }
  return null;
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

export default function ViolationsPage() {
  const { t, lang } = useLang();

  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewing, setReviewing] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/violations", { params: { page: 1, limit: 500 } });
      setViolations(res.data.data.violations || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return violations.filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const plate = (v.extractedPlateNumber || "").toLowerCase();
        const owner = (v.matchedOwner && v.matchedOwner.name ? v.matchedOwner.name : "").toLowerCase();
        if (!plate.includes(q) && !owner.includes(q) && !String(v._id).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [violations, status, query]);

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
    if (s === "all") return violations.length;
    return violations.filter((v) => v.status === s).length;
  }

  async function handleReview(id, decision) {
    setReviewing(true);
    try {
      const res = await api.patch("/violations/" + id + "/review", { decision: decision });
      const updated = res.data.data.violation;
      setViolations((prev) => prev.map((v) => (v._id === id ? updated : v)));
      setSelected(updated);
    } catch (err) {
      console.error("Review failed", err);
    } finally {
      setReviewing(false);
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted text-sm">{t("reports.errorLoading")}</p>
        <button onClick={load} className="px-4 h-10 rounded-lg text-white text-sm font-medium" style={{ background: "var(--np-crimson)" }}>
          {t("reports.retry")}
        </button>
      </div>
    );
  }

  const selectedMapsLink = selected ? buildMapsLink(selected.location) : null;
  const selectedConfidence = selected ? confidencePct(selected.aiConfidence) : null;
  const canReview = selected && (selected.status === "detected" || selected.status === "flagged");

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-display font-bold text-text">{t("violations.heading")}</h2>
        <p className="text-muted mt-1">{t("violations.subtitle")}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {STATUS_TABS.map((s) => {
          const active = s === status;
          const label = s === "all" ? t("reports.allStatuses") : t("status." + s);
          return (
            <button key={s} onClick={() => resetPage(setStatus)(s)} className="relative px-4 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors" style={{ color: active ? "var(--np-crimson)" : "var(--muted)" }}>
              {active && (
                <motion.span layoutId="viol-tab" className="absolute inset-0 rounded-lg" style={{ background: "var(--crimson-soft)" }} transition={{ type: "spring", stiffness: 400, damping: 32 }} />
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
          <input value={query} onChange={(e) => resetPage(setQuery)(e.target.value)} placeholder={t("violations.searchPlaceholder")} className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface border border-border focus:border-crimson outline-none transition text-sm" />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted text-sm">{t("common.loading")}…</div>
        ) : pageRows.length === 0 ? (
          <div className="p-12 text-center text-muted">{t("reports.noResults")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left border-b border-border">
                  <th className="font-medium px-5 py-3">{t("th.id")}</th>
                  <th className="font-medium px-3 py-3">{t("violations.plate")}</th>
                  <th className="font-medium px-3 py-3 hidden md:table-cell">{t("violations.owner")}</th>
                  <th className="font-medium px-3 py-3 hidden lg:table-cell">{t("reports.confidence")}</th>
                  <th className="font-medium px-3 py-3">{t("th.status")}</th>
                  <th className="font-medium px-5 py-3 hidden md:table-cell">{t("th.date")}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((v) => {
                  const st = STATUS_STYLE[v.status] || STATUS_STYLE.detected;
                  const conf = confidencePct(v.aiConfidence);
                  return (
                    <tr key={v._id} onClick={() => setSelected(v)} className="border-b border-border last:border-0 hover:bg-surface2 transition-colors cursor-pointer">
                      <td className="px-5 py-3 text-muted">#{v._id.slice(-6)}</td>
                      <td className="px-3 py-3 font-medium text-text">{v.extractedPlateNumber || t("violations.noPlate")}</td>
                      <td className="px-3 py-3 hidden md:table-cell text-muted">{v.matchedOwner && v.matchedOwner.name ? v.matchedOwner.name : "—"}</td>
                      <td className="px-3 py-3 hidden lg:table-cell text-muted">{conf !== null ? conf + "%" : "—"}</td>
                      <td className="px-3 py-3"><Badge style={st} label={t("status." + v.status)} /></td>
                      <td className="px-5 py-3 hidden md:table-cell text-muted">{formatDateTime(v.createdAt)}</td>
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

                <h3 className="text-xl font-display font-bold mb-1 text-text">{selected.extractedPlateNumber || t("violations.noPlate")}</h3>
                <p className="text-muted text-sm mb-4">{formatDateTime(selected.createdAt)}</p>

                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt="" className="rounded-lg w-full h-44 object-cover border border-border mb-4" />
                ) : (
                  <div className="rounded-lg bg-surface2 border border-border h-44 grid place-items-center mb-4 text-muted text-sm">{t("reports.noPhoto")}</div>
                )}

                <div className="space-y-3 text-sm">
                  <Row label={t("th.status")} node={<Badge style={STATUS_STYLE[selected.status] || STATUS_STYLE.detected} label={t("status." + selected.status)} />} />
                  {selectedConfidence !== null && <Row label={t("reports.confidence")} value={selectedConfidence + "%"} />}

                  {selected.matchedOwner && selected.matchedOwner.name && (
                    <>
                      <Row label={t("violations.owner")} value={selected.matchedOwner.name} />
                      {selected.matchedOwner.phone && <Row label={t("violations.ownerPhone")} value={selected.matchedOwner.phone} />}
                      {selected.matchedOwner.email && <Row label={t("violations.ownerEmail")} value={selected.matchedOwner.email} />}
                      {selected.matchedOwner.vehicleType && <Row label={t("violations.vehicleType")} value={selected.matchedOwner.vehicleType} />}
                    </>
                  )}

                  {!selected.matchedOwner || !selected.matchedOwner.name ? (
                    <p className="text-xs text-muted bg-surface2 rounded-lg px-3 py-2">{t("violations.noOwnerMatch")}</p>
                  ) : null}

                  {selectedMapsLink && <Row label={t("reports.viewOnMap")} node={<MapLink href={selectedMapsLink}>{t("reports.viewOnMap")}</MapLink>} />}

                  {selected.notifiedAt && <Row label={t("reports.notifiedAt")} value={formatDateTime(selected.notifiedAt)} />}
                </div>

                {canReview && (
                  <div className="flex gap-2 mt-6 pt-4 border-t border-border">
                    <button disabled={reviewing} onClick={() => handleReview(selected._id, "rejected")} className="flex-1 h-11 rounded-lg text-sm font-medium border border-border text-text disabled:opacity-50">
                      {t("reports.reject")}
                    </button>
                    <button disabled={reviewing} onClick={() => handleReview(selected._id, "confirmed")} className="flex-1 h-11 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--np-crimson)" }}>
                      {t("violations.confirm")}
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