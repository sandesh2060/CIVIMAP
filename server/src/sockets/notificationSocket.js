// ========================================================================
// FILE : server/src/sockets/notificationSocket.js
// ========================================================================

function emitNotificationNew(io, userId, notification) {
  io.to(`user-${userId}`).emit("notification:new", { notification });
}

// Lightweight signal to every connected citizen — the client refetches
// or shows a toast, rather than the server emitting N personalized events.
function emitNotificationBroadcast(io, payload) {
  io.to("citizen-room").emit("notification:new", { notification: payload });
}

module.exports = { emitNotificationNew, emitNotificationBroadcast };