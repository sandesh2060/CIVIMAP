// ========================================================================
// FILE : server/src/jobs/violationDetectionJob.js
// ========================================================================

const { Worker } = require("bullmq");
const { connection } = require("./queue");
const Violation = require("../models/Violation");
const User = require("../models/User");
const MockVehicleRegistry = require("../models/MockVehicleRegistry");
const aiServiceClient = require("../utils/aiServiceClient");
const notifications = require("../notifications");
const logger = require("../utils/logger");
const { env } = require("../config/env");

async function processViolationDetection(job) {
  const { violationId } = job.data;
  const violation = await Violation.findById(violationId);
  if (!violation) {
    logger.jobFailure("Violation not found, skipping", { violationId });
    return;
  }

  let aiResult;
  try {
    aiResult = await aiServiceClient.detectPlate(violation.imageUrl);
  } catch (err) {
    // Never silently drop a violation on AI failure — always fall back
    // to manual admin review.
    await violation.markFlagged({ error: err.message });
    logger.jobFailure("AI plate detection failed, flagged for manual review", {
      violationId,
      error: err.message,
    });
    return;
  }

  // FIX: previously destructured `plateText` for registry matching.
  // plateText includes province/category text and stays in Devanagari
  // script — it was never going to reliably match a MockVehicleRegistry
  // entry. plateNumberDigits is the field the AI service's own contract
  // (see aiServiceClient.js JSDoc) says to use for matching; plateText is
  // still stored on the violation for display purposes only.
  const { plateText, plateNumberDigits, confidence, croppedImageUrl } = aiResult;
  violation.extractedPlateNumber = plateText || null;
  violation.croppedPlateImageUrl = croppedImageUrl || null;
  violation.aiConfidence = confidence;
  violation.aiProcessedAt = new Date();

  const user = await User.findById(violation.reportedBy);

  let registryMatch = null;
  if (plateNumberDigits) {
    registryMatch = await MockVehicleRegistry.findByPlate(plateNumberDigits);
  }

  const highConfidence = confidence >= env.AI_CONFIDENCE_THRESHOLD;

if (highConfidence && registryMatch) {
  violation.matchedOwner = {
    name: registryMatch.ownerName,
    phone: registryMatch.phone,
    email: registryMatch.email,
    vehicleType: registryMatch.vehicleType,
  };
  violation.matchedRegistryId = registryMatch._id;
  violation.matchedOwnerUserId = registryMatch.ownerUserId || null;
  await violation.save();

  const dispatchResults = await notifications.dispatchViolationNotifications(violation);
  violation.notificationChannels = dispatchResults;
  violation.status = "notified";
  violation.notifiedAt = new Date();
  await violation.save();

  if (violation.matchedOwnerUserId) {
    const notificationService = require("../services/notificationService");
    try {
      await notificationService.notifyOwnerMatchedViolation(violation);
    } catch (err) {
      logger.jobFailure("In-app notification failed for matched owner", {
        violationId,
        error: err.message,
      });
    }
  }

  if (user) {
    user.stats.violationsConfirmed += 1;
    await user.adjustTrustScore(3);
  }
}else {
    // Low confidence OR no registry match — never auto-notify (README
    // section 15: false accusations must be prevented by a human check).
    await violation.markFlagged({ confidence });

    try {
      const { getIO } = require("../sockets");
      getIO().to("admin-room").emit("violation:new", { violation });
    } catch (err) {
      logger.jobFailure("Socket emit failed for violation:new", {
        violationId,
        error: err.message,
      });
    }
  }

  if (user) {
    user.stats.violationsSubmitted += 1;
    await user.save({ validateBeforeSave: false });
  }
}

const violationDetectionWorker = new Worker("violation-detection", processViolationDetection, {
  connection,
  concurrency: 5,
});

violationDetectionWorker.on("failed", (job, err) => {
  logger.jobFailure("violationDetectionWorker job failed", {
    jobId: job?.id,
    error: err.message,
  });
});

module.exports = violationDetectionWorker;