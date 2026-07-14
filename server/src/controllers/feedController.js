const Post = require("../models/Post");
const Comment = require("../models/Comment");
const feedService = require("../services/feedService");
const { getIO } = require("../sockets");
const feedSocket = require("../sockets/feedSocket");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { containsProfanity } = require("../utils/profanityFilter");
const { uploadBuffer, deleteImage } = require("../config/cloudinary");

// ---------------- Posts ----------------

async function createPost(req, res, next) {
  try {
    const { title, titleNe, body, bodyNe, category, isPinned, status } = req.body;
    const resolvedStatus = status === "draft" ? "draft" : "published";

    // multipart form fields arrive as strings, not real booleans
    const resolvedIsPinned = isPinned === true || isPinned === "true";

    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, "civimap/feed");
      imageUrl = uploaded.url;
      imagePublicId = uploaded.publicId;
    }

    const post = await Post.create({
      title,
      titleNe: titleNe || null,
      body,
      bodyNe: bodyNe || null,
      category,
      imageUrl,
      imagePublicId, // NOTE: only persists if Post schema declares this field — see flag above
      isPinned: resolvedIsPinned,
      status: resolvedStatus,
      publishedAt: resolvedStatus === "published" ? new Date() : null,
      createdBy: req.account._id,
    });

    if (resolvedStatus === "published") {
      feedService.notifyNewPost(post).catch((err) =>
        logger.jobFailure("notifyNewPost failed", { error: err.message })
      );
    }

    return ApiResponse.created(res, { post }, "Post created");
  } catch (err) {
    next(err);
  }
}

// Citizen-facing feed — published posts only.
async function listPublishedPosts(req, res, next) {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const filters = { status: "published" };
    if (category) filters.category = category;

    const [posts, total] = await Promise.all([
      Post.find(filters)
        .sort({ isPinned: -1, publishedAt: -1, createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate("createdBy", "fullName"),
      Post.countDocuments(filters),
    ]);

    return ApiResponse.ok(res, { posts, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
}

// Admin-facing feed — includes drafts, for the management page.
async function listAllPosts(req, res, next) {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (category) filters.category = category;

    const [posts, total] = await Promise.all([
      Post.find(filters)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate("createdBy", "fullName"),
      Post.countDocuments(filters),
    ]);

    return ApiResponse.ok(res, { posts, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
}

async function getPost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id).populate("createdBy", "fullName");
    if (!post) throw ApiError.notFound("Post not found");

    const isAdmin = !!req.account.role;

    if (post.status !== "published" && !isAdmin) {
      throw ApiError.notFound("Post not found");
    }

    if (!isAdmin) {
      post.viewCount += 1;
      await post.save();
    }

    return ApiResponse.ok(res, { post });
  } catch (err) {
    next(err);
  }
}

// UPDATED: previously did a blind Object.assign(post, req.body), which
// worked fine for a JSON payload but breaks with multipart form data:
//   - isPinned / commentsDisabled arrive as the strings "true"/"false"
//     (a non-empty string is always truthy, so unpinning/re-enabling
//     comments would have silently stopped working)
//   - image replacement/removal needs explicit handling — imageUrl can't
//     just be blindly copied from req.body anymore, since the new image
//     may have come in as a file (req.file) rather than a URL string
// Everything else keeps the original Object.assign behavior.
async function updatePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound("Post not found");

    const wasPublished = post.status === "published";

    const { isPinned, commentsDisabled, removeImage, titleNe, bodyNe, ...rest } = req.body;

    Object.assign(post, rest);
    if (titleNe !== undefined) post.titleNe = titleNe.trim() ? titleNe : null;
    if (bodyNe !== undefined) post.bodyNe = bodyNe.trim() ? bodyNe : null;
    if (isPinned !== undefined) post.isPinned = isPinned === true || isPinned === "true";
    if (commentsDisabled !== undefined) {
      post.commentsDisabled = commentsDisabled === true || commentsDisabled === "true";
    }

    // Image replacement/removal. A new file always wins over an explicit
    // removeImage flag. NOTE: old-image cleanup only fires if the Post
    // schema actually has imagePublicId — see flag above.
    if (req.file) {
      const oldPublicId = post.imagePublicId;
      const uploaded = await uploadBuffer(req.file.buffer, "civimap/feed");
      post.imageUrl = uploaded.url;
      post.imagePublicId = uploaded.publicId;
      if (oldPublicId) deleteImage(oldPublicId).catch(() => {});
    } else if (removeImage === "true" || removeImage === true) {
      if (post.imagePublicId) deleteImage(post.imagePublicId).catch(() => {});
      post.imageUrl = null;
      post.imagePublicId = null;
    }

    if (!wasPublished && post.status === "published" && !post.publishedAt) {
      post.publishedAt = new Date();
    }
    post.editedAt = new Date();

    await post.save();

    if (!wasPublished && post.status === "published") {
      feedService.notifyNewPost(post).catch((err) =>
        logger.jobFailure("notifyNewPost failed", { error: err.message })
      );
    } else {
      try {
        feedSocket.emitFeedPostUpdated(getIO(), post);
      } catch (err) {
        logger.jobFailure("Socket emit failed for feed:post_updated", { error: err.message });
      }
    }

    return ApiResponse.ok(res, { post }, "Post updated");
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound("Post not found");

    if (post.imagePublicId) deleteImage(post.imagePublicId).catch(() => {});

    await Comment.deleteMany({ post: post._id });
    await post.deleteOne();

    try {
      feedSocket.emitFeedPostDeleted(getIO(), post._id);
    } catch (err) {
      logger.jobFailure("Socket emit failed for feed:post_deleted", { error: err.message });
    }

    return ApiResponse.ok(res, null, "Post deleted");
  } catch (err) {
    next(err);
  }
}

async function toggleLike(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound("Post not found");

    const userId = req.account._id;
    const alreadyLiked = post.likedBy.some((id) => id.equals(userId));

    if (alreadyLiked) {
      post.likedBy = post.likedBy.filter((id) => !id.equals(userId));
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      post.likedBy.push(userId);
      post.likeCount += 1;
    }

    await post.save();

    return ApiResponse.ok(res, { liked: !alreadyLiked, likeCount: post.likeCount });
  } catch (err) {
    next(err);
  }
}

// ---------------- Comments ----------------

async function listComments(req, res, next) {
  try {
    const comments = await Comment.find({ post: req.params.id, isHidden: false })
      .sort({ createdAt: 1 })
      .populate("author", "fullName");

    return ApiResponse.ok(res, { comments });
  } catch (err) {
    next(err);
  }
}

async function addComment(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw ApiError.notFound("Post not found");
    if (post.commentsDisabled) throw ApiError.badRequest("Comments are disabled on this post");

    const { body, parentComment } = req.body;

    if (containsProfanity(body)) {
      throw ApiError.badRequest("Your comment contains inappropriate language and wasn't posted.");
    }

    if (parentComment) {
      const parent = await Comment.findOne({ _id: parentComment, post: post._id });
      if (!parent) throw ApiError.notFound("Parent comment not found");
      if (parent.parentComment) throw ApiError.badRequest("Cannot reply to a reply");
    }

    const comment = await Comment.create({
      post: post._id,
      author: req.account._id,
      parentComment: parentComment || null,
      body,
    });

    post.commentCount += 1;
    await post.save();

    const populated = await comment.populate("author", "fullName");

    try {
      feedSocket.emitFeedNewComment(getIO(), post._id, populated);
    } catch (err) {
      logger.jobFailure("Socket emit failed for feed:new_comment", { error: err.message });
    }

    return ApiResponse.created(res, { comment: populated }, "Comment added");
  } catch (err) {
    next(err);
  }
}

async function deleteOwnComment(req, res, next) {
  try {
    const comment = await Comment.findOne({ _id: req.params.id, author: req.account._id });
    if (!comment) throw ApiError.notFound("Comment not found");

    await comment.deleteOne();
    await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });

    return ApiResponse.ok(res, null, "Comment deleted");
  } catch (err) {
    next(err);
  }
}

async function adminDeleteComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw ApiError.notFound("Comment not found");

    await comment.deleteOne();
    await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });

    return ApiResponse.ok(res, null, "Comment removed");
  } catch (err) {
    next(err);
  }
}

async function flagComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw ApiError.notFound("Comment not found");

    const userId = req.account._id;
    if (!comment.flaggedBy.some((id) => id.equals(userId))) {
      comment.flaggedBy.push(userId);
      comment.flagCount += 1;
      await comment.save();
    }

    return ApiResponse.ok(res, null, "Comment flagged for review");
  } catch (err) {
    next(err);
  }
}

async function hideComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw ApiError.notFound("Comment not found");

    comment.isHidden = true;
    await comment.save();

    return ApiResponse.ok(res, null, "Comment hidden");
  } catch (err) {
    next(err);
  }
}

async function listFlaggedComments(req, res, next) {
  try {
    const comments = await Comment.find({ flagCount: { $gt: 0 }, isHidden: false })
      .sort({ flagCount: -1, createdAt: -1 })
      .populate("author", "fullName")
      .populate("post", "title");

    return ApiResponse.ok(res, { comments });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPost,
  listPublishedPosts,
  listAllPosts,
  getPost,
  updatePost,
  deletePost,
  toggleLike,
  listComments,
  addComment,
  deleteOwnComment,
  adminDeleteComment,
  flagComment,
  hideComment,
  listFlaggedComments,
};