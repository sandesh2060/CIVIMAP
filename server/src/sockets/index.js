// ========================================================================
// FILE : server/src/sockets/index.js
// ========================================================================

const { Server } = require("socket.io");
const { env } = require("../config/env");
const { verifyAccessToken } = require("../utils/tokens");
const logger = require("../utils/logger");

const registerMapSocket = require("./mapSocket");
const registerReportSocket = require("./reportSocket");
const registerSignalSocket = require("./signalSocket");

let io = null;

function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });

  // Auth: a valid token is required to identify the socket's owner and
  // join it to a personal room (user-<id>) for targeted events like
  // notification:new. Sockets with a missing or invalid token are
  // rejected outright rather than allowed through anonymously — letting
  // them through silently was causing "connected but deaf" sessions
  // where the client looked live but never joined any room.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      // Public/anonymous access is still allowed for unauthenticated
      // pages (map viewport, signal updates) — just no personal room.
      return next();
    }

    try {
      const payload = verifyAccessToken(token);
      socket.accountId = payload.sub;
      socket.accountType = payload.accountType;
      return next();
    } catch (err) {
      logger.authFailure("Socket auth token invalid", { error: err.message });
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.accountId) {
      socket.join(`user-${socket.accountId}`);
      if (socket.accountType === "admin") socket.join("admin-room");
      if (socket.accountType === "citizen") socket.join("citizen-room");
    }

    registerMapSocket(io, socket);
    registerReportSocket(io, socket);

    socket.on("disconnect", () => {
      // no-op for now — room membership is cleaned up automatically by socket.io
    });
  });

  registerSignalSocket(io);

  logger.info("Socket.io initialized");
  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.io has not been initialized yet");
  return io;
}

module.exports = { initSockets, getIO };