// ========================================================================
// FILE : server/src/controllers/notificationController.js
// ========================================================================

const Notification = require("../models/Notification");
const notificationService = require("../services/notificationService");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

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
    const { title, message } = req.body;
    const result = await notificationService.broadcastToAllCitizens({ title, message });
    return ApiResponse.created(res, result, "Broadcast sent");
  } catch (err) {
    next(err);
  }
}

module.exports = { myNotifications, unreadCount, markRead, markAllRead, broadcast };