// ========================================================================
// FILE : server/src/sockets/feedSocket.js  (UPDATED)
// ========================================================================

function emitFeedNewPost(io, post) {
  io.emit("feed:new_post", { post });
}

// FIX: was io.to(`post:${postId}`), but nothing in sockets/index.js ever
// joins a socket to a `post:<id>` room — there's no generic "join"/"leave"
// handler registered anywhere (only registerMapSocket/registerReportSocket/
// registerSignalSocket exist). That meant this event broadcast to an empty
// room and never reached any client. Switched to a global broadcast to
// match the app's existing convention (feed:new_post, place:new, report:new
// all broadcast globally and let the client filter) — CommentThread.jsx
// already filters incoming comments by postId, so no client-side change
// needed there beyond removing the now-dead join/leave calls below.
function emitFeedNewComment(io, postId, comment) {
  io.emit("feed:new_comment", { comment });
}

function emitFeedPostUpdated(io, post) {
  io.emit("feed:post_updated", { post });
}

function emitFeedPostDeleted(io, postId) {
  io.emit("feed:post_deleted", { postId });
}

module.exports = {
  emitFeedNewPost,
  emitFeedNewComment,
  emitFeedPostUpdated,
  emitFeedPostDeleted,
};