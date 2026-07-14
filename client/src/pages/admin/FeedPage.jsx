// file: client/src/pages/admin/FeedPage.jsx  (NEW)
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import { useLang } from "../../i18n/LanguageContext";
import { fmtNum } from "../../i18n/numbers";
import { EASE } from "../../config/tokens";
import { useCachedFetch, invalidateCache } from "../../hooks/useCachedFetch";
import PostComposer from "../../components/feed/PostComposer";

const CATEGORIES = ["announcement", "road", "traffic", "safety", "maintenance", "other"];
const STATUS_TABS = ["all", "published", "draft"];
const PAGE_SIZE = 8;

const CATEGORY_STYLE = {
  announcement: { bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" },
  road: { bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  traffic: { bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  safety: { bg: "#e6f4ea", color: "#1e7e34" },
  maintenance: { bg: "var(--surface2)", color: "var(--muted)" },
  other: { bg: "var(--surface2)", color: "var(--muted)" },
};

const STATUS_STYLE = {
  published: { bg: "#e6f4ea", color: "#1e7e34" },
  draft: { bg: "var(--surface2)", color: "var(--muted)" },
};

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Badge({ style, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: style.bg, color: style.color }}>
      {label}
    </span>
  );
}

function Row({ label, value, node }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted">{label}</span>
      {node ? node : <span className="font-medium text-text">{value}</span>}
    </div>
  );
}

const POSTS_CACHE_KEY = "admin:feed:posts";
const FLAGGED_CACHE_KEY = "admin:feed:flagged";

async function loadPosts() {
  const res = await api.get("/feed/posts/admin", { params: { page: 1, limit: 500 } });
  return res.data.data.posts || [];
}

async function loadFlagged() {
  const res = await api.get("/feed/comments/flagged");
  return res.data.data.comments || [];
}

export default function FeedPage() {
  const { t, lang } = useLang();

  const [tab, setTab] = useState("posts"); // "posts" | "flagged"
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null); // selected post for detail drawer
  const [composerFor, setComposerFor] = useState(null); // null = closed, {} = new, post = edit
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // post pending delete confirmation

  const { data: postsData, loading, error, refresh, setData } = useCachedFetch(POSTS_CACHE_KEY, loadPosts);
  const posts = postsData || [];

  const {
    data: flaggedData,
    loading: flaggedLoading,
    refresh: refreshFlagged,
    setData: setFlaggedData,
  } = useCachedFetch(FLAGGED_CACHE_KEY, loadFlagged);
  const flagged = flaggedData || [];

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (category !== "all" && p.category !== category) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [posts, status, category, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  function resetPage(fn) {
    return (v) => { fn(v); setPage(1); };
  }

  function countFor(s) {
    if (s === "all") return posts.length;
    return posts.filter((p) => p.status === s).length;
  }

  function handleSaved(post) {
    const exists = posts.some((p) => p._id === post._id);
    const next = exists ? posts.map((p) => (p._id === post._id ? post : p)) : [post, ...posts];
    setData(next);
    setComposerFor(null);
    setSelected((cur) => (cur && cur._id === post._id ? post : cur));
  }

  async function handleTogglePin(post) {
    setBusyId(post._id);
    try {
      const res = await api.patch(`/feed/posts/${post._id}`, { isPinned: !post.isPinned });
      const updated = res.data.data.post;
      setData(posts.map((p) => (p._id === post._id ? updated : p)));
      setSelected((cur) => (cur && cur._id === post._id ? updated : cur));
    } catch {
      // leave list as-is; user can retry
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(post) {
    setBusyId(post._id);
    try {
      await api.delete(`/feed/posts/${post._id}`);
      setData(posts.filter((p) => p._id !== post._id));
      setSelected((cur) => (cur && cur._id === post._id ? null : cur));
      setConfirmDelete(null);
    } catch {
      // keep confirm dialog open so the admin can retry
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveFlaggedComment(comment) {
    setBusyId(comment._id);
    try {
      await api.patch(`/feed/comments/${comment._id}/hide`);
      setFlaggedData(flagged.filter((c) => c._id !== comment._id));
      // The post's commentCount changed server-side, but we don't have
      // a cheap way to patch that into the cached posts list here —
      // next full refresh of the Posts tab will pick it up.
      invalidateCache(POSTS_CACHE_KEY);
    } catch {
      // leave in list so admin can retry
    } finally {
      setBusyId(null);
    }
  }

  if (error && posts.length === 0 && tab === "posts") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted text-sm">{t("reports.errorLoading")}</p>
        <button onClick={refresh} className="px-4 h-10 rounded-lg text-white text-sm font-medium" style={{ background: "var(--np-crimson)" }}>
          {t("reports.retry")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-display font-bold text-text">Feed Management</h2>
          <p className="text-muted mt-1">Create posts, moderate comments, manage the citizen feed.</p>
        </div>
        {tab === "posts" && (
          <button
            onClick={() => setComposerFor({})}
            className="px-4 h-9 rounded-lg text-white text-sm font-medium"
            style={{ background: "var(--np-crimson)" }}
          >
            New post
          </button>
        )}
      </div>

      {/* Top-level tabs: Posts / Flagged comments */}
      <div className="flex gap-1 bg-surface2 p-1 rounded-lg w-fit mb-4">
        {[
          { id: "posts", label: "Posts", count: posts.length },
          { id: "flagged", label: "Flagged comments", count: flagged.length },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className="relative px-4 h-9 rounded-md text-sm font-medium transition-colors"
            style={{ color: tab === tabItem.id ? "var(--np-crimson)" : "var(--muted)" }}
          >
            {tab === tabItem.id && (
              <motion.span
                layoutId="feed-admin-tab-pill"
                className="absolute inset-0 rounded-md bg-surface"
                style={{ boxShadow: "var(--shadow-sm)" }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">
              {tabItem.label} <span className="text-xs opacity-70">({fmtNum(tabItem.count, lang)})</span>
            </span>
          </button>
        ))}
      </div>

      {tab === "posts" ? (
        <>
          <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
            {STATUS_TABS.map((s) => {
              const active = s === status;
              const label = s === "all" ? "All" : s[0].toUpperCase() + s.slice(1);
              return (
                <button
                  key={s}
                  onClick={() => resetPage(setStatus)(s)}
                  className="relative px-4 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                  style={{ color: active ? "var(--np-crimson)" : "var(--muted)" }}
                >
                  {active && (
                    <motion.span layoutId="feed-status-tab" className="absolute inset-0 rounded-lg" style={{ background: "var(--crimson-soft)" }} transition={{ type: "spring", stiffness: 400, damping: 32 }} />
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
              <input
                value={query}
                onChange={(e) => resetPage(setQuery)(e.target.value)}
                placeholder="Search title or body…"
                className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface border border-border focus:border-crimson outline-none transition text-sm"
              />
            </div>
            <select
              value={category}
              onChange={(e) => resetPage(setCategory)(e.target.value)}
              className="h-10 px-3 rounded-lg bg-surface border border-border focus:border-crimson outline-none transition text-sm sm:w-48"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
            {loading && posts.length === 0 ? (
              <div className="p-12 text-center text-muted text-sm">{t("common.loading")}…</div>
            ) : pageRows.length === 0 ? (
              <div className="p-12 text-center text-muted">{t("reports.noResults")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted text-left border-b border-border">
                      <th className="font-medium px-5 py-3">Title</th>
                      <th className="font-medium px-3 py-3 hidden md:table-cell">Category</th>
                      <th className="font-medium px-3 py-3">Status</th>
                      <th className="font-medium px-3 py-3 hidden lg:table-cell">Engagement</th>
                      <th className="font-medium px-5 py-3 hidden md:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((p) => {
                      const st = STATUS_STYLE[p.status] || STATUS_STYLE.draft;
                      const cat = CATEGORY_STYLE[p.category] || CATEGORY_STYLE.other;
                      return (
                        <tr key={p._id} onClick={() => setSelected(p)} className="border-b border-border last:border-0 hover:bg-surface2 transition-colors cursor-pointer">
                          <td className="px-5 py-3 font-medium text-text max-w-xs truncate">
                            {p.isPinned && <span className="text-xs mr-1.5" style={{ color: "var(--np-crimson)" }}>📌</span>}
                            {p.title}
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell">
                            <Badge style={cat} label={p.category} />
                          </td>
                          <td className="px-3 py-3"><Badge style={st} label={p.status} /></td>
                          <td className="px-3 py-3 hidden lg:table-cell text-muted">
                            {fmtNum(p.likeCount || 0, lang)} likes · {fmtNum(p.commentCount || 0, lang)} comments
                          </td>
                          <td className="px-5 py-3 hidden md:table-cell text-muted">{formatDateTime(p.createdAt)}</td>
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
              <span className="text-muted">
                Showing {fmtNum(from, lang)}–{fmtNum(to, lang)} of {fmtNum(filtered.length, lang)}
              </span>
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
        </>
      ) : (
        // ---- Flagged comments moderation queue ----
        <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
          {flaggedLoading && flagged.length === 0 ? (
            <div className="p-12 text-center text-muted text-sm">{t("common.loading")}…</div>
          ) : flagged.length === 0 ? (
            <div className="p-12 text-center text-muted">No flagged comments right now.</div>
          ) : (
            <div className="divide-y divide-border">
              {flagged.map((c) => (
                <div key={c._id} className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted mb-1">
                      {c.author?.fullName || "Citizen"} · on "{c.post?.title || "deleted post"}" ·{" "}
                      <span style={{ color: "var(--np-crimson)" }}>{fmtNum(c.flagCount, lang)} flags</span>
                    </p>
                    <p className="text-sm text-text whitespace-pre-line">{c.body}</p>
                  </div>
                  <button
                    disabled={busyId === c._id}
                    onClick={() => handleRemoveFlaggedComment(c)}
                    className="shrink-0 text-xs font-medium px-3 h-8 rounded-lg border border-border hover:bg-surface2 transition disabled:opacity-50"
                  >
                    {busyId === c._id ? "Removing…" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={() => setSelected(null)} />
            <motion.aside className="fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-surface border-l border-border shadow-lg overflow-y-auto" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.34, ease: EASE.smooth }}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-muted text-sm">#{selected._id.slice(-6)}</span>
                  <button onClick={() => setSelected(null)} className="w-9 h-9 grid place-items-center rounded-lg hover:bg-surface2 transition" aria-label="Close">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <h3 className="text-xl font-display font-bold mb-1 text-text">{selected.title}</h3>
                <p className="text-muted text-sm mb-4">{formatDateTime(selected.createdAt)}</p>

                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt="" className="rounded-lg w-full h-44 object-cover border border-border mb-4" />
                ) : null}

                <p className="text-sm text-text whitespace-pre-line mb-4">{selected.body}</p>

                <div className="space-y-3 text-sm">
                  <Row label="Status" node={<Badge style={STATUS_STYLE[selected.status] || STATUS_STYLE.draft} label={selected.status} />} />
                  <Row label="Category" node={<Badge style={CATEGORY_STYLE[selected.category] || CATEGORY_STYLE.other} label={selected.category} />} />
                  <Row label="Pinned" value={selected.isPinned ? "Yes" : "No"} />
                  <Row label="Comments disabled" value={selected.commentsDisabled ? "Yes" : "No"} />
                  <Row label="Likes" value={fmtNum(selected.likeCount || 0, lang)} />
                  <Row label="Comments" value={fmtNum(selected.commentCount || 0, lang)} />
                  <Row label="Views" value={fmtNum(selected.viewCount || 0, lang)} />
                  {selected.createdBy?.fullName && <Row label="Created by" value={selected.createdBy.fullName} />}
                </div>

                <div className="flex gap-2 mt-6 pt-4 border-t border-border">
                  <button
                    disabled={busyId === selected._id}
                    onClick={() => handleTogglePin(selected)}
                    className="flex-1 h-11 rounded-lg text-sm font-medium border border-border text-text disabled:opacity-50"
                  >
                    {selected.isPinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={() => setComposerFor(selected)}
                    className="flex-1 h-11 rounded-lg text-sm font-medium border border-border text-text"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(selected)}
                    className="flex-1 h-11 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--np-crimson)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Create/edit composer */}
      <AnimatePresence>
        {composerFor && (
          <PostComposer
            post={composerFor._id ? composerFor : null}
            onClose={() => setComposerFor(null)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE.out }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-xl w-full max-w-sm p-5"
            >
              <h3 className="font-display text-lg font-semibold text-text mb-2">Delete this post?</h3>
              <p className="text-sm text-muted mb-5">
                "{confirmDelete.title}" and all its comments will be permanently deleted. This can't be undone.
              </p>
              <div className="flex gap-2">
                <button
                  disabled={busyId === confirmDelete._id}
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 h-11 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--np-crimson)" }}
                >
                  {busyId === confirmDelete._id ? "Deleting…" : "Delete"}
                </button>
                <button onClick={() => setConfirmDelete(null)} className="h-11 px-5 rounded-lg text-sm font-medium border border-border">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}