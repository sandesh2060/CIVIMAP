// ========================================================================
// FILE : server/src/controllers/notificationController.js
// ========================================================================

const Notification = require("../models/Notification");
const Broadcast = require("../models/Broadcast");
const notificationService = require("../services/notificationService");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

async function myNotifications(req, res, next) {
  try {
    const { unreadOnly, limit } = req.query;
    const filters = { recipient: req.account._id };
    if (unreadOnly === "true") filters.isRead = false;

    const notifications = await Notification.find(filters)
      .sort({ createdAt: -1 })
      .limit(limit ? Number(limit) : 30);

    const unreadCount = await Notification.unreadCountForUser(req.account._id);

    return ApiResponse.ok(res, { notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

async function unreadCount(req, res, next) {
  try {
    const unreadCount = await Notification.unreadCountForUser(req.account._id);
    return ApiResponse.ok(res, { unreadCount });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.account._id,
    });
    if (!notification) throw ApiError.notFound("Notification not found");

    await notification.markRead();
    return ApiResponse.ok(res, { notification });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await Notification.markAllReadForUser(req.account._id);
    return ApiResponse.ok(res, null, "All notifications marked read");
  } catch (err) {
    next(err);
  }
}

async function broadcast(req, res, next) {
  try {
    const { title, message, titleNe, messageNe, audience } = req.body;
    const resolvedAudience = audience === "admins" ? "admins" : "all";

    const result = await notificationService.broadcastNotification({
      title,
      message,
      titleNe,
      messageNe,
      audience: resolvedAudience,
    });

    // Log entry is best-effort — a logging failure shouldn't make the
    // (already-sent) broadcast look like it failed to the admin.
    try {
      await Broadcast.create({
        title,
        message,
        titleNe: resolvedAudience === "all" && titleNe ? titleNe : null,
        messageNe: resolvedAudience === "all" && messageNe ? messageNe : null,
        audience: resolvedAudience,
        recipientCount: result.recipientCount,
        sentBy: req.account._id,
      });
    } catch (logErr) {
      logger.jobFailure("Failed to write Broadcast history row", { error: logErr.message });
    }

    return ApiResponse.created(res, result, "Broadcast sent");
  } catch (err) {
    next(err);
  }
}

async function listBroadcasts(req, res, next) {
  try {
    const broadcasts = await Broadcast.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("sentBy", "fullName email");

    return ApiResponse.ok(res, { broadcasts });
  } catch (err) {
    next(err);
  }
}

async function deleteBroadcast(req, res, next) {
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    if (!broadcast) throw ApiError.notFound("Broadcast not found");

    await broadcast.deleteOne();
    return ApiResponse.ok(res, null, "Broadcast removed from history");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  myNotifications,
  unreadCount,
  markRead,
  markAllRead,
  broadcast,
  listBroadcasts,
  deleteBroadcast,
};