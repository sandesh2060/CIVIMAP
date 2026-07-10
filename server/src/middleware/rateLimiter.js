// ========================================================================
// FILE : server/src/middleware/rateLimiter.js  (FULL FILE — replace existing)
// ========================================================================

const rateLimit = require("express-rate-limit");

const baseHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests, please try again later.",
  });
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: baseHandler,
});

const reportSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: baseHandler,
  keyGenerator: (req) => req.account?.id || req.ip,
});

const violationSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: baseHandler,
  keyGenerator: (req) => req.account?.id || req.ip,
});

// Generous enough not to block someone in a genuine fast-moving emergency,
// but enough to stop automated abuse of a channel that pages a real department.
const emergencyAlertLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: baseHandler,
  keyGenerator: (req) => req.account?.id || req.ip,
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: baseHandler,
});

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: baseHandler,
  keyGenerator: (req) => req.body?.identifier || req.ip,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: baseHandler,
  keyGenerator: (req) => req.body?.identifier || req.ip,
});

module.exports = {
  authLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  reportSubmitLimiter,
  violationSubmitLimiter,
  emergencyAlertLimiter,
  globalLimiter,
};