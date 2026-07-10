// ========================================================================
// FILE : server/src/controllers/violationController.js
// ========================================================================

const Violation = require("../models/Violation");
const User = require("../models/User");
const { uploadBuffer, deleteImage } = require("../config/cloudinary");
const { enqueueViolationDetection } = require("../jobs/queue");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

async function createViolation(req, res, next) {
  try {
    if (!req.file) throw ApiError.badRequest("A photo is required");

    const { violationType, location } = req.body;
    const loc = typeof location === "string" ? JSON.parse(location) : location;

    const { url, publicId } = await uploadBuffer(req.file.buffer, "civimap/violations");

    const violation = await Violation.create({
      reportedBy: req.account._id,
      imageUrl: url,
      imagePublicId: publicId,
      violationType,
      location: { type: "Point", coordinates: [loc.lng, loc.lat] },
    });

    enqueueViolationDetection(violation._id).catch((err) =>
      logger.jobFailure("Failed to enqueue violation detection", {
        violationId: violation._id,
        error: err.message,
      })
    );

    return ApiResponse.created(res, { violation });
  } catch (err) {
    next(err);
  }
}

async function listViolations(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const filters = { isDeleted: false };
    if (status) filters.status = status;

    const skip = (page - 1) * limit;
    const [violations, total] = await Promise.all([
      Violation.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Violation.countDocuments(filters),
    ]);

    return ApiResponse.ok(res, {
      violations,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    next(err);
  }
}

async function getViolation(req, res, next) {
  try {
    const violation = await Violation.findOne({ _id: req.params.id, isDeleted: false });
    if (!violation) throw ApiError.notFound("Violation not found");
    return ApiResponse.ok(res, { violation });
  } catch (err) {
    next(err);
  }
}

async function myViolations(req, res, next) {
  try {
    const violations = await Violation.find({
      reportedBy: req.account._id,
      isDeleted: false,
    }).sort({ createdAt: -1 });
    return ApiResponse.ok(res, { violations });
  } catch (err) {
    next(err);
  }
}

async function reviewViolation(req, res, next) {
  try {
    const { decision, rejectionReason } = req.body;
    const violation = await Violation.findOne({ _id: req.params.id, isDeleted: false });
    if (!violation) throw ApiError.notFound("Violation not found");

    if (decision === "confirmed") {
      await violation.adminConfirm(req.account._id);

      // Admin manually confirmed a flagged/low-confidence match — send
      // notifications now, same as the automatic high-confidence path.
      const notifications = require("../notifications");
      const dispatchResults = await notifications.dispatchViolationNotifications(violation);
      violation.notificationChannels = dispatchResults;
      await violation.save();

      await User.findByIdAndUpdate(violation.reportedBy, {
        $inc: { "stats.violationsConfirmed": 1 },
      });
    } else {
      await violation.adminReject(req.account._id, rejectionReason);
      await User.findByIdAndUpdate(violation.reportedBy, {
        $inc: { "stats.violationsRejected": 1 },
      });
    }

    return ApiResponse.ok(res, { violation });
  } catch (err) {
    next(err);
  }
}

async function deleteViolation(req, res, next) {
  try {
    const violation = await Violation.findOne({ _id: req.params.id, isDeleted: false });
    if (!violation) throw ApiError.notFound("Violation not found");

    violation.isDeleted = true;
    violation.deletedAt = new Date();
    await violation.save();
    await deleteImage(violation.imagePublicId);

    return ApiResponse.ok(res, null, "Violation deleted");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createViolation,
  listViolations,
  getViolation,
  myViolations,
  reviewViolation,
  deleteViolation,
};