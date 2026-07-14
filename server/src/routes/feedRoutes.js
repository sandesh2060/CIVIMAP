const express = require("express");
const feedController = require("../controllers/feedController");
const { protect, citizenOnly, adminOnly } = require("../middleware/auth");
const { uploadSingleImage } = require("../middleware/upload");
const validate = require("../middleware/validate");
const { createPostSchema, updatePostSchema, commentSchema } = require("../validators/feedValidators");

const router = express.Router();

// Posts
router.get("/posts", protect, citizenOnly, feedController.listPublishedPosts);
router.get("/posts/admin", protect, adminOnly(), feedController.listAllPosts);
router.get("/posts/:id", protect, feedController.getPost);
router.post(
  "/posts",
  protect,
  adminOnly(),
  uploadSingleImage("image"), // must run before validate() so it parses the multipart body into req.body/req.file
  validate(createPostSchema),
  feedController.createPost
);
router.patch(
  "/posts/:id",
  protect,
  adminOnly(),
  uploadSingleImage("image"),
  validate(updatePostSchema),
  feedController.updatePost
);
router.delete("/posts/:id", protect, adminOnly(), feedController.deletePost);
router.post("/posts/:id/like", protect, citizenOnly, feedController.toggleLike);

// Comments
router.get("/posts/:id/comments", protect, feedController.listComments);
router.post("/posts/:id/comments", protect, citizenOnly, validate(commentSchema), feedController.addComment);
router.delete("/comments/:id", protect, citizenOnly, feedController.deleteOwnComment);
router.delete("/comments/:id/admin", protect, adminOnly(), feedController.adminDeleteComment);
router.post("/comments/:id/flag", protect, citizenOnly, feedController.flagComment);
router.patch("/comments/:id/hide", protect, adminOnly(), feedController.hideComment);
router.get("/comments/flagged", protect, adminOnly(), feedController.listFlaggedComments);

module.exports = router;