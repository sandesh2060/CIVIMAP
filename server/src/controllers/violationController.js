// ========================================================================
// FILE : server/src/controllers/violationController.js
// ========================================================================

const Violation = require("../models/Violation");
const User = require("../models/User");
const MockVehicleRegistry = require("../models/MockVehicleRegistry");
const { uploadBuffer, deleteImage } = require("../config/cloudinary");
const { enqueueViolationDetection } = require("../jobs/queue");
const aiServiceClient = require("../utils/aiServiceClient");
const notifications = require("../notifications");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { env } = require("../config/env");

const REPORTER_FIELDS = "fullName phone email";

async function detectPreview(req, res, next) {
  try {
    if (!req.file) throw ApiError.badRequest("A photo is required");

    const { url, publicId } = await uploadBuffer(req.file.buffer, "civimap/violations");

    try {
      const aiResult = await aiServiceClient.detectPlate(url);
      return ApiResponse.ok(res, {
        imageUrl: url,
        imagePublicId: publicId,
        plateText: aiResult.plateText,
        confidence: aiResult.confidence,
        detectionFailed: false,
      });
    } catch (err) {
      logger.aiServiceError("detectPlate preview failed", {
        imageUrl: url,
        error: err.message,
      });
      return ApiResponse.ok(res, {
        imageUrl: url,
        imagePublicId: publicId,
        plateText: null,
        confidence: 0,
        detectionFailed: true,
      });
    }
  } catch (err) {
    next(err);
  }
}

async function createViolation(req, res, next) {
  try {
    const {
      violationType,
      location,
      previewImageUrl,
      previewImagePublicId,
      confirmedPlateNumber,
      confirmedConfidence,
    } = req.body;
    const loc = typeof location === "string" ? JSON.parse(location) : location;

    let url, publicId;
    if (previewImageUrl && previewImagePublicId) {
      url = previewImageUrl;
      publicId = previewImagePublicId;
    } else {
      if (!req.file) throw ApiError.badRequest("A photo is required");
      ({ url, publicId } = await uploadBuffer(req.file.buffer, "civimap/violations"));
    }

    const violation = await Violation.create({
      reportedBy: req.account._id,
      imageUrl: url,
      imagePublicId: publicId,
      violationType,
      location: { type: "Point", coordinates: [loc.lng, loc.lat] },
    });

    if (confirmedPlateNumber) {
      violation.extractedPlateNumber = confirmedPlateNumber;
      violation.aiConfidence = Number(confirmedConfidence) || 0;
      violation.aiProcessedAt = new Date();

      const registryMatch = await MockVehicleRegistry.findByPlate(confirmedPlateNumber);

      if (registryMatch) {
        violation.matchedOwner = {
          name: registryMatch.ownerName,
          phone: registryMatch.phone,
          email: registryMatch.email,
          vehicleType: registryMatch.vehicleType,
        };
        violation.matchedRegistryId = registryMatch._id;
        violation.matchedOwnerUserId = registryMatch.ownerUserId || null;

        const isSelfReport =
          violation.matchedOwnerUserId &&
          String(violation.matchedOwnerUserId) === String(req.account._id);

        if (isSelfReport) {
          violation.status = "rejected";
          violation.rejectionReason = "Vehicle is registered under the reporting account.";
          violation.reviewedAt = new Date();
          await violation.save();

          await User.findByIdAndUpdate(req.account._id, {
            $inc: { "stats.violationsSubmitted": 1, "stats.violationsRejected": 1 },
          });

          return ApiResponse.created(
            res,
            { violation, selfReport: true },
            "This vehicle is registered under your own account, so it can't be reported — self-reports are rejected automatically."
          );
        }

        await violation.save();

        const dispatchResults = await notifications.dispatchViolationNotifications(violation);
        violation.notificationChannels = dispatchResults;
        violation.status = "notified";
        violation.notifiedAt = new Date();
        await violation.save();

        if (
          violation.matchedOwnerUserId &&
          String(violation.matchedOwnerUserId) !== String(violation.reportedBy)
        ) {
          const notificationService = require("../services/notificationService");
          await notificationService.notifyOwnerMatchedViolation(violation);
        }

        await User.findByIdAndUpdate(req.account._id, {
          $inc: { "stats.violationsConfirmed": 1, "stats.violationsSubmitted": 1 },
        });
      } else {
        await violation.markFlagged({ confidence: violation.aiConfidence });
        await User.findByIdAndUpdate(req.account._id, {
          $inc: { "stats.violationsSubmitted": 1 },
        });

        try {
          const { getIO } = require("../sockets");
          getIO().to("admin-room").emit("violation:new", { violation });
        } catch (err) {
          logger.jobFailure("Socket emit failed for violation:new", {
            violationId: violation._id,
            error: err.message,
          });
        }
      }
    } else {
      enqueueViolationDetection(violation._id).catch((err) =>
        logger.jobFailure("Failed to enqueue violation detection", {
          violationId: violation._id,
          error: err.message,
        })
      );
    }

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
      Violation.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("reportedBy", REPORTER_FIELDS),
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
    const violation = await Violation.findOne({ _id: req.params.id, isDeleted: false }).populate(
      "reportedBy",
      REPORTER_FIELDS
    );
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

      const dispatchResults = await notifications.dispatchViolationNotifications(violation);
      violation.notificationChannels = dispatchResults;
      await violation.save();

      await User.findByIdAndUpdate(violation.reportedBy, {
        $inc: { "stats.violationsConfirmed": 1 },
      });

      if (
        violation.matchedOwnerUserId &&
        String(violation.matchedOwnerUserId) !== String(violation.reportedBy)
      ) {
        const notificationService = require("../services/notificationService");
        await notificationService.notifyOwnerMatchedViolation(violation);
      }
    } else {
      await violation.adminReject(req.account._id, rejectionReason);
      await User.findByIdAndUpdate(violation.reportedBy, {
        $inc: { "stats.violationsRejected": 1 },
      });
    }
    const notificationService = require("../services/notificationService");
    const reporter = await User.findById(violation.reportedBy);
    if (reporter) await notificationService.notifyViolationStatus(violation, reporter, decision);

    const populated = await Violation.findById(violation._id).populate("reportedBy", REPORTER_FIELDS);

    return ApiResponse.ok(res, { violation: populated });
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
  detectPreview,
  createViolation,
  listViolations,
  getViolation,
  myViolations,
  reviewViolation,
  deleteViolation,
};