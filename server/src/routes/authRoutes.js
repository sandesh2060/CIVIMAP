// ========================================================================
// FILE : server/src/routes/authRoutes.js
// ========================================================================
const express = require("express");
const authController = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { authLimiter, otpRequestLimiter, otpVerifyLimiter } = require("../middleware/rateLimiter");
const { adminLoginSchema, otpRequestSchema, otpVerifySchema } = require("../validators/authValidators");

const router = express.Router();

router.post("/otp/request", otpRequestLimiter, validate(otpRequestSchema), authController.requestOtp);
router.post("/otp/verify", otpVerifyLimiter, validate(otpVerifySchema), authController.verifyOtp);
router.post("/admin/login", authLimiter, validate(adminLoginSchema), authController.adminLogin);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", protect, authController.getMe);

module.exports = router;