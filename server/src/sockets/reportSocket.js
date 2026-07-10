// ========================================================================
// FILE : server/src/sockets/reportSocket.js
// ========================================================================

/**
 * Report/violation events are mostly server-initiated (emitted from
 * jobs/* and notifications/* after AI processing), so there isn't much
 * for the client to actively send. This registers the admin-room join
 * for violation queue visibility and exposes emit helpers for reuse.
 */
function registerReportSocket(io, socket) {
  socket.on("admin:subscribeQueue", () => {
    if (socket.accountType === "admin") {
      socket.join("admin-room");
    }
  });
}

function emitReportNew(io, report) {
  io.emit("report:new", { report });
}

function emitReportStatusChanged(io, userId, reportId, status) {
  io.to(`user-${userId}`).emit("report:statusChanged", { reportId, status });
}

function emitViolationNew(io, violation) {
  io.to("admin-room").emit("violation:new", { violation });
}

function emitViolationNotified(io, violationId) {
  io.to("admin-room").emit("violation:notified", { violationId });
}

module.exports = registerReportSocket;
module.exports.emitReportNew = emitReportNew;
module.exports.emitReportStatusChanged = emitReportStatusChanged;
module.exports.emitViolationNew = emitViolationNew;
module.exports.emitViolationNotified = emitViolationNotified;