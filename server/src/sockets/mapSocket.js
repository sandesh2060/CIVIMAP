// ========================================================================
// FILE : server/src/sockets/mapSocket.js
// ========================================================================

/**
 * Handles per-client map viewport subscriptions and place pin sync.
 * Clients join a room keyed by a coarse viewport identifier so
 * place:new/updated/deleted broadcasts don't need to be filtered
 * client-side against a rapidly-changing bbox.
 */
function registerMapSocket(io, socket) {
  socket.on("map:subscribeViewport", ({ bbox }) => {
    if (!Array.isArray(bbox) || bbox.length !== 4) return;
    const roomKey = viewportRoomKey(bbox);
    socket.join(roomKey);
    socket.currentViewportRoom = roomKey;
  });

  socket.on("map:unsubscribeViewport", () => {
    if (socket.currentViewportRoom) {
      socket.leave(socket.currentViewportRoom);
      socket.currentViewportRoom = null;
    }
  });
}

// Coarse rounding groups nearby viewports into the same room so we're not
// creating a unique room per pixel-perfect bbox.
function viewportRoomKey(bbox) {
  const rounded = bbox.map((n) => Math.round(n * 10) / 10);
  return `viewport-${rounded.join(",")}`;
}

/** Called by placeController after create/update/delete to broadcast to everyone. */
function broadcastPlaceEvent(io, event, place) {
  io.emit(event, { place }); // simplest correct behavior: broadcast globally
}

module.exports = registerMapSocket;
module.exports.broadcastPlaceEvent = broadcastPlaceEvent;