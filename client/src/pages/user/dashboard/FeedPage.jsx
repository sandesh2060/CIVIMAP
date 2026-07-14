// file: client/src/pages/user/dashboard/FeedPage.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../../services/api";
import socket from "../../../services/socket";
import { useAuth } from "../../../context/AuthContext";
import PostCard from "../../../components/feed/PostCard";
import CommentThread from "../../../components/feed/CommentThread";

const CATEGORIES = ["all", "announcement", "road", "traffic", "safety", "maintenance", "other"];
const LIMIT = 20;

function sameId(a, b) {
  return a && b && String(a) === String(b);
}

export default function FeedPage() {
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id;

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [openCommentsFor, setOpenCommentsFor] = useState(null); // single post id, or null
  const [likeBusyId, setLikeBusyId] = useState(null);
  const mountedOnce = useRef(false);

  const load = useCallback(async (targetCategory, targetPage) => {
    const isFirstPage = targetPage === 1;
    isFirstPage ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const params = { page: targetPage, limit: LIMIT };
      if (targetCategory !== "all") params.category = targetCategory;
      const res = await api.get("/feed/posts", { params });
      const { posts: fetched, total: t } = res.data.data;
      setPosts((prev) => (isFirstPage ? fetched : [...prev, ...fetched]));
      setTotal(t);
    } catch {
      setError("Couldn't load the feed. Pull to refresh or try again.");
    } finally {
      isFirstPage ? setLoading(false) : setLoadingMore(false);
    }
  }, []);

  // Initial load + reload whenever the category filter changes.
  useEffect(() => {
    setPage(1);
    load(category, 1);
  }, [category, load]);

  // Live updates — feed:new_post / post_updated / post_deleted are
  // GLOBAL broadcasts (see feedSocket.js), so we filter/merge client-side.
  useEffect(() => {
    function handleNewPost({ post }) {
      // Only splice a brand-new post into view if it matches the active
      // filter (or "all"), and only if it's actually published (drafts
      // never reach citizens via this event anyway, but stay defensive).
      if (post.status !== "published") return;
      if (category !== "all" && post.category !== category) return;
      setPosts((prev) => (prev.some((p) => sameId(p._id, post._id)) ? prev : [post, ...prev]));
      setTotal((t) => t + 1);
    }

    function handlePostUpdated({ post }) {
      setPosts((prev) => {
        const exists = prev.some((p) => sameId(p._id, post._id));
        // Post was a draft we never saw, but just got published — and it
        // matches the current filter: splice it in like a new post.
        if (!exists) {
          if (post.status !== "published") return prev;
          if (category !== "all" && post.category !== category) return prev;
          setTotal((t) => t + 1);
          return [post, ...prev];
        }
        // Post moved to a status/category we no longer show: drop it.
        if (post.status !== "published" || (category !== "all" && post.category !== category)) {
          setTotal((t) => Math.max(0, t - 1));
          return prev.filter((p) => !sameId(p._id, post._id));
        }
        return prev.map((p) => (sameId(p._id, post._id) ? post : p));
      });
    }

    function handlePostDeleted({ postId }) {
      setPosts((prev) => {
        if (!prev.some((p) => sameId(p._id, postId))) return prev;
        setTotal((t) => Math.max(0, t - 1));
        return prev.filter((p) => !sameId(p._id, postId));
      });
      setOpenCommentsFor((cur) => (sameId(cur, postId) ? null : cur));
    }

    socket.on("feed:new_post", handleNewPost);
    socket.on("feed:post_updated", handlePostUpdated);
    socket.on("feed:post_deleted", handlePostDeleted);
    return () => {
      socket.off("feed:new_post", handleNewPost);
      socket.off("feed:post_updated", handlePostUpdated);
      socket.off("feed:post_deleted", handlePostDeleted);
    };
  }, [category]);

  async function handleLikeToggle(post) {
    setLikeBusyId(post._id);
    const wasLiked = (post.likedBy || []).some((id) => sameId(id, currentUserId));

    // Optimistic update — flip both the count AND likedBy, since PostCard
    // reads likedBy (not a separate boolean) to decide the heart fill state.
    setPosts((prev) =>
      prev.map((p) => {
        if (!sameId(p._id, post._id)) return p;
        const nextLikedBy = wasLiked
          ? (p.likedBy || []).filter((id) => !sameId(id, currentUserId))
          : [...(p.likedBy || []), currentUserId];
        return { ...p, likeCount: p.likeCount + (wasLiked ? -1 : 1), likedBy: nextLikedBy };
      })
    );

    try {
      const res = await api.post(`/feed/posts/${post._id}/like`);
      const { liked, likeCount } = res.data.data;
      // Reconcile with the server's authoritative liked/likeCount, in case
      // of a race (e.g. double-click) — likedBy follows the server's `liked`.
      setPosts((prev) =>
        prev.map((p) => {
          if (!sameId(p._id, post._id)) return p;
          const nextLikedBy = liked
            ? (p.likedBy || []).some((id) => sameId(id, currentUserId))
              ? p.likedBy
              : [...(p.likedBy || []), currentUserId]
            : (p.likedBy || []).filter((id) => !sameId(id, currentUserId));
          return { ...p, likeCount, likedBy: nextLikedBy };
        })
      );
    } catch {
      // Roll back the optimistic change.
      setPosts((prev) =>
        prev.map((p) => {
          if (!sameId(p._id, post._id)) return p;
          const nextLikedBy = wasLiked
            ? [...(p.likedBy || []), currentUserId]
            : (p.likedBy || []).filter((id) => !sameId(id, currentUserId));
          return { ...p, likeCount: p.likeCount + (wasLiked ? 1 : -1), likedBy: nextLikedBy };
        })
      );
      setError("Couldn't update your like. Try again.");
    } finally {
      setLikeBusyId(null);
    }
  }

  function handleToggleComments(post) {
    setOpenCommentsFor((cur) => (sameId(cur, post._id) ? null : post._id));
  }

  function handleCommentCountChange(postId, updater) {
    setPosts((prev) =>
      prev.map((p) => (sameId(p._id, postId) ? { ...p, commentCount: updater(p.commentCount) } : p))
    );
  }

  const canLoadMore = posts.length < total;

  async function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    await load(category, next);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition
              ${category === c
                ? "text-white border-transparent"
                : "border-border text-muted hover:text-text"}`}
            style={category === c ? { background: "var(--np-crimson)" } : undefined}
          >
            {c === "all" ? "All" : c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading feed…</p>
      ) : error && posts.length === 0 ? (
        <p className="text-sm text-muted">{error}</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted">No posts yet in this category.</p>
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {posts.map((post) => (
              <motion.div key={post._id} layout>
                <PostCard
                  post={post}
                  variant="citizen"
                  commentsOpen={sameId(openCommentsFor, post._id)}
                  onToggleComments={handleToggleComments}
                  onLikeToggle={handleLikeToggle}
                  likeBusy={likeBusyId === post._id}
                />
                {sameId(openCommentsFor, post._id) && (
                  <div className="border border-t-0 border-border rounded-b-lg px-4 pb-4 pt-3 bg-surface">
                    <CommentThread
                      postId={post._id}
                      commentsDisabled={post.commentsDisabled}
                      onCountChange={(updater) => handleCommentCountChange(post._id, updater)}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {error && posts.length > 0 && (
        <p className="text-xs mt-3" style={{ color: "var(--np-crimson)" }}>{error}</p>
      )}

      {canLoadMore && !loading && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-border hover:bg-surface2 transition disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}