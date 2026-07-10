// ========================================================================
// FILE : server/src/routes/reportRoutes.js
// ========================================================================

const express = require("express");
const reportController = require("../controllers/reportController");
const { protect, citizenOnly, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { uploadSingleImage } = require("../middleware/upload");
const { reportSubmitLimiter } = require("../middleware/rateLimiter");
const {
  createReportSchema,
  reviewReportSchema,
  listReportsQuerySchema,
} = require("../validators/reportValidators");

const router = express.Router();

router.post(
  "/",
  protect,
  citizenOnly,
  reportSubmitLimiter,
  uploadSingleImage("image"),
  validate(createReportSchema),
  reportController.createReport
);

router.get("/", validate(listReportsQuerySchema, "query"), reportController.listReports);
router.get("/mine", protect, citizenOnly, reportController.myReports);
router.get("/:id", reportController.getReport);

router.patch(
  "/:id/review",
  protect,
  adminOnly("canReviewReports"),
  validate(reviewReportSchema),
  reportController.reviewReport
);

router.delete("/:id", protect, adminOnly(), reportController.deleteReport);

module.exports = router;