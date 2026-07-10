// ========================================================================
// FILE : server/src/jobs/queue.js
// ========================================================================

const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const { env } = require("../config/env");

// maxRetriesPerRequest: null is required by BullMQ's blocking connection usage.
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 500,
  removeOnFail: 1000,
};

const reportQueue = new Queue("report-verification", { connection, defaultJobOptions });
const violationQueue = new Queue("violation-detection", { connection, defaultJobOptions });

async function enqueueReportVerification(reportId) {
  return reportQueue.add("verify-report", { reportId });
}

async function enqueueViolationDetection(violationId) {
  return violationQueue.add("detect-violation", { violationId });
}

module.exports = {
  connection,
  reportQueue,
  violationQueue,
  enqueueReportVerification,
  enqueueViolationDetection,
};