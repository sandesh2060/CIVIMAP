// ========================================================================
// FILE : server/src/routes/notificationRoutes.js
// ========================================================================

const express = require("express");
const notificationController = require("../controllers/notificationController");
const { protect, citizenOnly, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { broadcastSchema } = require("../validators/notificationValidators");

const router = express.Router();

router.get("/", protect, citizenOnly, notificationController.myNotifications);
router.get("/unread-count", protect, citizenOnly, notificationController.unreadCount);
router.patch("/:id/read", protect, citizenOnly, notificationController.markRead);
router.patch("/read-all", protect, citizenOnly, notificationController.markAllRead);

router.post(
  "/broadcast",
  protect,
  adminOnly(),
  validate(broadcastSchema),
  notificationController.broadcast
);

module.exports = router;