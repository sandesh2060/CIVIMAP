// ========================================================================
// FILE : server/src/services/emergencyService.js
// ========================================================================

const EmergencyContact = require("../models/EmergencyContact");
const EmergencyAlert = require("../models/EmergencyAlert");
const notifications = require("../notifications");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

async function createAndDispatchAlert({ citizen, category, location, note }) {
  const contact = await EmergencyContact.findForDispatch(category, citizen.address || {});

  if (!contact) {
    logger.notificationFailure("No EmergencyContact configured for category", { category });
    throw ApiError.internal(
      `No ${category} department is currently configured to receive alerts. Please call emergency services directly.`
    );
  }

  const alert = await EmergencyAlert.create({
    reportedBy: citizen._id,
    category,
    location,
    note: note || null,
    contactedDepartment: contact._id,
    status: "dispatched",
  });

  const dispatchResult = await notifications.dispatchEmergencyAlert(alert, contact, citizen);

  alert.channelsUsed = dispatchResult.channelsUsed;
  if (!dispatchResult.channelsUsed.length) {
    await alert.markDispatchFailed(dispatchResult.reason || "No channel succeeded");
  } else {
    await alert.save();
  }

  return { alert, channelsUsed: dispatchResult.channelsUsed, contact };
}

async function resolveAlert(alertId, resolver, resolverType) {
  const alert = await EmergencyAlert.findById(alertId);
  if (!alert) throw ApiError.notFound("Emergency alert not found");

  const isOwner = alert.reportedBy.equals(resolver._id);
  if (resolverType !== "admin" && !isOwner) {
    throw ApiError.forbidden("Not authorized to resolve this alert");
  }

  await alert.markResolved(resolver._id, resolverType);

  try {
    const { getIO } = require("../sockets");
    const io = getIO();
    io.to("admin-room").emit("emergency:statusChanged", { alertId: alert._id, status: alert.status });
    io.to(`user-${alert.reportedBy}`).emit("emergency:statusChanged", {
      alertId: alert._id,
      status: alert.status,
    });
  } catch (err) {
    logger.notificationFailure("Socket push failed for emergency:statusChanged", {
      alertId: alert._id,
      error: err.message,
    });
  }

  return alert;
}

module.exports = { createAndDispatchAlert, resolveAlert };