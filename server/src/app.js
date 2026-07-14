// ========================================================================
// FILE : server/src/app.js  (FULL FILE — replace existing)
// ========================================================================

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");

const { env } = require("./config/env");
const { globalLimiter } = require("./middleware/rateLimiter");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const reportRoutes = require("./routes/reportRoutes");
const violationRoutes = require("./routes/violationRoutes");
const placeRoutes = require("./routes/placeRoutes");
const signalRoutes = require("./routes/signalRoutes");
const mapRoutes = require("./routes/mapRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");
const feedRoutes = require("./routes/feedRoutes");

const app = express();
const isDev = env.NODE_ENV !== "production";

app.set("trust proxy", 1);

// helmet() with no options applies a strict default CSP that has no
// explicit worker-src directive, so it falls back to script-src for
// workers too — this blocks blob: workers (used by Vite HMR / some
// client libraries in dev). Explicitly allow blob: for both so dev
// tooling and any worker-based libraries function correctly.
//
// unsafe-inline / unsafe-eval are ONLY added in development (needed by
// Vite HMR). In production these are dropped: they'd otherwise let any
// injected script in user-submitted content (report descriptions,
// violation plate text, etc.) actually execute, which is exactly what
// CSP exists to prevent on an admin panel that renders that content.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "worker-src": ["'self'", "blob:"],
        "script-src": isDev
          ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"]
          : ["'self'", "blob:"],
      },
    },
  })
);
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

// Strips any request key starting with "$" or containing "." from
// req.body / req.query / req.params, e.g. { "status[$ne]": "pending" }
// or a raw { "$where": ... } body. Joi + stripUnknown already blocks
// this on every route that has a validate() schema — this is a global
// backstop in case a future route is added without one.
app.use(mongoSanitize());

app.use(globalLimiter);

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "CIVIMAP API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/violations", violationRoutes);
app.use("/api/places", placeRoutes);
app.use("/api/signals", signalRoutes);
app.use("/api", mapRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/feed", feedRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;