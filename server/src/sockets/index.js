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

  // Optional auth: if a token is provided, identify the socket's owner so
  // we can join it to a personal room (user-<id>) for targeted events like
  // report:statusChanged. Anonymous/unauthenticated sockets are still
  // allowed to join public rooms (map viewport, signal updates).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        socket.accountId = payload.sub;
        socket.accountType = payload.accountType;
      } catch (err) {
        logger.authFailure("Socket auth token invalid", { error: err.message });
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    if (socket.accountId) {
      socket.join(`user-${socket.accountId}`);
      if (socket.accountType === "admin") socket.join("admin-room");
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