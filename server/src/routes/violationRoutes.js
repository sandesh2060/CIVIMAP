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

// NEW: runs AI plate detection synchronously on a cropped photo BEFORE a
// Violation record exists, so the citizen can see and confirm/correct
// the read before anything is submitted. Reuses the same upload
// middleware and rate limiter as the real submit route since it does
// real work (Cloudinary upload + AI call) and should be protected the
// same way — a citizen could otherwise hit this repeatedly as a free
// OCR service.
router.post(
  "/detect-preview",
  protect,
  citizenOnly,
  violationSubmitLimiter,
  uploadSingleImage("image"),
  violationController.detectPreview
);

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