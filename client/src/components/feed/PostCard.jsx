// file: client/src/components/feed/PostCard.jsx
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";

const CATEGORY_STYLE = {
  announcement: { bg: "var(--blue-soft, rgba(0,56,147,0.1))", color: "var(--np-blue)" },
  road: { bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  traffic: { bg: "var(--crimson-soft)", color: "var(--np-crimson)" },
  safety: { bg: "#e6f4ea", color: "#1e7e34" },
  maintenance: { bg: "var(--surface2)", color: "var(--muted)" },
  other: { bg: "var(--surface2)", color: "var(--muted)" },
};

function formatDate(d) {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name) {
  if (!name) return "CM";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "CM";
}

function HeartIcon({ filled, small }) {
  const size = small ? "w-3 h-3" : "w-5 h-5";
  return (
    <svg viewBox="0 0 24 24" className={size} fill={filled ? "currentColor" : "none"}
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7.5-4.6-10-9.3C.6 8.1 2.3 5 5.6 5c2 0 3.4 1.1 4.4 2.6C11 5.9 12.4 4.8 14.4 4.8c3.3 0 5 3.1 3.6 6.9C15.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 01-8 8H7l-4 3 1-4.4A8 8 0 1121 12z" />
    </svg>
  );
}

function PinIcon({ small }) {
  const size = small ? "w-3 h-3" : "w-4 h-4";
  return (
    <svg viewBox="0 0 24 24" className={size} fill="currentColor">
      <path d="M14 2l-1 1 1 5-4 4-6-1 6 6-5 5 5-5 6 6-1-6 4-4 5 1-1-1-5-1 4-4-1-1-5 1 4-4-1-1-4 4-1-5z" transform="translate(0,0) scale(0.9)" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
    </svg>
  );
}

/**
 * Shared card for a feed post, styled like a Facebook post:
 * avatar/name/time header -> body text -> edge-to-edge image ->
 * like/comment count strip -> full-width Like/Comment action bar.
 *
 * `variant` controls which action set shows:
 *  - "citizen": like button + a toggle to open/close the comment thread
 *  - "admin": pin/edit/delete icon buttons in the header, no like button
 *
 * `commentsOpen` also flattens the card's bottom corners/border so the
 * comment thread rendered below it (by the parent) reads as one block.
 */
export default function PostCard({
  post,
  variant = "citizen",
  commentsOpen = false,
  onToggleComments,
  onLikeToggle,
  onEdit,
  onDelete,
  onTogglePin,
  likeBusy = false,
}) {
  const { user } = useAuth();
  const isCitizen = variant === "citizen";
  const catStyle = CATEGORY_STYLE[post.category] || CATEGORY_STYLE.other;

  const liked = isCitizen && user
    ? (post.likedBy || []).some((id) => String(id) === String(user._id || user.id))
    : false;

  const authorName = post.createdBy?.fullName || "CiviMap";
  const likeCount = post.likeCount || 0;
  const commentCount = post.commentCount || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={`lux-card border border-border bg-surface overflow-hidden ${
        commentsOpen ? "rounded-t-lg rounded-b-none border-b-0" : "rounded-lg"
      }`}
    >
      {/* Header: avatar + name + time/category, admin controls on the right */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        <div
          className="w-10 h-10 rounded-full grid place-items-center text-xs font-semibold shrink-0"
          style={{ background: catStyle.bg, color: catStyle.color }}
        >
          {getInitials(authorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-text truncate">{authorName}</span>
            {post.isPinned && (
              <span className="inline-flex items-center" style={{ color: "var(--np-crimson)" }} title="Pinned">
                <PinIcon small />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted flex-wrap">
            <span>{formatDate(post.publishedAt || post.createdAt)}</span>
            <span>·</span>
            <span className="capitalize font-medium" style={{ color: catStyle.color }}>
              {post.category}
            </span>
            {variant === "admin" && post.status === "draft" && (
              <>
                <span>·</span>
                <span className="text-muted">Draft</span>
              </>
            )}
          </div>
        </div>

        {variant === "admin" && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onTogglePin?.(post)}
              title={post.isPinned ? "Unpin" : "Pin to top"}
              className="w-8 h-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface2 transition"
            >
              <PinIcon />
            </button>
            <button
              type="button"
              onClick={() => onEdit?.(post)}
              title="Edit"
              className="w-8 h-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface2 transition"
            >
              <EditIcon />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(post)}
              title="Delete"
              className="w-8 h-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface2 transition"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {/* Body text */}
      <div className="px-4 pb-3">
        <h3 className="font-semibold text-text mb-1">{post.title}</h3>
        <p className="text-sm text-text whitespace-pre-line leading-relaxed">{post.body}</p>
      </div>

      {/* Edge-to-edge image */}
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt=""
          className="w-full max-h-[520px] object-cover block bg-surface2"
        />
      )}

      {/* Like/comment count summary strip */}
      {(likeCount > 0 || commentCount > 0 || (post.viewCount || 0) > 0) && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            {likeCount > 0 && (
              <>
                <span
                  className="w-4 h-4 rounded-full grid place-items-center text-white"
                  style={{ background: "var(--np-crimson)" }}
                >
                  <HeartIcon filled small />
                </span>
                {likeCount}
              </>
            )}
          </span>
          <span className="flex items-center gap-2">
            {commentCount > 0 && <span>{commentCount} comments</span>}
            <span>{post.viewCount || 0} views</span>
          </span>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center border-t border-border">
        {isCitizen ? (
          <button
            type="button"
            disabled={likeBusy}
            onClick={() => onLikeToggle?.(post)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition hover:bg-surface2 disabled:opacity-50"
            style={{ color: liked ? "var(--np-crimson)" : "var(--muted)" }}
          >
            <HeartIcon filled={liked} />
            Like
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted">
            <HeartIcon filled={false} />
            {likeCount} likes
          </div>
        )}

        <div className="w-px self-stretch bg-border" />

        <button
          type="button"
          onClick={() => onToggleComments?.(post)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted hover:bg-surface2 transition"
        >
          <CommentIcon />
          {commentsOpen ? "Hide comments" : "Comment"}
        </button>
      </div>

      {post.commentsDisabled && (
        <div className="px-4 pb-3 -mt-1">
          <span className="text-xs text-muted">Comments are disabled on this post</span>
        </div>
      )}
    </motion.div>
  );
}