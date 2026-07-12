// ========================================================================
// FILE : server/src/routes/authRoutes.js
// ========================================================================
const express = require("express");
const authController = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { uploadSingleImage } = require("../middleware/upload");
const { authLimiter, otpRequestLimiter, otpVerifyLimiter } = require("../middleware/rateLimiter");
const {
  adminLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
  updateProfileSchema,
} = require("../validators/authValidators");

const router = express.Router();

router.post("/otp/request", otpRequestLimiter, validate(otpRequestSchema), authController.requestOtp);
router.post("/otp/verify", otpVerifyLimiter, validate(otpVerifySchema), authController.verifyOtp);
router.post("/admin/login", authLimiter, validate(adminLoginSchema), authController.adminLogin);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/logout-all", protect, authController.logoutAll);
router.get("/me", protect, authController.getMe);
router.patch("/me", protect, validate(updateProfileSchema), authController.updateProfile);

// No Joi validation here — these routes carry no body fields, only a
// multipart file (same pattern as violationRoutes' detect-preview).
router.post("/me/avatar", protect, uploadSingleImage("avatar"), authController.uploadAvatar);
router.delete("/me/avatar", protect, authController.removeAvatar);

module.exports = router;