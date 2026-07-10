// ========================================================================
// FILE : server/src/server.js
// ========================================================================

const http = require("http");
const app = require("./app");
const { env } = require("./config/env");
const { connectDB } = require("./config/db");
const { initSockets } = require("./sockets");
const logger = require("./utils/logger");

const httpServer = http.createServer(app);

async function start() {
  // Connect to MongoDB FIRST — sockets and job workers below both issue
  // queries on init/boot, and Mongoose silently buffers those queries
  // until a connection exists rather than failing fast. Without this
  // awaited call, every early query times out after 10s
  // ("buffering timed out") even though nothing is actually broken.
  await connectDB();

  // Starting the BullMQ workers here (by requiring them) so `npm run dev`
  // runs API + sockets + job processing in a single process, matching the
  // "Terminal 2 — Server (API + sockets + job worker)" setup in the README.
  // Required after connectDB() resolves, for the same reason as above.
  require("./jobs/reportVerificationJob");
  require("./jobs/violationDetectionJob");

  initSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`CIVIMAP server listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason: reason?.message || reason });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  httpServer.close(() => process.exit(0));
});

// NOTE: start() is intentionally NOT called here. This module only
// defines/exports it. index.js is the single entry point responsible for
// calling start() exactly once, after validateEnv(). Calling it here too
// (as before) caused start() to run twice — once as a side effect of
// `require("./server")`, and again explicitly from index.js — which
// double-initialized Socket.io on the same httpServer and attempted a
// second httpServer.listen() on an already-listening server, silently
// swallowed by the unhandledRejection handler above.

module.exports = { httpServer, start };