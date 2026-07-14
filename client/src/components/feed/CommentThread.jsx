// file: client/src/components/feed/CommentThread.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import socket from "../../services/socket";
import { useAuth } from "../../context/AuthContext";

function formatDate(d) {
  return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function sameId(a, b) {
  return a && b && String(a) === String(b);
}

function CommentRow({ comment, isAdmin, currentUserId, onReply, onDelete, onFlag, onHide, busyId }) {
  const isOwn = sameId(comment.author?._id, currentUserId);
  const busy = busyId === comment._id;

  return (
    <div className="py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm">
            <span className="font-medium text-text">{comment.author?.fullName || "Citizen"}</span>{" "}
            <span className="text-xs text-muted">{formatDate(comment.createdAt)}</span>
          </p>
          <p className="text-sm text-text mt-0.5 whitespace-pre-line">{comment.body}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1 text-xs text-muted">
        {!comment.parentComment && (
          <button type="button" onClick={() => onReply(comment._id)} className="hover:text-text transition font-medium">
            Reply
          </button>
        )}
        {isOwn && (
          <button type="button" disabled={busy} onClick={() => onDelete(comment)} className="hover:text-text transition disabled:opacity-50">
            {busy ? "Deleting…" : "Delete"}
          </button>
        )}
        {!isOwn && !isAdmin && (
          <button type="button" disabled={busy} onClick={() => onFlag(comment)} className="hover:text-text transition disabled:opacity-50">
            Flag
          </button>
        )}
        {isAdmin && (
          <button type="button" disabled={busy} onClick={() => onHide(comment)} className="hover:text-text transition disabled:opacity-50">
            {busy ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Realtime: feed:new_comment is a GLOBAL broadcast (see feedSocket.js) —
 * matches the app's existing convention for feed:new_post, place:new,
 * report:new. We filter to this post client-side below. There is no
 * per-post room to join (confirmed against sockets/index.js — only
 * map/report/signal sockets register per-socket handlers), so no
 * join/leave calls are needed here.
 */
export default function CommentThread({ postId, commentsDisabled, onCountChange }) {
  const { user, isAdmin } = useAuth();
  const currentUserId = user?._id || user?.id;

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [busyId, setBusyId] = useState(null);
  const replyInputRef = useRef(null);

  // Synchronous submit guard — React state (`submitting`) only updates on
  // the next render, so two rapid clicks/Enter-presses can both read
  // `submitting === false` before the first setSubmitting(true) commits,
  // letting both requests through and creating two real Comment documents
  // (this was the "same comment posted twice" bug: two distinct _ids, not
  // a rendering/dedup issue). A ref updates immediately, closing that race.
  const submittingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/feed/posts/${postId}/comments`);
      setComments(res.data.data.comments);
    } catch {
      setError("Couldn't load comments.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleNewComment({ comment }) {
      if (!sameId(comment.post, postId)) return;
      setComments((prev) => (prev.some((c) => sameId(c._id, comment._id)) ? prev : [...prev, comment]));
      onCountChange?.((n) => n + 1);
    }

    socket.on("feed:new_comment", handleNewComment);
    return () => {
      socket.off("feed:new_comment", handleNewComment);
    };
  }, [postId, onCountChange]);

  useEffect(() => {
    if (replyTo && replyInputRef.current) replyInputRef.current.focus();
  }, [replyTo]);

  async function submitComment(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/feed/posts/${postId}/comments`, { body: text });
      const newComment = res.data.data.comment;
      // Guard against the socket broadcast having already delivered this
      // exact comment back to us before this response resolved.
      setComments((prev) => (prev.some((c) => sameId(c._id, newComment._id)) ? prev : [...prev, newComment]));
      setBody("");
      onCountChange?.((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't post your comment. Try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function submitReply(parentId) {
    const text = replyBody.trim();
    if (!text || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/feed/posts/${postId}/comments`, { body: text, parentComment: parentId });
      const newComment = res.data.data.comment;
      setComments((prev) => (prev.some((c) => sameId(c._id, newComment._id)) ? prev : [...prev, newComment]));
      setReplyBody("");
      setReplyTo(null);
      onCountChange?.((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't post your reply. Try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleDelete(comment) {
    setBusyId(comment._id);
    try {
      const path = isAdmin ? `/feed/comments/${comment._id}/admin` : `/feed/comments/${comment._id}`;
      await api.delete(path);
      setComments((prev) => prev.filter((c) => c._id !== comment._id && c.parentComment !== comment._id));
      onCountChange?.((n) => Math.max(0, n - 1));
    } catch {
      setError("Couldn't delete that comment.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleHide(comment) {
    setBusyId(comment._id);
    try {
      await api.patch(`/feed/comments/${comment._id}/hide`);
      setComments((prev) => prev.filter((c) => c._id !== comment._id));
      onCountChange?.((n) => Math.max(0, n - 1));
    } catch {
      setError("Couldn't remove that comment.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleFlag(comment) {
    setBusyId(comment._id);
    try {
      await api.post(`/feed/comments/${comment._id}/flag`);
    } catch {
      setError("Couldn't flag that comment.");
    } finally {
      setBusyId(null);
    }
  }

  const topLevel = comments.filter((c) => !c.parentComment);
  const repliesOf = (id) => comments.filter((c) => sameId(c.parentComment, id));

  return (
    <div className="border-t border-border pt-3 mt-3">
      {loading ? (
        <p className="text-sm text-muted">Loading comments…</p>
      ) : error && comments.length === 0 ? (
        <p className="text-sm text-muted">{error}</p>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-muted">No comments yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {topLevel.map((c) => (
            <div key={c._id}>
              <CommentRow
                comment={c}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                onReply={setReplyTo}
                onDelete={handleDelete}
                onFlag={handleFlag}
                onHide={handleHide}
                busyId={busyId}
              />
              {repliesOf(c._id).map((r) => (
                <div key={r._id} className="pl-5 border-l-2 border-border ml-1">
                  <CommentRow
                    comment={r}
                    isAdmin={isAdmin}
                    currentUserId={currentUserId}
                    onReply={setReplyTo}
                    onDelete={handleDelete}
                    onFlag={handleFlag}
                    onHide={handleHide}
                    busyId={busyId}
                  />
                </div>
              ))}

              <AnimatePresence>
                {replyTo === c._id && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitReply(c._id);
                    }}
                    className="pl-5 mt-1 mb-2 flex gap-2"
                  >
                    <input
                      ref={replyInputRef}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      maxLength={500}
                      placeholder="Write a reply…"
                      className="lux-input flex-1 h-9 px-3 rounded-lg text-sm outline-none"
                    />
                    <button
                      type="submit"
                      disabled={submitting || !replyBody.trim()}
                      className="text-xs font-medium px-3 rounded-lg text-white disabled:opacity-50"
                      style={{ background: "var(--np-crimson)" }}
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReplyTo(null); setReplyBody(""); }}
                      className="text-xs font-medium text-muted hover:text-text"
                    >
                      Cancel
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {error && comments.length > 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--np-crimson)" }}>{error}</p>
      )}

      {!commentsDisabled && !isAdmin && (
        <form onSubmit={submitComment} className="flex gap-2 mt-3">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            placeholder="Add a comment…"
            className="lux-input flex-1 h-10 px-3 rounded-lg text-sm outline-none"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="text-sm font-medium px-4 rounded-lg text-white disabled:opacity-50"
            style={{ background: "var(--np-crimson)" }}
          >
            Post
          </button>
        </form>
      )}
    </div>
  );
}