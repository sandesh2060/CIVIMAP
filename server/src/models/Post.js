// ========================================================================
// FILE : server/src/models/Post.js
// ========================================================================
const mongoose = require("mongoose");
const { Schema } = mongoose;

const PostSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    titleNe: { type: String, trim: true, maxlength: 150, default: null },
    body: { type: String, required: true, trim: true, maxlength: 3000 },
    bodyNe: { type: String, trim: true, maxlength: 3000, default: null },

    category: {
      type: String,
      enum: ["announcement", "road", "traffic", "safety", "maintenance", "other"],
      default: "announcement",
    },

    imageUrl: { type: String, default: null },

    status: { type: String, enum: ["draft", "published"], default: "published" },
    publishedAt: { type: Date, default: null },

    isPinned: { type: Boolean, default: false },
    commentsDisabled: { type: Boolean, default: false },

    likedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PostSchema.index({ isPinned: -1, publishedAt: -1, createdAt: -1 });
PostSchema.index({ status: 1 });

module.exports = mongoose.model("Post", PostSchema);