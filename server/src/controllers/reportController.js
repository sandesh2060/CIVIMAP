// ========================================================================
// FILE : server/src/controllers/reportController.js
// ========================================================================

const Report = require("../models/Report");
const User = require("../models/User");
const { uploadBuffer, deleteImage } = require("../config/cloudinary");
const { enqueueReportVerification } = require("../jobs/queue");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");


async function createReport(req, res, next) {
  try {
    if (!req.file) throw ApiError.badRequest("A photo is required");

    const { description, category, location } = req.body;
    const loc = typeof location === "string" ? JSON.parse(location) : location;

    const { url, publicId } = await uploadBuffer(req.file.buffer, "civimap/reports");

    const report = await Report.create({
      reportedBy: req.account._id,
      imageUrl: url,
      imagePublicId: publicId,
      description,
      category,
      location: { type: "Point", coordinates: [loc.lng, loc.lat] },
    });

    await User.findByIdAndUpdate(req.account._id, {
      $inc: { "stats.reportsSubmitted": 1 },
    });

    enqueueReportVerification(report._id).catch((err) =>
      logger.jobFailure("Failed to enqueue report verification", {
        reportId: report._id,
        error: err.message,
      })
    );

    return ApiResponse.created(res, { report });
  } catch (err) {
    next(err);
  }
}

async function listReports(req, res, next) {
  try {
    const { status, bbox, page, limit } = req.query;
    const filters = { isDeleted: false };
    if (status) filters.status = status;

    const query = bbox
      ? Report.findWithinBounds(bbox.split(",").map(Number), filters)
      : Report.find(filters);

    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      query.clone().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Report.countDocuments(filters),
    ]);

    return ApiResponse.ok(res, { reports, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
}

async function getReport(req, res, next) {
  try {
    const report = await Report.findOne({ _id: req.params.id, isDeleted: false });
    if (!report) throw ApiError.notFound("Report not found");
    return ApiResponse.ok(res, { report });
  } catch (err) {
    next(err);
  }
}

async function myReports(req, res, next) {
  try {
    const reports = await Report.find({
      reportedBy: req.account._id,
      isDeleted: false,
    }).sort({ createdAt: -1 });
    return ApiResponse.ok(res, { reports });
  } catch (err) {
    next(err);
  }
}

async function reviewReport(req, res, next) {
  try {
    const { decision, rejectionReason } = req.body;
    const report = await Report.findOne({ _id: req.params.id, isDeleted: false });
    if (!report) throw ApiError.notFound("Report not found");

    if (decision === "approved") {
      await report.adminApprove(req.account._id);
      await User.findByIdAndUpdate(report.reportedBy, {
        $inc: { "stats.reportsApproved": 1 },
      });
    } else {
      await report.adminReject(req.account._id, rejectionReason);
      await User.findByIdAndUpdate(report.reportedBy, {
        $inc: { "stats.reportsRejected": 1 },
      });
    }

    const notifications = require("../notifications");
     const notificationService = require("../services/notificationService");
    const user = await User.findById(report.reportedBy);
    if (user) {
      await notifications.dispatchReportStatusNotification(report, user);
        await notificationService.notifyReportStatus(report, user, decision); 
    }

    return ApiResponse.ok(res, { report });
  } catch (err) {
    next(err);
  }
}

async function deleteReport(req, res, next) {
  try {
    const report = await Report.findOne({ _id: req.params.id, isDeleted: false });
    if (!report) throw ApiError.notFound("Report not found");

    report.isDeleted = true;
    report.deletedAt = new Date();
    await report.save();
    await deleteImage(report.imagePublicId);

    return ApiResponse.ok(res, null, "Report deleted");
  } catch (err) {
    next(err);
  }
}

module.exports = { createReport, listReports, getReport, myReports, reviewReport, deleteReport };