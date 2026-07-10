// ========================================================================
// FILE : server/src/routes/violationRoutes.js
// ========================================================================

const express = require("express");
const violationController = require("../controllers/violationController");
const { protect, citizenOnly, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { uploadSingleImage } = require("../middleware/upload");
const { violationSubmitLimiter } = require("../middleware/rateLimiter");
const {
  createViolationSchema,
  reviewViolationSchema,
  listViolationsQuerySchema,
} = require("../validators/violationValidators");

const router = express.Router();

router.post(
  "/",
  protect,
  citizenOnly,
  violationSubmitLimiter,
  uploadSingleImage("image"),
  validate(createViolationSchema),
  violationController.createViolation
);

router.get(
  "/",
  protect,
  adminOnly(),
  validate(listViolationsQuerySchema, "query"),
  violationController.listViolations
);
router.get("/mine", protect, citizenOnly, violationController.myViolations);
router.get("/:id", protect, adminOnly(), violationController.getViolation);

router.patch(
  "/:id/review",
  protect,
  adminOnly("canReviewViolations"),
  validate(reviewViolationSchema),
  violationController.reviewViolation
);

router.delete("/:id", protect, adminOnly(), violationController.deleteViolation);

module.exports = router;