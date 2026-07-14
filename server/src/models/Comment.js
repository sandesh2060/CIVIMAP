// ========================================================================
// FILE : server/src/models/Comment.js
// ========================================================================
const mongoose = require("mongoose");
const { Schema } = mongoose;

const CommentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parentComment: { type: Schema.Types.ObjectId, ref: "Comment", default: null }, // one level of replies

    body: { type: String, required: true, trim: true, maxlength: 500 },

    isHidden: { type: Boolean, default: false }, // hidden by admin moderation
    flaggedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    flagCount: { type: Number, default: 0 },

    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CommentSchema.index({ post: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", CommentSchema);