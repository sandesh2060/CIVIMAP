// ========================================================================
// FILE : server/src/services/feedService.js
// ========================================================================
const Notification = require("../models/Notification");
const User = require("../models/User");
const { getIO } = require("../sockets");
const feedSocket = require("../sockets/feedSocket");
const logger = require("../utils/logger");

// Fan out a "new post" notification to every active citizen, the same
// insertMany + single socket emit pattern as broadcastToAllCitizens in
// notificationService.js.
async function notifyNewPost(post) {
  const citizens = await User.find({
    isActive: true,
    isBanned: false,
    isDeleted: false,
  }).select("_id");

  if (citizens.length > 0) {
    const docs = citizens.map((c) => ({
      recipient: c._id,
      type: "new_feed_post",
      title: "New post",
      message: post.title,
      relatedPost: post._id,
    }));

    try {
      await Notification.insertMany(docs);
    } catch (err) {
      logger.jobFailure("Failed to fan out new_feed_post notifications", { error: err.message });
    }
  }

  try {
    feedSocket.emitFeedNewPost(getIO(), post);
  } catch (err) {
    logger.jobFailure("Socket emit failed for feed:new_post", { error: err.message });
  }
}

module.exports = { notifyNewPost };