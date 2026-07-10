// ========================================================================
// FILE : server/src/sockets/signalSocket.js
// ========================================================================

const TrafficSignal = require("../models/TrafficSignal");
const logger = require("../utils/logger");

/**
 * Runs an in-memory tick loop, once per second, advancing every mock
 * signal's countdown and broadcasting the new state. This is the ONLY
 * place that changes when real hardware is introduced (README section
 * 5, "Signal Countdown" flow) — it would read from a hardware feed
 * instead of calling signal.tick(), and emit the identical event shape.
 */
function registerSignalSocket(io) {
  let cache = [];

  async function loadSignals() {
    cache = await TrafficSignal.find({ isActive: true, isMock: true });
  }

  loadSignals().catch((err) =>
    logger.error("Failed to load traffic signals for simulator", { error: err.message })
  );

  // Reload from DB periodically in case admins add/remove signals.
  setInterval(() => {
    loadSignals().catch((err) =>
      logger.error("Failed to refresh traffic signals", { error: err.message })
    );
  }, 60 * 1000);

  setInterval(async () => {
    for (const signal of cache) {
      signal.tick();
      io.emit("signal:update", {
        signalId: signal.signalId,
        state: signal.currentState,
        countdownSeconds: signal.countdownSeconds,
      });
    }

    // Persist every 5 seconds instead of every tick, to avoid hammering
    // Mongo with a write per signal per second.
    if (Date.now() % 5000 < 1000) {
      await Promise.allSettled(cache.map((s) => s.save()));
    }
  }, 1000);
}

module.exports = registerSignalSocket;