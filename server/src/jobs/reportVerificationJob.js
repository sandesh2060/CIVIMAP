// ========================================================================
// FILE : server/src/jobs/reportVerificationJob.js
// ========================================================================

const { Worker } = require("bullmq");
const { connection } = require("./queue");
const Report = require("../models/Report");
const User = require("../models/User");
const aiServiceClient = require("../utils/aiServiceClient");
const notifications = require("../notifications");
const logger = require("../utils/logger");
const { env } = require("../config/env");

async function processReportVerification(job) {
  const { reportId } = job.data;
  const report = await Report.findById(reportId);
  if (!report) {
    logger.jobFailure("Report not found, skipping", { reportId });
    return;
  }

  let aiResult;
  try {
    aiResult = await aiServiceClient.verifyRoadDamage(report.imageUrl);
  } catch (err) {
    // AI service failure must NOT silently drop the report — fall back
    // to manual review rather than losing the submission (README section 16).
    await report.markFlagged({ error: err.message });
    logger.jobFailure("AI verification call failed, flagged for manual review", {
      reportId,
      error: err.message,
    });
    return;
  }

  const { confidence, label, flagForReview } = aiResult;
  const user = await User.findById(report.reportedBy);

  if (!flagForReview && confidence >= env.AI_CONFIDENCE_THRESHOLD) {
    await report.markApproved({ confidence, label });
    if (user) {
      user.stats.reportsApproved += 1;
      await user.adjustTrustScore(2);
    }

    try {
      const { getIO } = require("../sockets");
      getIO().emit("report:new", { report });
    } catch (err) {
      logger.jobFailure("Socket emit failed for report:new", { reportId, error: err.message });
    }
  } else {
    await report.markFlagged({ confidence, label });
  }

  if (user && report.status !== "pending") {
    await notifications.dispatchReportStatusNotification(report, user);
  }
}

const reportVerificationWorker = new Worker("report-verification", processReportVerification, {
  connection,
  concurrency: 5,
});

reportVerificationWorker.on("failed", (job, err) => {
  logger.jobFailure("reportVerificationWorker job failed", {
    jobId: job?.id,
    error: err.message,
  });
});

module.exports = reportVerificationWorker;