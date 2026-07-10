// ========================================================================
// FILE : server/src/index.js
// ========================================================================

const { validateEnv } = require("./config/env");
validateEnv(); // fail fast if required env vars are missing

const { start } = require("./server");
const logger = require("./utils/logger");

(async () => {
  try {
    // start() (in server.js) already awaits connectDB() as its first step
    // before touching sockets/workers/listen — no need to connect here
    // too. The previous duplicate connectDB() call here, combined with
    // server.js also auto-invoking start() at import time, was what
    // caused start() (and therefore connectDB(), initSockets(), and
    // httpServer.listen()) to run twice per process boot.
    await start();
  } catch (err) {
    logger.error("Fatal error during startup", { error: err.message });
    process.exit(1);
  }
})();