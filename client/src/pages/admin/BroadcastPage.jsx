// file: client/src/pages/admin/BroadcastPage.jsx
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/FormField";

const EMPTY_ERRORS = {};

export default function BroadcastPage() {
  const [audience, setAudience] = useState("all"); // "all" | "admins"

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [titleNe, setTitleNe] = useState("");
  const [messageNe, setMessageNe] = useState("");

  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const showNepaliFields = audience === "all"; // admins only ever get English email

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/notifications/broadcasts");
      setHistory(res.data.data.broadcasts);
    } catch {
      // history is a nice-to-have; leave the list empty rather than blocking the page
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const validate = () => {
    const next = {};
    if (title.trim().length < 2) next.title = "Title must be at least 2 characters";
    if (title.trim().length > 120) next.title = "Title must be under 120 characters";
    if (message.trim().length < 2) next.message = "Message must be at least 2 characters";
    if (message.trim().length > 500) next.message = "Message must be under 500 characters";

    if (showNepaliFields) {
      if (titleNe.trim().length > 0 && titleNe.trim().length < 2) {
        next.titleNe = "Title must be at least 2 characters";
      }
      if (titleNe.trim().length > 120) next.titleNe = "Title must be under 120 characters";
      if (messageNe.trim().length > 0 && messageNe.trim().length < 2) {
        next.messageNe = "Message must be at least 2 characters";
      }
      if (messageNe.trim().length > 500) next.messageNe = "Message must be under 500 characters";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    setApiError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await api.post("/notifications/broadcast", {
        title: title.trim(),
        message: message.trim(),
        titleNe: showNepaliFields && titleNe.trim() ? titleNe.trim() : undefined,
        messageNe: showNepaliFields && messageNe.trim() ? messageNe.trim() : undefined,
        audience,
      });
      setResult({
        count: res.data.data.recipientCount,
        audience: res.data.data.audience,
      });
      setTitle("");
      setMessage("");
      setTitleNe("");
      setMessageNe("");
      setErrors(EMPTY_ERRORS);
      loadHistory();
    } catch (err) {
      setApiError(
        err.response?.data?.message || "Failed to send broadcast. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/notifications/broadcasts/${id}`);
      setHistory((prev) => prev.filter((b) => b._id !== id));
    } catch {
      // leave the row in place if delete failed; user can retry
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-5xl">
      <h2 className="font-display font-semibold text-xl mb-1">Send a broadcast</h2>
      <p className="text-sm text-muted mb-6">
        {audience === "all"
          ? "In-app notification (in the viewer's language) + English email, sent to every active citizen."
          : "Email only, in English, sent to every active admin."}
      </p>

      <form onSubmit={handleSubmit} className="lux-card p-6 rounded-2xl">
        <div className="mb-6 text-left">
          <label className="block text-sm font-medium text-text mb-2">Send to</label>
          <div className="flex gap-2 max-w-md">
            <button
              type="button"
              onClick={() => setAudience("all")}
              className="flex-1 h-10 rounded-lg text-sm font-medium border transition"
              style={
                audience === "all"
                  ? { background: "var(--np-blue)", color: "#fff", borderColor: "var(--np-blue)" }
                  : { borderColor: "var(--border)" }
              }
            >
              All citizens
            </button>
            <button
              type="button"
              onClick={() => setAudience("admins")}
              className="flex-1 h-10 rounded-lg text-sm font-medium border transition"
              style={
                audience === "admins"
                  ? { background: "var(--np-blue)", color: "#fff", borderColor: "var(--np-blue)" }
                  : { borderColor: "var(--border)" }
              }
            >
              Admins only
            </button>
          </div>
        </div>

        {/* ---------------- English + Nepali side by side ---------------- */}
        <div
          className={
            showNepaliFields
              ? "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
              : "grid grid-cols-1 gap-y-6 max-w-md"
          }
        >
          {/* English column (always required) */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" }}
              >
                English
              </span>
              {showNepaliFields && <span className="text-xs text-muted">Required — always sent</span>}
            </div>

            <FormField
              id="broadcast-title"
              label="Title"
              placeholder="e.g. Scheduled maintenance tonight"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              maxLength={120}
            />

            <div className="text-left">
              <label htmlFor="broadcast-message" className="block text-sm font-medium text-text mb-2">
                Message
              </label>
              <textarea
                id="broadcast-message"
                rows={6}
                maxLength={500}
                placeholder="Write the announcement citizens will see..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="lux-input w-full py-3.5 px-4 rounded-xl text-base text-text placeholder:text-placeholder outline-none resize-none"
              />
              <div className="flex justify-between mt-1.5">
                {errors.message ? (
                  <p className="text-sm font-medium" style={{ color: "var(--np-crimson)" }}>
                    {errors.message}
                  </p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted">{message.length}/500</span>
              </div>
            </div>
          </div>

          {/* Nepali column (optional, citizens only) */}
          {showNepaliFields && (
            <div className="md:border-l md:border-border md:pl-8">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: "var(--crimson-soft)", color: "var(--np-crimson)" }}
                >
                  नेपाली
                </span>
                <span className="text-xs text-muted">Optional — shown instead of English</span>
              </div>

              <FormField
                id="broadcast-title-ne"
                label="शीर्षक (Title in Nepali)"
                placeholder="जस्तै: आजराति सडक मर्मत सूचना"
                value={titleNe}
                onChange={(e) => setTitleNe(e.target.value)}
                error={errors.titleNe}
                maxLength={120}
              />

              <div className="text-left">
                <label htmlFor="broadcast-message-ne" className="block text-sm font-medium text-text mb-2">
                  सन्देश (Message in Nepali)
                </label>
                <textarea
                  id="broadcast-message-ne"
                  rows={6}
                  maxLength={500}
                  placeholder="नागरिकहरूले देख्ने सूचना नेपालीमा लेख्नुहोस्..."
                  value={messageNe}
                  onChange={(e) => setMessageNe(e.target.value)}
                  className="lux-input w-full py-3.5 px-4 rounded-xl text-base text-text placeholder:text-placeholder outline-none resize-none"
                  dir="ltr"
                />
                <div className="flex justify-between mt-1.5">
                  {errors.messageNe ? (
                    <p className="text-sm font-medium" style={{ color: "var(--np-crimson)" }}>
                      {errors.messageNe}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-muted">{messageNe.length}/500</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {apiError && (
          <p className="text-sm font-medium mt-6" style={{ color: "var(--np-crimson)" }}>
            {apiError}
          </p>
        )}

        <div className="mt-6 max-w-md">
          <Button type="submit" loading={loading}>
            Send broadcast
          </Button>
        </div>
      </form>

      <AnimatePresence>
        {result !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-4 px-4 py-3 rounded-xl border border-border bg-surface2 text-sm max-w-md"
          >
            Sent to <strong>{result.count}</strong>{" "}
            {result.audience === "admins" ? "admin" : "citizen"}
            {result.count === 1 ? "" : "s"}.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- History ---------------- */}
      <div className="mt-10">
        <h3 className="font-display font-semibold text-lg mb-3">Broadcast history</h3>

        {historyLoading ? (
          <p className="text-sm text-muted">Loading history…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted">No broadcasts sent yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence initial={false}>
              {history.map((b) => (
                <motion.li
                  key={b._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="lux-card p-4 rounded-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={
                            b.audience === "admins"
                              ? { background: "var(--crimson-soft)", color: "var(--np-crimson)" }
                              : { background: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" }
                          }
                        >
                          {b.audience === "admins" ? "Admins" : "All citizens"}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(b.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="font-medium text-text truncate">{b.title}</p>
                      <p className="text-sm text-muted line-clamp-2">{b.message}</p>
                      <p className="text-xs text-muted mt-1">
                        Sent to {b.recipientCount} {b.audience === "admins" ? "admin" : "citizen"}
                        {b.recipientCount === 1 ? "" : "s"}
                        {b.sentBy?.fullName ? ` · by ${b.sentBy.fullName}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(b._id)}
                      disabled={deletingId === b._id}
                      className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted hover:text-text transition disabled:opacity-50"
                    >
                      {deletingId === b._id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}